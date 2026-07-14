import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  API_BASE,
  BUILD_LABEL,
  CheckpointEncryptedPlacedDocument,
  createEncryptedPlacement as uploadEncryptedPlacementToBackend,
  getCheckpointEncryptedPlacements,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
  saveMultiplayerProfile,
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
const ALTITUDE_TOLERANCE_METERS = 30;
const START_CHECKPOINT = {
  id: "mckinney-performing-arts-center",
  name: "McKinney Performing Arts Center",
  address: "111 N Tennessee St, McKinney, TX",
  latitude: 33.19735,
  longitude: -96.61536,
  radiusMeters: 75,
  note: "public starting point for this artifact",
};
const CHECKPOINT_RIDDLE =
  "I was once the public square's courthouse stage. Stand near my doors and name this place.";
const CHECKPOINT_RIDDLE_HINT = "Use the place name on the checkpoint card.";
const CHECKPOINT_RIDDLE_ANSWERS = [
  "mckinney performing arts center",
  "mpac",
  "the mckinney performing arts center",
];
type AppMode = "creator" | "seeker";

export default function DocumentStudioScreen() {
  const [mode, setMode] = useState<AppMode>("creator");
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hint, setHint] = useState("");
  const [unlockPhrase, setUnlockPhrase] = useState("");
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleSolved, setRiddleSolved] = useState(false);
  const [placedDocument, setPlacedDocument] =
    useState<EncryptedPlacedDocument | null>(null);
  const [decryptedDocument, setDecryptedDocument] =
    useState<PlacedDocumentPlaintext | null>(null);
  const [nearbyDocuments, setNearbyDocuments] = useState<
    CheckpointEncryptedPlacedDocument[]
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
        if (active) {
          setProfile(nextProfile);
          setPlayerName(nextProfile.playerName);
        }
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
  const distanceToCheckpoint = currentLatLng
    ? haversine(currentLatLng, {
        latitude: START_CHECKPOINT.latitude,
        longitude: START_CHECKPOINT.longitude,
      })
    : null;
  const currentAltitudeMeters = location?.coords.altitude ?? null;
  const currentAltitudeAccuracyMeters = location?.coords.altitudeAccuracy ?? null;
  const isAtCheckpoint =
    distanceToCheckpoint !== null &&
    distanceToCheckpoint <= START_CHECKPOINT.radiusMeters;
  const artifactAltitudeDelta =
    placedDocument?.altitudeMeters !== null &&
    placedDocument?.altitudeMeters !== undefined &&
    currentAltitudeMeters !== null
      ? Math.abs(currentAltitudeMeters - placedDocument.altitudeMeters)
      : null;
  const artifactAltitudeTolerance =
    placedDocument?.altitudeToleranceMeters ?? ALTITUDE_TOLERANCE_METERS;
  const altitudeMatches =
    placedDocument?.altitudeMeters === null ||
    placedDocument?.altitudeMeters === undefined ||
    (artifactAltitudeDelta !== null &&
      artifactAltitudeDelta <= artifactAltitudeTolerance);
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
    distanceToPlacedDocument <= placedDocument.radiusMeters &&
    altitudeMatches;

  function resetStatus() {
    setError(null);
    setMessage(null);
  }

  function notifyStatus(title: string, detail: string) {
    setMessage(detail);
    Alert.alert(title, detail);
  }

  function notifyError(detail: string) {
    setError(detail);
    Alert.alert("Homage", detail);
  }

  async function updatePlayerName() {
    resetStatus();
    const cleanName = playerName.trim() || "Player";
    const nextProfile = profile
      ? { ...profile, playerName: cleanName }
      : {
          playerId: `player-${Date.now()}`,
          playerName: cleanName,
          roomCode: null,
        };
    setProfile(nextProfile);
    setPlayerName(cleanName);
    await saveMultiplayerProfile(nextProfile);
    notifyStatus("Signed in", `${cleanName} is active on this phone.`);
  }

  function solveCheckpointRiddle() {
    resetStatus();
    const normalized = riddleAnswer.trim().toLowerCase();
    const solved = CHECKPOINT_RIDDLE_ANSWERS.some(
      (answer) => normalized === answer || normalized.includes(answer),
    );
    if (!solved) {
      notifyError("not quite. try the checkpoint place name.");
      return;
    }
    setRiddleSolved(true);
    notifyStatus("Riddle solved", "artifact coordinates can now be requested.");
  }

  function sealBlocker() {
    if (!currentLatLng) return "waiting for GPS coordinates.";
    if (title.trim().length === 0) return "add a title first.";
    if (body.trim().length < 10) return "write at least 10 characters.";
    if (!hasUsablePhrase) return "unlock phrase must be at least 8 characters.";
    return null;
  }

  function encryptHere() {
    resetStatus();
    const blocker = sealBlocker();
    if (blocker) {
      notifyError(blocker);
      return;
    }
    if (!currentLatLng) return;
    setWorking("encrypt");
    setDecryptedDocument(null);
    try {
      const metadata = {
        id: createPlacedDocumentId(),
        latitude: Number(currentLatLng.latitude.toFixed(7)),
        longitude: Number(currentLatLng.longitude.toFixed(7)),
        altitudeMeters:
          currentAltitudeMeters === null
            ? null
            : Number(currentAltitudeMeters.toFixed(1)),
        altitudeAccuracyMeters:
          currentAltitudeAccuracyMeters === null
            ? null
            : Number(currentAltitudeAccuracyMeters.toFixed(1)),
        altitudeToleranceMeters: ALTITUDE_TOLERANCE_METERS,
        radiusMeters: 35,
        createdAt: new Date().toISOString(),
        documentKind: "note",
        hint: hint.trim() || undefined,
        checkpointId: START_CHECKPOINT.id,
        checkpointName: START_CHECKPOINT.name,
        checkpointLatitude: START_CHECKPOINT.latitude,
        checkpointLongitude: START_CHECKPOINT.longitude,
        checkpointRadiusMeters: START_CHECKPOINT.radiusMeters,
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
      notifyStatus("Sealed", "sealed locally with your unlock phrase.");
    } catch (caught) {
      notifyError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  async function uploadEncryptedPackage() {
    resetStatus();
    if (!placedDocument) {
      notifyError("seal the artifact locally before publishing it.");
      return;
    }
    setWorking("upload");
    try {
      await uploadEncryptedPlacementToBackend({
        creator_player_id: profile?.playerId ?? null,
        document: placedDocument,
      });
      notifyStatus("Published", "published. the backend has GPS + ciphertext only.");
    } catch (caught) {
      notifyError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  async function findNearby() {
    if (!currentLatLng) return;
    resetStatus();
    if (!riddleSolved) {
      notifyError("solve the checkpoint riddle before requesting artifacts.");
      return;
    }
    if (!isAtCheckpoint) {
      notifyError(`go to ${START_CHECKPOINT.name} to reveal the artifact.`);
      return;
    }
    setWorking("find");
    try {
      const response = await getCheckpointEncryptedPlacements({
        checkpoint_id: START_CHECKPOINT.id,
        latitude: currentLatLng.latitude,
        longitude: currentLatLng.longitude,
        limit: 10,
      });
      setNearbyDocuments(response.documents);
      notifyStatus(
        "Artifacts found",
        `${response.count} sealed artifact(s) available from this checkpoint.`,
      );
    } catch (caught) {
      notifyError(errorMessage(caught));
    } finally {
      setWorking(null);
    }
  }

  function loadNearbyDocument(document: CheckpointEncryptedPlacedDocument) {
    const {
      artifact_distance_m: _artifactDistance,
      checkpoint_distance_m: _checkpointDistance,
      ...encryptedDocument
    } = document;
    resetStatus();
    setPlacedDocument(encryptedDocument);
    setDecryptedDocument(null);
    setMessage("artifact loaded. type the unlock phrase to open.");
  }

  function decryptAtLocation() {
    if (!placedDocument || !canDecrypt) return;
    resetStatus();
    setWorking("decrypt");
    try {
      const secret = derivePlacedDocumentSecret(placedDocument.id, unlockPhrase);
      setDecryptedDocument(decryptPlacedDocument(placedDocument, secret));
      setMessage("opened locally on this phone.");
    } catch {
      setError("could not open. check the unlock phrase and GPS location.");
    } finally {
      setWorking(null);
    }
  }

  async function openPhoneMap() {
    if (!placedDocument) return;
    resetStatus();
    const label = encodeURIComponent("Homage artifact");
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
        <Text style={styles.muted}>preparing artifact...</Text>
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
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>homage</Text>
            <Text style={styles.title}>artifact</Text>
            <Text style={styles.status}>{gpsStatus}</Text>
            <Text numberOfLines={2} style={styles.apiBase}>
              API {API_BASE}
            </Text>
            <Text numberOfLines={1} style={styles.apiBase}>
              build {BUILD_LABEL}
            </Text>
          </View>

          <View style={styles.modeSwitch}>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setMode("creator")}
              style={[
                styles.modeButton,
                mode === "creator" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "creator" && styles.modeButtonTextActive,
                ]}
              >
                Phone A: create
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setMode("seeker")}
              style={[
                styles.modeButton,
                mode === "seeker" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "seeker" && styles.modeButtonTextActive,
                ]}
              >
                Phone B: find
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileBox}>
            <Text style={styles.kicker}>phone identity</Text>
            <TextInput
              maxLength={40}
              onChangeText={setPlayerName}
              placeholder="name for this phone"
              placeholderTextColor={RGB_THEME.dim}
              selectionColor={RGB_THEME.cyan}
              style={styles.input}
              value={playerName}
            />
            <ActionButton
              disabled={working === "profile"}
              label="save name"
              loading={working === "profile"}
              onPress={() => void updatePlayerName()}
              tone="magenta"
            />
          </View>

          <View style={styles.checkpoint}>
            <Text style={styles.kicker}>start</Text>
            <Text style={styles.checkpointTitle}>{START_CHECKPOINT.name}</Text>
            <Text style={styles.muted}>{START_CHECKPOINT.address}</Text>
            <Text style={styles.muted}>{START_CHECKPOINT.note}</Text>
            <Text style={styles.muted}>
              GPS {START_CHECKPOINT.latitude.toFixed(6)},{" "}
              {START_CHECKPOINT.longitude.toFixed(6)}
            </Text>
            <Text style={styles.muted}>
              checkpoint radius {START_CHECKPOINT.radiusMeters} m
            </Text>
            <Text style={styles.muted}>
              distance{" "}
              {distanceToCheckpoint === null
                ? "waiting for GPS"
                : `${Math.round(distanceToCheckpoint)} m`}
            </Text>
            <Text style={styles.muted}>
              elevation{" "}
              {currentAltitudeMeters === null
                ? "waiting for phone elevation"
                : `${Math.round(currentAltitudeMeters)} m`}
            </Text>
          </View>

          {mode === "creator" ? (
            <>
              <View style={styles.step}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepTitle}>write artifact</Text>
              </View>
              <TextInput
                maxLength={80}
                onChangeText={setTitle}
                placeholder="title"
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={styles.input}
                value={title}
              />
              <TextInput
                maxLength={1_000}
                multiline
                onChangeText={setBody}
                placeholder="write at least 10 characters..."
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={[styles.input, styles.bodyInput]}
                textAlignVertical="top"
                value={body}
              />
              <TextInput
                maxLength={180}
                multiline
                onChangeText={setHint}
                placeholder="hint for the unlock phrase"
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={[styles.input, styles.hintInput]}
                textAlignVertical="top"
                value={hint}
              />
              <Text style={styles.muted}>
                the hint is public. do not put the phrase here.
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
                onChangeText={setUnlockPhrase}
                placeholder="unlock phrase, at least 8 characters"
                placeholderTextColor={RGB_THEME.dim}
                secureTextEntry
                selectionColor={RGB_THEME.cyan}
                style={styles.input}
                value={unlockPhrase}
              />
              <Text style={styles.muted}>
                the phrase stays on Phone A. Phone B needs the same phrase to open.
              </Text>
              <Text style={styles.muted}>
                artifact elevation{" "}
                {currentAltitudeMeters === null
                  ? "not available; sealing will still work"
                  : `${Math.round(currentAltitudeMeters)} m`}
              </Text>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepTitle}>seal and publish</Text>
              </View>
              <View style={styles.requirements}>
                <Requirement passed={Boolean(currentLatLng)} label="GPS coordinates" />
                <Requirement passed={title.trim().length > 0} label="title" />
                <Requirement
                  passed={body.trim().length >= 10}
                  label="10+ body characters"
                />
                <Requirement passed={hasUsablePhrase} label="8+ character phrase" />
                <Requirement
                  passed={placedDocument !== null}
                  label="sealed before publish"
                />
              </View>
              <View style={styles.buttonRow}>
                <ActionButton
                  disabled={working === "encrypt"}
                  label="seal here"
                  loading={working === "encrypt"}
                  onPress={encryptHere}
                  tone="cyan"
                />
                <ActionButton
                  disabled={working === "upload"}
                  label="publish"
                  loading={working === "upload"}
                  onPress={() => void uploadEncryptedPackage()}
                  tone="lime"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.step}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepTitle}>go to checkpoint</Text>
              </View>
              <Text style={styles.muted}>
                Phone B must be at {START_CHECKPOINT.name}. The backend only returns
                artifact coordinates when this phone is inside the checkpoint radius.
              </Text>
              <ActionButton
                disabled={false}
                label="open checkpoint map"
                onPress={() =>
                  void Linking.openURL(
                    openStreetMapUrl(
                      START_CHECKPOINT.latitude,
                      START_CHECKPOINT.longitude,
                    ),
                  )
                }
                tone="cyan"
              />

              <View style={styles.step}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepTitle}>solve riddle</Text>
              </View>
              <View style={styles.riddleBox}>
                <Text style={styles.packageTitle}>{CHECKPOINT_RIDDLE}</Text>
                <Text style={styles.muted}>{CHECKPOINT_RIDDLE_HINT}</Text>
              </View>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
                onChangeText={(value) => {
                  setRiddleAnswer(value);
                  setRiddleSolved(false);
                }}
                placeholder="riddle answer"
                placeholderTextColor={RGB_THEME.dim}
                selectionColor={RGB_THEME.cyan}
                style={styles.input}
                value={riddleAnswer}
              />
              <ActionButton
                disabled={working === "riddle"}
                label={riddleSolved ? "riddle solved" : "solve riddle"}
                onPress={solveCheckpointRiddle}
                tone={riddleSolved ? "lime" : "amber"}
              />

              <View style={styles.step}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepTitle}>request coordinates</Text>
              </View>
              <View style={styles.requirements}>
                <Requirement passed={Boolean(currentLatLng)} label="GPS coordinates" />
                <Requirement passed={isAtCheckpoint} label="inside checkpoint" />
                <Requirement passed={riddleSolved} label="riddle solved" />
              </View>
              <ActionButton
                disabled={working === "find"}
                label="find artifacts"
                loading={working === "find"}
                onPress={() => void findNearby()}
                tone="magenta"
              />
              {nearbyDocuments.map((document) => (
                <Pressable
                  key={document.id}
                  onPress={() => loadNearbyDocument(document)}
                  style={styles.nearbyRow}
                >
                  <View style={styles.flex}>
                    <Text style={styles.packageTitle}>sealed artifact</Text>
                    <Text style={styles.muted}>
                      checkpoint {Math.round(document.checkpoint_distance_m)} m /
                      artifact {Math.round(document.artifact_distance_m)} m
                    </Text>
                    <Text style={styles.muted}>
                      GPS {document.latitude.toFixed(5)},{" "}
                      {document.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <Text style={styles.locked}>load map</Text>
                </Pressable>
              ))}
            </>
          )}

          {placedDocument ? (
            <View style={styles.package}>
              <Text style={styles.packageTitle}>sealed artifact</Text>
              <Text style={styles.muted}>
                starts at {placedDocument.checkpointName ?? START_CHECKPOINT.name}
              </Text>
              <DocumentLocationMap
                latitude={placedDocument.latitude}
                longitude={placedDocument.longitude}
              />
              <Text style={styles.muted}>
                GPS {placedDocument.latitude.toFixed(6)},{" "}
                {placedDocument.longitude.toFixed(6)}
              </Text>
              <Text style={styles.muted}>
                open radius {placedDocument.radiusMeters} m
              </Text>
              <Text style={styles.muted}>
                artifact elevation{" "}
                {placedDocument.altitudeMeters === null ||
                placedDocument.altitudeMeters === undefined
                  ? "not recorded"
                  : `${Math.round(placedDocument.altitudeMeters)} m`}
              </Text>
              <Text style={styles.muted}>
                your elevation{" "}
                {currentAltitudeMeters === null
                  ? "waiting for phone elevation"
                  : `${Math.round(currentAltitudeMeters)} m`}
              </Text>
              <Text style={styles.muted}>
                elevation delta{" "}
                {artifactAltitudeDelta === null
                  ? "waiting"
                  : `${Math.round(artifactAltitudeDelta)} m / ${artifactAltitudeTolerance} m`}
              </Text>
              {placedDocument.hint ? (
                <View style={styles.hintBox}>
                  <Text style={styles.hintLabel}>hint</Text>
                  <Text style={styles.hintText}>{placedDocument.hint}</Text>
                </View>
              ) : null}
              <Text style={styles.muted}>
                Distance{" "}
                {distanceToPlacedDocument === null
                  ? "waiting for GPS"
                  : `${Math.round(distanceToPlacedDocument)} m`}
              </Text>
              <View style={styles.mapButtons}>
                <Pressable onPress={() => void openPhoneMap()} style={styles.mapButton}>
                  <Text style={styles.mapButtonText}>phone map</Text>
                </Pressable>
                <Pressable
                  onPress={() => void openOpenStreetMap()}
                  style={[styles.mapButton, styles.osmButton]}
                >
                  <Text style={[styles.mapButtonText, styles.osmButtonText]}>
                    OSM
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
            <Text style={styles.stepTitle}>open</Text>
          </View>
          <ActionButton
            disabled={!canDecrypt || working === "decrypt"}
            label="open at location"
            loading={working === "decrypt"}
            onPress={decryptAtLocation}
            tone="lime"
          />

          {decryptedDocument ? (
            <View style={styles.decrypted}>
              <Text style={styles.kicker}>opened locally</Text>
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

function Requirement({ label, passed }: { label: string; passed: boolean }) {
  return (
    <Text style={[styles.requirement, passed ? styles.requirementOk : styles.requirementMissing]}>
      {passed ? "ok" : "need"} - {label}
    </Text>
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
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={disabled}
      onPress={() => {
        console.log(`[DocumentStudio] ${label} tapped`);
        onPress();
      }}
      style={[styles.actionButton, { backgroundColor }, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={RGB_THEME.black} />
      ) : (
        <Text style={styles.actionText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function DocumentLocationMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const zoom = 16;
  const center = latLngToTile(latitude, longitude, zoom);
  const tiles = [];
  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      tiles.push({
        key: `${row}:${column}`,
        x: center.x + column,
        y: center.y + row,
      });
    }
  }

  return (
    <View style={styles.mapPreview}>
      <View style={styles.tileGrid}>
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{
              uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`,
            }}
            style={styles.mapTile}
          />
        ))}
      </View>
      <View pointerEvents="none" style={styles.mapMarker}>
        <View style={styles.markerDot} />
      </View>
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function latLngToTile(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  return {
    x: Math.floor(((longitude + 180) / 360) * scale),
    y: Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
        scale,
    ),
  };
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
  apiBase: {
    color: RGB_THEME.dim,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modeButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modeButtonActive: {
    backgroundColor: RGB_THEME.cyan,
    borderColor: RGB_THEME.cyan,
  },
  modeButtonText: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  modeButtonTextActive: { color: RGB_THEME.black },
  profileBox: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  checkpoint: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  checkpointTitle: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
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
  hintInput: { minHeight: 76, paddingTop: 13 },
  requirements: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  requirement: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textTransform: "uppercase",
  },
  requirementMissing: { color: RGB_THEME.amber },
  requirementOk: { color: RGB_THEME.lime },
  riddleBox: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.amber,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
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
  hintBox: {
    backgroundColor: RGB_THEME.surfaceRaised,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  hintLabel: {
    color: RGB_THEME.amber,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
  },
  hintText: { color: RGB_THEME.text, fontSize: 14, lineHeight: 20 },
  mapPreview: {
    aspectRatio: 1.45,
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    height: "100%",
    width: "100%",
  },
  mapTile: {
    height: "33.3333%",
    width: "33.3333%",
  },
  mapMarker: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  markerDot: {
    backgroundColor: RGB_THEME.magenta,
    borderColor: RGB_THEME.text,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
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
