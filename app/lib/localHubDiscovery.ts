import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Hub, HubKind } from "./hubs";

type Point = { latitude: number; longitude: number };
type OsmElement = { id: number; type: string; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> };

const SEARCH_RADIUS_METERS = 8_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

export async function loadLocalHubCandidates(origin: Point): Promise<{ cached: Hub[]; refresh: Promise<Hub[]> }> {
  const cached = await readCache(origin);
  return { cached, refresh: discover(origin) };
}

async function discover(origin: Point): Promise<Hub[]> {
  const latitude = Number(origin.latitude.toFixed(3));
  const longitude = Number(origin.longitude.toFixed(3));
  const query = `[out:json][timeout:12];(nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["amenity"~"library|townhall|arts_centre|community_centre"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["tourism"~"museum|gallery|attraction|artwork"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["historic"~"monument|memorial"]["name"];nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["leisure"="park"]["name"];);out center tags;`;
  const attempts = ENDPOINTS.map(async (endpoint) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: `data=${encodeURIComponent(query)}`, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { elements?: OsmElement[] };
      if (!body.elements?.length) throw new Error("No named public places returned");
      return body.elements;
    } finally { clearTimeout(timeout); }
  });
  const elements = await Promise.any(attempts).catch(() => [] as OsmElement[]);
  const seen = new Set<string>();
  const hubs = elements.flatMap((element): Hub[] => {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat, lon = element.lon ?? element.center?.lon, name = tags.name?.trim();
    if (lat === undefined || lon === undefined || !name || tags.access === "private" || tags.access === "no") return [];
    const key = name.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: `osm-${element.type}-${element.id}`, name, locality: "Near you", country: "", kind: hubKind(tags), latitude: lat, longitude: lon, radiusMeters: 100, reason: reason(tags) }];
  }).sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b)).slice(0, 24);
  if (hubs.length) await writeCache(origin, hubs);
  return hubs;
}

function hubKind(tags: Record<string, string>): HubKind {
  if (tags.historic || tags.tourism === "artwork" || tags.tourism === "attraction") return "monument";
  if (tags.amenity === "library" || tags.amenity === "community_centre" || tags.leisure === "park") return "suburban";
  return "city";
}

function reason(tags: Record<string, string>) {
  if (tags.amenity === "library") return "Public library discovered near this phone.";
  if (tags.amenity === "townhall") return "Public civic building discovered near this phone.";
  if (tags.leisure === "park") return "Named public park discovered near this phone.";
  if (tags.historic) return "Named historic landmark discovered near this phone.";
  return "Named public place discovered near this phone.";
}

function cacheKey(origin: Point) { return `homage.local-hubs.v1:${origin.latitude.toFixed(2)}:${origin.longitude.toFixed(2)}`; }
async function readCache(origin: Point): Promise<Hub[]> {
  const raw = await AsyncStorage.getItem(cacheKey(origin)).catch(() => null);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw) as { savedAt: number; hubs: Hub[] }; return Date.now() - parsed.savedAt <= CACHE_TTL_MS ? parsed.hubs : []; } catch { return []; }
}
async function writeCache(origin: Point, hubs: Hub[]) { await AsyncStorage.setItem(cacheKey(origin), JSON.stringify({ savedAt: Date.now(), hubs })).catch(() => {}); }
function distanceMeters(a: Point, b: Point) { const r = 6_371_000, rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(h)); }
