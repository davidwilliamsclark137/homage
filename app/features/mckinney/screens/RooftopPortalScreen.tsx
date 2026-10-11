import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import embeddedMap from "../map/embedded.json";
import { WebView } from "react-native-webview";
import { haversine } from "../../../lib/geo";
import { usableFix, type Fix } from "../portals/rooftop";
import {
  MAP_PORTALS,
  portalAccess,
  isPortalVisible,
} from "../portals/mapAccess";
import {
  beginJourney,
  chooseStop,
  completeStop,
  currentStop,
  journeyFinished,
  nextStops,
  type Journey,
} from "../journey/graph";
import { PortalActivity } from "../activities/PortalActivity";
import { portalHtml } from "./portalHtml";
import { proximitySignal } from "../audio/proximity";
import { usePortalAudio } from "../audio/usePortalAudio";

const meters = (n: number | null) =>
  n === null || !Number.isFinite(n) ? "Unavailable" : n.toFixed(1) + " m";

export default function RooftopPortalScreen() {
  const { sharedDestination, sharedFocus } = useLocalSearchParams<{
    sharedDestination?: string;
    sharedFocus?: string;
  }>();
  const mapRef = useRef<WebView>(null);
  const visibleIdsRef = useRef(new Set<string>());
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    if (
      typeof sharedDestination === "string" &&
      MAP_PORTALS.some((portal) => portal.id === sharedDestination)
    ) {
      setSelectedId(sharedDestination);
      setFocusRequest((value) => value + 1);
      setMode("map");
    }
  }, [sharedDestination, sharedFocus]);
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setFix(null);
      setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  const [mode, setMode] = useState<"map" | "preview" | "field">("map");
  useEffect(() => {
    if (!foreground) return;
    if (Platform.OS === "web") {
      setError(
        "Open Homage in Expo Go for GPS activation. You can explore and preview portals here.",
      );
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    setError("");
    setFix(null);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted)
        throw Error(
          "Location permission is needed for the field test. You can still preview the portal.",
        );
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (position) => {
          if (!cancelled) {
            setFix({ ...position.coords, timestamp: position.timestamp });
            setNow(Date.now());
            setError("");
          }
        },
        (reason) => {
          if (!cancelled) setError("Location unavailable: " + reason);
        },
      );
      if (cancelled) subscription.remove();
    })().catch((e) => {
      if (!cancelled)
        setError(e instanceof Error ? e.message : "Location unavailable.");
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription?.remove();
    };
  }, [attempt, foreground]);
  const [muted, setMuted] = useState(false);
  const [demoStarted, setDemoStarted] = useState<number | null>(null);
  const [demoProgress, setDemoProgress] = useState(0);
  const previousSignal = useRef<string | null>(null);
  const signal = proximitySignal(
    error ? null : fix,
    Platform.OS,
    now,
    previousSignal.current,
  );
  useEffect(() => {
    previousSignal.current = signal?.id ?? null;
  }, [signal?.id]);
  useEffect(() => {
    if (!foreground || !screenFocused || mode !== "map" || muted)
      setDemoStarted(null);
  }, [foreground, screenFocused, mode, muted]);
  useEffect(() => {
    if (demoStarted === null) return;
    setDemoProgress(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - demoStarted;
      setDemoProgress(Math.min(1, elapsed / 6000));
      if (elapsed >= 8000) setDemoStarted(null);
    }, 100);
    return () => clearInterval(timer);
  }, [demoStarted]);
  const audioError = usePortalAudio(
    demoStarted !== null ? { tuning: demoProgress, volume: 0.3 } : signal,
    foreground &&
      screenFocused &&
      mode === "map" &&
      !muted &&
      (demoStarted !== null || !error),
  );
  const visiblePortals = MAP_PORTALS.filter(
    (p) => showHidden || isPortalVisible(p, error ? null : fix, now),
  );
  visibleIdsRef.current = new Set(visiblePortals.map((p) => p.id));
  const selected = visiblePortals.find((p) => p.id === selectedId);
  const activePortal = selected ?? MAP_PORTALS[1];
  const html = useMemo(
    () =>
      portalHtml(
        activePortal.fractal,
        activePortal.place,
        activePortal.title,
        "A signal hidden in downtown McKinney.",
      ).replace(
        "PORTAL " + (activePortal.fractal + 1) + " · LIVE FRACTAL",
        "HOMAGE · LIVE FRACTAL",
      ),
    [activePortal],
  );
  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      if (mode !== "map") setMapLoaded(false);
      setMode("map");
    }
  }, [selectedId, selected, mode]);
  const access = portalAccess(activePortal, fix, Platform.OS, now);
  const ready = foreground && !error && access.ready;
  useEffect(() => {
    if (mode === "field" && !ready) {
      setMapLoaded(false);
      setMode("map");
    }
  }, [mode, ready]);
  const mapFix = fix && !error && usableFix(fix, now) ? fix : null;
  const mapLocation = JSON.stringify({
    type: "homage-location",
    focusRequest,
    showHidden,
    latitude: mapFix?.latitude ?? null,
    longitude: mapFix?.longitude ?? null,
    fix: mapFix,
    selectedId: selected?.id ?? null,
    readyIds: error
      ? []
      : MAP_PORTALS.filter(
          (p) => portalAccess(p, fix, Platform.OS, now).ready,
        ).map((p) => p.id),
  });
  function mapEvent(type: string, id?: string) {
    if (type === "map-ready") {
      setMapLoaded(true);
      setMapError(false);
    }
    if (type === "portal-selected" && id && visibleIdsRef.current.has(id))
      setSelectedId(id!);
    if (type === "map-error") setMapError(true);
  }
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMessage = (event: MessageEvent) => {
      if (event.source === frameRef.current?.contentWindow)
        mapEvent(event.data?.type, event.data?.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (!mapLoaded || mode !== "map") return;
    if (Platform.OS === "web")
      frameRef.current?.contentWindow?.postMessage(
        JSON.parse(mapLocation),
        "*",
      );
    else
      mapRef.current?.injectJavaScript(
        "window.homageMap && window.homageMap.update(" +
          mapLocation +
          "); true;",
      );
  }, [mapLocation, mapLoaded, mode]);
  function previewStop(id: string) {
    setShowHidden(true);
    setSelectedId(id);
    setShowAnimation(false);
    setMode("preview");
  }
  function followConnection(id: string) {
    if (!journey || !nextStops(journey).includes(id)) return;
    setJourney(chooseStop(journey, id));
    setShowHidden(true);
    setSelectedId(id);
    setShowAnimation(false);
    setMapLoaded(false);
    setMode("map");
  }
  function backToMap() {
    setShowAnimation(false);
    setMapLoaded(false);
    setMode("map");
  }
  if (selected && (mode === "preview" || (mode === "field" && ready)))
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={s.eyebrow}>
            {mode === "preview"
              ? "PREVIEW · LOCATION CHECK BYPASSED"
              : activePortal.kind === "rooftop"
                ? "EXPERIMENTAL ROOFTOP MATCH"
                : "STOREFRONT PORTAL"}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={backToMap}
            style={s.button}
          >
            <Text style={s.buttonText}>Back to map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => setShowAnimation((value) => !value)}
          >
            <Text style={s.link}>
              {showAnimation ? "Try the activity" : "View portal animation"}
            </Text>
          </Pressable>
        </View>
        {!showAnimation ? (
          <PortalActivity
            key={activePortal.id + mode}
            portal={activePortal}
            preview={mode === "preview"}
            journey={
              journey &&
              mode === "preview" &&
              currentStop(journey) === activePortal.id
                ? {
                    completed: journey.completed.includes(activePortal.id),
                    finished: journeyFinished(journey),
                    trail: journey.path
                      .map(
                        (id) =>
                          MAP_PORTALS.find((p) => p.id === id)?.shortName ?? id,
                      )
                      .join(" → "),
                    choices: nextStops(journey).map((id) => ({
                      id,
                      label:
                        "Follow clue · " +
                        (MAP_PORTALS.find((p) => p.id === id)?.shortName ?? id),
                    })),
                    onComplete: () =>
                      setJourney((current) =>
                        current ? completeStop(current, activePortal.id) : null,
                      ),
                    onChoose: followConnection,
                  }
                : undefined
            }
          />
        ) : Platform.OS === "web" ? (
          <iframe
            title="Portal preview"
            srcDoc={html}
            style={{ flex: 1, width: "100%", border: 0 }}
          />
        ) : (
          <WebView
            source={{ html }}
            javaScriptEnabled
            scrollEnabled={false}
            style={{ flex: 1, backgroundColor: "#05080C" }}
          />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.map}>
        {Platform.OS === "web" ? (
          <iframe
            ref={frameRef}
            title="McKinney portal map"
            srcDoc={embeddedMap.html}
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <WebView
            ref={mapRef}
            source={{ html: embeddedMap.html }}
            javaScriptEnabled
            scrollEnabled={false}
            style={s.map}
            onMessage={(event) => {
              try {
                const value = JSON.parse(event.nativeEvent.data);
                mapEvent(value.type, value.id);
              } catch {
                /* Ignore unrelated messages. */
              }
            }}
            onError={() => setMapError(true)}
          />
        )}
        {mapError && (
          <View style={s.mapNotice}>
            <Text style={s.copy}>
              The map could not load. Reload the map to try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMapError(false);
                setMapLoaded(false);
                mapRef.current?.reload();
                if (frameRef.current)
                  frameRef.current.srcdoc = embeddedMap.html;
              }}
              style={s.button}
            >
              <Text style={s.buttonText}>Reload map</Text>
            </Pressable>
          </View>
        )}
      </View>
      <ScrollView style={s.panelScroll} contentContainerStyle={s.panel}>
        <Text style={s.eyebrow}>HOMAGE · 3D PORTALS</Text>
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => router.push("/shared-walk")}
        >
          <Text style={s.buttonText}>
            A shared walk · two contributions, one finale
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={() => router.push("/sky-test")}
        >
          <Text style={s.link}>Sky test · live sensors</Text>
        </Pressable>
        {journey && !journeyFinished(journey) && (
          <View style={s.destination}>
            <Text style={s.eyebrow}>YOUR NEXT PORTAL</Text>
            <Text style={s.subtitle}>
              {MAP_PORTALS.find((p) => p.id === currentStop(journey))?.place}
            </Text>
            <Text style={s.copy}>
              {MAP_PORTALS.find((p) => p.id === currentStop(journey))?.address}
            </Text>
            <Text style={s.note}>
              Highlighted on the map · distance is straight-line, not a walking
              route.
            </Text>
            {mapFix && (
              <Text style={s.copy}>
                {meters(
                  haversine(
                    mapFix,
                    MAP_PORTALS.find((p) => p.id === currentStop(journey))!,
                  ),
                )}{" "}
                away
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => {
                setSelectedId(currentStop(journey));
                setShowHidden(true);
                setFocusRequest((value) => value + 1);
              }}
            >
              <Text style={s.buttonText}>Focus destination</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => {
            const next = journey ?? beginJourney();
            setJourney(next);
            previewStop(currentStop(next));
          }}
        >
          <Text style={s.buttonText}>
            {journey ? "Continue preview journey" : "Try a portal journey"}
          </Text>
        </Pressable>
        {journey && (
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => setJourney(null)}
          >
            <Text style={s.link}>End preview journey</Text>
          </Pressable>
        )}
        <Text style={s.note}>
          A branching story to try from anywhere. Preview progress lasts until
          you reload; no real visits are recorded.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showHidden }}
          onPress={() => setShowHidden((value) => !value)}
          style={s.button}
        >
          <Text style={s.buttonText}>
            {showHidden ? "Hide hidden portals" : "Show hidden portals"}
          </Text>
        </Pressable>
        {showHidden && (
          <Text style={s.note}>
            Preview mode · hidden portals are visible. Entry still requires
            visiting their location.
          </Text>
        )}
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMuted((value) => !value)}
            style={s.textButton}
          >
            <Text style={s.link}>
              {muted ? "Unmute portal sound" : "Mute portal sound"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              setMuted(false);
              setDemoStarted(demoStarted === null ? Date.now() : null);
            }}
          >
            <Text style={s.link}>
              {demoStarted === null ? "Try the sound" : "Stop sound demo"}
            </Text>
          </Pressable>
        </View>
        <Text style={s.note}>
          {audioError ||
            (demoStarted !== null
              ? "Sound demo · dissonance resolving into harmony"
              : muted
                ? "Portal sound muted."
                : signal
                  ? signal.ready
                    ? "Signal in tune · a portal is within reach."
                    : "A signal is nearby. Follow the sound as it settles."
                  : "Listen for a chord within 60 m of a portal. It resolves as you approach.")}
        </Text>
        {!selected && error !== "" && (
          <>
            <Text style={s.status}>{error}</Text>
            {Platform.OS !== "web" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((n) => n + 1)}
              >
                <Text style={s.link}>Retry GPS</Text>
              </Pressable>
            )}
          </>
        )}
        <Text style={s.eyebrow}>
          {selected
            ? selected.kind === "rooftop"
              ? "ROOFTOP PORTAL"
              : "STOREFRONT PORTAL"
            : visiblePortals.length + " PORTALS · DOWNTOWN MCKINNEY"}
        </Text>
        <Text style={s.subtitle}>
          {selected?.title ?? "Explore the square"}
        </Text>
        <Text style={s.copy}>
          {selected
            ? selected.place +
              (fix ? " · " + meters(haversine(fix, selected)) + " away" : "")
            : "Tap a portal on the map or a name below to see its location and animated preview from anywhere. Hidden portals still appear only nearby."}
        </Text>
        {selected && <Text style={s.note}>{selected.address}</Text>}
        {selected ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Preview " + selected.place + " portal"}
              onPress={() => setMode("preview")}
              style={s.button}
            >
              <Text style={s.buttonText}>Preview this portal</Text>
            </Pressable>
            <Text style={s.note}>
              Preview from anywhere · no GPS or visit required.
            </Text>
            <Text style={s.status} accessibilityLiveRegion="polite">
              {error || access.message}
            </Text>
            {ready && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode("field")}
                style={s.button}
              >
                <Text style={s.buttonText}>Enter portal</Text>
              </Pressable>
            )}
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedId(null)}
                style={s.textButton}
              >
                <Text style={s.link}>Close details</Text>
              </Pressable>
              {error && Platform.OS !== "web" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((n) => n + 1)}
                  style={s.textButton}
                >
                  <Text style={s.link}>Retry GPS</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={s.note}>
              {selected.kind === "rooftop"
                ? "Experimental rooftop height. Entry may need adjustment after the first visit."
                : (selected.arrivalNote ??
                  "On the public sidewalk · no purchase or building entry needed. Map-based storefront position; not yet field checked.")}
            </Text>
          </>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.portalList}
          >
            {visiblePortals.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={"Select " + p.place + " portal"}
                onPress={() => setSelectedId(p.id)}
                style={[s.portalChip, { borderColor: p.color }]}
              >
                <Text style={[s.link, { color: p.color }]}>
                  {"◎ " +
                    p.shortName +
                    (p.hiddenUntilNearby ? " · Hidden" : "")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#101e24" },
  map: { flex: 1, backgroundColor: "#101e24" },
  destination: {
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#80edbc",
    borderRadius: 12,
  },
  panelScroll: { maxHeight: "55%", flexGrow: 0 },
  panel: {
    backgroundColor: "#101c22",
    borderTopWidth: 1,
    borderTopColor: "#36554b",
    padding: 18,
    gap: 8,
  },
  eyebrow: {
    color: "#80edbc",
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "800",
  },
  subtitle: { color: "#f1f8ef", fontSize: 23, fontWeight: "800" },
  copy: { color: "#b3c9be", fontSize: 13, lineHeight: 19 },
  status: { color: "#d8e8e1", fontSize: 12, lineHeight: 18 },
  button: { backgroundColor: "#295e4c", borderRadius: 12, padding: 14 },
  buttonText: {
    color: "#f4fff8",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  grow: { flex: 1 },
  textButton: { paddingVertical: 8 },
  link: { color: "#80edbc", fontSize: 12, fontWeight: "700" },
  note: { color: "#839e91", fontSize: 10, lineHeight: 15 },
  portalList: { gap: 8, paddingVertical: 3 },
  portalChip: { borderWidth: 1, borderRadius: 12, padding: 12 },
  mapNotice: {
    position: "absolute",
    top: 65,
    left: 20,
    right: 20,
    backgroundColor: "#101c22",
    padding: 20,
  },
});
