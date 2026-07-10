from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass
from typing import Any

import requests


OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
EARTH_RADIUS_M = 6_371_000
CACHE_TTL_SECONDS = 15 * 60
SAFETY_POLICY_VERSION = 4
GPS_ERROR_MARGIN_M = 35

BLOCKED_ACCESS = {"private", "no", "customers", "permit"}
PEDESTRIAN_HIGHWAYS = {
    "footway",
    "path",
    "pedestrian",
    "steps",
    "cycleway",
    "trailhead",
}
MAJOR_ROADS = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
}
LOCAL_MOTOR_ROADS = {
    "tertiary",
    "tertiary_link",
    "residential",
    "unclassified",
    "service",
    "living_street",
    "track",
}
BLOCKED_TAGS = {
    ("military", "yes"),
    ("landuse", "military"),
    ("construction", "yes"),
    ("access", "private"),
    ("access", "no"),
}

CATEGORY_PRIORITY = {
    "public_art": 7,
    "historic": 6,
    "viewpoint": 5,
    "park": 4,
    "trail": 3,
    "water": 2,
    "bridge": 1,
}

_CACHE: dict[
    tuple[float, float, int, int, int],
    tuple[float, dict[str, Any]],
] = {}


@dataclass(frozen=True)
class Feature:
    osm_type: str
    osm_id: int
    name: str
    category: str
    latitude: float
    longitude: float
    distance_m: float
    tags: dict[str, str]


def haversine_m(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    to_radians = math.pi / 180
    delta_latitude = (latitude_b - latitude_a) * to_radians
    delta_longitude = (longitude_b - longitude_a) * to_radians
    latitude_a_radians = latitude_a * to_radians
    latitude_b_radians = latitude_b * to_radians
    value = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(latitude_a_radians)
        * math.cos(latitude_b_radians)
        * math.sin(delta_longitude / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(value))


def build_overpass_query(latitude: float, longitude: float, radius_m: int) -> str:
    return f"""
    [out:json][timeout:25];
    (
      nwr(around:{radius_m},{latitude},{longitude})["tourism"~"artwork|attraction|viewpoint"];
      nwr(around:{radius_m},{latitude},{longitude})["historic"];
      nwr(around:{radius_m},{latitude},{longitude})["leisure"~"park|garden|nature_reserve"];
      nwr(around:{radius_m},{latitude},{longitude})["natural"~"water|spring|peak"];
      nwr(around:{radius_m},{latitude},{longitude})["waterway"~"river|stream|canal"];
      way(around:{radius_m},{latitude},{longitude})["bridge"]["highway"~"footway|path|pedestrian"];
      nwr(around:{radius_m},{latitude},{longitude})["highway"="trailhead"];
      way(around:{radius_m},{latitude},{longitude})["highway"~"path|footway"]["name"];
    )->.candidates;
    way(around.candidates:40)["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|track|.*_link"]->.roads;
    .candidates out center tags;
    .roads out tags geom;
    """


def fetch_osm_features(
    latitude: float,
    longitude: float,
    radius_m: int,
) -> list[dict[str, Any]]:
    errors = []
    query = build_overpass_query(latitude, longitude, radius_m).encode("utf-8")
    for endpoint in OVERPASS_URLS:
        try:
            response = requests.post(
                endpoint,
                data=query,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json",
                    "User-Agent": "HomageEnvironmentQuests/0.1",
                },
                timeout=18,
            )
            response.raise_for_status()
            return response.json().get("elements", [])
        except Exception as error:
            errors.append(f"{endpoint}: {error}")
    raise RuntimeError("; ".join(errors))


def feature_coordinates(element: dict[str, Any]) -> tuple[float, float] | None:
    latitude = element.get("lat")
    longitude = element.get("lon")
    if latitude is None or longitude is None:
        center = element.get("center") or {}
        latitude = center.get("lat")
        longitude = center.get("lon")
    if not isinstance(latitude, (int, float)) or not isinstance(
        longitude, (int, float)
    ):
        return None
    return float(latitude), float(longitude)


def is_safe_candidate(tags: dict[str, str]) -> bool:
    access = tags.get("access", "").lower()
    if access in BLOCKED_ACCESS:
        return False
    if tags.get("military") or tags.get("landuse") == "military":
        return False
    if tags.get("disused") == "yes" or tags.get("abandoned") == "yes":
        return False
    highway = tags.get("highway")
    if highway and highway not in PEDESTRIAN_HIGHWAYS:
        return False
    return not any(tags.get(key) == value for key, value in BLOCKED_TAGS)


def road_buffer_m(tags: dict[str, str]) -> float:
    highway = tags.get("highway", "")
    if highway in MAJOR_ROADS:
        return 40
    if highway in LOCAL_MOTOR_ROADS:
        return 18
    return 0


def road_geometry(element: dict[str, Any]) -> list[tuple[float, float]]:
    geometry = element.get("geometry")
    if not isinstance(geometry, list):
        return []
    points = []
    for point in geometry:
        if not isinstance(point, dict):
            continue
        latitude = point.get("lat")
        longitude = point.get("lon")
        if isinstance(latitude, (int, float)) and isinstance(
            longitude, (int, float)
        ):
            points.append((float(latitude), float(longitude)))
    return points


def point_to_segment_m(
    latitude: float,
    longitude: float,
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    meters_per_latitude = 111_320
    meters_per_longitude = 111_320 * math.cos(math.radians(latitude))
    start_x = (start[1] - longitude) * meters_per_longitude
    start_y = (start[0] - latitude) * meters_per_latitude
    end_x = (end[1] - longitude) * meters_per_longitude
    end_y = (end[0] - latitude) * meters_per_latitude
    delta_x = end_x - start_x
    delta_y = end_y - start_y
    length_squared = delta_x * delta_x + delta_y * delta_y
    if length_squared == 0:
        return math.hypot(start_x, start_y)
    projection = max(
        0.0,
        min(
            1.0,
            -(start_x * delta_x + start_y * delta_y) / length_squared,
        ),
    )
    nearest_x = start_x + projection * delta_x
    nearest_y = start_y + projection * delta_y
    return math.hypot(nearest_x, nearest_y)


def is_clear_of_motor_roads(
    latitude: float,
    longitude: float,
    roads: list[tuple[float, list[tuple[float, float]]]],
    activation_radius_m: float,
) -> bool:
    for buffer_m, geometry in roads:
        for index in range(len(geometry) - 1):
            if (
                point_to_segment_m(
                    latitude,
                    longitude,
                    geometry[index],
                    geometry[index + 1],
                )
                < buffer_m + activation_radius_m + GPS_ERROR_MARGIN_M
            ):
                return False
    return True


def quest_radius_m(category: str) -> int:
    return 40 if category in {"park", "trail"} else 30


def feature_category(tags: dict[str, str]) -> str | None:
    tourism = tags.get("tourism")
    if tourism == "artwork":
        return "public_art"
    if tags.get("historic"):
        return "historic"
    if tourism == "viewpoint" or tags.get("natural") == "peak":
        return "viewpoint"
    if tags.get("leisure") in {"park", "garden", "nature_reserve"}:
        return "park"
    if tags.get("highway") in {"trailhead", "path", "footway"}:
        return "trail"
    if tags.get("waterway") or tags.get("natural") in {"water", "spring"}:
        return "water"
    if tags.get("bridge") and tags.get("highway") in {
        "footway",
        "path",
        "pedestrian",
    }:
        return "bridge"
    if tourism in {"attraction", "museum"}:
        return "historic"
    return None


def default_name(category: str, tags: dict[str, str]) -> str:
    named_type = {
        "public_art": "Public Artwork",
        "historic": "Historic Place",
        "viewpoint": "Viewpoint",
        "park": "Local Green Space",
        "trail": "Public Trail",
        "water": "Local Waterway",
        "bridge": "Public Bridge",
    }
    return (
        tags.get("name")
        or tags.get("official_name")
        or tags.get("description")
        or named_type[category]
    )


def normalize_features(
    elements: list[dict[str, Any]],
    latitude: float,
    longitude: float,
    radius_m: int,
) -> list[Feature]:
    features: list[Feature] = []
    seen: set[tuple[str, int]] = set()
    seen_places: set[tuple[str, int, int]] = set()
    roads: list[tuple[float, list[tuple[float, float]]]] = []

    for element in elements:
        tags = element.get("tags") or {}
        if not isinstance(tags, dict):
            continue
        buffer_m = road_buffer_m(tags)
        geometry = road_geometry(element)
        if buffer_m > 0 and len(geometry) >= 2:
            roads.append((buffer_m, geometry))

    for element in elements:
        tags = element.get("tags") or {}
        if not isinstance(tags, dict) or not is_safe_candidate(tags):
            continue
        category = feature_category(tags)
        coordinates = feature_coordinates(element)
        osm_type = str(element.get("type", "unknown"))
        osm_id = element.get("id")
        if category is None or coordinates is None or not isinstance(osm_id, int):
            continue

        key = (osm_type, osm_id)
        if key in seen:
            continue
        seen.add(key)

        feature_latitude, feature_longitude = coordinates
        if not is_clear_of_motor_roads(
            feature_latitude,
            feature_longitude,
            roads,
            quest_radius_m(category),
        ):
            continue
        distance_m = haversine_m(
            latitude,
            longitude,
            feature_latitude,
            feature_longitude,
        )
        if distance_m > radius_m or distance_m < 20:
            continue

        place_key = (
            category,
            round(feature_latitude * 10_000),
            round(feature_longitude * 10_000),
        )
        if place_key in seen_places:
            continue
        seen_places.add(place_key)

        features.append(
            Feature(
                osm_type=osm_type,
                osm_id=osm_id,
                name=default_name(category, tags),
                category=category,
                latitude=feature_latitude,
                longitude=feature_longitude,
                distance_m=distance_m,
                tags={str(key): str(value) for key, value in tags.items()},
            )
        )

    return features


def feature_score(feature: Feature) -> float:
    distance_score = max(0.0, 1.0 - abs(feature.distance_m - 650) / 1_500)
    metadata_score = 0.0
    if feature.tags.get("name"):
        metadata_score += 0.6
    if feature.tags.get("wikidata") or feature.tags.get("wikipedia"):
        metadata_score += 0.5
    if feature.tags.get("access") in {"yes", "permissive", "designated"}:
        metadata_score += 0.4
    return CATEGORY_PRIORITY[feature.category] + distance_score + metadata_score


def quest_description(feature: Feature) -> tuple[str, str]:
    templates = {
        "public_art": (
            f"Find {feature.name} and photograph a detail that catches your eye.",
            "photo",
        ),
        "historic": (
            f"Visit {feature.name} and photograph something that shows its history.",
            "photo",
        ),
        "viewpoint": (
            f"Reach {feature.name} and capture the view from public ground.",
            "photo",
        ),
        "park": (
            f"Check in at {feature.name} while remaining on a public path.",
            "checkin",
        ),
        "trail": (
            f"Reach {feature.name} and check in from the public trail.",
            "checkin",
        ),
        "water": (
            f"Find {feature.name} and photograph it from a safe public location.",
            "photo",
        ),
        "bridge": (
            f"Reach {feature.name} using a public pedestrian approach.",
            "checkin",
        ),
    }
    return templates[feature.category]


def feature_to_quest(feature: Feature, order: int) -> dict[str, Any]:
    description, kind = quest_description(feature)
    identity = f"osm:{feature.osm_type}:{feature.osm_id}"
    digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]
    radius = quest_radius_m(feature.category)
    return {
        "id": f"osm-{digest}",
        "name": feature.name,
        "description": description,
        "latitude": feature.latitude,
        "longitude": feature.longitude,
        "radius": radius,
        "kind": kind,
        "order": order,
        "category": feature.category,
        "source": "openstreetmap",
        "distance_m": round(feature.distance_m),
    }


def select_diverse_features(features: list[Feature], limit: int) -> list[Feature]:
    ranked = sorted(features, key=feature_score, reverse=True)
    selected: list[Feature] = []
    used_categories: set[str] = set()

    for feature in ranked:
        if feature.category in used_categories:
            continue
        selected.append(feature)
        used_categories.add(feature.category)
        if len(selected) == limit:
            return selected

    for feature in ranked:
        if feature in selected:
            continue
        selected.append(feature)
        if len(selected) == limit:
            break

    return selected


def procedural_quests(
    latitude: float,
    longitude: float,
    start_order: int,
    count: int,
) -> list[dict[str, Any]]:
    templates = [
        (
            "Rural Sound Map",
            "Stay where you are, listen for three layers of sound, then photograph a nearby texture or pattern.",
            "photo",
            "observation",
        ),
        (
            "Horizon Study",
            "Stay where you are and photograph the meeting point between the land, trees, or buildings and the sky.",
            "photo",
            "skyline",
        ),
        (
            "Natural Pattern",
            "Stay where you are and photograph a natural color, shape, or repeating pattern within reach.",
            "photo",
            "natural_pattern",
        ),
    ]
    quests = []
    for index, (name, description, kind, category) in enumerate(templates[:count]):
        quests.append(
            {
                "id": f"procedural-{category}-{round(latitude, 4)}-{round(longitude, 4)}",
                "name": name,
                "description": description,
                "latitude": latitude,
                "longitude": longitude,
                "radius": 30,
                "kind": kind,
                "order": start_order + index,
                "category": category,
                "source": "procedural-stationary-confirmed",
                "distance_m": 0,
                "requires_safe_area_confirmation": True,
                "stationary_only": True,
            }
        )
    return quests


def generate_environment_quests(
    latitude: float,
    longitude: float,
    radius_m: int = 2_000,
    limit: int = 3,
) -> dict[str, Any]:
    cache_key = (
        round(latitude, 2),
        round(longitude, 2),
        radius_m,
        limit,
        SAFETY_POLICY_VERSION,
    )
    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        return {**cached[1], "cached": True}

    source = "openstreetmap"
    error = None
    try:
        elements = fetch_osm_features(latitude, longitude, radius_m)
        features = normalize_features(elements, latitude, longitude, radius_m)
    except Exception as exc:
        features = []
        source = "procedural-fallback"
        error = str(exc)

    selected = select_diverse_features(features, limit)
    quests = [
        feature_to_quest(feature, index + 1)
        for index, feature in enumerate(selected)
    ]
    uses_stationary_fallback = not quests
    if uses_stationary_fallback:
        quests = procedural_quests(latitude, longitude, 1, limit)
        source = "procedural-stationary-confirmation"

    response = {
        "status": "ok",
        "source": source,
        "cached": False,
        "center": {"latitude": latitude, "longitude": longitude},
        "radius_m": radius_m,
        "features_considered": len(features),
        "quests": quests,
        "safety": {
            "policy_version": SAFETY_POLICY_VERSION,
            "road_buffered": True,
            "procedural_destinations": uses_stationary_fallback,
            "stationary_confirmation_required": uses_stationary_fallback,
        },
    }
    if error:
        response["warning"] = error
    _CACHE[cache_key] = (time.time(), response)
    return response
