import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";

import { createEncryptedPlacement, createMultiplayerRoom, MESSAGE_HUNTS_ENABLED } from "../api";
import { HUBS, type Hub } from "../lib/hubs";
import {
  createPlacedDocumentId,
  decryptPlacedDocument,
  derivePlacedDocumentSecret,
  encryptPlacedDocumentWithSecret,
  type PlacedDocumentPublicMetadata,
} from "../lib/placedDocumentEncryption";
import { getTwoPlayerId } from "../lib/messageHuntIdentity";

const colors = { background: "#F8F5EC", card: "#FFFFFF", ink: "#17241D", muted: "#627067", green: "#275D45", pale: "#E3ECE6", gold: "#E0A43A", line: "#DCD8CF", danger: "#A33D32" };

export default function CreateClueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ hubId?: string; hubName?: string; hubLocality?: string; hubKind?: string; hubLatitude?: string; hubLongitude?: string; hubRadius?: string }>();
  const customHub = makeCustomHub(params);
  const availableHubs = customHub && !HUBS.some((hub) => hub.id === customHub.id) ? [customHub, ...HUBS] : HUBS;
  const [hubId, setHubId] = useState(availableHubs.some((hub) => hub.id === params.hubId) ? params.hubId! : HUBS[0].id);
  const [hint, setHint] = useState("");
  const [message, setMessage] = useState("");
  const [phrase, setPhrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sealed, setSealed] = useState<{ hubName: string; code?: string; playerId?: string } | null>(null);

  useEffect(() => {
    if (params.hubId) return;
    let active = true;
    async function selectClosestHub() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const reading = await Location.getLastKnownPositionAsync({ maxAge: 86_400_000, requiredAccuracy: 10_000 })
        ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!active) return;
      const closest = [...HUBS].sort((a, b) => distanceMeters(reading.coords, a) - distanceMeters(reading.coords, b))[0];
      if (closest) setHubId(closest.id);
    }
    void selectClosestHub().catch(() => {});
    return () => { active = false; };
  }, [params.hubId]);

  const hub = availableHubs.find((candidate) => candidate.id === hubId) ?? HUBS[0];
  const ready = message.trim().length > 0 && phrase.trim().length >= 8;

  async function sealClue() {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const id = createPlacedDocumentId();
      const metadata: PlacedDocumentPublicMetadata = {
        id,
        latitude: hub.latitude,
        longitude: hub.longitude,
        radiusMeters: hub.radiusMeters,
        createdAt: new Date().toISOString(),
        documentKind: "encrypted-message",
        hint: hint.trim() || "An encrypted message is waiting here.",
        checkpointId: hub.id,
        checkpointName: hub.name,
        checkpointLatitude: hub.latitude,
        checkpointLongitude: hub.longitude,
        checkpointRadiusMeters: hub.radiusMeters,
      };
      const plaintext = { title: `Message at ${hub.name}`, byline: "Anonymous explorer", body: message.trim() };
      const secret = derivePlacedDocumentSecret(id, phrase);
      const document = encryptPlacedDocumentWithSecret(metadata, plaintext, secret);

      // Verify the encrypted payload locally before anything is uploaded.
      const verified = decryptPlacedDocument(document, secret);
      if (verified.body !== plaintext.body) throw new Error("The clue could not be verified.");

      await createEncryptedPlacement({ creator_player_id: null, document });
      if (!MESSAGE_HUNTS_ENABLED) { setSealed({ hubName: hub.name }); return; }
      const playerId = await getTwoPlayerId();
      const room = await createMultiplayerRoom({ player_id: playerId, player_name: "Player 1", platform: Platform.OS, latitude: hub.latitude, longitude: hub.longitude, mode: "message_hunt", document_id: document.id });
      setSealed({ hubName: hub.name, code: room.code, playerId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The clue could not be published. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function makeAnother() {
    setHint("");
    setMessage("");
    setPhrase("");
    setError("");
    setSealed(null);
  }

  if (sealed) return <SafeAreaView style={styles.safe} edges={["bottom"]}><View style={styles.successWrap}>
    <View style={styles.seal}><Text style={styles.sealMark}>◆</Text></View>
    <Text style={styles.eyebrow}>MESSAGE LEFT</Text>
    <Text style={styles.successTitle}>Sealed successfully</Text>
    <Text style={styles.successText}>Your encrypted message is now waiting at {sealed.hubName}.</Text>
    {sealed.code ? <View style={styles.codeCard}><Text style={styles.codeLabel}>PLAYER 2 JOIN CODE</Text><Text selectable style={styles.code}>{sealed.code}</Text><Text style={styles.codeHelp}>Player 2 enters this code on their phone. This code is not the unlock phrase.</Text></View> : null}
    <View style={styles.warning}><Text style={styles.warningTitle}>Remember the unlock phrase</Text><Text style={styles.warningText}>It was never sent to the server, so Homage cannot recover it. Share it separately when players are meant to solve the clue.</Text></View>
    {sealed.code && sealed.playerId ? <Pressable onPress={() => router.replace({ pathname: "/message-hunt", params: { code: sealed.code!, playerId: sealed.playerId! } })} style={styles.button}><Text style={styles.buttonText}>Watch the hunt</Text></Pressable> : null}
    <Pressable onPress={makeAnother} style={styles.textButton}><Text style={styles.textButtonText}>Leave another message</Text></Pressable>
  </View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={["bottom"]}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PRIVATE BY DESIGN</Text>
        <Text style={styles.title}>Leave a message</Text>
        <Text style={styles.intro}>Anyone can see the hint. Only someone with your phrase can open the message.</Text>

        <Text style={styles.label}>CURRENT HUB</Text>
        <View style={styles.currentHub}><View style={styles.currentHubMark}><Text style={styles.currentHubSymbol}>◆</Text></View><View style={styles.currentHubCopy}><Text style={styles.currentHubName}>{hub.name}</Text><Text style={styles.currentHubPlace}>{hub.locality}</Text></View></View>

        <View style={styles.card}>
          <Field label="Private message" value={message} onChangeText={setMessage} placeholder="Write the message you want to leave…" maxLength={1200} multiline tall />
          <Field label="Public hint (optional)" value={hint} onChangeText={setHint} placeholder="A hint for the person finding it" maxLength={180} multiline />
          <Field label="Unlock phrase" value={phrase} onChangeText={setPhrase} placeholder="A memorable phrase, at least 8 characters" maxLength={100} secureTextEntry autoCapitalize="none" />
          <Text style={styles.security}>The message is encrypted before upload. Render never receives the message or unlock phrase in readable form.</Text>
        </View>

        {phrase.length > 0 && phrase.trim().length < 8 ? <Text style={styles.validation}>Use at least 8 characters for the unlock phrase.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={!ready || saving} onPress={sealClue} style={[styles.button, (!ready || saving) && styles.buttonDisabled]}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Leave encrypted message</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string; tall?: boolean };
function Field({ label, tall, multiline, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#8A918C" style={[styles.input, multiline && styles.multiline, tall && styles.tall]} /></View>;
}

function makeCustomHub(params: { hubId?: string; hubName?: string; hubLocality?: string; hubKind?: string; hubLatitude?: string; hubLongitude?: string; hubRadius?: string }): Hub | null {
  const latitude = Number(params.hubLatitude), longitude = Number(params.hubLongitude), radius = Number(params.hubRadius);
  if (!params.hubId || !params.hubName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const kind = params.hubKind === "city" || params.hubKind === "monument" ? params.hubKind : "suburban";
  return { id: params.hubId, name: params.hubName, locality: params.hubLocality ?? "Nearby", country: "", kind, latitude, longitude, radiusMeters: Number.isFinite(radius) ? radius : 90, reason: "A locally discovered public hub candidate." };
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const r = 6_371_000, rad = (value: number) => value * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, flex: { flex: 1 }, content: { padding: 20, paddingBottom: 50 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 38, fontWeight: "800", letterSpacing: -1, marginTop: 5 }, intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 7 },
  label: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 25 }, currentHub: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 15, flexDirection: "row", marginTop: 9, padding: 14 }, currentHubMark: { alignItems: "center", backgroundColor: colors.green, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, currentHubSymbol: { color: "#FFF", fontSize: 14 }, currentHubCopy: { flex: 1, marginLeft: 12 }, currentHubName: { color: colors.ink, fontSize: 15, fontWeight: "800" }, currentHubPlace: { color: colors.muted, fontSize: 12, marginTop: 3 },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 14, padding: 17 }, field: { marginBottom: 17 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800", marginBottom: 7 }, input: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, paddingHorizontal: 13, paddingVertical: 12 }, multiline: { minHeight: 74, textAlignVertical: "top" }, tall: { minHeight: 112 }, security: { color: colors.green, fontSize: 12, lineHeight: 18 }, validation: { color: colors.danger, fontSize: 12, marginTop: 12 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, justifyContent: "center", marginTop: 18, minHeight: 52, padding: 15 }, buttonDisabled: { opacity: .42 }, buttonText: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  successWrap: { flex: 1, justifyContent: "center", padding: 28 }, seal: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 34, height: 68, justifyContent: "center", marginBottom: 24, width: 68 }, sealMark: { color: colors.green, fontSize: 28 }, successTitle: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -.7, marginTop: 8 }, successText: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10 }, warning: { backgroundColor: "#FFF8E8", borderColor: "#ECD7A6", borderRadius: 15, borderWidth: 1, marginTop: 25, padding: 16 }, warningTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, warningText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  codeCard: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.green, borderRadius: 16, borderWidth: 1, marginTop: 22, padding: 17 }, codeLabel: { color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, code: { color: colors.ink, fontSize: 32, fontWeight: "900", letterSpacing: 6, marginTop: 8 }, codeHelp: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: "center" }, textButton: { alignItems: "center", padding: 14 }, textButtonText: { color: colors.green, fontSize: 13, fontWeight: "800" },
});
