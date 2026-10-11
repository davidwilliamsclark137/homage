import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import {
  MAP_PORTALS,
  portalAccess,
} from "../features/mckinney/portals/mapAccess";
import { type Fix } from "../features/mckinney/portals/rooftop";
import { pausePlayers } from "../features/mckinney/audio/safePause";
import { request, type Session, type SharedWalk } from "../features/shared/api";

import { fragmentNotes, compositionNotes } from "../features/shared/music";

const STORAGE_KEY = "homage-shared-walk-v1";
export default function SharedWalkScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [walk, setWalk] = useState<SharedWalk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Session["mode"]>("rehearsal");
  const [choice, setChoice] = useState(0);
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsAttempt, setGpsAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const low = useAudioPlayer(require("../assets/audio/note-low.wav"));
  const middle = useAudioPlayer(require("../assets/audio/note-middle.wav"));
  const high = useAudioPlayer(require("../assets/audio/note-high.wav"));
  const players = useRef([low, middle, high]);
  players.current = [low, middle, high];
  const playback = useRef(0);
  const mounted = useRef(true);
  const pending = useRef(false);
  const active = foreground && focused;
  const activeRef = useRef(active);
  activeRef.current = active;
  const finale = MAP_PORTALS.find((p) => p.id === "mpac-meeting")!;
  const destination =
    walk?.fragment !== null && walk
      ? finale
      : MAP_PORTALS.find(
          (p) =>
            p.id ===
            (walk?.role === "patina"
              ? "patina-storefront"
              : "landon-storefront"),
        )!;
  const access = portalAccess(destination, fix, Platform.OS, now);
  const canAct =
    active && (walk?.mode === "rehearsal" || (!gpsError && access.ready));
  const present = useRef(false);
  present.current =
    active &&
    !!walk &&
    (walk.mode === "rehearsal" ||
      (!gpsError && portalAccess(finale, fix, Platform.OS, now).ready));
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    mounted.current = true;
    const playbackToken = playback;
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setFix(null);
    });
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (mounted.current && value) setSession(JSON.parse(value));
      })
      .catch(() => {
        if (mounted.current)
          setError("Could not restore this phone’s session.");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
      subscription.remove();
      playbackToken.current++;
      pausePlayers(players.current);
    };
  }, []);
  const send = useCallback(
    async (action: string, data = {}, target = session) => {
      if (!target || pending.current) return;
      pending.current = true;
      setBusy(true);
      try {
        const result = await request(target, action, {
          ...data,
          present: present.current,
        });
        if (mounted.current) {
          setWalk(result);
          setError("");
        }
      } catch (e) {
        if (mounted.current)
          setError(
            e instanceof Error
              ? e.message
              : "Connection unavailable. Try again.",
          );
      } finally {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [session],
  );
  useEffect(() => {
    if (!session || !active) return;
    void send("start");
    const timer = setInterval(() => {
      void send("state");
    }, 5000);
    return () => {
      clearInterval(timer);
      void request(session, "away").catch(() => {});
    };
  }, [session, active, send]);
  useEffect(() => {
    if (!active) {
      playback.current++;
      pausePlayers(players.current);
      setPlaying(false);
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active || walk?.mode !== "walk") return;
    let cancelled = false;
    let watcher: Location.LocationSubscription | undefined;
    setFix(null);
    setGpsError("");
    void (async () => {
      if (Platform.OS === "web")
        throw Error("Use Expo Go for an outdoor walk; rehearsal works here.");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted)
        throw Error("Allow precise location to contribute outdoors.");
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (position) => {
          if (!cancelled) {
            setFix({ ...position.coords, timestamp: position.timestamp });
            setGpsError("");
          }
        },
        (reason) => {
          if (!cancelled) {
            setFix(null);
            setGpsError(reason);
          }
        },
      );
      if (cancelled) watcher.remove();
    })().catch((e) => {
      if (!cancelled) setGpsError(e.message);
    });
    return () => {
      cancelled = true;
      watcher?.remove();
    };
  }, [active, walk?.mode, gpsAttempt]);
  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const bytes = await Crypto.getRandomBytesAsync(32);
      const next: Session = {
        token: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
          "",
        ),
        mode,
        code: code.trim().toUpperCase() || undefined,
      };
      // Save before sending, so a lost response retries the same identity.
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
    } catch {
      setError("Could not save a session on this phone. Please retry.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function leave() {
    if (!session || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await request(session, "leave");
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setWalk(null);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not leave. Retry when connected.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function forgetExpired() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setWalk(null);
      setError("");
    } catch {
      setError("Could not clear local storage. Please retry.");
    }
  }
  async function play(combined = false) {
    if (muted || playing) return;
    const run = ++playback.current;
    setPlaying(true);
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      });
      const notes =
        combined &&
        walk?.fragment !== null &&
        walk?.other?.fragment !== null &&
        walk?.other?.fragment !== undefined
          ? compositionNotes(walk.role, walk.fragment, walk.other.fragment)
          : fragmentNotes(walk?.role ?? "landon", walk?.fragment ?? choice);
      for (const note of notes) {
        if (
          note === undefined ||
          run !== playback.current ||
          !activeRef.current
        )
          break;
        const player = players.current[note];
        if (!player.isLoaded) throw Error("Sound is still loading. Try again.");
        await player.seekTo(0);
        if (run !== playback.current || !activeRef.current) break;
        player.play();
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Sound unavailable.");
    } finally {
      if (mounted.current && run === playback.current) setPlaying(false);
    }
  }
  function button(label: string, action: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled || busy}
        style={[s.button, (disabled || busy) && s.disabled]}
        onPress={action}
      >
        <Text style={s.buttonText}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        {button("← Back to map", () => router.back())}
        <Text style={s.title}>A shared walk</Text>
        <Text style={s.copy}>
          Two places, two contributions, one small composition.
        </Text>
        {loading ? (
          <Text style={s.copy}>Restoring your walk…</Text>
        ) : !session ? (
          <>
            <Text style={s.copy}>
              At Landon, leave three notes. At Patina, notice a detail and add
              its rhythm. Bring the two parts to MPAC. You can finish with an
              earlier contribution; meeting is always optional.
            </Text>
            {button(
              mode === "rehearsal"
                ? "✓ Rehearsal · try from anywhere"
                : "Rehearsal · try from anywhere",
              () => setMode("rehearsal"),
            )}
            {button(
              mode === "walk"
                ? "✓ Outdoor walk · GPS required"
                : "Outdoor walk · GPS required",
              () => setMode("walk"),
            )}
            <Text style={s.copy}>
              Have a partner’s code? Both phones must choose the same mode.
              Leave blank to start. Outdoor walks can connect with an earlier
              visitor; rehearsals only connect by code.
            </Text>
            <TextInput
              accessibilityLabel="Partner code"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
              maxLength={10}
              placeholder="Optional partner code"
              placeholderTextColor="#92a59f"
              style={s.input}
            />
            {button("Begin shared walk", () => void start())}
            <Text style={s.small}>
              Anonymous choices and progress stay on this prototype server for
              up to 48 hours. GPS stays on your phone. No photos, names, public
              profiles, or messages. The computer hosting Homage must stay
              online.
            </Text>
          </>
        ) : !walk ? (
          <>
            <Text style={s.copy}>Connecting to your saved walk…</Text>
            <Text style={s.small}>
              Forgetting locally does not withdraw a deposited fragment. Server
              sessions expire after 48 hours.
            </Text>
            {button("Retry connection", () => void send("start"))}
            {button(
              "Forget this session on this phone",
              () => void forgetExpired(),
            )}
          </>
        ) : (
          <>
            <Text style={s.tag}>
              {walk.mode === "rehearsal"
                ? "REHEARSAL · NO VISITS RECORDED"
                : "OUTDOOR WALK"}
            </Text>
            <Text selectable style={s.copy}>
              Partner code: {walk.code}
            </Text>
            <Text style={s.small}>
              Share this code only with someone you want to join. Expires{" "}
              {new Date(walk.expiresAt).toLocaleString()}.
            </Text>
            <View style={s.card}>
              <Text style={s.title}>
                {walk.arrived ? "Your finale at MPAC" : destination.place}
              </Text>
              <Text style={s.copy}>{destination.address}</Text>
              {!walk.arrived &&
                button("Show destination on map", () =>
                  router.navigate({
                    pathname: "/",
                    params: {
                      sharedDestination: destination.id,
                      sharedFocus: String(Date.now()),
                    },
                  }),
                )}
              {walk.mode === "walk" && (
                <Text style={s.copy}>{gpsError || access.message}</Text>
              )}
              {gpsError &&
                button("Retry location", () =>
                  setGpsAttempt((value) => value + 1),
                )}
            </View>
            <Text style={s.copy}>
              {!walk.other
                ? "Your part can wait for another visitor. You don’t have to stay here."
                : walk.other.online
                  ? "The other participant has this shared walk open now."
                  : "This is an earlier contribution or a participant who is away—not a live encounter."}
            </Text>
            {walk.fragment === null ? (
              <>
                <Text style={s.copy}>
                  {walk.role === "landon"
                    ? "Choose the shape of your three-note blend."
                    : "Notice something nearby. What caught your attention? Your choice gives the composition a rhythm."}
                </Text>
                {(walk.role === "landon"
                  ? ["Rising", "Falling", "Wandering"]
                  : ["Growing", "Weathered", "Handmade"]
                ).map((label, index) => (
                  <View key={label}>
                    {button(`${choice === index ? "✓ " : ""}${label}`, () =>
                      setChoice(index),
                    )}
                  </View>
                ))}
                {button(
                  "Listen to my fragment",
                  () => void play(),
                  muted || playing,
                )}
                {button(
                  walk.mode === "rehearsal"
                    ? "Deposit rehearsal fragment"
                    : "Leave my fragment here",
                  () => void send("fragment", { fragment: choice }),
                  !canAct,
                )}
              </>
            ) : (
              <>
                <Text style={s.copy}>
                  Your fragment is saved.{" "}
                  {walk.other?.fragment !== null &&
                  walk.other?.fragment !== undefined
                    ? "The other part is ready too."
                    : "The other part hasn’t been contributed yet."}
                </Text>
                {!walk.arrived &&
                  button(
                    walk.mode === "rehearsal"
                      ? "Rehearse arrival at MPAC"
                      : "I’m at MPAC · receive the finale",
                    () => void send("arrive"),
                    !canAct,
                  )}
                {walk.arrived && !walk.complete && (
                  <Text style={s.copy}>
                    Your finale is waiting for a second contribution. You can
                    leave and return within 48 hours.
                  </Text>
                )}
                {walk.complete && (
                  <>
                    <Text style={s.title}>
                      Something neither of you made alone
                    </Text>
                    {button(
                      "Play our composition",
                      () => void play(true),
                      muted || playing,
                    )}
                    <Text style={s.copy}>
                      This saved composition is your keepsake for this
                      prototype’s 48-hour window. No meeting is needed to enjoy
                      it.
                    </Text>
                    {button(
                      walk.meet
                        ? "Withdraw meeting invitation"
                        : "I’m open to saying hello at MPAC",
                      () =>
                        void send("consent", {
                          meet: !walk.meet,
                          again: walk.again,
                        }),
                      !walk.meet && !canAct,
                    )}
                    {walk.meeting && canAct ? (
                      <Text style={s.copy}>
                        {walk.mode === "rehearsal"
                          ? "Rehearsal: both opted in. No real meeting is indicated."
                          : "Both of you opted in and report being at MPAC now. If you wish, hold up this screen and ask about the other person’s fragment. You can always decline."}
                      </Text>
                    ) : (
                      walk.meet && (
                        <Text style={s.copy}>
                          Your invitation is open while you’re here. No
                          agreement to meet yet.
                        </Text>
                      )
                    )}
                    {button(
                      walk.again
                        ? "Withdraw another-walk request"
                        : "I’d walk with this person again",
                      () =>
                        void send("consent", {
                          meet: walk.meet,
                          again: !walk.again,
                        }),
                    )}
                    {walk.reconnect && (
                      <>
                        {button(
                          "Both agreed · begin another walk",
                          () => void send("repeat"),
                        )}
                        <Text style={s.small}>
                          Starting swaps your places and replaces this
                          composition with a fresh round.
                        </Text>
                      </>
                    )}
                  </>
                )}
                {button("Leave my fragment for later · back to map", () =>
                  router.back(),
                )}
              </>
            )}
            {button(muted ? "Unmute" : "Mute", () => {
              playback.current++;
              pausePlayers(players.current);
              setPlaying(false);
              setMuted(!muted);
            })}
            {button("Withdraw my contribution and leave", () => void leave())}
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {busy && <Text style={s.small}>Connecting…</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101f25" },
  content: { padding: 22, gap: 16 },
  title: { fontSize: 25, fontWeight: "700", color: "#eef8f0" },
  copy: { fontSize: 17, lineHeight: 25, color: "#c7d9d0" },
  small: { fontSize: 13, lineHeight: 19, color: "#a7bfb3" },
  tag: { color: "#f3d694", fontWeight: "700" },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#78dcb3",
  },
  button: { padding: 15, borderRadius: 12, backgroundColor: "#21443c" },
  buttonText: { color: "#a8f1d0", fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  input: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#78dcb3",
    borderRadius: 12,
    color: "#fff",
    fontSize: 18,
  },
  error: { color: "#ffbdad", fontSize: 16 },
});
