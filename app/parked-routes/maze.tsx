import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { generateMaze } from "../api";

type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6371000;

// Debug mode: true shows the red geofence box and blue route.
// Later set this to false.
const SHOW_DEBUG_MAZE = false;

// Red box from your sketch: the maze arena.
const MAZE_BOUNDS = {
  north: 33.19745,
  south: 33.19635,
  west: -96.61745,
  east: -96.61435,
};

// Street-like invisible route inside the box.
// This follows straight segments with 90-degree-ish turns.
const FALLBACK_MAZE_PATH: LatLng[] = [
  // Enter from east side
  { latitude: 33.19702, longitude: -96.61435 },

  // Go west along E Virginia-ish
  { latitude: 33.19702, longitude: -96.61535 },

  // Turn south
  { latitude: 33.19648, longitude: -96.61535 },

  // Turn west
  { latitude: 33.19648, longitude: -96.61615 },

  // Turn north
  { latitude: 33.19705, longitude: -96.61615 },

  // Continue west to exit side
  { latitude: 33.19705, longitude: -96.61735 },
];

const STRONG_SIGNAL_M = 8;
const MEDIUM_SIGNAL_M = 18;
const WEAK_SIGNAL_M = 30;
const FAIL_DISTANCE_M = 42;
// Might want to take this out - dc 
const COLLAPSE_AFTER_SECONDS = 8;
const FINISH_DISTANCE_M = 20;

function insideMazeBounds(p: LatLng) {
  return (
    p.latitude <= MAZE_BOUNDS.north &&
    p.latitude >= MAZE_BOUNDS.south &&
    p.longitude >= MAZE_BOUNDS.west &&
    p.longitude <= MAZE_BOUNDS.east
  );
}

function mazeBoundsPolygon(): LatLng[] {
  return [
    { latitude: MAZE_BOUNDS.north, longitude: MAZE_BOUNDS.west },
    { latitude: MAZE_BOUNDS.north, longitude: MAZE_BOUNDS.east },
    { latitude: MAZE_BOUNDS.south, longitude: MAZE_BOUNDS.east },
    { latitude: MAZE_BOUNDS.south, longitude: MAZE_BOUNDS.west },
  ];
}

function haversine(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

function toXYMeters(point: LatLng, origin: LatLng) {
  const latRad = (origin.latitude * Math.PI) / 180;

  return {
    x:
      ((point.longitude - origin.longitude) *
        Math.PI *
        EARTH_RADIUS_M *
        Math.cos(latRad)) /
      180,
    y: ((point.latitude - origin.latitude) * Math.PI * EARTH_RADIUS_M) / 180,
  };
}

function distancePointToSegmentMeters(point: LatLng, a: LatLng, b: LatLng) {
  const p = toXYMeters(point, a);
  const start = toXYMeters(a, a);
  const end = toXYMeters(b, a);

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return haversine(point, a);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - start.x) * dx + (p.y - start.y) * dy) / (dx * dx + dy * dy)
    )
  );

  const closest = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  const ddx = p.x - closest.x;
  const ddy = p.y - closest.y;

  return Math.sqrt(ddx * ddx + ddy * ddy);
}

function distanceToPathMeters(point: LatLng, path: LatLng[]) {
  let best = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const d = distancePointToSegmentMeters(point, path[i], path[i + 1]);
    if (d < best) best = d;
  }

  return best;
}

function signalLabel(distanceFromPath: number | null, active: boolean) {
  if (!active) return "Waiting";
  if (distanceFromPath === null) return "Finding signal";
  if (distanceFromPath <= STRONG_SIGNAL_M) return "Strong pulse";
  if (distanceFromPath <= MEDIUM_SIGNAL_M) return "Medium pulse";
  if (distanceFromPath <= WEAK_SIGNAL_M) return "Weak pulse";
  return "Lost signal";
}

function hapticIntervalMs(distanceFromPath: number | null) {
  if (distanceFromPath === null) return null;
  if (distanceFromPath <= STRONG_SIGNAL_M) return 700;
  if (distanceFromPath <= MEDIUM_SIGNAL_M) return 1800;
  if (distanceFromPath <= WEAK_SIGNAL_M) return 3500;
  return null;
}

export default function MazeScreen() {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [mazeActive, setMazeActive] = useState(false);
  const [mazeComplete, setMazeComplete] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [offPathSeconds, setOffPathSeconds] = useState(0);
  const [mazePath, setMazePath] = useState<LatLng[]>(FALLBACK_MAZE_PATH);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastHapticRef = useRef(0);
  const hasActivatedRef = useRef(false);

  const insideBounds = loc ? insideMazeBounds(loc) : false;

  const distanceFromPath = useMemo(() => {
    if (!loc || !mazeActive || collapsed || mazeComplete) return null;
    return distanceToPathMeters(loc, mazePath);
  }, [loc, mazeActive, collapsed, mazeComplete]);

  const finishDistance = useMemo(() => {
    if (!loc) return null;
    return haversine(loc, mazePath[mazePath.length - 1]);
  }, [loc]);

  const tooFarFromPath =
    mazeActive &&
    !collapsed &&
    !mazeComplete &&
    distanceFromPath !== null &&
    distanceFromPath > FAIL_DISTANCE_M;

  const signal = signalLabel(distanceFromPath, mazeActive && !collapsed);

  useEffect(() => {
    let mounted = true;

    async function startLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Location needed", "Allow location to test the invisible maze.");
        return;
      }

      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!mounted) return;

      setLoc({
        latitude: first.coords.latitude,
        longitude: first.coords.longitude,
      });

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 3,
        },
        (p) => {
          if (!mounted) return;

          setLoc({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          });
        }
      );
    }

    startLocation();

    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, []);

  // Trigger maze once the player enters the red rectangular geofence.
  useEffect(() => {
    if (!insideBounds || hasActivatedRef.current || !loc) return;

    hasActivatedRef.current = true;

    async function activateMaze() {
    try {
      const res = await generateMaze({
        entry_latitude: loc.latitude,
        entry_longitude: loc.longitude,
        bounds: MAZE_BOUNDS,
      });
      console.log("Maze source:", res.source);
      console.log("Maze points:", res.path.length);
      setMazePath(res.path);
    } catch (err) {
      setMazePath(FALLBACK_MAZE_PATH);

    }


      setMazeActive(true);
      setCollapsed(false);
    setMazeComplete(false);
    setOffPathSeconds(0);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );

    Alert.alert("Maze activated", "Follow the vibration to the west side.");
    }

    activateMaze();
    }, [insideBounds, loc]);

  // Haptic signal: faster pulse means closer to the correct invisible route.
  useEffect(() => {
    if (!mazeActive || collapsed || mazeComplete) return;

    const intervalMs = hapticIntervalMs(distanceFromPath);
    if (!intervalMs) return;

    const now = Date.now();

    if (now - lastHapticRef.current >= intervalMs) {
      lastHapticRef.current = now;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [loc, mazeActive, collapsed, mazeComplete, distanceFromPath]);

  // Finish when player reaches the west-side endpoint.
  useEffect(() => {
    if (!mazeActive || collapsed || mazeComplete || finishDistance === null) return;

    if (finishDistance <= FINISH_DISTANCE_M) {
      setMazeComplete(true);
      setMazeActive(false);

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      Alert.alert("Maze complete", "You reached the other side.");
    }
  }, [mazeActive, collapsed, mazeComplete, finishDistance]);

  // Collapse when player stays too far from the invisible route.
  useEffect(() => {
    if (!mazeActive || collapsed || mazeComplete) return;

    const timer = setInterval(() => {
      setOffPathSeconds((prev) => {
        if (!tooFarFromPath) return 0;

        const next = prev + 1;

        if (next >= COLLAPSE_AFTER_SECONDS) {
          setCollapsed(true);
          setMazeActive(false);

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});

          Alert.alert("Maze collapsed", "You left the invisible route. Start over.");
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mazeActive, collapsed, mazeComplete, tooFarFromPath]);

  function resetMaze() {
    hasActivatedRef.current = false;
    setMazeActive(false);
    setMazeComplete(false);
    setCollapsed(false);
    setOffPathSeconds(0);
  }

  if (!loc) {
    return (
      <View style={styles.center}>
        <Text>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        followsUserLocation
        initialRegion={{
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
      >
        {SHOW_DEBUG_MAZE ? (
          <>
            <Polygon
              coordinates={mazeBoundsPolygon()}
              fillColor="rgba(255,0,0,0.10)"
              strokeColor="rgba(255,0,0,0.85)"
              strokeWidth={3}
            />

            <Polyline
              coordinates={mazePath}
              strokeWidth={5}
              strokeColor="rgba(0,180,0,0.9)"
            />
          </>
        ) : null}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.heading}>Invisible Maze</Text>

        <Text style={styles.status}>
          {mazeComplete
            ? "Maze complete"
            : collapsed
              ? "Maze collapsed"
              : mazeActive
                ? "Maze active"
                : insideBounds
                  ? "Inside maze zone"
                  : "Waiting for maze zone"}
        </Text>

        <Text style={styles.signal}>{signal}</Text>

        <Text style={styles.text}>
          Inside geofence: {insideBounds ? "yes" : "no"}
        </Text>

        <Text style={styles.text}>
          Distance from route:{" "}
          {distanceFromPath !== null ? `${distanceFromPath.toFixed(1)} m` : "--"}
        </Text>

        <Text style={styles.text}>
          Finish distance:{" "}
          {finishDistance !== null ? `${finishDistance.toFixed(1)} m` : "--"}
        </Text>

        <Text style={styles.text}>Off route: {offPathSeconds}s</Text>

        <Button title="Reset maze" onPress={resetMaze} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  panel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },

  heading: {
    fontSize: 22,
    fontWeight: "700",
  },

  status: {
    fontSize: 18,
    fontWeight: "700",
  },

  signal: {
    fontSize: 18,
  },

  text: {
    fontSize: 15,
  },
});
