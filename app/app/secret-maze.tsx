import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createSecretMazeDestination,
  getSecretMazeDestinations,
  SecretMazeDestination,
} from "../api";
import { getMultiplayerProfile, MultiplayerProfile } from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

type LatLng = {
  latitude: number;
  longitude: number;
};

type Destination = {
  id: string;
  label: string;
  kind: string;
  coordinate: LatLng;
  clue: string;
  altitudeMeters?: number | null;
  horizontalAccuracyMeters?: number | null;
  altitudeAccuracyMeters?: number | null;
  altitudeToleranceMeters?: number | null;
  sampleCount?: number;
  calibratedSeconds?: number;
};

type CalibrationSample = LatLng & {
  altitudeMeters: number | null;
  horizontalAccuracyMeters: number | null;
  altitudeAccuracyMeters: number | null;
};

const DOWNTOWN_MCKINNEY_BOUNDS = {
  north: 33.2012,
  south: 33.1935,
  west: -96.6205,
  east: -96.6112,
};

const KNOWN_DESTINATIONS: Destination[] = [
  {
    id: "mpac-doors",
    label: "MPAC doors",
    kind: "monument",
    coordinate: { latitude: 33.19735, longitude: -96.61536 },
    clue: "Find the old courthouse stage at the center of the square.",
  },
  {
    id: "historic-square",
    label: "Historic square",
    kind: "monument",
    coordinate: { latitude: 33.19708, longitude: -96.61518 },
    clue: "Circle the square until the route folds back toward the middle.",
  },
  {
    id: "mural-hunt",
    label: "Mural hunt",
    kind: "mural",
    coordinate: { latitude: 33.19772, longitude: -96.61653 },
    clue: "Look for color on a wall near the old downtown blocks.",
  },
];

export default function SecretMazeScreen() {
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(KNOWN_DESTINATIONS[0].id);
  const [customLabel, setCustomLabel] = useState("Secret alleyway");
  const [customClue, setCustomClue] = useState("A public spot not listed on maps.");
  const [customLatitude, setCustomLatitude] = useState("");
  const [customLongitude, setCustomLongitude] = useState("");
  const [calibratedDestination, setCalibratedDestination] =
    useState<Destination | null>(null);
  const [savedDestinations, setSavedDestinations] = useState<Destination[]>([]);
  const [mazePath, setMazePath] = useState<LatLng[]>([]);
  const [generatedDestination, setGeneratedDestination] =
    useState<Destination | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getMultiplayerProfile()
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch(() => {});
    async function loadLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (active) setLocationError("location permission is needed for maze entry.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!active) return;
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    }
    loadLocation().catch((error) => {
      if (active) setLocationError(errorMessage(error));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getSecretMazeDestinations()
      .then((response) => {
        if (!active) return;
        setSavedDestinations(response.destinations.map(destinationFromApi));
      })
      .catch((error) => {
        if (active) setLocationError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedDestination = useMemo(() => {
    const saved = savedDestinations.find((destination) => destination.id === selectedId);
    if (saved) return saved;

    if (selectedId !== "custom") {
      return KNOWN_DESTINATIONS.find((destination) => destination.id === selectedId);
    }

    if (calibratedDestination) return calibratedDestination;

    const latitude = Number(customLatitude);
    const longitude = Number(customLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      id: "custom",
      label: customLabel.trim() || "Secret destination",
      kind: "secret",
      coordinate: { latitude, longitude },
      clue: customClue.trim() || "A public spot supplied by coordinates.",
    };
  }, [
    calibratedDestination,
    customClue,
    customLabel,
    customLatitude,
    customLongitude,
    savedDestinations,
    selectedId,
  ]);

  const insideDowntown = location ? isInsideBounds(location) : false;
  const destinationInsideDowntown = selectedDestination
    ? isInsideBounds(selectedDestination.coordinate)
    : false;

  function generateSecretMaze() {
    if (!location) {
      Alert.alert("Secret Maze", "waiting for this phone's location.");
      return;
    }
    if (!insideDowntown) {
      Alert.alert("Secret Maze", "enter downtown McKinney before generating a maze.");
      return;
    }
    if (!selectedDestination) {
      Alert.alert("Secret Maze", "choose a destination or enter coordinates.");
      return;
    }
    if (!destinationInsideDowntown) {
      Alert.alert(
        "Secret Maze",
        "the destination must be inside the downtown McKinney test bounds.",
      );
      return;
    }
    const path = buildMazePath(location, selectedDestination.coordinate);
    setGeneratedDestination(selectedDestination);
    setMazePath(path);
  }

  function useCurrentAsSecret() {
    if (!location) return;
    setSelectedId("custom");
    setCustomLatitude(location.latitude.toFixed(7));
    setCustomLongitude(location.longitude.toFixed(7));
  }

  async function calibrateSecretSpot() {
    setSelectedId("custom");
    setCalibrating(true);
    setCalibrationProgress("starting calibration...");
    try {
      const samples: CalibrationSample[] = [];
      const startedAt = Date.now();
      for (let index = 0; index < 12; index += 1) {
        const reading = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        const horizontalAccuracy = reading.coords.accuracy ?? null;
        const altitudeAccuracy = reading.coords.altitudeAccuracy ?? null;
        const sample = {
          latitude: reading.coords.latitude,
          longitude: reading.coords.longitude,
          altitudeMeters: reading.coords.altitude ?? null,
          horizontalAccuracyMeters: horizontalAccuracy,
          altitudeAccuracyMeters: altitudeAccuracy,
        };
        if (
          horizontalAccuracy === null ||
          horizontalAccuracy <= 35 ||
          samples.length < 4
        ) {
          samples.push(sample);
        }
        setCalibrationProgress(
          `${samples.length} good sample(s), latest GPS ${formatMeters(horizontalAccuracy)}`,
        );
        await delay(1200);
      }
      if (samples.length < 4) {
        Alert.alert("Secret Maze", "not enough stable samples. try standing still outside.");
        return;
      }

      const average = averageSamples(samples);
      const calibratedSeconds = (Date.now() - startedAt) / 1000;
      const destination = {
        id: `secret-${Date.now()}`,
        label: customLabel.trim() || "Secret alleyway",
        kind: "secret",
        coordinate: {
          latitude: Number(average.latitude.toFixed(7)),
          longitude: Number(average.longitude.toFixed(7)),
        },
        clue: customClue.trim() || "A public spot not listed on maps.",
        altitudeMeters:
          average.altitudeMeters === null
            ? null
            : Number(average.altitudeMeters.toFixed(1)),
        horizontalAccuracyMeters:
          average.horizontalAccuracyMeters === null
            ? null
            : Number(average.horizontalAccuracyMeters.toFixed(1)),
        altitudeAccuracyMeters:
          average.altitudeAccuracyMeters === null
            ? null
            : Number(average.altitudeAccuracyMeters.toFixed(1)),
        altitudeToleranceMeters: altitudeTolerance(average.altitudeAccuracyMeters),
        sampleCount: samples.length,
        calibratedSeconds: Number(calibratedSeconds.toFixed(1)),
      };
      setCalibratedDestination(destination);
      setCustomLatitude(destination.coordinate.latitude.toFixed(7));
      setCustomLongitude(destination.coordinate.longitude.toFixed(7));
      setCalibrationProgress(
        `calibrated ${samples.length} samples in ${Math.round(calibratedSeconds)}s`,
      );
      Alert.alert("Secret Maze", "secret spot calibrated. save it to Render when ready.");
    } catch (error) {
      Alert.alert("Secret Maze", errorMessage(error));
    } finally {
      setCalibrating(false);
    }
  }

  async function saveSecretSpot() {
    if (!selectedDestination || selectedId !== "custom") {
      Alert.alert("Secret Maze", "calibrate or enter a secret place first.");
      return;
    }
    setSaving(true);
    try {
      const destination = destinationToApi(
        calibratedDestination ?? selectedDestination,
      );
      const response = await createSecretMazeDestination({
        creator_player_id: profile?.playerId ?? null,
        destination,
      });
      const saved = destinationFromApi(response.destination);
      setSavedDestinations((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setSelectedId(saved.id);
      Alert.alert("Secret Maze", "secret destination saved to Render.");
    } catch (error) {
      Alert.alert("Secret Maze", errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function openDestinationMap() {
    const target = generatedDestination ?? selectedDestination;
    if (!target) return;
    const { latitude, longitude } = target.coordinate;
    await Linking.openURL(
      Platform.select({
        ios: `maps://?ll=${latitude},${longitude}&q=${encodeURIComponent(target.label)}`,
        android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(target.label)})`,
        default: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`,
      })!,
    );
  }

  if (!location && !locationError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.cyan} />
        <Text style={styles.muted}>finding downtown entry...</Text>
      </View>
    );
  }

  const mapCenter = location ?? KNOWN_DESTINATIONS[0].coordinate;
  const mapDestination = generatedDestination ?? selectedDestination;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
          <Text style={styles.kicker}>homage</Text>
          <Text style={styles.title}>secret maze</Text>
          <Text style={styles.muted}>
            generate a downtown route from the place you enter to a hidden landmark.
          </Text>

          <View style={styles.mapShell}>
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: mapCenter.latitude,
                longitude: mapCenter.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              region={{
                latitude: mapCenter.latitude,
                longitude: mapCenter.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              showsUserLocation
            >
              {mazePath.length > 1 ? (
                <Polyline
                  coordinates={mazePath}
                  strokeColor={RGB_THEME.cyan}
                  strokeWidth={4}
                />
              ) : null}
              {location ? <Marker coordinate={location} title="entry" /> : null}
              {mapDestination ? (
                <Marker
                  coordinate={mapDestination.coordinate}
                  pinColor="#d946ef"
                  title={mapDestination.label}
                />
              ) : null}
            </MapView>
          </View>

          <View style={styles.statusBox}>
            <StatusLine label="inside downtown" passed={insideDowntown} />
            <StatusLine
              label="destination inside bounds"
              passed={Boolean(selectedDestination && destinationInsideDowntown)}
            />
            <StatusLine
              label="elevation calibrated"
              passed={Boolean(selectedDestination?.altitudeMeters !== undefined)}
            />
            <StatusLine label="maze generated" passed={mazePath.length > 1} />
          </View>

          <Text style={styles.sectionTitle}>destination</Text>
          <View style={styles.destinationGrid}>
            {KNOWN_DESTINATIONS.map((destination) => (
              <Pressable
                key={destination.id}
                onPress={() => setSelectedId(destination.id)}
                style={[
                  styles.destinationButton,
                  selectedId === destination.id && styles.destinationButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.destinationButtonText,
                    selectedId === destination.id && styles.destinationButtonTextActive,
                  ]}
                >
                  {destination.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setSelectedId("custom")}
              style={[
                styles.destinationButton,
                selectedId === "custom" && styles.destinationButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.destinationButtonText,
                  selectedId === "custom" && styles.destinationButtonTextActive,
                ]}
              >
                secret place
              </Text>
            </Pressable>
          </View>

          {savedDestinations.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>saved spots</Text>
              <View style={styles.destinationGrid}>
                {savedDestinations.map((destination) => (
                  <Pressable
                    key={destination.id}
                    onPress={() => setSelectedId(destination.id)}
                    style={[
                      styles.destinationButton,
                      selectedId === destination.id && styles.destinationButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.destinationButtonText,
                        selectedId === destination.id &&
                          styles.destinationButtonTextActive,
                      ]}
                    >
                      {destination.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {selectedId === "custom" ? (
            <View style={styles.customBox}>
              <TextInput
                maxLength={80}
                onChangeText={setCustomLabel}
                placeholder="private destination label"
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={styles.input}
                value={customLabel}
              />
              <TextInput
                maxLength={240}
                multiline
                onChangeText={setCustomClue}
                placeholder="public clue or field note"
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={customClue}
              />
              <View style={styles.inputRow}>
                <TextInput
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setCustomLatitude}
                  placeholder="latitude"
                  placeholderTextColor={RGB_THEME.dim}
                  selectionColor={RGB_THEME.cyan}
                  style={[styles.input, styles.halfInput]}
                  value={customLatitude}
                />
                <TextInput
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setCustomLongitude}
                  placeholder="longitude"
                  placeholderTextColor={RGB_THEME.dim}
                  selectionColor={RGB_THEME.cyan}
                  style={[styles.input, styles.halfInput]}
                  value={customLongitude}
                />
              </View>
              <Pressable onPress={useCurrentAsSecret} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>use current GPS as secret</Text>
              </Pressable>
              <Pressable
                disabled={calibrating}
                onPress={() => void calibrateSecretSpot()}
                style={[styles.secondaryButton, calibrating && styles.disabled]}
              >
                <Text style={styles.secondaryButtonText}>
                  {calibrating ? "calibrating..." : "calibrate GPS + elevation"}
                </Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void saveSecretSpot()}
                style={[styles.secondaryButton, saving && styles.disabled]}
              >
                <Text style={styles.secondaryButtonText}>
                  {saving ? "saving..." : "save secret spot"}
                </Text>
              </Pressable>
              {calibrationProgress ? (
                <Text style={styles.muted}>{calibrationProgress}</Text>
              ) : null}
            </View>
          ) : null}

          {selectedDestination ? (
            <View style={styles.clueBox}>
              <Text style={styles.packageTitle}>{selectedDestination.kind}</Text>
              <Text style={styles.muted}>{selectedDestination.clue}</Text>
              <Text style={styles.mono}>
                {selectedDestination.coordinate.latitude.toFixed(6)},{" "}
                {selectedDestination.coordinate.longitude.toFixed(6)}
              </Text>
              <Text style={styles.muted}>
                elevation{" "}
                {selectedDestination.altitudeMeters === undefined ||
                selectedDestination.altitudeMeters === null
                  ? "not calibrated"
                  : `${Math.round(selectedDestination.altitudeMeters)} m`}
              </Text>
              <Text style={styles.muted}>
                GPS accuracy {formatMeters(selectedDestination.horizontalAccuracyMeters)} /
                altitude accuracy {formatMeters(selectedDestination.altitudeAccuracyMeters)}
              </Text>
              <Text style={styles.muted}>
                tolerance {formatMeters(selectedDestination.altitudeToleranceMeters)} /
                samples {selectedDestination.sampleCount ?? 1}
              </Text>
            </View>
          ) : null}

          <Pressable onPress={generateSecretMaze} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>generate downtown maze</Text>
          </Pressable>
          <Pressable onPress={openDestinationMap} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>open destination map</Text>
          </Pressable>

          {mazePath.length > 1 ? (
            <View style={styles.clueBox}>
              <Text style={styles.packageTitle}>maze route</Text>
              <Text style={styles.muted}>
                {mazePath.length} points / {Math.round(totalPathMeters(mazePath))} m
              </Text>
              <Text style={styles.muted}>
                This first version shows the route for testing. Later we can reveal one
                checkpoint at a time.
              </Text>
            </View>
          ) : null}

          {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusLine({ label, passed }: { label: string; passed: boolean }) {
  return (
    <Text style={[styles.statusLine, passed ? styles.ok : styles.need]}>
      {passed ? "ok" : "need"} - {label}
    </Text>
  );
}

function averageSamples(samples: CalibrationSample[]) {
  const altitudeSamples = samples.filter((sample) => sample.altitudeMeters !== null);
  const horizontalAccuracySamples = samples.filter(
    (sample) => sample.horizontalAccuracyMeters !== null,
  );
  const altitudeAccuracySamples = samples.filter(
    (sample) => sample.altitudeAccuracyMeters !== null,
  );
  return {
    latitude: average(samples.map((sample) => sample.latitude)),
    longitude: average(samples.map((sample) => sample.longitude)),
    altitudeMeters:
      altitudeSamples.length === 0
        ? null
        : average(altitudeSamples.map((sample) => sample.altitudeMeters!)),
    horizontalAccuracyMeters:
      horizontalAccuracySamples.length === 0
        ? null
        : average(
            horizontalAccuracySamples.map(
              (sample) => sample.horizontalAccuracyMeters!,
            ),
          ),
    altitudeAccuracyMeters:
      altitudeAccuracySamples.length === 0
        ? null
        : average(
            altitudeAccuracySamples.map((sample) => sample.altitudeAccuracyMeters!),
          ),
  };
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function altitudeTolerance(altitudeAccuracyMeters: number | null) {
  if (altitudeAccuracyMeters === null) return null;
  return Math.max(20, Math.min(80, altitudeAccuracyMeters * 2));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMeters(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : `${Math.round(value)} m`;
}

function destinationToApi(destination: Destination): SecretMazeDestination {
  return {
    id: destination.id === "custom" ? `secret-${Date.now()}` : destination.id,
    label: destination.label,
    kind: destination.kind,
    clue: destination.clue,
    latitude: destination.coordinate.latitude,
    longitude: destination.coordinate.longitude,
    altitude_m: destination.altitudeMeters ?? null,
    horizontal_accuracy_m: destination.horizontalAccuracyMeters ?? null,
    altitude_accuracy_m: destination.altitudeAccuracyMeters ?? null,
    altitude_tolerance_m: destination.altitudeToleranceMeters ?? null,
    sample_count: destination.sampleCount ?? 1,
    calibrated_seconds: destination.calibratedSeconds ?? 0,
    created_at: new Date().toISOString(),
  };
}

function destinationFromApi(destination: SecretMazeDestination): Destination {
  return {
    id: destination.id,
    label: destination.label,
    kind: destination.kind,
    clue: destination.clue ?? "Saved public secret spot.",
    coordinate: {
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    altitudeMeters: destination.altitude_m ?? null,
    horizontalAccuracyMeters: destination.horizontal_accuracy_m ?? null,
    altitudeAccuracyMeters: destination.altitude_accuracy_m ?? null,
    altitudeToleranceMeters: destination.altitude_tolerance_m ?? null,
    sampleCount: destination.sample_count,
    calibratedSeconds: destination.calibrated_seconds,
  };
}

function isInsideBounds(point: LatLng) {
  return (
    point.latitude <= DOWNTOWN_MCKINNEY_BOUNDS.north &&
    point.latitude >= DOWNTOWN_MCKINNEY_BOUNDS.south &&
    point.longitude >= DOWNTOWN_MCKINNEY_BOUNDS.west &&
    point.longitude <= DOWNTOWN_MCKINNEY_BOUNDS.east
  );
}

function buildMazePath(start: LatLng, end: LatLng) {
  const seed = Math.abs(hash(`${start.latitude}:${start.longitude}:${end.latitude}:${end.longitude}`));
  const latitudeSpan = end.latitude - start.latitude;
  const longitudeSpan = end.longitude - start.longitude;
  const wobble = 0.00018 + (seed % 5) * 0.000035;
  const direction = seed % 2 === 0 ? 1 : -1;

  return [
    start,
    {
      latitude: start.latitude + latitudeSpan * 0.18,
      longitude: start.longitude + longitudeSpan * 0.12 + wobble * direction,
    },
    {
      latitude: start.latitude + latitudeSpan * 0.38 + wobble * -direction,
      longitude: start.longitude + longitudeSpan * 0.34,
    },
    {
      latitude: start.latitude + latitudeSpan * 0.58,
      longitude: start.longitude + longitudeSpan * 0.62 + wobble * direction,
    },
    {
      latitude: start.latitude + latitudeSpan * 0.82 + wobble * direction,
      longitude: start.longitude + longitudeSpan * 0.84,
    },
    end,
  ].map(clampToDowntown);
}

function clampToDowntown(point: LatLng) {
  return {
    latitude: Math.min(
      DOWNTOWN_MCKINNEY_BOUNDS.north,
      Math.max(DOWNTOWN_MCKINNEY_BOUNDS.south, point.latitude),
    ),
    longitude: Math.min(
      DOWNTOWN_MCKINNEY_BOUNDS.east,
      Math.max(DOWNTOWN_MCKINNEY_BOUNDS.west, point.longitude),
    ),
  };
}

function totalPathMeters(path: LatLng[]) {
  return path.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + haversine(path[index - 1], point);
  }, 0);
}

function haversine(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(s));
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return result;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  center: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 20,
  },
  kicker: { color: RGB_THEME.cyan, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  muted: { color: RGB_THEME.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  mapShell: {
    aspectRatio: 1,
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 18,
    overflow: "hidden",
  },
  statusBox: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  statusLine: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 19,
    textTransform: "uppercase",
  },
  ok: { color: RGB_THEME.lime },
  need: { color: RGB_THEME.amber },
  sectionTitle: {
    color: RGB_THEME.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 22,
  },
  destinationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  destinationButton: {
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  destinationButtonActive: {
    backgroundColor: RGB_THEME.cyan,
    borderColor: RGB_THEME.cyan,
  },
  destinationButtonText: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  destinationButtonTextActive: { color: RGB_THEME.black },
  customBox: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  input: {
    backgroundColor: RGB_THEME.surfaceRaised,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  noteInput: { minHeight: 78, paddingTop: 12 },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  halfInput: { flex: 1 },
  clueBox: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  packageTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "900" },
  mono: {
    color: RGB_THEME.cyan,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50,
  },
  primaryButtonText: {
    color: RGB_THEME.black,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: RGB_THEME.cyan,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  disabled: { opacity: 0.4 },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 14 },
});
