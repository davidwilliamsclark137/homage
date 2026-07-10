import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import {
  API_BASE,
  createDocument,
  createEncryptedPlacement as uploadEncryptedPlacementToBackend,
  getNearbyEncryptedPlacements,
  getDocuments,
  NearbyEncryptedPlacedDocument,
  PuzzleKind,
  PublishedDocument,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { useStationaryAuthoringLocation } from "../hooks/useStationaryAuthoringLocation";
import { saveDocumentArtifact } from "../lib/artifacts";
import { haversine } from "../lib/geo";
import {
  createPlacedDocumentId,
  decodePlacedDocumentTransfer,
  decryptPlacedDocument,
  EncryptedPlacedDocument,
  encodePlacedDocumentKey,
  encodePlacedDocumentPackage,
  encryptPlacedDocument,
  PlacedDocumentPlaintext,
  PlacedDocumentSecret,
} from "../lib/placedDocumentEncryption";
import { RGB_THEME } from "../lib/theme";

type DocumentKind = "poem" | "prose_poem" | "short_story";
type Template = "neon" | "terminal" | "letterpress";
type Accent = "cyan" | "magenta" | "lime" | "amber";
type Typography = "serif" | "sans" | "mono";
type Alignment = "left" | "center" | "right";

const KINDS: { id: DocumentKind; label: string }[] = [
  { id: "poem", label: "Poem" },
  { id: "prose_poem", label: "Prose poem" },
  { id: "short_story", label: "Short story" },
];
const TEMPLATES: { id: Template; label: string }[] = [
  { id: "neon", label: "Neon" },
  { id: "terminal", label: "Terminal" },
  { id: "letterpress", label: "Letterpress" },
];
const TYPOGRAPHY: { id: Typography; label: string }[] = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
  { id: "mono", label: "Mono" },
];
const ALIGNMENTS: { id: Alignment; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];
const ACCENTS: { id: Accent; color: string }[] = [
  { id: "cyan", color: RGB_THEME.cyan },
  { id: "magenta", color: RGB_THEME.magenta },
  { id: "lime", color: RGB_THEME.lime },
  { id: "amber", color: RGB_THEME.amber },
];
const PUZZLES: { id: PuzzleKind; label: string }[] = [
  { id: "riddle", label: "Riddle" },
  { id: "word_puzzle", label: "Word puzzle" },
  { id: "clue", label: "Clue" },
];
const MAX_QR_TRANSFER_CHARS = 1_800;
type TransferQrMode = "package" | "key" | null;

export default function DocumentStudioScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [safeAreaConfirmed, setSafeAreaConfirmed] = useState(false);
  const [title, setTitle] = useState("");
  const [byline, setByline] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<DocumentKind>("poem");
  const [template, setTemplate] = useState<Template>("neon");
  const [accent, setAccent] = useState<Accent>("cyan");
  const [typography, setTypography] = useState<Typography>("serif");
  const [alignment, setAlignment] = useState<Alignment>("left");
  const [puzzleKind, setPuzzleKind] = useState<PuzzleKind>("riddle");
  const [puzzlePrompt, setPuzzlePrompt] = useState("");
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [documents, setDocuments] = useState<PublishedDocument[]>([]);
  const [placedDocument, setPlacedDocument] =
    useState<EncryptedPlacedDocument | null>(null);
  const [placedDocumentSecret, setPlacedDocumentSecret] =
    useState<PlacedDocumentSecret | null>(null);
  const [decryptedPlacedDocument, setDecryptedPlacedDocument] =
    useState<PlacedDocumentPlaintext | null>(null);
  const [nearbyEncryptedDocuments, setNearbyEncryptedDocuments] = useState<
    NearbyEncryptedPlacedDocument[]
  >([]);
  const [transferQrMode, setTransferQrMode] = useState<TransferQrMode>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [uploadingEncrypted, setUploadingEncrypted] = useState(false);
  const [discoveringEncrypted, setDiscoveringEncrypted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    accuracy,
    error: locationError,
    gpsReady,
    loading: locationLoading,
    location,
    stationaryFixes,
    status: gpsStatus,
  } = useStationaryAuthoringLocation();

  useEffect(() => {
    let active = true;

    getMultiplayerProfile()
      .then((nextProfile) => {
        if (!active) return;
        setProfile(nextProfile);
        setByline(nextProfile.playerName);
        return getDocuments(nextProfile.playerId);
      })
      .then((response) => {
        if (active && response) setDocuments(response.documents);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!gpsReady) setSafeAreaConfirmed(false);
  }, [gpsReady]);

  const formReady =
    Boolean(profile) &&
    gpsReady &&
    safeAreaConfirmed &&
    title.trim().length >= 1 &&
    body.trim().length >= 10 &&
    puzzlePrompt.trim().length >= 8 &&
    puzzleAnswer.trim().length >= 1;
  const accentColor =
    ACCENTS.find((option) => option.id === accent)?.color ?? RGB_THEME.cyan;
  const previewColors = useMemo(() => {
    if (template === "letterpress") {
      return { background: "#F1F1EF", text: "#171A1F", muted: "#505965" };
    }
    if (template === "terminal") {
      return { background: "#080A0C", text: RGB_THEME.lime, muted: "#73A66A" };
    }
    return {
      background: RGB_THEME.background,
      text: RGB_THEME.text,
      muted: RGB_THEME.muted,
    };
  }, [template]);
  const fontFamily =
    typography === "serif"
      ? Platform.select({ ios: "Georgia", android: "serif" })
      : typography === "mono"
        ? Platform.select({ ios: "Menlo", android: "monospace" })
        : undefined;
  const currentLatLng = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
    : null;
  const placedDistance =
    placedDocument && currentLatLng
      ? haversine(currentLatLng, {
          latitude: placedDocument.latitude,
          longitude: placedDocument.longitude,
        })
      : null;
  const placedUnlockReady =
    placedDocument !== null &&
    placedDocumentSecret !== null &&
    placedDistance !== null &&
    placedDistance <= placedDocument.radiusMeters;
  const canEncryptPlacedDocument =
    Boolean(currentLatLng) && title.trim().length >= 1 && body.trim().length >= 10;
  const packageQrValue = placedDocument
    ? encodePlacedDocumentPackage(placedDocument)
    : null;
  const keyQrValue =
    placedDocument && placedDocumentSecret
      ? encodePlacedDocumentKey(placedDocument, placedDocumentSecret)
      : null;
  const activeQrValue =
    transferQrMode === "package"
      ? packageQrValue
      : transferQrMode === "key"
        ? keyQrValue
        : null;
  const packageQrTooLarge =
    packageQrValue !== null && packageQrValue.length > MAX_QR_TRANSFER_CHARS;

  function createEncryptedPlacement() {
    if (!currentLatLng || !canEncryptPlacedDocument) return;
    setEncrypting(true);
    setEncryptionError(null);
    setDecryptedPlacedDocument(null);
    try {
      const metadata = {
        id: createPlacedDocumentId(),
        latitude: Number(currentLatLng.latitude.toFixed(7)),
        longitude: Number(currentLatLng.longitude.toFixed(7)),
        radiusMeters: 35,
        createdAt: new Date().toISOString(),
        documentKind: kind,
      };
      const result = encryptPlacedDocument(metadata, {
        title: title.trim(),
        byline: byline.trim() || profile?.playerName || "Anonymous",
        body: body.trim(),
      });
      setPlacedDocument(result.encryptedDocument);
      setPlacedDocumentSecret(result.secret);
      setTransferQrMode("package");
      setSuccess("Encrypted placed document created on this phone.");
    } catch (caught) {
      setEncryptionError(errorMessage(caught));
    } finally {
      setEncrypting(false);
    }
  }

  function unlockPlacedDocument() {
    if (!placedDocument || !placedDocumentSecret || !placedUnlockReady) return;
    setEncryptionError(null);
    try {
      setDecryptedPlacedDocument(
        decryptPlacedDocument(placedDocument, placedDocumentSecret),
      );
    } catch (caught) {
      setEncryptionError(errorMessage(caught));
    }
  }

  async function uploadEncryptedPlacement() {
    if (!placedDocument) return;
    setUploadingEncrypted(true);
    setEncryptionError(null);
    try {
      await uploadEncryptedPlacementToBackend({
        creator_player_id: profile?.playerId ?? null,
        document: placedDocument,
      });
      setSuccess("Encrypted package uploaded. Backend has coordinates and ciphertext only.");
    } catch (caught) {
      setEncryptionError(errorMessage(caught));
    } finally {
      setUploadingEncrypted(false);
    }
  }

  async function discoverNearbyEncryptedPlacements() {
    if (!currentLatLng) return;
    setDiscoveringEncrypted(true);
    setEncryptionError(null);
    try {
      const response = await getNearbyEncryptedPlacements({
        latitude: currentLatLng.latitude,
        longitude: currentLatLng.longitude,
        radius_m: 2_000,
        limit: 10,
      });
      setNearbyEncryptedDocuments(response.documents);
      setSuccess(`${response.count} encrypted package(s) found nearby.`);
    } catch (caught) {
      setEncryptionError(errorMessage(caught));
    } finally {
      setDiscoveringEncrypted(false);
    }
  }

  function selectNearbyEncryptedPlacement(document: NearbyEncryptedPlacedDocument) {
    const { distance_m: _distance, ...encryptedDocument } = document;
    setPlacedDocument(encryptedDocument);
    setPlacedDocumentSecret(null);
    setDecryptedPlacedDocument(null);
    setTransferQrMode(null);
    setSuccess("Nearby encrypted package loaded. It remains locked without a key.");
  }

  async function openScanner() {
    setEncryptionError(null);
    if (!cameraPermission?.granted) {
      const nextPermission = await requestCameraPermission();
      if (!nextPermission.granted) {
        setEncryptionError("Camera permission is required to scan transfer QR codes.");
        return;
      }
    }
    setScannerOpen(true);
  }

  function handleTransferScan(result: BarcodeScanningResult) {
    setScannerOpen(false);
    setEncryptionError(null);
    setDecryptedPlacedDocument(null);
    try {
      const payload = decodePlacedDocumentTransfer(result.data);
      if (payload.kind === "encrypted-placed-document") {
        setPlacedDocument(payload.document);
        setPlacedDocumentSecret(null);
        setTransferQrMode(null);
        setSuccess("Encrypted package received. The document is still locked.");
        return;
      }
      if (!placedDocument || payload.documentId !== placedDocument.id) {
        throw new Error("This key does not match the current encrypted document.");
      }
      setPlacedDocumentSecret(payload.secret);
      setSuccess("Document key received. Go to the GPS location to decrypt.");
    } catch (caught) {
      setEncryptionError(errorMessage(caught));
    }
  }

  async function publish() {
    if (!formReady || !profile || !location || accuracy === null) return;
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await createDocument({
        player_id: profile.playerId,
        player_name: profile.playerName,
        title: title.trim(),
        body: body.trim(),
        byline: byline.trim(),
        document_kind: kind,
        template,
        accent,
        typography,
        alignment,
        puzzle_kind: puzzleKind,
        puzzle_prompt: puzzlePrompt.trim(),
        puzzle_answer: puzzleAnswer.trim(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy,
        stationary_fixes: stationaryFixes,
        safe_area_confirmed: true,
      });
      setDocuments((current) => [response.document, ...current]);
      try {
        await saveDocumentArtifact({
          questId: response.quest.id,
          questName: response.quest.name,
          questDescription: response.quest.description,
          source: response.quest.source,
          latitude: response.document.latitude,
          longitude: response.document.longitude,
          documentId: response.document.id,
          documentKind: response.document.document_kind,
          documentRemoteUrl: absoluteUrl(response.document.pdf_url),
          documentSourceRemoteUrl: absoluteUrl(response.document.source_url),
        });
        setSuccess(
          `${response.document.title} is published and saved in Artifacts.`,
        );
      } catch (artifactError) {
        setSuccess(`${response.document.title} is published.`);
        setError(
          `The local artifact copy could not be saved: ${errorMessage(artifactError)}`,
        );
      }
      setSafeAreaConfirmed(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  }

  async function openAndSave(document: PublishedDocument) {
    setError(null);
    try {
      await saveDocumentArtifact({
        questId: document.quest_id ?? document.id,
        questName: `Read: ${document.title}`,
        questDescription: `A ${document.document_kind.replaceAll("_", " ")} left by ${document.byline}.`,
        source: "community-document",
        latitude: document.latitude,
        longitude: document.longitude,
        documentId: document.id,
        documentKind: document.document_kind,
        documentRemoteUrl: absoluteUrl(document.pdf_url),
        documentSourceRemoteUrl: absoluteUrl(document.source_url),
      });
      await Linking.openURL(absoluteUrl(document.pdf_url));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (profileLoading || locationLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.magenta} />
        <Text style={styles.loadingText}>Preparing Document Studio...</Text>
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
          <View style={styles.headingRow}>
            <View style={styles.headingText}>
              <Text style={styles.kicker}>LATEX PUBLISHING</Text>
              <Text style={styles.title}>Document Studio</Text>
            </View>
            <Text style={[styles.gps, gpsReady && styles.gpsReady]}>
              {gpsStatus}
            </Text>
          </View>

          <Text style={styles.label}>Writing form</Text>
          <Segmented
            onChange={setKind}
            options={KINDS}
            selected={kind}
          />

          <Text style={styles.label}>Title</Text>
          <TextInput
            maxLength={80}
            onChangeText={setTitle}
            placeholder="A signal in the grass"
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>Byline</Text>
          <TextInput
            maxLength={50}
            onChangeText={setByline}
            placeholder="Anonymous"
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={byline}
          />

          <Text style={styles.label}>Text</Text>
          <TextInput
            maxLength={4_000}
            multiline
            onChangeText={setBody}
            placeholder={
              kind === "poem"
                ? "Write one line at a time..."
                : "Write your short piece..."
            }
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={[styles.input, styles.bodyInput]}
            textAlignVertical="top"
            value={body}
          />
          <Text style={styles.counter}>{body.length}/4000</Text>

          <Text style={styles.sectionTitle}>Document design</Text>

          <Text style={styles.label}>Template</Text>
          <Segmented
            onChange={setTemplate}
            options={TEMPLATES}
            selected={template}
          />

          <Text style={styles.label}>Typography</Text>
          <Segmented
            onChange={setTypography}
            options={TYPOGRAPHY}
            selected={typography}
          />

          <Text style={styles.label}>Alignment</Text>
          <Segmented
            onChange={setAlignment}
            options={ALIGNMENTS}
            selected={alignment}
          />

          <Text style={styles.label}>Accent light</Text>
          <View style={styles.swatches}>
            {ACCENTS.map((option) => (
              <Pressable
                accessibilityLabel={`${option.id} accent`}
                key={option.id}
                onPress={() => setAccent(option.id)}
                style={[
                  styles.swatchButton,
                  accent === option.id && styles.swatchButtonActive,
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: option.color },
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Preview</Text>
          <View
            style={[
              styles.preview,
              {
                backgroundColor: previewColors.background,
                borderColor: accentColor,
              },
            ]}
          >
            <Text
              numberOfLines={2}
              style={[
                styles.previewTitle,
                {
                  color: accentColor,
                  fontFamily,
                  textAlign: alignment,
                },
              ]}
            >
              {title.trim() || "Untitled signal"}
            </Text>
            <Text
              style={[
                styles.previewByline,
                {
                  color: previewColors.muted,
                  fontFamily,
                  textAlign: alignment,
                },
              ]}
            >
              {byline.trim() || profile?.playerName || "Anonymous"}
            </Text>
            <View
              style={[styles.previewRule, { backgroundColor: accentColor }]}
            />
            <Text
              numberOfLines={12}
              style={[
                styles.previewBody,
                {
                  color: previewColors.text,
                  fontFamily,
                  textAlign: alignment,
                },
              ]}
            >
              {body.trim() || "Your writing will appear here."}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Placed encrypted document</Text>
          <Text style={styles.encryptionCopy}>
            Create a local encrypted package with visible GPS coordinates. The
            package does not include the document key.
          </Text>
          <View style={styles.placementActions}>
            <Pressable
              disabled={!canEncryptPlacedDocument || encrypting}
              onPress={createEncryptedPlacement}
              style={[
                styles.encryptButton,
                (!canEncryptPlacedDocument || encrypting) && styles.disabled,
              ]}
            >
              {encrypting ? (
                <ActivityIndicator color={RGB_THEME.black} />
              ) : (
                <Text style={styles.encryptText}>Encrypt here</Text>
              )}
            </Pressable>
            <Pressable
              disabled={!currentLatLng || discoveringEncrypted}
              onPress={() => void discoverNearbyEncryptedPlacements()}
              style={[
                styles.discoverButton,
                (!currentLatLng || discoveringEncrypted) && styles.disabled,
              ]}
            >
              {discoveringEncrypted ? (
                <ActivityIndicator color={RGB_THEME.black} />
              ) : (
                <Text style={styles.discoverText}>Find nearby</Text>
              )}
            </Pressable>
          </View>
          {nearbyEncryptedDocuments.length ? (
            <View style={styles.nearbyList}>
              {nearbyEncryptedDocuments.map((document) => (
                <Pressable
                  key={document.id}
                  onPress={() => selectNearbyEncryptedPlacement(document)}
                  style={styles.nearbyRow}
                >
                  <View style={styles.documentText}>
                    <Text style={styles.documentTitle}>{document.id}</Text>
                    <Text style={styles.documentMeta}>
                      {Math.round(document.distance_m)} m /{" "}
                      {document.documentKind}
                    </Text>
                  </View>
                  <Text style={styles.packageStatus}>LOCKED</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {placedDocument ? (
            <View style={styles.encryptedPackage}>
              <View style={styles.packageHeader}>
                <Text style={styles.packageTitle}>Encrypted package</Text>
                <Text style={styles.packageStatus}>LOCKED</Text>
              </View>
              <Text style={styles.packageLine}>
                GPS {placedDocument.latitude.toFixed(6)},{" "}
                {placedDocument.longitude.toFixed(6)}
              </Text>
              <Text style={styles.packageLine}>
                Unlock radius {placedDocument.radiusMeters} m
              </Text>
              <Text style={styles.packageLine}>
                Algorithm {placedDocument.algorithm}
              </Text>
              <Text style={styles.packageLine}>
                Package QR size {packageQrValue?.length ?? 0}/
                {MAX_QR_TRANSFER_CHARS}
              </Text>
              <Text numberOfLines={4} style={styles.ciphertext}>
                {placedDocument.ciphertextHex}
              </Text>
              <View style={styles.transferButtons}>
                <Pressable
                  disabled={packageQrTooLarge}
                  onPress={() => setTransferQrMode("package")}
                  style={[
                    styles.transferButton,
                    packageQrTooLarge && styles.disabled,
                  ]}
                >
                  <Text style={styles.transferButtonText}>Package QR</Text>
                </Pressable>
                <Pressable
                  disabled={!keyQrValue}
                  onPress={() => setTransferQrMode("key")}
                  style={[
                    styles.transferButton,
                    styles.keyButton,
                    !keyQrValue && styles.disabled,
                  ]}
                >
                  <Text style={[styles.transferButtonText, styles.keyText]}>
                    Key QR
                  </Text>
                </Pressable>
              </View>
              {packageQrTooLarge ? (
                <Text style={styles.error}>
                  This document is too large for the QR prototype. Shorten the
                  text for this phone-to-phone test.
                </Text>
              ) : null}
              {activeQrValue ? (
                <View style={styles.qrPanel}>
                  <Text style={styles.qrTitle}>
                    {transferQrMode === "package"
                      ? "Scan this first: encrypted package"
                      : "Scan this second: document key"}
                  </Text>
                  <View style={styles.qrBox}>
                    <QRCode
                      backgroundColor="#FFFFFF"
                      color="#000000"
                      size={220}
                      value={activeQrValue}
                    />
                  </View>
                </View>
              ) : null}
              <Pressable
                disabled={uploadingEncrypted}
                onPress={() => void uploadEncryptedPlacement()}
                style={[
                  styles.uploadEncryptedButton,
                  uploadingEncrypted && styles.disabled,
                ]}
              >
                {uploadingEncrypted ? (
                  <ActivityIndicator color={RGB_THEME.black} />
                ) : (
                  <Text style={styles.uploadEncryptedText}>
                    Upload encrypted package
                  </Text>
                )}
              </Pressable>
              <Text style={styles.packageLine}>
                Distance{" "}
                {placedDistance === null
                  ? "waiting for GPS"
                  : `${Math.round(placedDistance)} m`}
              </Text>
              <Pressable
                disabled={!placedUnlockReady}
                onPress={unlockPlacedDocument}
                style={[
                  styles.unlockButton,
                  !placedUnlockReady && styles.disabled,
                ]}
              >
                <Text style={styles.unlockText}>Decrypt at location</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.receivePanel}>
            <Text style={styles.packageTitle}>Receive from another phone</Text>
            <Text style={styles.encryptionCopy}>
              Scan the package QR first. It will show GPS coordinates and
              ciphertext, but no readable document text. Scan the key QR later
              to make decryption possible at the location.
            </Text>
            <Pressable onPress={() => void openScanner()} style={styles.scanButton}>
              <Text style={styles.scanText}>Scan transfer QR</Text>
            </Pressable>
            {scannerOpen ? (
              <View style={styles.scannerPanel}>
                <CameraView
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  facing="back"
                  onBarcodeScanned={handleTransferScan}
                  style={styles.camera}
                />
                <Pressable
                  onPress={() => setScannerOpen(false)}
                  style={styles.closeScannerButton}
                >
                  <Text style={styles.closeScannerText}>Close scanner</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {decryptedPlacedDocument ? (
            <View style={styles.decryptedPanel}>
              <Text style={styles.decryptedKicker}>DECRYPTED LOCALLY</Text>
              <Text style={styles.decryptedTitle}>
                {decryptedPlacedDocument.title}
              </Text>
              <Text style={styles.decryptedByline}>
                {decryptedPlacedDocument.byline}
              </Text>
              <Text style={styles.decryptedBody}>
                {decryptedPlacedDocument.body}
              </Text>
            </View>
          ) : null}
          {encryptionError ? (
            <Text style={styles.error}>{encryptionError}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>Artifact lock</Text>
          <Text style={styles.label}>Puzzle type</Text>
          <Segmented
            onChange={setPuzzleKind}
            options={PUZZLES}
            selected={puzzleKind}
          />
          <Text style={styles.label}>Prompt for the finder</Text>
          <TextInput
            maxLength={240}
            multiline
            onChangeText={setPuzzlePrompt}
            placeholder="I speak without a mouth and echo without a voice. What am I?"
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={[styles.input, styles.puzzleInput]}
            textAlignVertical="top"
            value={puzzlePrompt}
          />
          <Text style={styles.label}>Answer</Text>
          <TextInput
            autoCapitalize="none"
            maxLength={80}
            onChangeText={setPuzzleAnswer}
            placeholder="echo"
            placeholderTextColor={RGB_THEME.dim}
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={puzzleAnswer}
          />

          <View style={styles.safetyRow}>
            <View style={styles.safetyText}>
              <Text style={styles.safetyTitle}>Leave it at this location</Text>
              <Text style={styles.safetyCopy}>
                I am in a designated parking or pedestrian area, away from
                pumps, drive lanes, roads, and shoulders, and allowed to leave
                a reading signal here.
              </Text>
            </View>
            <Switch
              disabled={!gpsReady}
              ios_backgroundColor={RGB_THEME.border}
              onValueChange={setSafeAreaConfirmed}
              thumbColor={
                safeAreaConfirmed ? RGB_THEME.lime : RGB_THEME.muted
              }
              trackColor={{
                false: RGB_THEME.border,
                true: RGB_THEME.surfaceRaised,
              }}
              value={safeAreaConfirmed}
            />
          </View>

          {locationError ? (
            <Text style={styles.error}>{locationError}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Pressable
            disabled={!formReady || publishing}
            onPress={() => void publish()}
            style={[
              styles.publishButton,
              (!formReady || publishing) && styles.disabled,
            ]}
          >
            {publishing ? (
              <ActivityIndicator color={RGB_THEME.black} />
            ) : (
              <Text style={styles.publishText}>Typeset and publish PDF</Text>
            )}
          </Pressable>

          <View style={styles.libraryHeading}>
            <Text style={styles.libraryTitle}>Your documents</Text>
            <Text style={styles.libraryCount}>{documents.length}</Text>
          </View>
          {documents.length ? (
            documents.map((document) => (
              <View key={document.id} style={styles.documentRow}>
                <View style={styles.documentText}>
                  <Text style={styles.documentTitle}>{document.title}</Text>
                  <Text style={styles.documentMeta}>
                    {document.document_kind.replaceAll("_", " ")} /{" "}
                    {document.template}
                  </Text>
                </View>
                <View style={styles.documentActions}>
                  <Pressable
                    accessibilityLabel={`Open PDF for ${document.title}`}
                    onPress={() => void openAndSave(document)}
                    style={styles.openButton}
                  >
                    <Text style={styles.openText}>PDF</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Open LaTeX source for ${document.title}`}
                    onPress={() =>
                      void Linking.openURL(`${API_BASE}${document.source_url}`)
                    }
                    style={[styles.openButton, styles.sourceButton]}
                  >
                    <Text style={[styles.openText, styles.sourceText]}>TeX</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No documents published yet.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Segmented<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { id: T; label: string }[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onChange(option.id)}
          style={[
            styles.segment,
            selected === option.id && styles.segmentActive,
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.segmentText,
              selected === option.id && styles.segmentTextActive,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function absoluteUrl(value: string) {
  return value.startsWith("http") ? value : `${API_BASE}${value}`;
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
  },
  loadingText: { color: RGB_THEME.muted, fontSize: 14 },
  headingRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headingText: { flex: 1, minWidth: 0 },
  kicker: { color: RGB_THEME.magenta, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  gps: {
    color: RGB_THEME.amber,
    fontSize: 11,
    fontWeight: "800",
    maxWidth: 132,
    textAlign: "right",
  },
  gpsReady: { color: RGB_THEME.lime },
  sectionTitle: {
    color: RGB_THEME.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 30,
  },
  label: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 16,
  },
  input: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  bodyInput: { minHeight: 180, paddingTop: 13 },
  puzzleInput: { minHeight: 88, paddingTop: 13 },
  counter: {
    color: RGB_THEME.dim,
    fontSize: 11,
    marginTop: 5,
    textAlign: "right",
  },
  segmented: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 5,
  },
  segmentActive: { backgroundColor: RGB_THEME.cyan },
  segmentText: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  segmentTextActive: { color: RGB_THEME.black },
  swatches: { flexDirection: "row", gap: 10 },
  swatchButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 54,
  },
  swatchButtonActive: { borderColor: RGB_THEME.text, borderWidth: 2 },
  swatch: { borderRadius: 3, height: 24, width: 32 },
  preview: {
    borderRadius: 4,
    borderTopWidth: 3,
    minHeight: 280,
    padding: 22,
  },
  previewTitle: { fontSize: 25, fontWeight: "900", lineHeight: 30 },
  previewByline: { fontSize: 11, marginTop: 6 },
  previewRule: { height: 2, marginVertical: 18, width: "100%" },
  previewBody: { fontSize: 14, lineHeight: 21 },
  encryptionCopy: {
    color: RGB_THEME.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  placementActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  encryptButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  encryptText: { color: RGB_THEME.black, fontSize: 14, fontWeight: "900" },
  discoverButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.amber,
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  discoverText: { color: RGB_THEME.black, fontSize: 14, fontWeight: "900" },
  nearbyList: {
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
  },
  nearbyRow: {
    alignItems: "center",
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 60,
    padding: 12,
  },
  encryptedPackage: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  packageHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  packageTitle: { color: RGB_THEME.text, fontSize: 15, fontWeight: "900" },
  packageStatus: { color: RGB_THEME.amber, fontSize: 11, fontWeight: "900" },
  packageLine: {
    color: RGB_THEME.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
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
  transferButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  transferButton: {
    alignItems: "center",
    borderColor: RGB_THEME.cyan,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  transferButtonText: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
  },
  keyButton: { borderColor: RGB_THEME.magenta },
  keyText: { color: RGB_THEME.magenta },
  qrPanel: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  qrTitle: {
    color: RGB_THEME.text,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    padding: 12,
  },
  uploadEncryptedButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 46,
  },
  uploadEncryptedText: {
    color: RGB_THEME.black,
    fontSize: 13,
    fontWeight: "900",
  },
  receivePanel: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 46,
  },
  scanText: { color: RGB_THEME.black, fontSize: 13, fontWeight: "900" },
  scannerPanel: {
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    height: 300,
    marginTop: 12,
    overflow: "hidden",
  },
  camera: { flex: 1 },
  closeScannerButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.black,
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  closeScannerText: {
    color: RGB_THEME.text,
    fontSize: 12,
    fontWeight: "900",
  },
  unlockButton: {
    alignItems: "center",
    borderColor: RGB_THEME.lime,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
  },
  unlockText: { color: RGB_THEME.lime, fontSize: 12, fontWeight: "900" },
  decryptedPanel: {
    borderColor: RGB_THEME.lime,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  decryptedKicker: { color: RGB_THEME.lime, fontSize: 10, fontWeight: "900" },
  decryptedTitle: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  decryptedByline: { color: RGB_THEME.muted, fontSize: 12, marginTop: 4 },
  decryptedBody: {
    color: RGB_THEME.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  safetyRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 24,
    paddingVertical: 15,
  },
  safetyText: { flex: 1, paddingRight: 16 },
  safetyTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "800" },
  safetyCopy: {
    color: RGB_THEME.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 12 },
  success: { color: RGB_THEME.lime, fontSize: 13, marginTop: 12 },
  publishButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 52,
  },
  publishText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  libraryHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 36,
    paddingBottom: 8,
  },
  libraryTitle: { color: RGB_THEME.text, fontSize: 18, fontWeight: "900" },
  libraryCount: { color: RGB_THEME.magenta, fontSize: 13, fontWeight: "800" },
  documentRow: {
    alignItems: "center",
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    paddingVertical: 12,
  },
  documentText: { flex: 1, minWidth: 0 },
  documentTitle: { color: RGB_THEME.text, fontSize: 15, fontWeight: "800" },
  documentMeta: {
    color: RGB_THEME.muted,
    fontSize: 11,
    marginTop: 4,
    textTransform: "capitalize",
  },
  documentActions: { flexDirection: "row", gap: 6 },
  openButton: {
    borderColor: RGB_THEME.cyan,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
  },
  openText: { color: RGB_THEME.cyan, fontSize: 12, fontWeight: "900" },
  sourceButton: { borderColor: RGB_THEME.magenta },
  sourceText: { color: RGB_THEME.magenta },
  empty: {
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    color: RGB_THEME.muted,
    fontSize: 13,
    paddingVertical: 18,
  },
});
