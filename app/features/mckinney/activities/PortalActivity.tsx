import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import { pausePlayers } from "../audio/safePause";
import {
  ACTIVITIES,
  SWEET_SEQUENCE,
  fitsSlice,
  fitsWeave,
  memoryStep,
} from "./activities";
import type { MapPortal } from "../portals/mapAccess";

export function PortalActivity({
  portal,
  preview,
  journey,
}: {
  portal: MapPortal;
  preview: boolean;
  journey?: {
    completed: boolean;
    finished: boolean;
    trail: string;
    choices: { id: string; label: string }[];
    onComplete: () => void;
    onChoose: (id: string) => void;
  };
}) {
  const activity = ACTIVITIES[portal.id];
  const [done, setDone] = useState(journey?.completed ?? false);
  const [selected, setSelected] = useState<number[]>([]);
  const [rotation, setRotation] = useState(1);
  const [rows, setRows] = useState([0, 2]);
  const [progress, setProgress] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [memoryReady, setMemoryReady] = useState(false);
  const [message, setMessage] = useState("");
  const [holdSeconds, setHoldSeconds] = useState(0);
  const mounted = useRef(true);
  const [holding, setHolding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const mutedRef = useRef(audioMuted);
  mutedRef.current = audioMuted;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const low = useAudioPlayer(require("../../../assets/audio/note-low.wav"));
  const middle = useAudioPlayer(
    require("../../../assets/audio/note-middle.wav"),
  );
  const high = useAudioPlayer(require("../../../assets/audio/note-high.wav"));
  const players = [low, middle, high];
  const playerRef = useRef(players);
  playerRef.current = players;

  function later(action: () => void, delay: number) {
    timers.current.push(setTimeout(action, delay));
  }
  function stop() {
    generation.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pausePlayers(playerRef.current);
  }
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stop();
        setWatching(false);
        setMemoryReady(false);
        setHolding(false);
        setPlaying(false);
        setLit(null);
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      stop();
    };
  }, []);
  async function note(index: number) {
    if (mutedRef.current) return;
    const run = generation.current;
    try {
      const player = playerRef.current[index];
      if (!player.isLoaded) {
        setMessage("Sound is loading. You can still use the visual controls.");
        return;
      }
      player.volume = 0.35;
      await player.seekTo(0);
      if (mounted.current && run === generation.current && !mutedRef.current)
        player.play();
    } catch {
      if (mounted.current && run === generation.current)
        setMessage("Sound unavailable. The visual activity still works.");
    }
  }
  function complete() {
    setDone(true);
    journey?.onComplete();
  }
  function reset() {
    stop();
    setDone(false);
    setSelected([]);
    setRotation(1);
    setRows([0, 2]);
    setProgress(0);
    setLit(null);
    setWatching(false);
    setMemoryReady(false);
    setMessage("");
    setHolding(false);
    setHoldSeconds(0);
    setPlaying(false);
  }
  function toggle(index: number) {
    void note(index);
    setSelected((current) =>
      current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index],
    );
  }
  function playComposition() {
    if (selected.length !== 3 || playing) return;
    stop();
    setPlaying(true);
    const phrase =
      activity.kind === "rhythm" ? [0, 1, 0, 2, 0, 1, 2, 1] : selected;
    if (activity.kind === "blend") {
      phrase.forEach((index) => void note(index));
    } else {
      phrase.forEach((index, step) =>
        later(() => {
          setLit(index);
          void note(index);
        }, step * 450),
      );
    }
    later(
      () => {
        setPlaying(false);
        setLit(null);
        complete();
      },
      activity.kind === "blend" ? 1200 : phrase.length * 450 + 300,
    );
  }
  function watchSequence() {
    stop();
    setDone(false);
    setProgress(0);
    setWatching(true);
    setMemoryReady(false);
    setMessage("");
    SWEET_SEQUENCE.forEach((index, step) => {
      later(
        () => {
          setLit(index);
          void note(index);
        },
        step * 900 + 300,
      );
      later(() => setLit(null), step * 900 + 900);
    });
    later(() => {
      setWatching(false);
      setMemoryReady(true);
      setMessage("Your turn. Repeat the three lights.");
    }, 3100);
  }
  const musical = ["blend", "rhythm", "performance"].includes(activity.kind);
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={[s.place, { color: portal.color }]}>{portal.place}</Text>
      <Text style={s.title}>{activity.title}</Text>
      <Text style={s.copy}>{activity.prompt}</Text>
      {journey && <Text style={s.note}>Preview path: {journey.trail}</Text>}
      {preview && activity.kind === "notice" && (
        <Text style={s.copy}>
          At home, use an imagined detail. At the portal, look around from the
          sidewalk.
        </Text>
      )}
      {musical && (
        <>
          <View style={s.row}>
            {["Low", "Middle", "High"].map((label, index) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{
                  selected: selected.includes(index),
                  disabled: playing,
                }}
                disabled={playing}
                onPress={() => toggle(index)}
                style={[
                  s.tile,
                  selected.includes(index) && s.chosen,
                  lit === index && s.lit,
                ]}
              >
                <Text style={s.buttonText}>
                  {activity.kind === "rhythm"
                    ? ["Pulse", "Tap", "Chime"][index]
                    : label}
                  {selected.includes(index) ? " ✓" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.copy}>
            {selected.length}/3 layers
            {activity.kind === "performance"
              ? " · order: " +
                selected.map((i) => ["Low", "Middle", "High"][i]).join(" → ")
              : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={selected.length !== 3 || playing}
            accessibilityState={{ disabled: selected.length !== 3 || playing }}
            style={[s.button, (selected.length !== 3 || playing) && s.disabled]}
            onPress={playComposition}
          >
            <Text style={s.buttonText}>
              {playing
                ? "Playing…"
                : activity.kind === "blend"
                  ? "Blend the notes"
                  : "Play my composition"}
            </Text>
          </Pressable>
        </>
      )}
      {activity.kind === "slice" && (
        <>
          <View style={s.pieArea}>
            <View style={s.pie}>
              <View style={s.gap} />
            </View>
            <View
              style={[
                s.looseSlice,
                { transform: [{ rotate: `${rotation * 90}deg` }] },
              ]}
            >
              <View style={[s.wedge, { backgroundColor: portal.color }]} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => {
              const next = (rotation + 1) % 4;
              setRotation(next);
              if (fitsSlice(next)) complete();
            }}
          >
            <Text style={s.buttonText}>Turn slice 90°</Text>
          </Pressable>
          <Text style={s.copy}>
            {fitsSlice(rotation)
              ? "The slice fits the top-right gap."
              : "Turn the colored slice toward the top-right gap."}
          </Text>
        </>
      )}
      {activity.kind === "notice" && (
        <>
          <View
            style={[
              s.echo,
              {
                borderColor: portal.color,
                borderRadius:
                  selected[0] === 0 ? 90 : selected[0] === 1 ? 12 : 0,
                transform: [{ rotate: selected[0] === 2 ? "45deg" : "0deg" }],
              },
            ]}
          >
            <Text style={[s.symbol, { color: portal.color }]}>
              {selected[0] === 0 ? "✿" : selected[0] === 1 ? "≈" : "◇"}
            </Text>
          </View>
          {[
            "Something growing",
            "Something weathered",
            "Something handmade",
          ].map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              style={[s.button, selected[0] === index && s.chosen]}
              onPress={() => {
                setSelected([index]);
                complete();
              }}
            >
              <Text style={s.buttonText}>{label}</Text>
            </Pressable>
          ))}
        </>
      )}
      {activity.kind === "memory" && (
        <>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={watchSequence}
          >
            <Text style={s.buttonText}>
              {watching ? "Replay lights" : "Watch the lights"}
            </Text>
          </Pressable>
          <View style={s.row}>
            {[0, 1, 2].map((index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Light ${index + 1}`}
                disabled={!memoryReady || done}
                style={[s.tile, lit === index && s.lit]}
                onPress={() => {
                  void note(index);
                  const next = memoryStep(progress, index);
                  setProgress(next);
                  setMessage(
                    next === 0
                      ? "Not quite. Start the sequence again."
                      : `${next}/3 matched`,
                  );
                  if (next === 3) {
                    complete();
                    setMemoryReady(false);
                  }
                }}
              >
                <Text style={s.buttonText}>
                  {index + 1}
                  {lit === index ? " ●" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.copy}>
            {watching
              ? "Watch…"
              : memoryReady
                ? "Your turn"
                : "Tap Watch the lights to begin."}
          </Text>
        </>
      )}
      {activity.kind === "weave" && (
        <>
          {[0, 1].map((row) => (
            <View key={row}>
              <View style={s.row}>
                {[0, 1, 2].map((column) => (
                  <View key={column} style={s.cell}>
                    <Text style={[s.symbol, { color: portal.color }]}>
                      {rows[row] === column ? (row === 0 ? "⌃" : "⌄") : "·"}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                style={s.button}
                onPress={() => {
                  const next = [...rows];
                  next[row] = (next[row] + 1) % 3;
                  setRows(next);
                  if (fitsWeave(next[0], next[1])) complete();
                }}
              >
                <Text style={s.buttonText}>
                  Shift {row === 0 ? "upper" : "lower"} half →
                </Text>
              </Pressable>
            </View>
          ))}
          <Text style={s.copy}>Target: both halves in the center column.</Text>
        </>
      )}
      {activity.kind === "hold" && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold for three seconds"
            style={[s.hold, holding && s.chosen]}
            disabled={done}
            accessibilityState={{ disabled: done }}
            onPressIn={() => {
              stop();
              setHolding(true);
              setHoldSeconds(0);
              void note(0);
              later(() => {
                setHoldSeconds(1);
                void note(1);
              }, 1000);
              later(() => {
                setHoldSeconds(2);
                void note(2);
              }, 2000);
              holdTimer.current = setTimeout(() => {
                holdTimer.current = null;
                setHoldSeconds(3);
                complete();
                setHolding(false);
                [0, 1, 2].forEach((index) => void note(index));
              }, 3000);
            }}
            onPressOut={() => {
              if (holdTimer.current) {
                stop();
                setHoldSeconds(0);
              }
              setHolding(false);
            }}
          >
            <Text style={s.buttonText}>
              {done
                ? "Settled ✓"
                : holding
                  ? `${holdSeconds} / 3 seconds`
                  : "Hold · 3 seconds"}
            </Text>
          </Pressable>
          <Text style={s.copy}>
            Hold to hear three rising notes, then a chord. Releasing early
            resets the hold.
          </Text>
        </>
      )}
      {message !== "" && (
        <Text style={s.copy} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      {done && (
        <View style={s.result}>
          <Text style={s.place} accessibilityLiveRegion="polite">
            {preview ? "PREVIEW COMPLETE" : "ACTIVITY COMPLETE"}
          </Text>
          <Text style={s.copy}>
            {journey
              ? journey.finished
                ? "Journey complete. Your choices brought these fragments together at MPAC."
                : "Fragment found. Choose which connection to follow next."
              : activity.clue}
          </Text>
          {journey?.choices.map((choice) => (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              style={s.button}
              onPress={() => journey.onChoose(choice.id)}
            >
              <Text style={s.buttonText}>{choice.label}</Text>
            </Pressable>
          ))}
          <Text style={s.note}>
            Story clue only · no portal unlocked or visit recorded.
          </Text>
        </View>
      )}
      <View style={s.row}>
        <Pressable accessibilityRole="button" style={s.button} onPress={reset}>
          <Text style={s.buttonText}>Start again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => {
            setAudioMuted(!audioMuted);
            if (!audioMuted) {
              generation.current++;
              pausePlayers(playerRef.current);
            }
          }}
        >
          <Text style={s.buttonText}>
            {audioMuted ? "Sound on" : "Mute sound"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#101e24" },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  place: { fontSize: 12, color: "#80edbc", fontWeight: "700" },
  title: { fontSize: 26, color: "#f1f8ef", fontWeight: "700" },
  copy: { fontSize: 15, lineHeight: 22, color: "#b3c9be" },
  note: { fontSize: 12, lineHeight: 18, color: "#b3c9be" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  button: { backgroundColor: "#295e4c", padding: 15, borderRadius: 12 },
  buttonText: {
    color: "#f4fff8",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  tile: {
    flex: 1,
    paddingVertical: 24,
    backgroundColor: "#243b43",
    borderRadius: 12,
    minWidth: 75,
  },
  chosen: { backgroundColor: "#397b60" },
  lit: { backgroundColor: "#88712a" },
  disabled: { opacity: 0.4 },
  result: {
    padding: 18,
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#213d36",
  },
  pieArea: { height: 190, alignItems: "center", justifyContent: "center" },
  pie: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#839e91",
    overflow: "hidden",
  },
  gap: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 80,
    height: 80,
    backgroundColor: "#101e24",
  },
  looseSlice: { position: "absolute", width: 160, height: 160 },
  wedge: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 80,
    height: 80,
    borderTopRightRadius: 80,
  },
  echo: {
    alignSelf: "center",
    width: 140,
    height: 140,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
  },
  symbol: { fontSize: 48 },
  cell: { flex: 1, alignItems: "center" },
  hold: {
    alignSelf: "center",
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#295e4c",
  },
});
