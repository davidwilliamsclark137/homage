import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { HUBS } from "../lib/hubs";

type Point = { latitude: number; longitude: number };
type NearbyHub = Point & { id: string; name: string; kind: string; distance: number; source: "nearby" | "catalog" };
type OsmElement = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const colors = { background: "#F4F1EA", card: "#FFFFFF", ink: "#1D211F", muted: "#666C68", line: "#DCD8CF", green: "#264E3D", pale: "#E3ECE6", danger: "#9B3C32" };
const SEARCH_RADIUS_METERS = 8_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export default function NearbyHubsScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<Point | null>(null);
  const [places, setPlaces] = useState<NearbyHub[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Finding your location…");
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadNearby(); }, []);

  async function loadNearby() {
    setLoading(true);
    try {
      setStatus("Finding your location…");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is needed to find nearby hubs.");
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) throw new Error("Turn on location services, then search again.");
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 86_400_000, requiredAccuracy: 10_000 });
      const reading = cached ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const current = { latitude: reading.coords.latitude, longitude: reading.coords.longitude };
      setLocation(current);
      const immediate = catalogPlaces(current);
      const cachedPlaces = await readPlaceCache(current);
      const firstResults = mergePlaces(cachedPlaces, immediate);
      setPlaces(firstResults);
      setSelectedId(firstResults[0]?.id ?? null);
      setStatus("Closest hubs ready · checking the immediate area…");
      setLoading(false);
      const discovered = await fetchNearby(current);
      const next = mergePlaces(discovered, immediate);
      setPlaces(next);
      setSelectedId(next[0]?.id ?? null);
      if (discovered.length) void writePlaceCache(current, discovered);
      const liveCount = discovered.filter((place) => place.source === "nearby").length;
      setStatus(liveCount
        ? `${liveCount} possible hubs within 5 miles · closest first`
        : next.length
          ? "Nearby map search is unavailable — showing the closest catalog hub"
          : "No candidates found in this area");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nearby search is unavailable.");
    } finally { setLoading(false); }
  }

  const selected = useMemo(() => places.find((place) => place.id === selectedId) ?? null, [places, selectedId]);

  function choose(place: NearbyHub) {
    setSelectedId(place.id);
  }

  function openHub(place: NearbyHub) {
    const catalogId = place.id.startsWith("catalog-") ? place.id.slice("catalog-".length) : place.id;
    const catalog = HUBS.find((hub) => hub.id === catalogId);
    router.push({ pathname: "/hub", params: { id: catalogId, name: place.name, locality: catalog?.locality ?? "Nearby", kind: place.kind.replace(" · catalog", ""), latitude: String(place.latitude), longitude: String(place.longitude), radius: String(catalog?.radiusMeters ?? 90) } });
  }

  return <SafeAreaView style={styles.safe} edges={["bottom"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>AROUND YOU</Text><Text style={styles.title}>Nearby</Text>
    <Text style={styles.intro}>Public places near you that could become quest hubs.</Text>
    <View style={styles.status}>{loading && <ActivityIndicator color={colors.green} />}<Text style={styles.statusText}>{status}</Text></View>

    {location ? <View style={styles.locationCard}><Text style={styles.locationLabel}>YOUR NEXT HUB</Text><Text style={styles.locationText}>The closest candidate is always shown first. Local discovery continues in the background.</Text></View> : null}

    {selected ? <View style={styles.featured}><Text style={styles.candidate}>NEXT HUB · {selected.kind.toUpperCase()}</Text><Text style={styles.featuredTitle}>{selected.name}</Text><Text style={styles.featuredMeta}>{formatDistance(selected.distance)} away</Text><Pressable onPress={() => openHub(selected)} style={styles.activate}><Text style={styles.activateText}>Explore this hub</Text></Pressable></View> : null}

    <View style={styles.list}>{places.map((place) => <Pressable key={place.id} onPress={() => choose(place)} style={[styles.row, selectedId === place.id && styles.rowSelected]}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{place.name}</Text><Text style={styles.rowKind}>{place.kind}</Text></View><Text style={styles.distance}>{formatDistance(place.distance)}</Text></Pressable>)}</View>
    {!loading && <Pressable onPress={() => void loadNearby()} style={styles.refresh}><Text style={styles.refreshText}>Search again</Text></Pressable>}
    <Text style={styles.attribution}>Nearby place data © OpenStreetMap contributors. Verify pedestrian access and local conditions before activating a hub.</Text>
  </ScrollView></SafeAreaView>;
}

async function fetchNearby(origin: Point): Promise<NearbyHub[]> {
  // Approximate to ~110 m before querying a third-party place index.
  const lat = Number(origin.latitude.toFixed(3));
  const lon = Number(origin.longitude.toFixed(3));
  const query = `[out:json][timeout:20];(nwr(around:${SEARCH_RADIUS_METERS},${lat},${lon})["tourism"~"museum|gallery|attraction"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${lat},${lon})["historic"~"monument|memorial|castle|ruins"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${lat},${lon})["amenity"~"library|townhall|arts_centre|community_centre"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${lat},${lon})["leisure"="park"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${lat},${lon})["tourism"="artwork"]["name"];);out center;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  const attempts = endpoints.map(async (endpoint) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_500);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: `data=${encodeURIComponent(query)}`, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { elements?: OsmElement[] };
      return payload.elements ?? [];
    } finally { clearTimeout(timeout); }
  });
  const elements = await Promise.any(attempts).catch(() => [] as OsmElement[]);
  const seen = new Set<string>();
  const nearby = elements.flatMap((element) => {
    const latitude = element.lat ?? element.center?.lat, longitude = element.lon ?? element.center?.lon, name = element.tags?.name;
    if (latitude === undefined || longitude === undefined || !name) return [];
    const key = name.trim().toLowerCase(); if (seen.has(key)) return []; seen.add(key);
    const kind = classify(element.tags ?? {}); const distance = distanceMeters(origin, { latitude, longitude });
    return [{ id: `${element.type}-${element.id}`, name, kind, latitude, longitude, distance, source: "nearby" as const }];
  }).sort((a, b) => a.distance - b.distance).slice(0, 40);
  if (nearby.length) return nearby;

  return [];
}

function placeCacheKey(origin: Point) {
  return `homage.nearby-hubs.v2:${origin.latitude.toFixed(2)}:${origin.longitude.toFixed(2)}`;
}

async function readPlaceCache(origin: Point): Promise<NearbyHub[]> {
  const raw = await AsyncStorage.getItem(placeCacheKey(origin)).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { savedAt: number; places: NearbyHub[] };
    return Date.now() - parsed.savedAt <= CACHE_TTL_MS ? parsed.places : [];
  } catch { return []; }
}

async function writePlaceCache(origin: Point, places: NearbyHub[]) {
  await AsyncStorage.setItem(placeCacheKey(origin), JSON.stringify({ savedAt: Date.now(), places })).catch(() => {});
}

function catalogPlaces(origin: Point): NearbyHub[] {
  return HUBS.map((hub) => ({
    id: `catalog-${hub.id}`,
    name: hub.name,
    kind: `${hub.kind} · catalog`,
    latitude: hub.latitude,
    longitude: hub.longitude,
    distance: distanceMeters(origin, hub),
    source: "catalog" as const,
  })).sort((a, b) => a.distance - b.distance).slice(0, 8);
}

function mergePlaces(primary: NearbyHub[], fallback: NearbyHub[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((place) => {
    const key = place.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.distance - b.distance).slice(0, 40);
}

function classify(tags: Record<string, string>) { if (tags.amenity === "library") return "library"; if (tags.amenity === "townhall") return "civic"; if (tags.leisure === "park") return "park"; if (tags.tourism === "artwork") return "public art"; if (tags.historic) return "historic"; return tags.tourism ?? "community"; }
function distanceMeters(a: Point, b: Point) { const r = 6_371_000, rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(h)); }
function formatDistance(m: number) { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1609.344).toFixed(1)} mi`; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, content: { padding: 20, paddingBottom: 48 }, eyebrow: { color: colors.green, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 38, fontWeight: "700", letterSpacing: -1, marginTop: 5 }, intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 6 },
  status: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 18, minHeight: 24 }, statusText: { color: colors.muted, flex: 1, fontSize: 13 }, locationCard: { backgroundColor: colors.pale, borderRadius: 14, marginTop: 14, padding: 15 }, locationLabel: { color: colors.green, fontSize: 10, fontWeight: "800", letterSpacing: 1 }, locationText: { color: colors.ink, fontSize: 13, marginTop: 5 },
  featured: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 18 }, candidate: { color: colors.green, fontSize: 10, fontWeight: "800", letterSpacing: .8 }, featuredTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 10 }, featuredMeta: { color: colors.muted, fontSize: 13, marginTop: 5 }, activate: { alignItems: "center", backgroundColor: colors.green, borderRadius: 12, marginTop: 14, padding: 13 }, activateText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  list: { gap: 8, marginTop: 18 }, row: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", padding: 15 }, rowSelected: { borderColor: colors.green, borderWidth: 2, padding: 14 }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" }, rowKind: { color: colors.muted, fontSize: 12, marginTop: 3, textTransform: "capitalize" }, distance: { color: colors.green, fontSize: 12, fontWeight: "700" }, refresh: { alignItems: "center", borderColor: colors.green, borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 13 }, refreshText: { color: colors.green, fontWeight: "700" }, attribution: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 24 },
});
