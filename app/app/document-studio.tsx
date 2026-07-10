import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createEncryptedPlacement as uploadEncryptedPlacementToBackend,
  getNearbyEncryptedPlacements,
  NearbyEncryptedPlacedDocument,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { useStationaryAuthoringLocation } from "../hooks/useStationaryAuthoringLocation";
import { haversine } from "../lib/geo";
import {
  createPlacedDocumentId,
  decryptPlacedDocument,
  derivePlacedDocumentSecret,
  EncryptedPlacedDocument,
  encryptPlacedDocumentWithSecret,
  PlacedDocumentPlaintext,
} from "../lib/placedDocumentEncryption";
import { RGB_THEME } from "../lib/theme";

const MIN_UNLOCK_PHRASE_LENGTH = 8;

export default function DocumentStudioScreen() {
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [unlockPhrase, setUnlockPhrase] = useState("");
  const [placedDocument, setPlacedDocument] =
    useState<EncryptedPlacedDocument | null>(null);
  const [decryptedDocument, setDecryptedDocument] =
    useState<PlacedDocumentPlaintext | null>(null);
  const [nearbyDocuments, setNearbyDocuments] = useState<
    NearbyEncryptedPlacedDocument[]
  >([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    error: locationError,
    loading: locationLoading,
    location,
    status: gpsStatus,
  } = useStationaryAuthoringLocation();

  useEffect(() => {
    let active = true;
    getMultiplayerProfile()
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentLatLng = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
    : null;
  const distanceToPlacedDocument =
    placedDocument && currentLatLng
      ? haversine(currentLatLng, {
          latitude: placedDocument.latitude,
          longitude: placedDocument.longitude,
        })
      : null;
  const hasUsablePhrase =
    unlockPhrase.trim().length >= MIN_UNLOCK_PHRASE_LENGTH;
  const canEncrypt =
    Boolean(currentLatLng) &&
    title.trim().length > 0 &&
    body.trim().length >= 10 &&
    hasUsablePhrase;
  const canDecrypt =
    placedDocument !== null &&
    hasUsablePhrase &&
    distanceToPlacedDocument !== null &&
    distanceToPlacedDocument <= placedDocument.radiusMeters;

  function resetStatus() {
    setError(null);
    setMessage(null);
  }

  function encryptHere() {
    if (!currentLatLng || !canEncrypt) return;
    resetStatus();
    setWorking("encrypt");
    setDecryptedDocument(null);
    try {
      const metadata = {
        id: createPlacedDocumentId(),
        latitude: Number(currentLatLng.latitude.toFixed(7)),
        longitude: Number(currentLatLng.longitude.toFixed(7)),
        radiusMeters: 35,
        createdAt: new Date().toISOString(),
        documentKind: "note",
      };
      const secret = derivePlacedDocumentSecret(metadata.id, unlockPhrase);
      const encryptedDocument = encryptPlacedDocumentWithSecret(
        metadata,
        {
          title: title.trim(),
          byline: profile?.playerName ?? "Anonymous",
          body: body.trim(),
        },
        secret,
      );
      setPlacedDocument(encryptedDocument);
      setMessage("Encrypted locally with your unlock phrase.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  async function uploadEncryptedPackage() {
    if (!placedDocument) return;
    resetStatus();
    setWorking("upload");
    try {
      await uploadEncryptedPlacementToBackend({
        creator_player_id: profile?.playerId ?? null,
        document: placedDocument,
      });
      setMessage("Uploaded locked package. Backend has GPS + ciphertext only.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  async function findNearby() {
    if (!currentLatLng) return;
    resetStatus();
    setWorking("find");
    try {
      const response = await getNearbyEncryptedPlacements({
        latitude: currentLatLng.latitude,
        longitude: currentLatLng.longitude,
        radius_m: 2_000,
        limit: 10,
      });
      setNearbyDocuments(response.documents);
      setMessage(`${response.count} encrypted package(s) found nearby.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  function loadNearbyDocument(document: NearbyEncryptedPlacedDocument) {
    const { distance_m: _distance, ...encryptedDocument } = document;
    resetStatus();
    setPlacedDocument(encryptedDocument);
    setDecryptedDocument(null);
    setMessage("Loaded locked package. Type the unlock phrase to decrypt.");
  }

  function decryptAtLocation() {
    if (!placedDocument || !canDecrypt) return;
    resetStatus();
    setWorking("decrypt");
    try {
      const secret = derivePlacedDocumentSecret(placedDocument.id, unlockPhrase);
      setDecryptedDocument(decryptPlacedDocument(placedDocument, secret));
      setMessage("Decrypted locally on this phone.");
    } catch {
      setError("Could not decrypt. Check the unlock phrase and GPS location.");
    } finally {
      setWorking(null);
    }
  }

  async function openPhoneMap() {
    if (!placedDocument) return;
    resetStatus();
    const label = encodeURIComponent("Homage encrypted document");
    const latitude = placedDocument.latitude;
    const longitude = placedDocument.longitude;
    const url = Platform.select({
      ios: `maps://?ll=${latitude},${longitude}&q=${label}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
      default: openStreetMapUrl(latitude, longitude),
    });
    try {
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(openStreetMapUrl(latitude, longitude));
    }
  }

  async function openOpenStreetMap() {
    if (!placedDocument) return;
    resetStatus();
    await Linking.openURL(
      openStreetMapUrl(placedDocument.latitude, placedDocument.longitude),
    );
  }

  if (loadingProfile || locationLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.cyan} />
        <Text style={styles.muted}>Preparing encrypted document test...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>HOMAGE PRIVACY TEST</Text>
            <Text style={styles.title}>Encrypted Document Drop</Text>
            <Text style={styles.status}>{gpsStatus}</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepTitle}>Write and choose an unlock phrase</Text>
          </View>
          <TextInput
            maxLength={80}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={title}
          />
          <TextInput
            maxLength={1_000}
            multiline
            onChangeText={setBody}
            placeholder="Write at least 10 characters..."
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={[styles.input, styles.bodyInput]}
            textAlignVertical="top"
            value={body}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={120}
            onChangeText={setUnlockPhrase}
            placeholder="Unlock phrase, at least 8 characters"
            placeholderTextColor={RGB_THEME.dim}
            secureTextEntry
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={unlockPhrase}
          />
          <Text style={styles.muted}>
            The phrase is not uploaded. Phone B must type the same phrase.
          </Text>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepTitle}>Encrypt and upload only ciphertext</Text>
          </View>
          <View style={styles.buttonRow}>
            <ActionButton
              disabled={!canEncrypt || working === "encrypt"}
              label="Encrypt here"
              loading={working === "encrypt"}
              onPress={encryptHere}
              tone="cyan"
            />
            <ActionButton
              disabled={!placedDocument || working === "upload"}
              label="Upload locked"
              loading={working === "upload"}
              onPress={() => void uploadEncryptedPackage()}
              tone="lime"
            />
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepTitle}>Find locked documents nearby</Text>
          </View>
          <ActionButton
            disabled={!currentLatLng || working === "find"}
            label="Find nearby encrypted packages"
            loading={working === "find"}
            onPress={() => void findNearby()}
            tone="amber"
          />
          {nearbyDocuments.map((document) => (
            <Pressable
              key={document.id}
              onPress={() => loadNearbyDocument(document)}
              style={styles.nearbyRow}
            >
              <View style={styles.flex}>
                <Text style={styles.packageTitle}>{document.id}</Text>
                <Text style={styles.muted}>
                  {Math.round(document.distance_m)} m away / GPS{" "}
                  {document.latitude.toFixed(5)}, {document.longitude.toFixed(5)}
                </Text>
              </View>
              <Text style={styles.locked}>LOCKED</Text>
            </Pressable>
          ))}

          {placedDocument ? (
            <View style={styles.package}>
              <Text style={styles.packageTitle}>Loaded encrypted package</Text>
              <Text style={styles.muted}>
                GPS {placedDocument.latitude.toFixed(6)},{" "}
                {placedDocument.longitude.toFixed(6)}
              </Text>
              <Text style={styles.muted}>
                Unlock radius {placedDocument.radiusMeters} m
              </Text>
              <Text style={styles.muted}>
                Distance{" "}
                {distanceToPlacedDocument === null
                  ? "waiting for GPS"
                  : `${Math.round(distanceToPlacedDocument)} m`}
              </Text>
              <View style={styles.mapButtons}>
                <Pressable onPress={() => void openPhoneMap()} style={styles.mapButton}>
                  <Text style={styles.mapButtonText}>Open phone map</Text>
                </Pressable>
                <Pressable
                  onPress={() => void openOpenStreetMap()}
                  style={[styles.mapButton, styles.osmButton]}
                >
                  <Text style={[styles.mapButtonText, styles.osmButtonText]}>
                    Open OSM
                  </Text>
                </Pressable>
              </View>
              <Text numberOfLines={4} style={styles.ciphertext}>
                {placedDocument.ciphertextHex}
              </Text>
            </View>
          ) : null}

          <View style={styles.step}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepTitle}>Decrypt with phrase at the location</Text>
          </View>
          <ActionButton
            disabled={!canDecrypt || working === "decrypt"}
            label="Decrypt at location"
            loading={working === "decrypt"}
            onPress={decryptAtLocation}
            tone="lime"
          />

          {decryptedDocument ? (
            <View style={styles.decrypted}>
              <Text style={styles.kicker}>DECRYPTED LOCALLY</Text>
              <Text style={styles.decryptedTitle}>{decryptedDocument.title}</Text>
              <Text style={styles.muted}>{decryptedDocument.byline}</Text>
              <Text style={styles.decryptedBody}>{decryptedDocument.body}</Text>
            </View>
          ) : null}

          {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActionButton({
  disabled,
  label,
  loading = false,
  onPress,
  tone,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  tone: "amber" | "cyan" | "lime" | "magenta";
}) {
  const backgroundColor = RGB_THEME[tone];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, { backgroundColor }, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={RGB_THEME.black} />
      ) : (
        <Text style={styles.actionText}>{label}</Text>
      )}
    </Pressable>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function openStreetMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
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
  header: {
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    paddingBottom: 18,
  },
  kicker: { color: RGB_THEME.cyan, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  status: { color: RGB_THEME.amber, fontSize: 12, fontWeight: "800", marginTop: 8 },
  step: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 26 },
  stepNumber: {
    backgroundColor: RGB_THEME.surfaceRaised,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.cyan,
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  stepTitle: { color: RGB_THEME.text, flex: 1, fontSize: 17, fontWeight: "900" },
  input: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 16,
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  bodyInput: { minHeight: 140, paddingTop: 13 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: {
    alignItems: "center",
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  actionText: {
    color: RGB_THEME.black,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  disabled: { opacity: 0.4 },
  nearbyRow: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    minHeight: 68,
    padding: 12,
  },
  locked: { color: RGB_THEME.amber, fontSize: 11, fontWeight: "900" },
  package: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  packageTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "900" },
  muted: { color: RGB_THEME.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  mapButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  mapButton: {
    alignItems: "center",
    borderColor: RGB_THEME.cyan,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  mapButtonText: { color: RGB_THEME.cyan, fontSize: 12, fontWeight: "900" },
  osmButton: { borderColor: RGB_THEME.magenta },
  osmButtonText: { color: RGB_THEME.magenta },
  ciphertext: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.lime,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    padding: 10,
  },
  decrypted: {
    borderColor: RGB_THEME.lime,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  decryptedTitle: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  decryptedBody: {
    color: RGB_THEME.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 14 },
  success: { color: RGB_THEME.lime, fontSize: 13, marginTop: 14 },
});
