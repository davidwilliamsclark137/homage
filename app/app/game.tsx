import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { uploadForm } from "../api";

type LatLng = { latitude: number; longitude: number };
type Target = {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;     // meters
  kind: "checkin" | "photo";
};

const R = 6371000; // meters
function haversine(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function offset(from: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lon1 = (from.longitude * Math.PI) / 180;
  const dr = distanceM / R;
  const lat2 =
    Math.asin(
      Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br)
    );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

// tiny deterministic PRNG
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromLatLng(lat: number, lon: number) {
  const L = Math.round(lat * 5000);
  const O = Math.round(lon * 5000);
  return (L * 73856093) ^ (O * 19349663);
}

export default function GameScreen() {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [inRangeId, setInRangeId] = useState<string | null>(null);
  const [nearestId, setNearestId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // 1) locate and watch
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Allow location to play the exploration game.");
        return;
      }
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mounted) return;
      const here = { latitude: first.coords.latitude, longitude: first.coords.longitude };
      setLoc(here);

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5 },
        (p) => {
          if (!mounted) return;
          setLoc({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        }
      );
    })();
    return () => {
      watchRef.current?.remove();
    };
  }, []);

  // 2) spawn targets once at first fix (3..5 within ~50..200m)
  useEffect(() => {
    if (!loc || targets.length) return;
    const seed = seedFromLatLng(loc.latitude, loc.longitude);
    const rand = mulberry32(seed);
    const count = 3 + Math.floor(rand() * 3);
    const t: Target[] = [];
    for (let i = 0; i < count; i++) {
      const bearing = Math.floor(rand() * 360);
      const dist = 60 + Math.floor(rand() * 140); // 60..200 m
      const p = offset(loc, bearing, dist);
      const kind: Target["kind"] = rand() < 0.5 ? "checkin" : "photo";
      t.push({ id: `t${i}`, latitude: p.latitude, longitude: p.longitude, radius: kind === "photo" ? 25 : 20, kind });
    }
    setTargets(t);
  }, [loc, targets.length]);

  // 3) compute nearest and in-range every time you move
  useEffect(() => {
    if (!loc || !targets.length) return;

    let nearest: { id: string; d: number } | null = null;
    let newlyInRange: string | null = null;

    for (const t of targets) {
      if (completed.has(t.id)) continue; // ignore completed
      const d = haversine(loc, { latitude: t.latitude, longitude: t.longitude });
      if (!nearest || d < nearest.d) nearest = { id: t.id, d };
      if (d <= t.radius) {
        newlyInRange = t.id;
        break;
      }
    }

    setNearestId(nearest?.id ?? null);

    // only fire haptic when you *enter* the zone
    setInRangeId((prev) => {
      const changed = newlyInRange && newlyInRange !== prev;
      if (changed) Haptics.selectionAsync().catch(() => {});
      return newlyInRange ?? null;
    });
  }, [loc, targets, completed]);

  // derived helpers
  const statusById = useMemo(() => {
    const map = new Map<string, "completed" | "inRange" | "nearest" | "pending">();
    for (const t of targets) {
      if (completed.has(t.id)) { map.set(t.id, "completed"); continue; }
      if (inRangeId === t.id) { map.set(t.id, "inRange"); continue; }
      if (nearestId === t.id) { map.set(t.id, "nearest"); continue; }
      map.set(t.id, "pending");
    }
    return map;
  }, [targets, completed, inRangeId, nearestId]);

  function pinColorFor(tid: string) {
    const s = statusById.get(tid);
    switch (s) {
      case "completed": return "#8e44ad"; // purple
      case "inRange":   return "#27ae60"; // green
      case "nearest":   return "#f39c12"; // orange
      default:          return "#7f8c8d"; // gray
    }
  }
  function circleFillFor(tid: string) {
    const s = statusById.get(tid);
    switch (s) {
      case "completed": return "rgba(142,68,173,0.16)";
      case "inRange":   return "rgba(39,174,96,0.20)";
      case "nearest":   return "rgba(243,156,18,0.16)";
      default:          return "rgba(127,140,141,0.12)";
    }
  }

  async function completeCurrent() {
    if (!loc) return;
    const activeId = inRangeId ?? nearestId;
    if (!activeId) return;
    const t = targets.find(x => x.id === activeId);
    if (!t) return;

    // must be *in range* to complete
    const d = haversine(loc, { latitude: t.latitude, longitude: t.longitude });
    if (d > t.radius) {
      Alert.alert("Get closer", `You're ${d.toFixed(0)} m away. Enter the circle to complete.`);
      return;
    }

    if (t.kind === "checkin") {
      setCompleted(prev => new Set(prev).add(t.id));
      Alert.alert("Checkpoint reached!", "Nice. You’ve unlocked the next clue.");
      return;
    }

    // photo quest
    const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: lib } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cam !== "granted" || lib !== "granted") {
      Alert.alert("Camera/Library needed", "Please allow permissions.");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (shot.canceled) return;

    const uri = shot.assets[

