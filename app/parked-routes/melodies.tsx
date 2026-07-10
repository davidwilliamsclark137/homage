import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import {
  GeneratedMelody,
  generateMelody,
  MelodyMood,
} from "../lib/chiptune";
import {
  CollectedMelody,
  getCollectedMelodies,
} from "../lib/melodyCollection";
import { RGB_THEME } from "../lib/theme";

const MOODS: { id: MelodyMood; label: string }[] = [
  { id: "bright", label: "Bright" },
  { id: "dreamy", label: "Dreamy" },
  { id: "arcade", label: "Arcade" },
];

export default function MelodiesScreen() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [mood, setMood] = useState<MelodyMood>("bright");
  const [melody, setMelody] = useState<GeneratedMelody | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState<CollectedMelody[]>([]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCollectedMelodies()
        .then((melodies) => {
          if (active) setCollected(melodies);
        })
        .catch((caught) => {
          if (active) {
            setError(caught instanceof Error ? caught.message : String(caught));
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

  async function createAndPlay(nextMood: MelodyMood = mood) {
    if (generating) return;
    setGenerating(true);
    setError(null);

    try {
      const next = await generateMelody(nextMood);
      setMelody(next);
      player.replace({ uri: next.uri });
      player.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setGenerating(false);
    }
  }

  async function replay() {
    if (!melody) {
      await createAndPlay();
      return;
    }
    await player.seekTo(0);
    player.play();
  }

  function selectMood(nextMood: MelodyMood) {
    setMood(nextMood);
    void createAndPlay(nextMood);
  }

  function playCollected(next: CollectedMelody) {
    setMood(next.mood);
    setMelody(next);
    player.replace({ uri: next.uri });
    player.play();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Melody Lab</Text>
        <Text style={styles.metadata}>
          {melody ? `${melody.keyName} · ${melody.tempo} BPM` : "16-step chip synth"}
        </Text>
      </View>

      <View style={styles.sequencer}>
        {(melody?.notes ?? Array.from({ length: 16 }, () => null)).map(
          (note, index) => (
            <View
              key={index}
              style={[
                styles.step,
                {
                  height: note ? 24 + ((note % 12) / 11) * 88 : 12,
                  backgroundColor: note
                    ? stepColor(mood, index)
                    : RGB_THEME.border,
                },
              ]}
            />
          ),
        )}
      </View>

      <View style={styles.moodControl}>
        {MOODS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => selectMood(option.id)}
            style={[
              styles.moodOption,
              mood === option.id && styles.moodOptionActive,
            ]}
          >
            <Text
              style={[
                styles.moodText,
                mood === option.id && styles.moodTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.transport}>
        <Pressable
          accessibilityLabel={status.playing ? "Replay melody" : "Play melody"}
          style={styles.playButton}
          onPress={replay}
        >
          <Text style={styles.playIcon}>▶</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Generate a new melody"
          disabled={generating}
          style={[styles.generateButton, generating && styles.disabled]}
          onPress={() => createAndPlay()}
        >
          <Text style={styles.generateIcon}>↻</Text>
          <Text style={styles.generateText}>
            {generating ? "Generating" : "New melody"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.collectionHeader}>
        <Text style={styles.collectionTitle}>Found melodies</Text>
        <Text style={styles.collectionCount}>{collected.length}</Text>
      </View>

      {collected.length ? (
        <View style={styles.collection}>
          {collected.map((item) => (
            <Pressable
              key={item.id}
              accessibilityLabel={`Play melody found at ${item.locationName}`}
              onPress={() => playCollected(item)}
              style={({ pressed }) => [
                styles.melodyRow,
                pressed && styles.melodyRowPressed,
              ]}
            >
              <View style={styles.foundIcon}>
                <Text style={styles.foundIconText}>♪</Text>
              </View>
              <View style={styles.foundDetails}>
                <Text numberOfLines={1} style={styles.foundName}>
                  {item.locationName}
                </Text>
                <Text style={styles.foundMetadata}>
                  {item.mood} · {item.keyName} · {item.tempo} BPM
                </Text>
              </View>
              <Text style={styles.rowPlay}>▶</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyCollection}>
          Explore cyan music markers on the map to fill this collection.
        </Text>
      )}
    </ScrollView>
  );
}

function stepColor(mood: MelodyMood, index: number) {
  const colors: Record<MelodyMood, string[]> = {
    bright: [RGB_THEME.lime, RGB_THEME.amber, RGB_THEME.cyan, "#FF7A8F"],
    dreamy: [RGB_THEME.cyan, "#A978FF", "#45E6B1", RGB_THEME.magenta],
    arcade: [RGB_THEME.magenta, "#FF8A4C", RGB_THEME.lime, RGB_THEME.cyan],
  };
  return colors[mood][index % colors[mood].length];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RGB_THEME.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { color: RGB_THEME.text, fontSize: 24, fontWeight: "800" },
  metadata: { color: RGB_THEME.muted, fontSize: 12, fontWeight: "700" },
  sequencer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
    height: 180,
    justifyContent: "center",
    marginTop: 48,
    paddingBottom: 16,
  },
  step: {
    borderRadius: 2,
    flex: 1,
    maxWidth: 18,
    minHeight: 12,
  },
  moodControl: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 24,
    overflow: "hidden",
  },
  moodOption: {
    alignItems: "center",
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  moodOptionActive: { backgroundColor: RGB_THEME.cyan },
  moodText: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "800" },
  moodTextActive: { color: RGB_THEME.black },
  transport: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 36,
  },
  playButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  playIcon: { color: RGB_THEME.black, fontSize: 20, marginLeft: 3 },
  generateButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  generateIcon: { color: RGB_THEME.lime, fontSize: 22 },
  generateText: { color: RGB_THEME.text, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  error: {
    color: RGB_THEME.danger,
    fontSize: 13,
    marginTop: 20,
    textAlign: "center",
  },
  collectionHeader: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 52,
    paddingBottom: 12,
  },
  collectionTitle: { color: RGB_THEME.text, fontSize: 18, fontWeight: "800" },
  collectionCount: { color: RGB_THEME.cyan, fontSize: 15, fontWeight: "800" },
  collection: { marginTop: 4 },
  melodyRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
  },
  melodyRowPressed: { opacity: 0.62 },
  foundIcon: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 4,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  foundIconText: { color: RGB_THEME.black, fontSize: 24, fontWeight: "900" },
  foundDetails: { flex: 1, minWidth: 0 },
  foundName: { color: RGB_THEME.text, fontSize: 15, fontWeight: "800" },
  foundMetadata: {
    color: RGB_THEME.muted,
    fontSize: 12,
    marginTop: 4,
    textTransform: "capitalize",
  },
  rowPlay: { color: RGB_THEME.magenta, fontSize: 16, paddingHorizontal: 8 },
  emptyCollection: {
    color: RGB_THEME.dim,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 20,
  },
});
