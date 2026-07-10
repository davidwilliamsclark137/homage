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
import { SafeAreaView } from "react-native-safe-area-context";

import {
  API_BASE,
  createDocument,
  getDocuments,
  PuzzleKind,
  PublishedDocument,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { useStationaryAuthoringLocation } from "../hooks/useStationaryAuthoringLocation";
import { saveDocumentArtifact } from "../lib/artifacts";
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

export default function DocumentStudioScreen() {
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
