import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type Point = { latitude: number; longitude: number };
type Checkpoint = Point & { id: string; name: string; address: string; clue: string; cells: { index: number; value: number }[] };
type SavedGame = { visited: string[]; entries: Record<number, number>; complete: boolean };

const STORAGE_KEY = "homage.mckinney-square-three.v1";
const RANGE_METERS = 120;
const SOLUTION = [1, 2, 3, 3, 1, 2, 2, 3, 1];
const CHECKPOINTS: Checkpoint[] = [
  { id: "city-hall", name: "McKinney City Hall", address: "401 E. Virginia St.", latitude: 33.198057, longitude: -96.610596, clue: "The civic anchor fixes both ends of the center diagonal.", cells: [{ index: 0, value: 1 }, { index: 4, value: 1 }] },
  { id: "old-courthouse", name: "Old Courthouse / MPAC", address: "111 N. Tennessee St.", latitude: 33.19735, longitude: -96.61536, clue: "The old courthouse places two threes across the grid.", cells: [{ index: 2, value: 3 }, { index: 7, value: 3 }] },
  { id: "mitchell-park", name: "Mitchell Memorial Park", address: "300 W. Louisiana St.", latitude: 33.1976, longitude: -96.61778, clue: "The park closes the southwest-to-northeast pattern.", cells: [{ index: 3, value: 3 }, { index: 8, value: 1 }] },
];
const colors = { background: "#F8F5EC", card: "#FFF", ink: "#17241D", muted: "#627067", green: "#275D45", bright: "#5AC47A", gold: "#E0A43A", line: "#DCD8CF", pale: "#E3ECE6", danger: "#A33D32" };

export default function McKinneyGridScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ huntCode?: string; playerId?: string; documentId?: string; hubId?: string; hubName?: string; hubLatitude?: string; hubLongitude?: string; hubRadius?: string }>();
  const storageKey = params.huntCode ? `${STORAGE_KEY}.${params.huntCode}` : STORAGE_KEY;
  const [location, setLocation] = useState<Point | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<number, number>>({});
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("Finding your position…");

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      try { const saved = JSON.parse(raw) as SavedGame; setVisited(saved.visited ?? []); setEntries(saved.entries ?? {}); setComplete(Boolean(saved.complete)); } catch { /* Start fresh. */ }
    });
    async function begin() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location access is needed to collect the downtown tiles.");
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 86_400_000, requiredAccuracy: 10_000 });
      if (cached && active) accept(cached);
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 6_000 }, accept);
    }
    function accept(reading: Location.LocationObject) {
      if (!active) return;
      setLocation({ latitude: reading.coords.latitude, longitude: reading.coords.longitude });
      setMessage("Downtown signal active");
    }
    begin().catch((cause) => active && setMessage(cause instanceof Error ? cause.message : "Location is unavailable."));
    return () => { active = false; subscription?.remove(); };
  }, [storageKey]);

  const givens = useMemo(() => {
    const result: Record<number, number> = {};
    CHECKPOINTS.filter((checkpoint) => visited.includes(checkpoint.id)).forEach((checkpoint) => checkpoint.cells.forEach((cell) => { result[cell.index] = cell.value; }));
    return result;
  }, [visited]);
  const allVisited = CHECKPOINTS.every((checkpoint) => visited.includes(checkpoint.id));

  async function collect(checkpoint: Checkpoint) {
    if (!location || distanceMeters(location, checkpoint) > RANGE_METERS || visited.includes(checkpoint.id)) return;
    const next = [...visited, checkpoint.id];
    setVisited(next);
    await persist(next, entries, complete);
  }

  async function cycleCell(index: number) {
    if (!allVisited || givens[index] !== undefined || complete) return;
    const current = entries[index] ?? 0;
    const next = { ...entries, [index]: current === 3 ? 1 : current + 1 };
    setEntries(next);
    await persist(visited, next, complete);
  }

  async function checkGrid() {
    if (!allVisited) return;
    const values = SOLUTION.map((_, index) => givens[index] ?? entries[index] ?? 0);
    if (values.every((value, index) => value === SOLUTION[index])) {
      setComplete(true);
      setMessage("Square solved");
      await persist(visited, entries, true);
    } else {
      setMessage("Not quite. Each row and column needs 1, 2, and 3 exactly once.");
    }
  }

  async function reset() {
    setVisited([]); setEntries({}); setComplete(false); setMessage(location ? "Downtown signal active" : "Finding your position…");
    await AsyncStorage.removeItem(storageKey);
  }

  function openFinalMessage() {
    if (!params.huntCode || !params.playerId || !params.documentId) return;
    router.push({
      pathname: "/hub",
      params: {
        id: params.hubId ?? "mckinney-mpac",
        name: params.hubName ?? "McKinney Performing Arts Center (MPAC)",
        locality: "Downtown McKinney",
        kind: "community",
        latitude: params.hubLatitude ?? "33.19735",
        longitude: params.hubLongitude ?? "-96.61536",
        radius: params.hubRadius ?? "90",
        huntCode: params.huntCode,
        playerId: params.playerId,
        documentId: params.documentId,
      },
    });
  }

  return <SafeAreaView style={styles.safe} edges={["bottom"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>DOWNTOWN FIELD TEST</Text>
    <Text style={styles.title}>Square Three</Text>
    <Text style={styles.intro}>Visit three public downtown checkpoints to recover the fixed tiles. Then fill the grid so every row and column contains 1, 2, and 3 once.</Text>
    <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>{message}</Text></View>

    <View style={styles.grid}>{SOLUTION.map((_, index) => {
      const fixed = givens[index] !== undefined;
      const value = fixed ? givens[index] : entries[index];
      return <Pressable key={index} onPress={() => void cycleCell(index)} style={[styles.cell, fixed && styles.cellFixed, complete && styles.cellComplete]}><Text style={[styles.cellText, fixed && styles.cellTextFixed]}>{value ?? "·"}</Text></Pressable>;
    })}</View>
    <Text style={styles.gridHelp}>{allVisited ? "Tap the blank cells to cycle 1 → 2 → 3." : `${visited.length}/3 checkpoints recovered`}</Text>
    {allVisited && !complete ? <Pressable onPress={() => void checkGrid()} style={styles.primary}><Text style={styles.primaryText}>Check the square</Text></Pressable> : null}
    {complete ? <View style={styles.reveal}><Text style={styles.revealEyebrow}>FIELD TEST COMPLETE</Text><Text style={styles.revealTitle}>The square remembers.</Text><Text style={styles.revealText}>{params.huntCode ? `You recovered the route and solved its pattern. Return to ${params.hubName ?? "MPAC"} to open Player 1’s encrypted message.` : "You recovered the route and solved its pattern."}</Text>{params.huntCode ? <Pressable onPress={openFinalMessage} style={styles.finalButton}><Text style={styles.finalButtonText}>Open the final message</Text></Pressable> : null}</View> : null}

    <Text style={styles.section}>Checkpoints</Text>
    <View style={styles.list}>{CHECKPOINTS.map((checkpoint, index) => {
      const distance = location ? distanceMeters(location, checkpoint) : null;
      const inRange = distance !== null && distance <= RANGE_METERS;
      const collected = visited.includes(checkpoint.id);
      return <View key={checkpoint.id} style={[styles.checkpoint, collected && styles.checkpointDone]}>
        <View style={[styles.step, collected && styles.stepDone]}><Text style={[styles.stepText, collected && styles.stepTextDone]}>{collected ? "✓" : index + 1}</Text></View>
        <View style={styles.checkpointCopy}><Text style={styles.checkpointName}>{checkpoint.name}</Text><Text style={styles.address}>{checkpoint.address}</Text><Text style={styles.distance}>{distance === null ? "Waiting for GPS" : `${formatDistance(distance)} away`}</Text>{collected ? <Text style={styles.clue}>{checkpoint.clue}</Text> : null}</View>
        {!collected ? <Pressable disabled={!inRange} onPress={() => void collect(checkpoint)} style={[styles.collect, !inRange && styles.collectDisabled]}><Text style={[styles.collectText, !inRange && styles.collectTextDisabled]}>{inRange ? "Collect" : "Locked"}</Text></Pressable> : null}
      </View>;
    })}</View>
    <View style={styles.safety}><Text style={styles.safetyTitle}>Field-test safely</Text><Text style={styles.safetyText}>Use public sidewalks and crossings, remain outside buildings, and pause the test if construction, traffic, weather, or lighting makes a checkpoint uncomfortable. Mitchell Park’s posted city hours are 5:30 a.m.–11 p.m.</Text></View>
    <Pressable onPress={() => void reset()} style={styles.reset}><Text style={styles.resetText}>Reset field test</Text></Pressable>
  </ScrollView></SafeAreaView>;

  async function persist(nextVisited: string[], nextEntries: Record<number, number>, nextComplete: boolean) {
    await AsyncStorage.setItem(storageKey, JSON.stringify({ visited: nextVisited, entries: nextEntries, complete: nextComplete } satisfies SavedGame));
  }
}

function distanceMeters(a: Point, b: Point) { const r = 6_371_000, rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(h)); }
function formatDistance(m: number) { if (m < 1_000) return `${Math.round(m)} m`; return `${(m / 1609.344).toFixed(1)} mi`; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, content: { padding: 20, paddingBottom: 50 }, eyebrow: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 37, fontWeight: "900", letterSpacing: -1, marginTop: 6 }, intro: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }, status: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 17, padding: 12 }, statusDot: { backgroundColor: colors.bright, borderRadius: 5, height: 10, width: 10 }, statusText: { color: colors.green, flex: 1, fontSize: 12, fontWeight: "800" },
  grid: { alignSelf: "center", borderColor: colors.green, borderRadius: 12, borderWidth: 3, flexDirection: "row", flexWrap: "wrap", marginTop: 24, overflow: "hidden", width: 267 }, cell: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderWidth: .5, height: 87, justifyContent: "center", width: 87 }, cellFixed: { backgroundColor: "#E7E0C8" }, cellComplete: { backgroundColor: colors.pale }, cellText: { color: colors.ink, fontSize: 32, fontWeight: "800" }, cellTextFixed: { color: colors.green }, gridHelp: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: "center" }, primary: { alignItems: "center", alignSelf: "center", backgroundColor: colors.green, borderRadius: 13, marginTop: 14, padding: 13, width: 267 }, primaryText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  reveal: { backgroundColor: colors.green, borderRadius: 17, marginTop: 20, padding: 18 }, revealEyebrow: { color: "#BEE5CA", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, revealTitle: { color: "#FFF", fontSize: 22, fontWeight: "900", marginTop: 8 }, revealText: { color: "#E4F0E8", fontSize: 13, lineHeight: 20, marginTop: 7 }, finalButton: { alignItems: "center", backgroundColor: "#FFF", borderRadius: 12, marginTop: 14, padding: 13 }, finalButtonText: { color: colors.green, fontSize: 13, fontWeight: "900" }, section: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 30 }, list: { gap: 10, marginTop: 13 }, checkpoint: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", padding: 14 }, checkpointDone: { borderColor: colors.green }, step: { alignItems: "center", backgroundColor: "#F4E8CB", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, stepDone: { backgroundColor: colors.pale }, stepText: { color: colors.gold, fontWeight: "900" }, stepTextDone: { color: colors.green }, checkpointCopy: { flex: 1, marginLeft: 11 }, checkpointName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, address: { color: colors.muted, fontSize: 11, marginTop: 3 }, distance: { color: colors.green, fontSize: 11, fontWeight: "800", marginTop: 4 }, clue: { color: colors.ink, fontSize: 12, lineHeight: 17, marginTop: 8 }, collect: { backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, collectDisabled: { backgroundColor: "#ECE9E1" }, collectText: { color: "#FFF", fontSize: 11, fontWeight: "900" }, collectTextDisabled: { color: colors.muted }, safety: { backgroundColor: "#FFF8E8", borderColor: "#ECD7A6", borderRadius: 15, borderWidth: 1, marginTop: 22, padding: 15 }, safetyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, safetyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, reset: { alignItems: "center", marginTop: 18, padding: 12 }, resetText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
});
