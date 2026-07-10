import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import { GeneratedMelody, generateMelody } from "../lib/chiptune";
import { RGB_THEME } from "../lib/theme";

const DEMO_SEED = 0x80_8B_17;

export default function RainbowBitScreen() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [melody, setMelody] = useState<GeneratedMelody | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch(() => {});
  }, []);

  async function loadAndPlay() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = melody ?? (await generateMelody("bright", DEMO_SEED));
      setMelody(next);
      player.replace({ uri: next.uri });
      player.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function replay() {
    if (!melody) {
      await loadAndPlay();
      return;
    }
    await player.seekTo(0);
    player.play();
  }

  const notes = melody?.notes ?? previewNotes();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>ORIGINAL CHIP SIGNAL</Text>
        <Text style={styles.title}>8-bit rainbow demo</Text>
        <Text style={styles.copy}>
          A tiny original chiptune sketch for testing a separate music page.
        </Text>
      </View>

      <View style={styles.cartridge}>
        <View style={styles.cartridgeTop}>
          <View>
            <Text style={styles.label}>HOMAGE CART</Text>
            <Text style={styles.meta}>
              {melody ? `${melody.keyName} / ${melody.tempo} BPM` : "fixed seed / bright"}
            </Text>
          </View>
          <View style={[styles.led, status.playing && styles.ledActive]} />
        </View>

        <View style={styles.sequencer}>
          {notes.map((note, index) => (
            <View key={index} style={styles.stepWrap}>
              <View
                style={[
                  styles.step,
                  {
                    height: note ? 28 + ((note % 12) / 11) * 98 : 12,
                    backgroundColor: note ? stepColor(index) : RGB_THEME.border,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.transport}>
          <Pressable
            disabled={loading}
            onPress={melody ? replay : loadAndPlay}
            style={[styles.playButton, loading && styles.disabled]}
          >
            {loading ? (
              <ActivityIndicator color={RGB_THEME.black} />
            ) : (
              <Text style={styles.playText}>
                {status.playing ? "Replay" : "Play snippet"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Note</Text>
        <Text style={styles.noteCopy}>
          This does not reproduce the copyrighted melody. It is a small original
          8-bit signal for testing how a music/artifact moment might feel in
          Homage.
        </Text>
      </View>
    </ScrollView>
  );
}

function previewNotes() {
  return [72, 76, 79, null, 84, 83, 79, 76, 74, null, 76, 79, 81, 79, 76, 72];
}

function stepColor(index: number) {
  const colors = [
    RGB_THEME.lime,
    RGB_THEME.amber,
    RGB_THEME.cyan,
    RGB_THEME.magenta,
  ];
  return colors[index % colors.length];
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: { padding: 22, paddingBottom: 44 },
  header: { marginTop: 8 },
  kicker: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  title: {
    color: RGB_THEME.text,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  copy: {
    color: RGB_THEME.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  cartridge: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.cyan,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
    padding: 16,
  },
  cartridgeTop: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  label: { color: RGB_THEME.lime, fontSize: 13, fontWeight: "900" },
  meta: { color: RGB_THEME.muted, fontSize: 12, marginTop: 4 },
  led: {
    backgroundColor: RGB_THEME.border,
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  ledActive: { backgroundColor: RGB_THEME.lime },
  sequencer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
    height: 190,
    marginTop: 28,
    paddingBottom: 12,
  },
  stepWrap: { alignItems: "center", flex: 1, justifyContent: "flex-end" },
  step: { borderRadius: 3, minHeight: 10, width: "100%" },
  transport: { marginTop: 20 },
  playButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 6,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.6 },
  playText: { color: RGB_THEME.black, fontSize: 16, fontWeight: "900" },
  error: {
    color: RGB_THEME.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
  },
  note: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  noteTitle: { color: RGB_THEME.amber, fontSize: 14, fontWeight: "900" },
  noteCopy: {
    color: RGB_THEME.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
