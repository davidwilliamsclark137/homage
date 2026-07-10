import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createSong,
  getSongs,
  PublishedSong,
  PuzzleKind,
} from "../api";
import { useStationaryAuthoringLocation } from "../hooks/useStationaryAuthoringLocation";
import { saveSongArtifact } from "../lib/artifacts";
import {
  CHORD_EXTENSIONS,
  CHORD_QUALITIES,
  ChordExtension,
  ChordQuality,
  ChipKey,
  ChipMeter,
  ChipScale,
  ChipSong,
  chordNameForBar,
  chordName,
  chordVoicingFor,
  createChipSong,
  DrumVoice,
  melodyNoteName,
  randomizeChipSong,
  renderChipSong,
  resizeChipSong,
  stepsPerBar,
} from "../lib/chipSong";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

const KEYS: ChipKey[] = ["C", "D", "E", "F", "G", "A"];
const SCALES: ChipScale[] = ["major", "minor"];
const METERS: ChipMeter[] = ["4/4", "3/4", "6/8"];
const CHORD_DEGREES = [0, 1, 2, 3, 4, 5, 6];
const CHORD_QUALITY_LABELS: Record<ChordQuality, string> = {
  triad: "Triad",
  maj7: "Maj7",
  min7: "Min7",
  dom7: "Dom7",
  "half-dim": "Half dim",
  dim7: "Dim7",
};
const DRUMS: { id: DrumVoice; label: string; color: string }[] = [
  { id: "kick", label: "KICK", color: RGB_THEME.cyan },
  { id: "snare", label: "SNARE", color: RGB_THEME.magenta },
  { id: "hat", label: "HAT", color: RGB_THEME.lime },
];
const PUZZLES: PuzzleKind[] = ["riddle", "word_puzzle", "clue"];

export default function SongStudioScreen() {
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [song, setSong] = useState<ChipSong>(() => createChipSong());
  const [bar, setBar] = useState(0);
  const [published, setPublished] = useState<PublishedSong[]>([]);
  const [puzzleKind, setPuzzleKind] = useState<PuzzleKind>("riddle");
  const [puzzlePrompt, setPuzzlePrompt] = useState("");
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [safeAreaConfirmed, setSafeAreaConfirmed] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    accuracy,
    error: locationError,
    gpsReady,
    location,
    stationaryFixes,
    status: gpsStatus,
  } = useStationaryAuthoringLocation();

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch(() => {});
    getMultiplayerProfile()
      .then((next) => {
        setProfile(next);
        return getSongs(next.playerId);
      })
      .then((response) => setPublished(response.songs))
      .catch((caught) => setError(errorMessage(caught)));
  }, []);

  useEffect(() => {
    if (!gpsReady) setSafeAreaConfirmed(false);
  }, [gpsReady]);

  function patchSong(patch: Partial<ChipSong>) {
    setSong((current) => ({ ...current, ...patch }));
    setMessage(null);
  }

  function selectMeter(meter: ChipMeter) {
    setSong((current) => resizeChipSong(current, meter));
  }

  function chooseChord(degree: number) {
    setSong((current) => ({
      ...current,
      chordDegrees: current.chordDegrees.map((value, index) =>
        index === bar ? degree : value,
      ),
    }));
  }

  function chooseChordQuality(quality: ChordQuality) {
    setSong((current) => {
      const voicings = chordVoicingsForUpdate(current);
      voicings[bar] = {
        ...voicings[bar],
        quality,
      };
      return { ...current, chordVoicings: voicings };
    });
  }

  function toggleChordExtension(extension: ChordExtension) {
    setSong((current) => {
      const voicings = chordVoicingsForUpdate(current);
      const extensions = voicings[bar].extensions.includes(extension)
        ? voicings[bar].extensions.filter((value) => value !== extension)
        : [...voicings[bar].extensions, extension];
      voicings[bar] = {
        ...voicings[bar],
        extensions,
      };
      return { ...current, chordVoicings: voicings };
    });
  }

  function toggleNote(step: number, degree: number) {
    setSong((current) => ({
      ...current,
      melody: current.melody.map((notes, barIndex) =>
        barIndex === bar
          ? notes.map((note, stepIndex) =>
              stepIndex === step ? (note === degree ? null : degree) : note,
            )
          : notes,
      ),
    }));
  }

  function toggleDrum(voice: DrumVoice, step: number) {
    setSong((current) => ({
      ...current,
      drums: {
        ...current.drums,
        [voice]: current.drums[voice].map((hits, barIndex) =>
          barIndex === bar
            ? hits.map((hit, stepIndex) => (stepIndex === step ? !hit : hit))
            : hits,
        ),
      },
    }));
  }

  async function play(nextSong: ChipSong = song) {
    if (rendering) return;
    setRendering(true);
    setError(null);
    try {
      const uri = await renderChipSong(nextSong);
      player.replace({ uri });
      player.play();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRendering(false);
    }
  }

  async function keep() {
    setRendering(true);
    setError(null);
    try {
      const songId = `local-song-${Date.now()}`;
      await saveSongArtifact({
        questId: songId,
        questName: song.title.trim() || "Untitled cartridge",
        questDescription: `An eight-bar ${song.key} ${song.scale} chip song.`,
        source: "song-studio-local",
        latitude: location?.coords.latitude ?? 0,
        longitude: location?.coords.longitude ?? 0,
        songId,
        song: { ...song, title: song.title.trim() || "Untitled cartridge" },
      });
      setMessage("Saved as a playable artifact.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRendering(false);
    }
  }

  async function drop() {
    if (
      !profile ||
      !location ||
      accuracy === null ||
      !gpsReady ||
      !safeAreaConfirmed ||
      publishing
    ) {
      return;
    }
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      const titledSong = {
        ...song,
        title: song.title.trim() || "Untitled cartridge",
      };
      const response = await createSong({
        player_id: profile.playerId,
        player_name: profile.playerName,
        title: titledSong.title,
        composition: titledSong,
        puzzle_kind: puzzleKind,
        puzzle_prompt: puzzlePrompt.trim(),
        puzzle_answer: puzzleAnswer.trim(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy,
        stationary_fixes: stationaryFixes,
        safe_area_confirmed: true,
      });
      await saveSongArtifact({
        questId: response.quest.id,
        questName: response.quest.name,
        questDescription: response.quest.description,
        source: response.quest.source,
        latitude: response.song.latitude,
        longitude: response.song.longitude,
        songId: response.song.id,
        song: response.song.composition,
        songRemoteUrl: response.song.song_url,
      });
      setPublished((current) => [response.song, ...current]);
      setSafeAreaConfirmed(false);
      setMessage("Dropped into the world and saved in Artifacts.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  }

  async function playPublished(item: PublishedSong) {
    setSong(item.composition);
    await play(item.composition);
  }

  const steps = stepsPerBar(song.meter);
  const currentChord = song.chordDegrees[bar];
  const currentVoicing = chordVoicingFor(song, bar);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View>
            <Text style={styles.kicker}>8-BIT TRACKER</Text>
            <Text style={styles.title}>Song Studio</Text>
          </View>
          <Text style={[styles.gps, gpsReady && styles.gpsReady]}>
            {gpsStatus}
          </Text>
        </View>

        <Text style={styles.label}>Cartridge name</Text>
        <TextInput
          maxLength={60}
          onChangeText={(title) => patchSong({ title })}
          placeholder="Untitled cartridge"
          placeholderTextColor={RGB_THEME.dim}
          selectionColor={RGB_THEME.cyan}
          style={styles.input}
          value={song.title}
        />

        <Text style={styles.label}>Key</Text>
        <Segmented
          options={KEYS}
          selected={song.key}
          onChange={(key) => patchSong({ key })}
        />
        <Text style={styles.label}>Scale</Text>
        <Segmented
          options={SCALES}
          selected={song.scale}
          onChange={(scale) => patchSong({ scale })}
        />
        <Text style={styles.label}>Time signature</Text>
        <Segmented options={METERS} selected={song.meter} onChange={selectMeter} />

        <View style={styles.tempoRow}>
          <View>
            <Text style={styles.label}>Tempo</Text>
            <Text style={styles.tempo}>{song.tempo} BPM</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease tempo"
              onPress={() => patchSong({ tempo: Math.max(60, song.tempo - 5) })}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Increase tempo"
              onPress={() => patchSong({ tempo: Math.min(180, song.tempo + 5) })}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Bar</Text>
          <Text style={styles.sectionMeta}>{bar + 1} / 8</Text>
        </View>
        <View style={styles.barSelector}>
          {Array.from({ length: 8 }, (_, index) => (
            <Pressable
              key={index}
              onPress={() => setBar(index)}
              style={[styles.barButton, bar === index && styles.barButtonActive]}
            >
              <Text
                style={[styles.barText, bar === index && styles.barTextActive]}
              >
                {index + 1}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Chord</Text>
          <Text style={styles.sectionMeta}>{chordNameForBar(song, bar)}</Text>
        </View>
        <View style={styles.chords}>
          {CHORD_DEGREES.map((degree) => (
            <Pressable
              key={degree}
              onPress={() => chooseChord(degree)}
              style={[
                styles.chordButton,
                currentChord === degree && styles.chordButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.chordText,
                  currentChord === degree && styles.chordTextActive,
                ]}
              >
                {chordName(song, degree, currentVoicing)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Quality</Text>
        <View style={styles.qualityGrid}>
          {CHORD_QUALITIES.map((quality) => (
            <Pressable
              key={quality}
              onPress={() => chooseChordQuality(quality)}
              style={[
                styles.qualityButton,
                currentVoicing.quality === quality && styles.qualityButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.qualityText,
                  currentVoicing.quality === quality && styles.qualityTextActive,
                ]}
              >
                {CHORD_QUALITY_LABELS[quality]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Extensions</Text>
        <View style={styles.extensionGrid}>
          {CHORD_EXTENSIONS.map((extension) => {
            const active = currentVoicing.extensions.includes(extension);
            return (
              <Pressable
                key={extension}
                onPress={() => toggleChordExtension(extension)}
                style={[
                  styles.extensionButton,
                  active && styles.extensionButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.extensionText,
                    active && styles.extensionTextActive,
                  ]}
                >
                  {extension}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Melody</Text>
          <Text style={styles.sectionMeta}>PULSE 25%</Text>
        </View>
        <View style={styles.noteGrid}>
          {Array.from({ length: 8 }, (_, row) => 7 - row).map((degree) => (
            <View key={degree} style={styles.gridRow}>
              <Text style={styles.noteLabel}>{melodyNoteName(song, degree)}</Text>
              {Array.from({ length: steps }, (_, step) => {
                const active = song.melody[bar][step] === degree;
                return (
                  <Pressable
                    accessibilityLabel={`${melodyNoteName(song, degree)} step ${step + 1}`}
                    key={step}
                    onPress={() => toggleNote(step, degree)}
                    style={[
                      styles.noteCell,
                      step % 2 === 0 && styles.beatCell,
                      active && styles.noteCellActive,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Drums</Text>
          <Text style={styles.sectionMeta}>NOISE CHANNEL</Text>
        </View>
        {DRUMS.map((voice) => (
          <View key={voice.id} style={styles.drumRow}>
            <Text style={[styles.drumLabel, { color: voice.color }]}>
              {voice.label}
            </Text>
            {song.drums[voice.id][bar].map((hit, step) => (
              <Pressable
                accessibilityLabel={`${voice.label} step ${step + 1}`}
                key={step}
                onPress={() => toggleDrum(voice.id, step)}
                style={[
                  styles.drumCell,
                  step % 2 === 0 && styles.beatCell,
                  hit && { backgroundColor: voice.color, borderColor: voice.color },
                ]}
              />
            ))}
          </View>
        ))}

        <View style={styles.transport}>
          <Pressable
            disabled={rendering}
            onPress={() => void play()}
            style={styles.playButton}
          >
            <Text style={styles.playText}>
              {rendering ? "Rendering..." : playerStatus.playing ? "Replay" : "Play"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSong((current) => randomizeChipSong(current))}
            style={styles.randomButton}
          >
            <Text style={styles.randomText}>Randomize</Text>
          </Pressable>
          <Pressable disabled={rendering} onPress={() => void keep()} style={styles.keepButton}>
            <Text style={styles.keepText}>Keep</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Artifact lock</Text>
          <Text style={styles.sectionMeta}>REQUIRED TO DROP</Text>
        </View>
        <Text style={styles.label}>Puzzle type</Text>
        <Segmented
          options={PUZZLES}
          selected={puzzleKind}
          onChange={setPuzzleKind}
        />
        <Text style={styles.label}>Prompt for the finder</Text>
        <TextInput
          maxLength={240}
          multiline
          onChangeText={setPuzzlePrompt}
          placeholder="What has keys but cannot open a door?"
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
          placeholder="piano"
          placeholderTextColor={RGB_THEME.dim}
          selectionColor={RGB_THEME.cyan}
          style={styles.input}
          value={puzzleAnswer}
        />

        <View style={styles.safetyRow}>
          <View style={styles.safetyText}>
            <Text style={styles.safetyTitle}>Drop this song here</Text>
            <Text style={styles.safetyCopy}>
              I am stationary in a permitted pedestrian or parking area, away
              from roads, shoulders, pumps, and drive lanes.
            </Text>
          </View>
          <Switch
            disabled={!gpsReady}
            ios_backgroundColor={RGB_THEME.border}
            onValueChange={setSafeAreaConfirmed}
            thumbColor={safeAreaConfirmed ? RGB_THEME.lime : RGB_THEME.muted}
            trackColor={{ false: RGB_THEME.border, true: RGB_THEME.surfaceRaised }}
            value={safeAreaConfirmed}
          />
        </View>

        {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable
          disabled={
            !gpsReady ||
            !safeAreaConfirmed ||
            !profile ||
            puzzlePrompt.trim().length < 8 ||
            !puzzleAnswer.trim() ||
            publishing
          }
          onPress={() => void drop()}
          style={[
            styles.dropButton,
            (!gpsReady ||
              !safeAreaConfirmed ||
              !profile ||
              puzzlePrompt.trim().length < 8 ||
              !puzzleAnswer.trim() ||
              publishing) &&
              styles.disabled,
          ]}
        >
          {publishing ? (
            <ActivityIndicator color={RGB_THEME.black} />
          ) : (
            <Text style={styles.dropText}>Drop song into the world</Text>
          )}
        </Pressable>

        <View style={styles.libraryHeading}>
          <Text style={styles.sectionTitle}>Your world drops</Text>
          <Text style={styles.libraryCount}>{published.length}</Text>
        </View>
        {published.length ? (
          published.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void playPublished(item)}
              style={styles.songRow}
            >
              <View style={styles.songGlyph}>
                <Text style={styles.songGlyphText}>♪</Text>
              </View>
              <View style={styles.songDetails}>
                <Text numberOfLines={1} style={styles.songTitle}>
                  {item.title}
                </Text>
                <Text style={styles.songMeta}>
                  {item.composition.key} {item.composition.scale} ·{" "}
                  {item.composition.meter} · {item.composition.tempo} BPM
                </Text>
              </View>
              <Text style={styles.rowPlay}>▶</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>No songs dropped yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Segmented<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: readonly T[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.segment, selected === option && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              selected === option && styles.segmentTextActive,
            ]}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function chordVoicingsForUpdate(song: ChipSong) {
  return Array.from({ length: 8 }, (_, index) => chordVoicingFor(song, index));
}

const CELL_SIZE = 30;

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: { padding: 18, paddingBottom: 56 },
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: { color: RGB_THEME.magenta, fontSize: 10, fontWeight: "900" },
  title: { color: RGB_THEME.text, fontSize: 28, fontWeight: "900", marginTop: 3 },
  gps: { color: RGB_THEME.dim, fontSize: 10, fontWeight: "800", maxWidth: 120 },
  gpsReady: { color: RGB_THEME.lime },
  label: {
    color: RGB_THEME.muted,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 20,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  puzzleInput: { minHeight: 84, paddingTop: 12 },
  segmented: {
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 40 },
  segmentActive: { backgroundColor: RGB_THEME.cyan },
  segmentText: { color: RGB_THEME.muted, fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: RGB_THEME.black },
  tempoRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tempo: { color: RGB_THEME.text, fontSize: 22, fontWeight: "800" },
  stepper: { flexDirection: "row", gap: 8 },
  stepperButton: {
    alignItems: "center",
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 44,
  },
  stepperText: { color: RGB_THEME.lime, fontSize: 24, fontWeight: "700" },
  sectionHeading: {
    alignItems: "baseline",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    paddingBottom: 8,
  },
  sectionTitle: { color: RGB_THEME.text, fontSize: 18, fontWeight: "900" },
  sectionMeta: { color: RGB_THEME.cyan, fontSize: 10, fontWeight: "900" },
  barSelector: { flexDirection: "row", gap: 5, marginTop: 12 },
  barButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: "center",
  },
  barButtonActive: { backgroundColor: RGB_THEME.magenta, borderColor: RGB_THEME.magenta },
  barText: { color: RGB_THEME.muted, fontSize: 11, fontWeight: "900" },
  barTextActive: { color: RGB_THEME.black },
  chords: { flexDirection: "row", gap: 7 },
  chordButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: "center",
  },
  chordButtonActive: { backgroundColor: RGB_THEME.lime, borderColor: RGB_THEME.lime },
  chordText: { color: RGB_THEME.text, fontSize: 12, fontWeight: "800" },
  chordTextActive: { color: RGB_THEME.black },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  qualityButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 3,
    borderWidth: 1,
    flexBasis: 92,
    flexGrow: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  qualityButtonActive: {
    backgroundColor: RGB_THEME.cyan,
    borderColor: RGB_THEME.cyan,
  },
  qualityText: { color: RGB_THEME.text, fontSize: 11, fontWeight: "900" },
  qualityTextActive: { color: RGB_THEME.black },
  extensionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  extensionButton: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 3,
    borderWidth: 1,
    minHeight: 34,
    minWidth: 48,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  extensionButtonActive: {
    backgroundColor: RGB_THEME.magenta,
    borderColor: RGB_THEME.magenta,
  },
  extensionText: { color: RGB_THEME.text, fontSize: 11, fontWeight: "900" },
  extensionTextActive: { color: RGB_THEME.black },
  noteGrid: { marginTop: 12 },
  gridRow: { alignItems: "center", flexDirection: "row", gap: 4, marginBottom: 4 },
  noteLabel: { color: RGB_THEME.muted, fontSize: 9, fontWeight: "900", width: 24 },
  noteCell: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 2,
    borderWidth: 1,
    flex: 1,
    height: 24,
    maxWidth: CELL_SIZE,
  },
  beatCell: { borderColor: RGB_THEME.borderStrong },
  noteCellActive: { backgroundColor: RGB_THEME.cyan, borderColor: RGB_THEME.cyan },
  drumRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 8 },
  drumLabel: { fontSize: 8, fontWeight: "900", width: 42 },
  drumCell: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 2,
    borderWidth: 1,
    flex: 1,
    height: 28,
    maxWidth: CELL_SIZE,
  },
  transport: { flexDirection: "row", gap: 8, marginTop: 28 },
  playButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  playText: { color: RGB_THEME.black, fontSize: 13, fontWeight: "900" },
  randomButton: {
    alignItems: "center",
    borderColor: RGB_THEME.cyan,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  randomText: { color: RGB_THEME.cyan, fontSize: 12, fontWeight: "900" },
  keepButton: {
    alignItems: "center",
    borderColor: RGB_THEME.lime,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  keepText: { color: RGB_THEME.lime, fontSize: 12, fontWeight: "900" },
  safetyRow: {
    alignItems: "center",
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 30,
    padding: 14,
  },
  safetyText: { flex: 1 },
  safetyTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "900" },
  safetyCopy: { color: RGB_THEME.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  error: { color: RGB_THEME.danger, fontSize: 12, marginTop: 12 },
  success: { color: RGB_THEME.lime, fontSize: 12, marginTop: 12 },
  dropButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 5,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50,
  },
  dropText: { color: RGB_THEME.black, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.35 },
  libraryHeading: {
    alignItems: "baseline",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 38,
    paddingBottom: 9,
  },
  libraryCount: { color: RGB_THEME.magenta, fontSize: 14, fontWeight: "900" },
  songRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 66,
  },
  songGlyph: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 3,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  songGlyphText: { color: RGB_THEME.black, fontSize: 22, fontWeight: "900" },
  songDetails: { flex: 1, minWidth: 0 },
  songTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "900" },
  songMeta: { color: RGB_THEME.muted, fontSize: 10, marginTop: 4 },
  rowPlay: { color: RGB_THEME.cyan, fontSize: 14 },
  empty: { color: RGB_THEME.dim, fontSize: 13, paddingVertical: 18 },
});
