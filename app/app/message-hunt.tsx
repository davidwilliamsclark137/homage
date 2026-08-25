import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMultiplayerRoom, joinMultiplayerRoom, type MultiplayerRoom } from "../api";
import { getTwoPlayerId } from "../lib/messageHuntIdentity";

const colors = { background: "#F8F5EC", card: "#FFF", ink: "#17241D", muted: "#627067", green: "#275D45", bright: "#5AC47A", line: "#DCD8CF", danger: "#A33D32", pale: "#E3ECE6" };

export default function MessageHuntScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; playerId?: string }>();
  const [code, setCode] = useState(params.code ?? "");
  const [playerId, setPlayerId] = useState(params.playerId ?? "");
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [loading, setLoading] = useState(Boolean(params.code));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!params.code) return;
    try { setRoom(await getMultiplayerRoom(params.code, params.playerId)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Hunt unavailable."); }
    finally { setLoading(false); }
  }, [params.code, params.playerId]);

  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => void refresh(), 4_000); return () => clearInterval(timer); }, [refresh]));
  useEffect(() => { if (!playerId) void getTwoPlayerId().then(setPlayerId); }, [playerId]);

  async function join() {
    if (code.trim().length !== 6 || !playerId) return;
    setLoading(true); setError("");
    try {
      const joined = await joinMultiplayerRoom(code, { player_id: playerId, player_name: "Player 2", platform: Platform.OS });
      setRoom(joined);
      router.setParams({ code: joined.code, playerId });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not join hunt."); }
    finally { setLoading(false); }
  }

  function goToHub() {
    const quest = room?.quests[0];
    if (!quest || !room) return;
    router.push({ pathname: "/hub", params: { id: quest.checkpoint_id ?? `message-${quest.id}`, name: quest.checkpoint_name ?? quest.name, locality: "Message hunt", kind: "community", latitude: String(quest.latitude), longitude: String(quest.longitude), radius: String(quest.radius), huntCode: room.code, playerId, documentId: quest.document_id ?? quest.id } });
  }

  function beginPuzzle() {
    const quest = room?.quests[0];
    if (!quest || !room) return;
    router.push({
      pathname: "/mckinney-grid",
      params: {
        huntCode: room.code,
        playerId,
        documentId: quest.document_id ?? quest.id,
        hubId: quest.checkpoint_id ?? `message-${quest.id}`,
        hubName: quest.checkpoint_name ?? quest.name,
        hubLatitude: String(quest.latitude),
        hubLongitude: String(quest.longitude),
        hubRadius: String(quest.radius),
      },
    });
  }

  if (!room) return <SafeAreaView style={styles.safe} edges={["bottom"]}><View style={styles.center}>
    <Text style={styles.eyebrow}>TWO-PLAYER MODE</Text><Text style={styles.title}>Join a hunt</Text><Text style={styles.intro}>Enter the six-character code from Player 1.</Text>
    <TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="ABC123" placeholderTextColor="#929892" style={styles.codeInput} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={code.length !== 6 || loading} onPress={() => void join()} style={[styles.primary, (code.length !== 6 || loading) && styles.disabled]}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Join as Player 2</Text>}</Pressable>
  </View></SafeAreaView>;

  const me = room.players.find((player) => player.id === playerId);
  const sender = me?.role === "sender";
  const downtownSquareHunt = ["mckinney-mpac", "mckinney-city-hall"].includes(room.quests[0]?.checkpoint_id ?? "");
  return <SafeAreaView style={styles.safe} edges={["bottom"]}><View style={styles.center}>
    <Text style={styles.eyebrow}>MESSAGE HUNT · {room.code}</Text>
    <Text style={styles.title}>{room.status === "complete" ? "Message opened" : room.status === "active" ? "Hunt active" : "Waiting for Player 2"}</Text>
    <Text style={styles.intro}>{room.status === "complete" ? "Player 2 reached the hub and opened the encrypted message." : sender ? "Share the join code and keep this screen open to watch the hunt." : "Travel to the hub, find the encrypted message, and solve the phrase."}</Text>
    <View style={styles.players}>{["Player 1", "Player 2"].map((label, index) => { const player = room.players[index]; return <View key={label} style={styles.player}><View style={[styles.playerDot, player && styles.playerDotReady]} /><View><Text style={styles.playerName}>{label}</Text><Text style={styles.playerState}>{player ? player.role === "sender" ? "Message sender" : "Message solver" : "Not joined"}</Text></View></View>; })}</View>
    <View style={styles.codeCard}><Text style={styles.codeLabel}>JOIN CODE</Text><Text selectable style={styles.code}>{room.code}</Text></View>
    {!sender && room.status === "active" ? <Pressable onPress={downtownSquareHunt ? beginPuzzle : goToHub} style={styles.primary}><Text style={styles.primaryText}>{downtownSquareHunt ? "Begin Square Three" : "Go to message hub"}</Text></Pressable> : null}
    {sender && room.status !== "complete" ? <View style={styles.waiting}><ActivityIndicator color={colors.green} /><Text style={styles.waitingText}>Updating automatically…</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: colors.background, flex: 1 }, center: { flex: 1, justifyContent: "center", padding: 26 }, eyebrow: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 35, fontWeight: "900", letterSpacing: -.8, marginTop: 8 }, intro: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 9 }, codeInput: { backgroundColor: colors.card, borderColor: colors.green, borderRadius: 15, borderWidth: 2, color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: 7, marginTop: 25, padding: 16, textAlign: "center" }, primary: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, justifyContent: "center", marginTop: 17, minHeight: 52, padding: 14 }, primaryText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, disabled: { opacity: .4 }, error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 }, players: { gap: 9, marginTop: 24 }, player: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, padding: 14 }, playerDot: { backgroundColor: colors.line, borderRadius: 6, height: 12, width: 12 }, playerDotReady: { backgroundColor: colors.bright }, playerName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, playerState: { color: colors.muted, fontSize: 11, marginTop: 3 }, codeCard: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 15, marginTop: 15, padding: 15 }, codeLabel: { color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, code: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: 6, marginTop: 6 }, waiting: { alignItems: "center", flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 20 }, waitingText: { color: colors.muted, fontSize: 12 } });
