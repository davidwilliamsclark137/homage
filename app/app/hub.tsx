import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCheckpointEncryptedPlacements, getNearbyEncryptedPlacements, submitMultiplayerAction, type EncryptedPlacedDocument } from "../api";
import { readHubProgress, saveSolvedClue, setActiveHub, type SolvedClue } from "../lib/hubProgress";
import { HUBS } from "../lib/hubs";
import { decryptPlacedDocument, derivePlacedDocumentSecret, type EncryptedPlacedDocument as CryptoDocument } from "../lib/placedDocumentEncryption";

type Point = { latitude: number; longitude: number };
type RangeState = "finding" | "far" | "near" | "arrived";
const colors = { background: "#F8F5EC", card: "#FFF", ink: "#17241D", muted: "#627067", green: "#275D45", bright: "#5AC47A", gold: "#E0A43A", line: "#DCD8CF", pale: "#E3ECE6", danger: "#A33D32" };

export default function HubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; locality?: string; kind?: string; latitude?: string; longitude?: string; radius?: string; huntCode?: string; playerId?: string; documentId?: string }>();
  const catalog = HUBS.find((hub) => hub.id === params.id);
  const hub = {
    id: params.id ?? catalog?.id ?? HUBS[0].id,
    name: params.name ?? catalog?.name ?? HUBS[0].name,
    locality: params.locality ?? catalog?.locality ?? "Nearby",
    kind: params.kind ?? catalog?.kind ?? "community",
    latitude: numberParam(params.latitude, catalog?.latitude ?? HUBS[0].latitude),
    longitude: numberParam(params.longitude, catalog?.longitude ?? HUBS[0].longitude),
    radiusMeters: numberParam(params.radius, catalog?.radiusMeters ?? 90),
  };
  const [location, setLocation] = useState<Point | null>(null);
  const [clues, setClues] = useState<EncryptedPlacedDocument[]>([]);
  const [solved, setSolved] = useState<Record<string, SolvedClue>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Finding your position…");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<Record<string, string>>({});
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const distance = location ? distanceMeters(location, hub) : null;
  const range: RangeState = distance === null ? "finding" : distance <= hub.radiusMeters ? "arrived" : distance <= 1_000 ? "near" : "far";
  const solvedCount = clues.filter((clue) => solved[clue.id]).length;

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    void setActiveHub(hub.id);
    readHubProgress().then((progress) => active && setSolved(progress.solved));
    async function locate() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is needed to activate a hub.");
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 86_400_000, requiredAccuracy: 10_000 });
      if (cached && active) accept(cached);
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 8_000 }, accept);
    }
    function accept(reading: Location.LocationObject) {
      if (!active) return;
      setLocation({ latitude: reading.coords.latitude, longitude: reading.coords.longitude });
    }
    locate().catch((cause) => active && setStatus(cause instanceof Error ? cause.message : "Location is unavailable."));
    return () => { active = false; subscription?.remove(); };
  }, [hub.id]);

  useEffect(() => {
    if (!location) return;
    const current = location;
    let active = true;
    async function discover() {
      setLoading(true);
      try {
        if (range === "arrived") {
          const response = await getCheckpointEncryptedPlacements({ checkpoint_id: hub.id, latitude: current.latitude, longitude: current.longitude, limit: 30 });
          if (active) setClues(orderClues(response.documents));
          if (active) setStatus(response.count ? "Hub activated · encrypted messages detected" : "Hub activated · no messages have been left here yet");
        } else {
          const response = await getNearbyEncryptedPlacements({ latitude: current.latitude, longitude: current.longitude, radius_m: 10_000, limit: 50 });
          const attached = response.documents.filter((document) => document.checkpointId === hub.id);
          if (active) setClues(orderClues(attached));
          if (active) setStatus(attached.length ? `${attached.length} encrypted ${attached.length === 1 ? "message" : "messages"} detected · enter the hub to open` : range === "near" ? "Hub signal nearby" : "Travel toward this hub to strengthen the signal");
        }
      } catch (cause) {
        if (active) setStatus(cause instanceof Error ? cause.message : "Clue discovery is temporarily unavailable.");
      } finally { if (active) setLoading(false); }
    }
    void discover();
    return () => { active = false; };
  }, [range, hub.id, location]);

  async function unlock(clue: EncryptedPlacedDocument) {
    const phrase = phrases[clue.id]?.trim() ?? "";
    if (phrase.length < 8 || range !== "arrived") return;
    setUnlockingId(clue.id);
    setErrors((current) => ({ ...current, [clue.id]: "" }));
    try {
      const secret = derivePlacedDocumentSecret(clue.id, phrase);
      const plaintext = decryptPlacedDocument(clue as CryptoDocument, secret);
      const next = await saveSolvedClue({ documentId: clue.id, hubId: hub.id, ...plaintext, solvedAt: new Date().toISOString() });
      setSolved(next.solved);
      setPhrases((current) => ({ ...current, [clue.id]: "" }));
      if (params.huntCode && params.playerId && params.documentId === clue.id) {
        try { await submitMultiplayerAction(params.huntCode, { player_id: params.playerId, quest_id: clue.id, action: "message_opened" }); }
        catch { setErrors((current) => ({ ...current, [clue.id]: "Message opened, but the multiplayer status could not sync yet." })); }
      }
    } catch {
      setErrors((current) => ({ ...current, [clue.id]: "That phrase did not open this message." }));
    } finally { setUnlockingId(null); }
  }

  return <SafeAreaView style={styles.safe} edges={["bottom"]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>{rangeLabel(range)}</Text>
    <Text style={styles.title}>{hub.name}</Text>
    <Text style={styles.place}>{hub.locality} · {hub.kind}</Text>

    <View style={[styles.signalCard, range === "arrived" && styles.signalArrived]}>
      <View style={styles.signalTop}><View style={[styles.signalDot, range === "arrived" && styles.signalDotArrived]} /><Text style={styles.signalTitle}>{status}</Text></View>
      <Text style={styles.distance}>{distance === null ? "Waiting for GPS" : `${formatDistance(distance)} away · activation range ${hub.radiusMeters} m`}</Text>
      <View style={styles.track}><View style={[styles.trackFill, { width: `${signalPercent(distance, hub.radiusMeters)}%` }]} /></View>
    </View>

    {hub.id === "mckinney-mpac" ? <View style={styles.fieldTest}><Text style={styles.fieldTestEyebrow}>MCKINNEY LOCATION PACK · V1</Text><Text style={styles.fieldTestTitle}>The city becomes the puzzle</Text><Text style={styles.fieldTestText}>Explore six source-backed downtown sites, their observable details, and the puzzle mechanics they can support.</Text><Pressable onPress={() => router.push("/mckinney-pack")} style={styles.fieldTestButton}><Text style={styles.fieldTestButtonText}>Open McKinney pack</Text></Pressable><Pressable onPress={() => router.push("/mckinney-grid")} style={styles.packSecondary}><Text style={styles.packSecondaryText}>Start Square Three</Text></Pressable></View> : null}

    <View style={styles.progressRow}><Text style={styles.section}>Messages here</Text><Text style={styles.progress}>{solvedCount}/{clues.length} opened</Text></View>
    {loading && !clues.length ? <ActivityIndicator style={styles.loader} color={colors.green} /> : null}
    {!loading && !clues.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>{range === "arrived" ? "No messages here yet" : "No message signal yet"}</Text><Text style={styles.emptyText}>Leave an encrypted message for someone to find at this hub.</Text><Pressable onPress={() => router.push({ pathname: "/create-clue", params: { hubId: hub.id, hubName: hub.name, hubLocality: hub.locality, hubKind: hub.kind, hubLatitude: String(hub.latitude), hubLongitude: String(hub.longitude), hubRadius: String(hub.radiusMeters) } })} style={styles.outline}><Text style={styles.outlineText}>Leave a message here</Text></Pressable></View> : null}

    <View style={styles.list}>{clues.map((clue, index) => {
      const result = solved[clue.id];
      const expanded = expandedId === clue.id || Boolean(result);
      const available = range === "arrived";
      return <View key={clue.id} style={[styles.clue, result && styles.clueSolved]}>
        <Pressable onPress={() => setExpandedId(expanded ? null : clue.id)} style={styles.clueHeader}>
          <View style={[styles.number, result && styles.numberSolved]}><Text style={[styles.numberText, result && styles.numberTextSolved]}>{result ? "✓" : index + 1}</Text></View>
          <View style={styles.clueCopy}><Text style={styles.clueState}>{result ? "OPENED" : available ? "READY TO OPEN" : "SEALED"}</Text><Text style={styles.hint}>{clue.hint || "An encrypted message is waiting here."}</Text></View>
          <Text style={styles.chevron}>{expanded ? "−" : "+"}</Text>
        </Pressable>
        {expanded ? <View style={styles.clueBody}>{result ? <View><Text style={styles.revealTitle}>{result.title}</Text><Text style={styles.revealBody}>{result.body}</Text><Text style={styles.solvedDate}>Opened {new Date(result.solvedAt).toLocaleDateString()}</Text></View> : available ? <View><TextInput value={phrases[clue.id] ?? ""} onChangeText={(value) => setPhrases((current) => ({ ...current, [clue.id]: value }))} secureTextEntry autoCapitalize="none" placeholder="Enter the unlock phrase" placeholderTextColor="#8A918C" style={styles.input} />{errors[clue.id] ? <Text style={styles.error}>{errors[clue.id]}</Text> : null}<Pressable disabled={(phrases[clue.id]?.trim().length ?? 0) < 8 || unlockingId === clue.id} onPress={() => void unlock(clue)} style={[styles.unlock, ((phrases[clue.id]?.trim().length ?? 0) < 8 || unlockingId === clue.id) && styles.disabled]}>{unlockingId === clue.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.unlockText}>Open message</Text>}</Pressable></View> : <Text style={styles.lockedText}>Come within {hub.radiusMeters} meters of the hub to enter the unlock phrase.</Text>}</View> : null}
      </View>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

function numberParam(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function orderClues(clues: EncryptedPlacedDocument[]) { return [...clues].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
function rangeLabel(range: RangeState) { return range === "arrived" ? "HUB ACTIVATED" : range === "near" ? "SIGNAL NEARBY" : range === "far" ? "NEXT OBJECTIVE" : "LOCATING SIGNAL"; }
function signalPercent(distance: number | null, radius: number) { if (distance === null) return 5; if (distance <= radius) return 100; return Math.max(8, Math.min(92, (1 - distance / 10_000) * 100)); }
function distanceMeters(a: Point, b: Point) { const r = 6_371_000, rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(h)); }
function formatDistance(m: number) { if (m < 1_000) return `${Math.round(m)} m`; return `${(m / 1609.344).toFixed(1)} mi`; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, content: { padding: 20, paddingBottom: 50 }, eyebrow: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -.8, marginTop: 7 }, place: { color: colors.muted, fontSize: 13, marginTop: 5, textTransform: "capitalize" },
  signalCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 22, padding: 17 }, signalArrived: { backgroundColor: colors.pale, borderColor: colors.green }, signalTop: { alignItems: "center", flexDirection: "row", gap: 9 }, signalDot: { backgroundColor: colors.gold, borderRadius: 6, height: 12, width: 12 }, signalDotArrived: { backgroundColor: colors.bright }, signalTitle: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "800" }, distance: { color: colors.muted, fontSize: 12, marginTop: 9 }, track: { backgroundColor: "#DCE3DD", borderRadius: 4, height: 7, marginTop: 14, overflow: "hidden" }, trackFill: { backgroundColor: colors.green, borderRadius: 4, height: 7 },
  fieldTest: { backgroundColor: colors.green, borderRadius: 18, marginTop: 14, padding: 18 }, fieldTestEyebrow: { color: "#BEE5CA", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, fieldTestTitle: { color: "#FFF", fontSize: 23, fontWeight: "900", marginTop: 8 }, fieldTestText: { color: "#E4F0E8", fontSize: 13, lineHeight: 19, marginTop: 7 }, fieldTestButton: { alignItems: "center", backgroundColor: "#FFF", borderRadius: 12, marginTop: 14, padding: 12 }, fieldTestButtonText: { color: colors.green, fontSize: 13, fontWeight: "900" }, packSecondary: { alignItems: "center", borderColor: "#9BC6A9", borderRadius: 12, borderWidth: 1, marginTop: 9, padding: 11 }, packSecondaryText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  progressRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 28 }, section: { color: colors.ink, fontSize: 20, fontWeight: "800" }, progress: { color: colors.green, fontSize: 12, fontWeight: "800" }, loader: { marginTop: 35 }, empty: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginTop: 14, padding: 18 }, emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 }, outline: { alignItems: "center", borderColor: colors.green, borderRadius: 12, borderWidth: 1, marginTop: 15, padding: 12 }, outlineText: { color: colors.green, fontSize: 13, fontWeight: "800" },
  list: { gap: 10, marginTop: 14 }, clue: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 17, borderWidth: 1, overflow: "hidden" }, clueSolved: { borderColor: colors.green }, clueHeader: { alignItems: "center", flexDirection: "row", padding: 15 }, number: { alignItems: "center", backgroundColor: "#F4E8CB", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, numberSolved: { backgroundColor: colors.pale }, numberText: { color: colors.gold, fontSize: 14, fontWeight: "900" }, numberTextSolved: { color: colors.green }, clueCopy: { flex: 1, marginLeft: 12 }, clueState: { color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1 }, hint: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 20, marginTop: 4 }, chevron: { color: colors.green, fontSize: 22, marginLeft: 9 }, clueBody: { borderTopColor: colors.line, borderTopWidth: 1, padding: 15 }, input: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, padding: 13 }, unlock: { alignItems: "center", backgroundColor: colors.green, borderRadius: 12, marginTop: 10, minHeight: 47, justifyContent: "center", padding: 12 }, disabled: { opacity: .42 }, unlockText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, error: { color: colors.danger, fontSize: 12, marginTop: 8 }, lockedText: { color: colors.muted, fontSize: 13, lineHeight: 20 }, revealTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, revealBody: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 9 }, solvedDate: { color: colors.muted, fontSize: 11, marginTop: 14 },
});
