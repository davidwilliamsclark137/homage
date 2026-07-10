import {
  generateEnvironmentQuests,
  GeneratedQuest,
  QuestGenerationResponse,
} from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { haversine, LatLng } from "./geo";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const QUEST_CACHE_PREFIX = "homage.environmentQuests.v1";
const QUEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BLOCKED_ACCESS = new Set(["private", "no", "customers", "permit"]);
const PEDESTRIAN_HIGHWAYS = new Set([
  "footway",
  "path",
  "pedestrian",
  "steps",
  "cycleway",
  "trailhead",
]);
const MAJOR_ROADS = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
]);
const LOCAL_MOTOR_ROADS = new Set([
  "tertiary",
  "tertiary_link",
  "residential",
  "unclassified",
  "service",
  "living_street",
  "track",
]);

type OsmElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  geometry?: { lat?: number; lon?: number }[];
  tags?: Record<string, string>;
};

type QuestCategory =
  | "public_art"
  | "historic"
  | "viewpoint"
  | "park"
  | "trail"
  | "water"
  | "bridge";

type Candidate = {
  osmType: string;
  osmId: number;
  name: string;
  category: QuestCategory;
  latitude: number;
  longitude: number;
  distance: number;
  tags: Record<string, string>;
};

export async function loadEnvironmentQuests(
  location: LatLng,
): Promise<QuestGenerationResponse> {
  try {
    const response = await generateEnvironmentQuests({
      ...location,
      radius_m: 2_000,
      limit: 3,
    });
    if (
      !response.safety?.road_buffered ||
      response.safety.policy_version < 4 ||
      (response.safety.procedural_destinations &&
        (!response.safety.stationary_confirmation_required ||
          response.quests.some(
            (quest) =>
              !quest.requires_safe_area_confirmation ||
              !quest.stationary_only,
          )))
    ) {
      throw new Error("Backend quest safety policy is outdated.");
    }
    await cacheQuestResponse(location, response);
    return response;
  } catch (backendError) {
    try {
      const response = await generateFromOpenStreetMap(location);
      await cacheQuestResponse(location, response);
      return response;
    } catch (overpassError) {
      const cached = await readCachedQuestResponse(location);
      if (cached) {
        return {
          ...cached,
          cached: true,
          warning: `${errorMessage(backendError)}; ${errorMessage(overpassError)}; using cached map data`,
        };
      }
      const quests = proceduralQuests(location);
      return {
        status: "ok",
        source: "procedural-fallback",
        center: location,
        radius_m: 2_000,
        features_considered: 0,
        quests,
        warning: `${errorMessage(backendError)}; ${errorMessage(overpassError)}`,
        safety: {
          policy_version: 4,
          road_buffered: true,
          procedural_destinations: true,
          stationary_confirmation_required: true,
        },
      };
    }
  }
}

async function cacheQuestResponse(
  location: LatLng,
  response: QuestGenerationResponse,
) {
  if (!response.quests.length || response.safety?.procedural_destinations) return;
  await AsyncStorage.setItem(
    questCacheKey(location),
    JSON.stringify({
      createdAt: Date.now(),
      response,
    }),
  ).catch(() => {});
}

async function readCachedQuestResponse(
  location: LatLng,
): Promise<QuestGenerationResponse | null> {
  const raw = await AsyncStorage.getItem(questCacheKey(location)).catch(() => null);
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as {
      createdAt?: number;
      response?: QuestGenerationResponse;
    };
    if (
      !cached.createdAt ||
      !cached.response ||
      Date.now() - cached.createdAt > QUEST_CACHE_TTL_MS
    ) {
      return null;
    }
    return cached.response;
  } catch {
    return null;
  }
}

function questCacheKey(location: LatLng) {
  return [
    QUEST_CACHE_PREFIX,
    Math.round(location.latitude * 100) / 100,
    Math.round(location.longitude * 100) / 100,
  ].join(":");
}

async function generateFromOpenStreetMap(
  location: LatLng,
): Promise<QuestGenerationResponse> {
  const radius = 2_000;
  const elements = await fetchOverpassElements(location, radius);
  const candidates = normalizeCandidates(elements, location, radius);
  const selected = selectDiverseCandidates(candidates, 3);
  const quests = selected.length
    ? selected.map(candidateToQuest)
    : proceduralQuests(location);

  return {
    status: "ok",
    source: selected.length
      ? "openstreetmap-direct"
      : "procedural-stationary-confirmation",
    center: location,
    radius_m: radius,
    features_considered: candidates.length,
    quests,
    safety: {
      policy_version: 4,
      road_buffered: true,
      procedural_destinations: !selected.length,
      stationary_confirmation_required: !selected.length,
    },
  };
}

async function fetchOverpassElements(location: LatLng, radius: number) {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: overpassQuery(location, radius),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as { elements?: OsmElement[] };
      return body.elements ?? [];
    } catch (error) {
      errors.push(`${endpoint}: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(errors.join("; "));
}

function overpassQuery(location: LatLng, radius: number) {
  const around = `${radius},${location.latitude},${location.longitude}`;
  return `
    [out:json][timeout:25];
    (
      nwr(around:${around})["tourism"~"artwork|attraction|viewpoint"];
      nwr(around:${around})["historic"];
      nwr(around:${around})["leisure"~"park|garden|nature_reserve"];
      nwr(around:${around})["natural"~"water|spring|peak"];
      nwr(around:${around})["waterway"~"river|stream|canal"];
      way(around:${around})["bridge"]["highway"~"footway|path|pedestrian"];
      nwr(around:${around})["highway"="trailhead"];
      way(around:${around})["highway"~"path|footway"]["name"];
    )->.candidates;
    way(around.candidates:40)["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|track|.*_link"]->.roads;
    .candidates out center tags;
    .roads out tags geom;
  `;
}

function normalizeCandidates(
  elements: OsmElement[],
  origin: LatLng,
  radius: number,
) {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const seenPlaces = new Set<string>();
  const roads = elements
    .map((element) => ({
      buffer: roadBuffer(element.tags ?? {}),
      geometry: roadGeometry(element),
    }))
    .filter((road) => road.buffer > 0 && road.geometry.length >= 2);

  for (const element of elements) {
    const tags = element.tags ?? {};
    const category = categoryFor(tags);
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (
      !category ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof element.id !== "number" ||
      !isSafe(tags)
    ) {
      continue;
    }

    if (
      !isClearOfMotorRoads(
        latitude,
        longitude,
        roads,
        questRadius(category),
      )
    ) {
      continue;
    }

    const osmType = element.type ?? "unknown";
    const idKey = `${osmType}:${element.id}`;
    if (seen.has(idKey)) continue;
    seen.add(idKey);

    const distance = haversine(origin, { latitude, longitude });
    if (distance < 20 || distance > radius) continue;

    const placeKey = `${category}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    if (seenPlaces.has(placeKey)) continue;
    seenPlaces.add(placeKey);

    candidates.push({
      osmType,
      osmId: element.id,
      name:
        tags.name ??
        tags.official_name ??
        tags.description ??
        defaultName(category),
      category,
      latitude,
      longitude,
      distance,
      tags,
    });
  }

  return candidates;
}

function isSafe(tags: Record<string, string>) {
  if (BLOCKED_ACCESS.has(tags.access?.toLowerCase())) return false;
  if (
    Boolean(tags.military) ||
    tags.landuse === "military" ||
    tags.construction === "yes" ||
    tags.disused === "yes" ||
    tags.abandoned === "yes"
  ) {
    return false;
  }
  if (
    tags.highway &&
    !PEDESTRIAN_HIGHWAYS.has(tags.highway)
  ) {
    return false;
  }
  return true;
}

function roadBuffer(tags: Record<string, string>) {
  const highway = tags.highway ?? "";
  if (MAJOR_ROADS.has(highway)) return 40;
  if (LOCAL_MOTOR_ROADS.has(highway)) return 18;
  return 0;
}

function roadGeometry(element: OsmElement): LatLng[] {
  return (element.geometry ?? [])
    .filter(
      (point): point is { lat: number; lon: number } =>
        typeof point.lat === "number" && typeof point.lon === "number",
    )
    .map((point) => ({
      latitude: point.lat,
      longitude: point.lon,
    }));
}

function isClearOfMotorRoads(
  latitude: number,
  longitude: number,
  roads: { buffer: number; geometry: LatLng[] }[],
  activationRadius: number,
) {
  return roads.every((road) =>
    road.geometry.slice(1).every((end, index) => {
      return (
        pointToSegmentMeters(
          { latitude, longitude },
          road.geometry[index],
          end,
        ) >= road.buffer + activationRadius + 35
      );
    }),
  );
}

function questRadius(category: QuestCategory) {
  return ["park", "trail"].includes(category) ? 40 : 30;
}

function pointToSegmentMeters(point: LatLng, start: LatLng, end: LatLng) {
  const metersPerLatitude = 111_320;
  const metersPerLongitude =
    111_320 * Math.cos((point.latitude * Math.PI) / 180);
  const startX = (start.longitude - point.longitude) * metersPerLongitude;
  const startY = (start.latitude - point.latitude) * metersPerLatitude;
  const endX = (end.longitude - point.longitude) * metersPerLongitude;
  const endY = (end.latitude - point.latitude) * metersPerLatitude;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (!lengthSquared) return Math.hypot(startX, startY);
  const projection = Math.max(
    0,
    Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
  );
  return Math.hypot(
    startX + projection * deltaX,
    startY + projection * deltaY,
  );
}

function categoryFor(tags: Record<string, string>): QuestCategory | null {
  if (tags.tourism === "artwork") return "public_art";
  if (tags.historic) return "historic";
  if (tags.tourism === "viewpoint" || tags.natural === "peak") return "viewpoint";
  if (["park", "garden", "nature_reserve"].includes(tags.leisure ?? ""))
    return "park";
  if (["trailhead", "path", "footway"].includes(tags.highway ?? ""))
    return "trail";
  if (tags.waterway || ["water", "spring"].includes(tags.natural ?? ""))
    return "water";
  if (
    tags.bridge &&
    ["footway", "path", "pedestrian"].includes(tags.highway ?? "")
  )
    return "bridge";
  if (["attraction", "museum"].includes(tags.tourism ?? "")) return "historic";
  return null;
}

function defaultName(category: QuestCategory) {
  return {
    public_art: "Public Artwork",
    historic: "Historic Place",
    viewpoint: "Viewpoint",
    park: "Local Green Space",
    trail: "Public Trail",
    water: "Local Waterway",
    bridge: "Public Bridge",
  }[category];
}

function candidateScore(candidate: Candidate) {
  const categoryScore = {
    public_art: 7,
    historic: 6,
    viewpoint: 5,
    park: 4,
    trail: 3,
    water: 2,
    bridge: 1,
  }[candidate.category];
  const distanceScore = Math.max(
    0,
    1 - Math.abs(candidate.distance - 650) / 1_500,
  );
  const metadataScore =
    (candidate.tags.name ? 0.6 : 0) +
    (candidate.tags.wikidata || candidate.tags.wikipedia ? 0.5 : 0) +
    (["yes", "permissive", "designated"].includes(candidate.tags.access)
      ? 0.4
      : 0);
  return categoryScore + distanceScore + metadataScore;
}

function selectDiverseCandidates(candidates: Candidate[], limit: number) {
  const ranked = [...candidates].sort(
    (first, second) => candidateScore(second) - candidateScore(first),
  );
  const selected: Candidate[] = [];
  const categories = new Set<QuestCategory>();

  for (const candidate of ranked) {
    if (categories.has(candidate.category)) continue;
    selected.push(candidate);
    categories.add(candidate.category);
    if (selected.length === limit) return selected;
  }
  for (const candidate of ranked) {
    if (selected.includes(candidate)) continue;
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

function candidateToQuest(candidate: Candidate, index: number): GeneratedQuest {
  const templates: Record<
    QuestCategory,
    { description: string; kind: "checkin" | "photo"; radius: number }
  > = {
    public_art: {
      description: `Find ${candidate.name} and photograph a detail that catches your eye.`,
      kind: "photo",
      radius: questRadius("public_art"),
    },
    historic: {
      description: `Visit ${candidate.name} and photograph something that shows its history.`,
      kind: "photo",
      radius: questRadius("historic"),
    },
    viewpoint: {
      description: `Reach ${candidate.name} and capture the view from public ground.`,
      kind: "photo",
      radius: questRadius("viewpoint"),
    },
    park: {
      description: `Check in at ${candidate.name} while remaining on a public path.`,
      kind: "checkin",
      radius: questRadius("park"),
    },
    trail: {
      description: `Reach ${candidate.name} and check in from the public trail.`,
      kind: "checkin",
      radius: questRadius("trail"),
    },
    water: {
      description: `Find ${candidate.name} and photograph it from a safe public location.`,
      kind: "photo",
      radius: questRadius("water"),
    },
    bridge: {
      description: `Reach ${candidate.name} using a public pedestrian approach.`,
      kind: "checkin",
      radius: questRadius("bridge"),
    },
  };
  const template = templates[candidate.category];

  return {
    id: `osm-${candidate.osmType}-${candidate.osmId}`,
    name: candidate.name,
    description: template.description,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    radius: template.radius,
    kind: template.kind,
    order: index + 1,
    category: candidate.category,
    source: "openstreetmap-direct",
    distance_m: Math.round(candidate.distance),
  };
}

function proceduralQuests(location: LatLng): GeneratedQuest[] {
  const key = `${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}`;
  return [
    {
      id: `procedural-observation-${key}`,
      name: "Rural Sound Map",
      description:
        "Stay where you are, listen for three layers of sound, then photograph a nearby texture or pattern.",
      latitude: location.latitude,
      longitude: location.longitude,
      radius: 30,
      kind: "photo",
      order: 1,
      category: "observation",
      source: "procedural-stationary-confirmed",
      distance_m: 0,
      requires_safe_area_confirmation: true,
      stationary_only: true,
    },
  ];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
