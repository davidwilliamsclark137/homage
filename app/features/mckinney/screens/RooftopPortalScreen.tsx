import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import embeddedMap from "../map/embedded.json";
import { WebView } from "react-native-webview";
import { haversine } from "../../../lib/geo";
import { usableFix, type Fix } from "../portals/rooftop";
import {
  MAP_PORTALS,
  portalAccess,
  isPortalVisible,
} from "../portals/mapAccess";
import { portalHtml } from "./portalHtml";

const meters = (n: number | null) =>
  n === null || !Number.isFinite(n) ? "Unavailable" : n.toFixed(1) + " m";

export default function RooftopPortalScreen() {
  const mapRef = useRef<WebView>(null);
  const visibleIdsRef = useRef(new Set<string>());
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
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
  const visiblePortals = MAP_PORTALS.filter((p) =>
    isPortalVisible(p, error ? null : fix, now),
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
  function backToMap() {
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
        </View>
        {Platform.OS === "web" ? (
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
      <View style={s.panel}>
        <Text style={s.eyebrow}>HOMAGE · 3D PORTALS</Text>
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
            : "Explore the square. Hidden signals appear only while you’re nearby."}
        </Text>
        {selected && <Text style={s.note}>{selected.address}</Text>}
        {selected ? (
          <>
            <Text style={s.status} accessibilityLiveRegion="polite">
              {error || access.message}
            </Text>
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                disabled={!ready}
                onPress={() => setMode("field")}
                style={[s.button, s.grow, !ready && { opacity: 0.45 }]}
              >
                <Text style={s.buttonText}>
                  {ready
                    ? "Enter portal"
                    : selected.kind === "rooftop"
                      ? "Reach the rooftop"
                      : "Approach storefront"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void Linking.openURL(
                    "https://maps.apple.com/?daddr=" +
                      selected.latitude +
                      "," +
                      selected.longitude +
                      "&dirflg=w",
                  )
                }
                style={[s.button, s.grow]}
              >
                <Text style={s.buttonText}>Directions</Text>
              </Pressable>
            </View>
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode("preview")}
                style={s.textButton}
              >
                <Text style={s.link}>Preview portal</Text>
              </Pressable>
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
                  {"◎ " + p.shortName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#101e24" },
  map: { flex: 1, backgroundColor: "#101e24" },
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
