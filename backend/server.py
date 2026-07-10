from __future__ import annotations

import json
import hashlib
import hmac
import math
import os
import secrets
import string
import subprocess
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from backend import local_database
from backend.quests import SAFETY_POLICY_VERSION, generate_environment_quests


# ---------- Storage resolution ----------
def resolve_data_dir() -> Path:
    env = os.getenv("DATA_DIR")
    candidates = []

    if env:
        candidates.append(Path(env))

    candidates += [
        Path(__file__).resolve().parent / "data",
        Path("/var/data"),
        Path("/tmp/data"),
    ]

    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            t = c / ".write_test"
            t.write_text("ok", encoding="utf-8")
            t.unlink(missing_ok=True)
            return c
        except Exception:
            continue

    return Path("/tmp")


DATA_DIR = resolve_data_dir()
SUBDIRS = [
    "raw",
    "processed",
    "thumbs",
    "meta",
    "rooms",
    "custom_quests",
    "documents",
    "songs",
]
ROOM_LOCK = threading.Lock()
CUSTOM_QUEST_LOCK = threading.Lock()
DOCUMENT_LOCK = threading.Lock()
SONG_LOCK = threading.Lock()
ROOM_ALPHABET = string.ascii_uppercase + string.digits
ARTIFACT_TOKEN_SECRET = os.getenv("ARTIFACT_TOKEN_SECRET") or secrets.token_urlsafe(
    32
)

# Downtown McKinney OSM test bounds.
# Overpass bbox format: south, west, north, east
MAZE_SOUTH = 33.196
MAZE_WEST = -96.618
MAZE_NORTH = 33.198
MAZE_EAST = -96.614

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

FALLBACK_MAZE_PATH = [
    {"latitude": 33.19702, "longitude": -96.61435},
    {"latitude": 33.19702, "longitude": -96.61535},
    {"latitude": 33.19648, "longitude": -96.61535},
    {"latitude": 33.19648, "longitude": -96.61615},
    {"latitude": 33.19705, "longitude": -96.61615},
    {"latitude": 33.19705, "longitude": -96.61735},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    for sub in SUBDIRS:
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)
    local_database.initialize_database(DATA_DIR)
    yield


app = FastAPI(title="Homage Backend MVP", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestGenerationRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=2_000, ge=250, le=5_000)
    limit: int = Field(default=3, ge=1, le=5)


class CustomQuestCreateRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=3, max_length=60)
    description: str = Field(min_length=10, max_length=240)
    category: str = Field(
        default="observation",
        pattern="^(observation|photography|sound|sky)$",
    )
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=35)
    stationary_fixes: int = Field(ge=3, le=20)
    safe_area_confirmed: bool


class DocumentCreateRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=10, max_length=4_000)
    byline: str = Field(default="", max_length=50)
    document_kind: str = Field(pattern="^(poem|prose_poem|short_story)$")
    template: str = Field(pattern="^(neon|terminal|letterpress)$")
    accent: str = Field(pattern="^(cyan|magenta|lime|amber)$")
    typography: str = Field(pattern="^(serif|sans|mono)$")
    alignment: str = Field(pattern="^(left|center|right)$")
    puzzle_kind: str = Field(pattern="^(riddle|word_puzzle|clue)$")
    puzzle_prompt: str = Field(min_length=8, max_length=240)
    puzzle_answer: str = Field(min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=35)
    stationary_fixes: int = Field(ge=3, le=20)
    safe_area_confirmed: bool


class SongCreateRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=60)
    composition: dict
    puzzle_kind: str = Field(pattern="^(riddle|word_puzzle|clue)$")
    puzzle_prompt: str = Field(min_length=8, max_length=240)
    puzzle_answer: str = Field(min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=35)
    stationary_fixes: int = Field(ge=3, le=20)
    safe_area_confirmed: bool


class ArtifactUnlockRequest(BaseModel):
    artifact_kind: str = Field(pattern="^(document|song)$")
    artifact_id: str = Field(min_length=6, max_length=80)
    answer: str = Field(min_length=1, max_length=80)


class RoomCreateRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)
    platform: str = Field(min_length=1, max_length=20)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    mode: str = Field(default="signal_hunt", pattern="^(signal_hunt|hide_seek)$")


class RoomJoinRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)
    platform: str = Field(min_length=1, max_length=20)


class RoomActionRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    quest_id: str = Field(min_length=1, max_length=160)
    action: str = Field(pattern="^(melody|photo|sky)$")
    safe_area_confirmed: bool = False


class HideSelectRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    quest_id: str = Field(min_length=1, max_length=160)


class HideReadyRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    photo_url: Optional[str] = Field(default=None, max_length=500)
    treatment: Optional[str] = Field(default=None, max_length=40)
    safe_area_confirmed: bool = False


class HidePositionRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=10_000)


class HidePlayerRequest(BaseModel):
    player_id: str = Field(min_length=8, max_length=80)
    safe_area_confirmed: bool = False


class LocalAccountCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)


class LocalDeviceRegisterRequest(BaseModel):
    device_id: str = Field(min_length=6, max_length=120)
    device_name: str = Field(min_length=1, max_length=80)
    platform: str = Field(min_length=1, max_length=30)
    account_id: Optional[str] = Field(default=None, min_length=6, max_length=80)


class PairingCodeCreateRequest(BaseModel):
    account_id: Optional[str] = Field(default=None, min_length=6, max_length=80)
    display_name: str = Field(default="Homage Home Base", min_length=1, max_length=60)


class PairingCodeClaimRequest(BaseModel):
    device_id: str = Field(min_length=6, max_length=120)
    device_name: str = Field(min_length=1, max_length=80)
    platform: str = Field(min_length=1, max_length=30)
    player_id: str = Field(min_length=8, max_length=80)
    player_name: str = Field(min_length=1, max_length=30)


# ---------- Helpers ----------
def invalid_filename(name: str) -> bool:
    return ".." in name or name.startswith("/")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_single_line(value: str) -> str:
    return " ".join(value.split())


def normalized_puzzle_answer(value: str) -> str:
    return " ".join(
        "".join(character for character in word.casefold() if character.isalnum())
        for word in value.split()
        if any(character.isalnum() for character in word)
    )


def puzzle_answer_digest(value: str) -> str:
    normalized = normalized_puzzle_answer(value)
    if not normalized:
        raise HTTPException(
            status_code=422,
            detail="Puzzle answer must contain a letter or number",
        )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def artifact_access_token(artifact_kind: str, artifact_id: str) -> str:
    message = f"{artifact_kind}:{artifact_id}".encode("utf-8")
    return hmac.new(
        ARTIFACT_TOKEN_SECRET.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def require_artifact_access(
    record: dict,
    artifact_kind: str,
    artifact_id: str,
    token: Optional[str],
) -> None:
    if not record.get("answer_digest"):
        return
    expected = artifact_access_token(artifact_kind, artifact_id)
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Solve the artifact puzzle first")


def latex_escape(value: str) -> str:
    value = (
        value.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2026", "...")
        .replace("\u00a0", " ")
    )
    replacements = {
        "\\": r"\textbackslash{}",
        "{": r"\{",
        "}": r"\}",
        "$": r"\$",
        "&": r"\&",
        "#": r"\#",
        "_": r"\_",
        "%": r"\%",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(character, character) for character in value)


def latex_document_body(body: str, document_kind: str) -> str:
    normalized = body.replace("\r\n", "\n").replace("\r", "\n").strip()
    if document_kind == "poem":
        lines = []
        for line in normalized.split("\n"):
            lines.append(
                r"\medskip" if not line.strip() else f"{latex_escape(line.strip())}\\\\"
            )
        return "\n".join(lines)

    paragraphs = [
        latex_escape(" ".join(paragraph.split()))
        for paragraph in normalized.split("\n\n")
        if paragraph.strip()
    ]
    return "\n\n\\par\\medskip\n\n".join(paragraphs)


def document_latex(payload: DocumentCreateRequest) -> str:
    accent_colors = {
        "cyan": "20E7FF",
        "magenta": "FF4FCB",
        "lime": "B7FF5A",
        "amber": "FFD166",
    }
    templates = {
        "neon": ("0D0F12", "F4F7FA", "A5ADB8"),
        "terminal": ("080A0C", "B7FF5A", "73A66A"),
        "letterpress": ("F1F1EF", "171A1F", "505965"),
    }
    fonts = {
        "serif": r"\rmfamily",
        "sans": r"\sffamily",
        "mono": r"\ttfamily",
    }
    alignments = {
        "left": "flushleft",
        "center": "center",
        "right": "flushright",
    }
    background, foreground, muted = templates[payload.template]
    font_command = fonts[payload.typography]
    alignment = alignments[payload.alignment]
    title = latex_escape(clean_single_line(payload.title))
    byline_value = clean_single_line(payload.byline) or clean_single_line(
        payload.player_name
    )
    byline = latex_escape(byline_value)
    body = latex_document_body(payload.body, payload.document_kind)
    kind_label = latex_escape(payload.document_kind.replace("_", " ").upper())

    return rf"""\documentclass[11pt,letterpaper]{{article}}
\usepackage[margin=0.88in]{{geometry}}
\usepackage{{xcolor}}
\usepackage{{microtype}}
\usepackage{{parskip}}
\usepackage{{fancyhdr}}
\definecolor{{PageBackground}}{{HTML}}{{{background}}}
\definecolor{{PageForeground}}{{HTML}}{{{foreground}}}
\definecolor{{PageMuted}}{{HTML}}{{{muted}}}
\definecolor{{Accent}}{{HTML}}{{{accent_colors[payload.accent]}}}
\pagecolor{{PageBackground}}
\color{{PageForeground}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\headheight}}{{14pt}}
\pagestyle{{fancy}}
\fancyhf{{}}
\fancyhead[L]{{\textcolor{{PageMuted}}{{{kind_label}}}}}
\fancyhead[R]{{\textcolor{{Accent}}{{HOMAGE SIGNAL}}}}
\fancyfoot[C]{{\textcolor{{PageMuted}}{{\thepage}}}}
\begin{{document}}
{font_command}
\begin{{{alignment}}}
{{\color{{Accent}}\fontsize{{28}}{{33}}\selectfont\bfseries {title}\par}}
\vspace{{0.35em}}
{{\color{{PageMuted}}\small {byline}\par}}
\vspace{{0.9em}}
{{\color{{Accent}}\rule{{\linewidth}}{{1.4pt}}\par}}
\vspace{{1.3em}}
\fontsize{{12.2}}{{18}}\selectfont
{body}
\end{{{alignment}}}
\vfill
{{\color{{Accent}}\rule{{0.18\linewidth}}{{1.4pt}}}}
\end{{document}}
"""


def document_path(document_id: str, extension: str) -> Path:
    if (
        not document_id.startswith("document-")
        or any(
            character not in string.ascii_letters + string.digits + "-"
            for character in document_id
        )
        or extension not in {"json", "tex", "pdf"}
    ):
        raise HTTPException(status_code=400, detail="Invalid document ID")
    return DATA_DIR / "documents" / f"{document_id}.{extension}"


def public_document(record: dict, include_access: bool = False) -> dict:
    public = {
        key: value
        for key, value in record.items()
        if key
        not in {"created_by", "source_path", "pdf_path", "answer_digest"}
    }
    if include_access and record.get("answer_digest"):
        token = artifact_access_token("document", record["id"])
        public["pdf_url"] = f"{record['pdf_url']}?token={token}"
        public["source_url"] = f"{record['source_url']}?token={token}"
    return public


def song_path(song_id: str) -> Path:
    if not song_id.startswith("song-") or any(
        character not in string.ascii_letters + string.digits + "-"
        for character in song_id
    ):
        raise HTTPException(status_code=400, detail="Invalid song ID")
    return DATA_DIR / "songs" / f"{song_id}.json"


def public_song(record: dict, include_access: bool = False) -> dict:
    public = {
        key: value
        for key, value in record.items()
        if key not in {"created_by", "answer_digest"}
    }
    if include_access and record.get("answer_digest"):
        token = artifact_access_token("song", record["id"])
        public["song_url"] = f"{record['song_url']}?token={token}"
    return public


def validate_song_composition(composition: dict) -> dict:
    keys = {"C", "D", "E", "F", "G", "A"}
    scales = {"major", "minor"}
    meters = {"4/4": 8, "3/4": 6, "6/8": 6}
    if (
        composition.get("version") != 1
        or composition.get("key") not in keys
        or composition.get("scale") not in scales
        or composition.get("meter") not in meters
        or not isinstance(composition.get("tempo"), int)
        or not 60 <= composition["tempo"] <= 180
    ):
        raise HTTPException(status_code=422, detail="Invalid 8-bit song settings")

    steps = meters[composition["meter"]]
    chords = composition.get("chordDegrees")
    melody = composition.get("melody")
    drums = composition.get("drums")
    if (
        not isinstance(chords, list)
        or len(chords) != 8
        or any(type(degree) is not int or not 0 <= degree <= 6 for degree in chords)
        or not isinstance(melody, list)
        or len(melody) != 8
        or not isinstance(drums, dict)
        or set(drums) != {"kick", "snare", "hat"}
    ):
        raise HTTPException(status_code=422, detail="Song must contain eight valid bars")

    for bar in melody:
        if (
            not isinstance(bar, list)
            or len(bar) != steps
            or any(
                note is not None
                and (type(note) is not int or not 0 <= note <= 7)
                for note in bar
            )
        ):
            raise HTTPException(status_code=422, detail="Invalid melody sequence")
    for track in drums.values():
        if (
            not isinstance(track, list)
            or len(track) != 8
            or any(
                not isinstance(bar, list)
                or len(bar) != steps
                or any(type(hit) is not bool for hit in bar)
                for bar in track
            )
        ):
            raise HTTPException(status_code=422, detail="Invalid drum sequence")

    return {
        "version": 1,
        "title": clean_single_line(str(composition.get("title", "")))[:60],
        "key": composition["key"],
        "scale": composition["scale"],
        "meter": composition["meter"],
        "tempo": composition["tempo"],
        "chordDegrees": chords,
        "melody": melody,
        "drums": drums,
    }


def custom_quest_path(quest_id: str) -> Path:
    if not quest_id.startswith("community-") or any(
        character not in string.ascii_letters + string.digits + "-"
        for character in quest_id
    ):
        raise HTTPException(status_code=400, detail="Invalid quest ID")
    return DATA_DIR / "custom_quests" / f"{quest_id}.json"


def read_custom_quests() -> list[dict]:
    directory = DATA_DIR / "custom_quests"
    directory.mkdir(parents=True, exist_ok=True)
    quests = []
    for path in directory.glob("community-*.json"):
        try:
            quest = json.loads(path.read_text(encoding="utf-8"))
            if quest.get("enabled", True):
                quests.append(quest)
        except Exception:
            continue
    return quests


def nearby_custom_quests(
    latitude: float,
    longitude: float,
    radius_m: int,
) -> list[dict]:
    nearby = []
    for stored in read_custom_quests():
        distance = distance_meters(
            latitude,
            longitude,
            stored["latitude"],
            stored["longitude"],
        )
        if distance > radius_m:
            continue
        nearby.append(
            {
                key: value
                for key, value in stored.items()
                if key not in {"created_by", "enabled"}
            }
            | {"distance_m": round(distance)}
        )
    return sorted(nearby, key=lambda quest: (quest["distance_m"], quest["created_at"]))


def generate_quest_feed(
    latitude: float,
    longitude: float,
    radius_m: int,
    limit: int,
) -> dict:
    generated = generate_environment_quests(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
    )
    community = nearby_custom_quests(latitude, longitude, radius_m)
    combined = []
    seen = set()
    for quest in [*community, *generated.get("quests", [])]:
        if quest["id"] in seen:
            continue
        seen.add(quest["id"])
        combined.append({**quest, "order": len(combined) + 1})
        if len(combined) == limit:
            break

    if not community:
        return generated
    return {
        **generated,
        "source": f"community-and-{generated.get('source', 'generated')}",
        "quests": combined,
        "community_quests_considered": len(community),
        "safety": {
            **generated.get("safety", {}),
            "community_stationary_confirmation": True,
        },
    }


def room_path(code: str) -> Path:
    normalized = code.strip().upper()
    if len(normalized) != 6 or any(c not in ROOM_ALPHABET for c in normalized):
        raise HTTPException(status_code=400, detail="Invalid room code")
    return DATA_DIR / "rooms" / f"{normalized}.json"


def read_room(code: str) -> dict:
    path = room_path(code)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Room not found")
    try:
        room = json.loads(path.read_text(encoding="utf-8"))
        if room.get("safety_policy_version", 0) < SAFETY_POLICY_VERSION:
            raise HTTPException(
                status_code=409,
                detail="Room uses an outdated safety policy. Create a new room.",
            )
        return room
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Room data is unavailable") from error


def write_room(room: dict) -> None:
    path = room_path(room["code"])
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(room, indent=2), encoding="utf-8")
    temporary.replace(path)


def public_room(room: dict, player_id: Optional[str] = None) -> dict:
    response = {
        "code": room["code"],
        "mode": room.get("mode", "signal_hunt"),
        "safety_policy_version": room["safety_policy_version"],
        "status": room["status"],
        "created_at": room["created_at"],
        "updated_at": room["updated_at"],
        "quest_index": room["quest_index"],
        "quests": room["quests"],
        "completed_ids": room["completed_ids"],
        "players": list(room["players"].values()),
        "progress": room["progress"],
    }
    if room.get("mode") != "hide_seek":
        return response

    player = room["players"].get(player_id)
    hide_state = room["hide_seek"]
    selected = next(
        (
            quest
            for quest in room["quests"]
            if quest["id"] == hide_state["selected_quest_id"]
        ),
        None,
    )
    is_hider = player and player["role"] == "hider"
    response["quests"] = room["quests"] if is_hider else []
    response["hide_seek"] = {
        "selected_quest": selected if is_hider else None,
        "ready": hide_state["ready"],
        "photo_url": hide_state["photo_url"] if hide_state["ready"] else None,
        "treatment": hide_state["treatment"] if hide_state["ready"] else None,
        "distance_m": hide_state["distance_m"] if not is_hider else None,
        "temperature": hide_state["temperature"] if not is_hider else None,
        "trend": hide_state["trend"] if not is_hider else None,
        "can_find": hide_state["can_find"] if not is_hider else False,
        "found": hide_state["found"],
        "found_by": hide_state["found_by"],
        "sky_by": hide_state["sky_by"],
        "requires_safe_area_confirmation": bool(
            selected and selected.get("requires_safe_area_confirmation")
        ),
    }
    return response


def fresh_progress(room: dict) -> dict:
    quest_index = room["quest_index"]
    quest_id = (
        room["quests"][quest_index]["id"]
        if quest_index < len(room["quests"])
        else None
    )
    return {
        "quest_id": quest_id,
        "melody_by": None,
        "photo_by": None,
        "sky_by": [],
    }


def distance_meters(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    radius = 6_371_000
    latitude_delta = math.radians(latitude_b - latitude_a)
    longitude_delta = math.radians(longitude_b - longitude_a)
    first = math.radians(latitude_a)
    second = math.radians(latitude_b)
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first)
        * math.cos(second)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(value))


def temperature_for_distance(distance: float, radius: float) -> str:
    if distance <= max(radius, 60):
        return "signal"
    if distance <= 150:
        return "burning"
    if distance <= 350:
        return "hot"
    if distance <= 700:
        return "warm"
    if distance <= 1_200:
        return "cool"
    return "cold"


def point_inside_bounds(p: dict, south: float, west: float, north: float, east: float) -> bool:
    return (
        p["lat"] >= south
        and p["lat"] <= north
        and p["lon"] >= west
        and p["lon"] <= east
    )


def fetch_osm_highways() -> list[dict]:
    query = f"""
    [out:json][timeout:25];
    way["highway"]({MAZE_SOUTH},{MAZE_WEST},{MAZE_NORTH},{MAZE_EAST});
    out geom;
    """

    r = requests.post(
        OVERPASS_URL,
        data=query.encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json",
            "User-Agent": "HomageMazePrototype/0.1",
        },
        timeout=30,
    )

    r.raise_for_status()
    data = r.json()
    return data.get("elements", [])


def fallback_maze_response(reason: str):
    return {
        "status": "fallback",
        "source": "fallback-hardcoded",
        "reason": reason,
        "path": FALLBACK_MAZE_PATH,
    }


def choose_longest_east_west_way(ways: list[dict]):
    best_way = None
    best_span = 0.0

    for way in ways:
        geometry = [
            p
            for p in way.get("geometry", [])
            if point_inside_bounds(p, MAZE_SOUTH, MAZE_WEST, MAZE_NORTH, MAZE_EAST)
        ]

        if len(geometry) < 2:
            continue

        lons = [p["lon"] for p in geometry]
        span = max(lons) - min(lons)

        if span > best_span:
            best_span = span
            best_way = geometry

    return best_way, best_span


# ---------- Basic backend ----------
@app.get("/", response_class=HTMLResponse)
def root():
    return f"""
    <html>
      <head><title>Homage Backend MVP</title></head>
      <body style="font-family: system-ui; margin: 2rem;">
        <h1>Homage Backend is live ✅</h1>
        <p>DATA_DIR: <code>{DATA_DIR}</code></p>
        <ul>
          <li><a href="/healthz">/healthz</a> – health check</li>
          <li><a href="/local/database">/local/database</a> – local database status</li>
          <li><a href="/files">/files</a> – list uploaded files</li>
          <li><a href="/completed">/completed</a> – completed quest records</li>
          <li><code>POST /quests/generate</code> – nearby environment quests</li>
          <li><a href="/maze/test-osm">/maze/test-osm</a> – OSM test</li>
          <li><a href="/docs">/docs</a> – interactive API docs</li>
        </ul>
        <h2>Quick upload</h2>
        <form action="/upload" method="post" enctype="multipart/form-data">
          <input type="file" name="file" />
          <button type="submit">Upload</button>
        </form>
      </body>
    </html>
    """


@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        "data_dir": str(DATA_DIR),
        "subdirs": [str(DATA_DIR / s) for s in SUBDIRS],
        "database": local_database.database_status(DATA_DIR),
    }


@app.get("/local/database")
def local_database_status():
    return local_database.database_status(DATA_DIR)


@app.post("/local/accounts")
def create_local_account(payload: LocalAccountCreateRequest):
    account = local_database.create_account(
        DATA_DIR,
        display_name=clean_single_line(payload.display_name),
    )
    return {"status": "created", "account": account}


@app.get("/local/accounts")
def list_local_accounts():
    accounts = local_database.list_accounts(DATA_DIR)
    return {"count": len(accounts), "accounts": accounts}


@app.post("/local/devices")
def register_local_device(payload: LocalDeviceRegisterRequest):
    device = local_database.register_device(
        DATA_DIR,
        device_id=clean_single_line(payload.device_id),
        device_name=clean_single_line(payload.device_name),
        platform=clean_single_line(payload.platform),
        account_id=clean_single_line(payload.account_id)
        if payload.account_id
        else None,
    )
    return {"status": "registered", "device": device}


@app.post("/local/pairing-codes")
def create_pairing_code(payload: PairingCodeCreateRequest):
    account_id = payload.account_id
    account = None
    if account_id:
        account = local_database.get_account(DATA_DIR, clean_single_line(account_id))
        if not account:
            raise HTTPException(status_code=404, detail="Local account not found")
    else:
        account = local_database.create_account(
            DATA_DIR,
            display_name=clean_single_line(payload.display_name),
        )
        account_id = account["account_id"]

    try:
        pairing = local_database.create_pairing_code(
            DATA_DIR,
            account_id=account_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {
        "status": "created",
        "account": account or local_database.get_account(DATA_DIR, account_id),
        "pairing": pairing,
    }


@app.post("/local/pairing-codes/{code}/claim")
def claim_pairing_code(code: str, payload: PairingCodeClaimRequest):
    try:
        result = local_database.claim_pairing_code(
            DATA_DIR,
            code=code,
            device_id=clean_single_line(payload.device_id),
            device_name=clean_single_line(payload.device_name),
            platform=clean_single_line(payload.platform),
            player_id=payload.player_id,
            player_name=clean_single_line(payload.player_name),
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"status": "paired", **result}


@app.post("/multiplayer/rooms")
def create_multiplayer_room(payload: RoomCreateRequest):
    quest_response = generate_quest_feed(
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_m=2_000,
        limit=3,
    )
    quests = quest_response.get("quests", [])
    if not quests:
        raise HTTPException(status_code=503, detail="No quests could be generated")

    with ROOM_LOCK:
        code = ""
        for _ in range(20):
            candidate = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(6))
            if not room_path(candidate).exists():
                code = candidate
                break
        if not code:
            raise HTTPException(status_code=503, detail="Could not allocate a room")

        now = utc_now()
        room = {
            "code": code,
            "mode": payload.mode,
            "safety_policy_version": SAFETY_POLICY_VERSION,
            "status": "waiting",
            "created_at": now,
            "updated_at": now,
            "quest_index": 0,
            "quests": quests,
            "completed_ids": [],
            "players": {
                payload.player_id: {
                    "id": payload.player_id,
                    "name": payload.player_name.strip(),
                    "platform": payload.platform,
                    "role": (
                        "hider" if payload.mode == "hide_seek" else "pathfinder"
                    ),
                    "joined_at": now,
                }
            },
        }
        room["progress"] = fresh_progress(room)
        if payload.mode == "hide_seek":
            room["hide_seek"] = {
                "selected_quest_id": None,
                "ready": False,
                "photo_url": None,
                "treatment": None,
                "distance_m": None,
                "temperature": None,
                "trend": None,
                "can_find": False,
                "found": False,
                "found_by": None,
                "sky_by": [],
            }
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/join")
def join_multiplayer_room(code: str, payload: RoomJoinRequest):
    with ROOM_LOCK:
        room = read_room(code)
        existing = room["players"].get(payload.player_id)
        if existing:
            existing["name"] = payload.player_name.strip()
            existing["platform"] = payload.platform
        else:
            if len(room["players"]) >= 2:
                raise HTTPException(status_code=409, detail="Room is full")
            now = utc_now()
            room["players"][payload.player_id] = {
                "id": payload.player_id,
                "name": payload.player_name.strip(),
                "platform": payload.platform,
                "role": (
                    "seeker"
                    if room.get("mode") == "hide_seek"
                    else "archivist"
                ),
                "joined_at": now,
            }

        if len(room["players"]) == 2 and room["status"] == "waiting":
            room["status"] = "active"
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.get("/multiplayer/rooms/{code}")
def get_multiplayer_room(code: str, player_id: Optional[str] = None):
    with ROOM_LOCK:
        return public_room(read_room(code), player_id)


@app.post("/multiplayer/rooms/{code}/actions")
def submit_multiplayer_action(code: str, payload: RoomActionRequest):
    with ROOM_LOCK:
        room = read_room(code)
        if room.get("mode") != "signal_hunt":
            raise HTTPException(
                status_code=409,
                detail="This action belongs to Signal Hunt mode",
            )
        player = room["players"].get(payload.player_id)
        if not player:
            raise HTTPException(status_code=403, detail="Player is not in this room")
        if room["status"] == "waiting":
            raise HTTPException(status_code=409, detail="Waiting for a second player")
        if room["status"] == "complete":
            raise HTTPException(status_code=409, detail="Room is already complete")

        progress = room["progress"]
        if payload.quest_id != progress["quest_id"]:
            raise HTTPException(status_code=409, detail="Quest is no longer active")
        active_quest = next(
            quest for quest in room["quests"] if quest["id"] == progress["quest_id"]
        )
        if (
            payload.action in {"melody", "photo"}
            and active_quest.get("requires_safe_area_confirmation")
            and not payload.safe_area_confirmed
        ):
            raise HTTPException(
                status_code=409,
                detail="Confirm a stationary safe area away from traffic first",
            )

        if payload.action == "melody":
            if player["role"] != "pathfinder":
                raise HTTPException(
                    status_code=403,
                    detail="Only the Pathfinder can recover the melody",
                )
            progress["melody_by"] = payload.player_id
        elif payload.action == "photo":
            if player["role"] != "archivist":
                raise HTTPException(
                    status_code=403,
                    detail="Only the Archivist can capture the photo",
                )
            if not progress["melody_by"]:
                raise HTTPException(status_code=409, detail="Melody is not recovered")
            progress["photo_by"] = payload.player_id
        else:
            if not progress["photo_by"]:
                raise HTTPException(status_code=409, detail="Photo is not captured")
            if payload.player_id not in progress["sky_by"]:
                progress["sky_by"].append(payload.player_id)

        player_ids = set(room["players"].keys())
        sky_ids = set(progress["sky_by"])
        quest_complete = (
            len(player_ids) == 2
            and bool(progress["melody_by"])
            and bool(progress["photo_by"])
            and player_ids.issubset(sky_ids)
        )
        if quest_complete:
            room["completed_ids"].append(progress["quest_id"])
            room["quest_index"] += 1
            if room["quest_index"] >= len(room["quests"]):
                room["status"] = "complete"
            room["progress"] = fresh_progress(room)

        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/hide/select")
def select_hiding_place(code: str, payload: HideSelectRequest):
    with ROOM_LOCK:
        room = read_room(code)
        player = room["players"].get(payload.player_id)
        if room.get("mode") != "hide_seek":
            raise HTTPException(status_code=409, detail="Room is not Hide & Seek")
        if not player or player["role"] != "hider":
            raise HTTPException(status_code=403, detail="Only the Hider can choose")
        if room["hide_seek"]["ready"]:
            raise HTTPException(status_code=409, detail="Signal is already hidden")
        if not any(quest["id"] == payload.quest_id for quest in room["quests"]):
            raise HTTPException(status_code=404, detail="Hiding place not found")

        room["hide_seek"]["selected_quest_id"] = payload.quest_id
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/hide/ready")
def mark_hidden_signal_ready(code: str, payload: HideReadyRequest):
    with ROOM_LOCK:
        room = read_room(code)
        player = room["players"].get(payload.player_id)
        hide_state = room.get("hide_seek")
        if room.get("mode") != "hide_seek" or not hide_state:
            raise HTTPException(status_code=409, detail="Room is not Hide & Seek")
        if not player or player["role"] != "hider":
            raise HTTPException(
                status_code=403,
                detail="Only the Hider can plant the signal",
            )
        if room["status"] != "active":
            raise HTTPException(status_code=409, detail="Waiting for the Seeker")
        if not hide_state["selected_quest_id"]:
            raise HTTPException(status_code=409, detail="Choose a hiding place first")
        selected = next(
            quest
            for quest in room["quests"]
            if quest["id"] == hide_state["selected_quest_id"]
        )
        if (
            selected.get("requires_safe_area_confirmation")
            and not payload.safe_area_confirmed
        ):
            raise HTTPException(
                status_code=409,
                detail="Confirm a stationary safe area away from traffic first",
            )

        hide_state["ready"] = True
        hide_state["photo_url"] = payload.photo_url
        hide_state["treatment"] = payload.treatment
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/hide/position")
def update_seeker_position(code: str, payload: HidePositionRequest):
    with ROOM_LOCK:
        room = read_room(code)
        player = room["players"].get(payload.player_id)
        hide_state = room.get("hide_seek")
        if room.get("mode") != "hide_seek" or not hide_state:
            raise HTTPException(status_code=409, detail="Room is not Hide & Seek")
        if not player or player["role"] != "seeker":
            raise HTTPException(
                status_code=403,
                detail="Only the Seeker sends proximity updates",
            )
        if payload.accuracy > 35:
            raise HTTPException(status_code=409, detail="Precise GPS is required")
        if not hide_state["ready"]:
            raise HTTPException(status_code=409, detail="Signal is not hidden yet")

        target = next(
            quest
            for quest in room["quests"]
            if quest["id"] == hide_state["selected_quest_id"]
        )
        previous = hide_state["distance_m"]
        distance = distance_meters(
            payload.latitude,
            payload.longitude,
            target["latitude"],
            target["longitude"],
        )
        if previous is None or abs(previous - distance) < 10:
            trend = "steady"
        else:
            trend = "warmer" if distance < previous else "colder"
        hide_state["distance_m"] = round(distance)
        hide_state["temperature"] = temperature_for_distance(
            distance,
            target["radius"],
        )
        hide_state["trend"] = trend
        hide_state["can_find"] = distance <= max(target["radius"], 60)
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/hide/found")
def find_hidden_signal(code: str, payload: HidePlayerRequest):
    with ROOM_LOCK:
        room = read_room(code)
        player = room["players"].get(payload.player_id)
        hide_state = room.get("hide_seek")
        if room.get("mode") != "hide_seek" or not hide_state:
            raise HTTPException(status_code=409, detail="Room is not Hide & Seek")
        if not player or player["role"] != "seeker":
            raise HTTPException(status_code=403, detail="Only the Seeker can find it")
        if not hide_state["can_find"]:
            raise HTTPException(status_code=409, detail="Move closer to the signal")
        selected = next(
            quest
            for quest in room["quests"]
            if quest["id"] == hide_state["selected_quest_id"]
        )
        if (
            selected.get("requires_safe_area_confirmation")
            and not payload.safe_area_confirmed
        ):
            raise HTTPException(
                status_code=409,
                detail="Confirm a stationary safe area away from traffic first",
            )

        hide_state["found"] = True
        hide_state["found_by"] = payload.player_id
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/multiplayer/rooms/{code}/hide/sky")
def lock_hide_seek_sky(code: str, payload: HidePlayerRequest):
    with ROOM_LOCK:
        room = read_room(code)
        player = room["players"].get(payload.player_id)
        hide_state = room.get("hide_seek")
        if room.get("mode") != "hide_seek" or not hide_state:
            raise HTTPException(status_code=409, detail="Room is not Hide & Seek")
        if not player:
            raise HTTPException(status_code=403, detail="Player is not in this room")
        if not hide_state["found"]:
            raise HTTPException(status_code=409, detail="Signal has not been found")
        if payload.player_id not in hide_state["sky_by"]:
            hide_state["sky_by"].append(payload.player_id)

        if set(room["players"].keys()).issubset(set(hide_state["sky_by"])):
            room["status"] = "complete"
        room["updated_at"] = utc_now()
        write_room(room)
        return public_room(room, payload.player_id)


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    quest_id: Optional[str] = Form(default=None),
    quest_name: Optional[str] = Form(default=None),
    quest_description: Optional[str] = Form(default=None),
    quest_kind: Optional[str] = Form(default=None),
    latitude: Optional[str] = Form(default=None),
    longitude: Optional[str] = Form(default=None),
    target_latitude: Optional[str] = Form(default=None),
    target_longitude: Optional[str] = Form(default=None),
    treatment: Optional[str] = Form(default=None),
    room_code: Optional[str] = Form(default=None),
    player_id: Optional[str] = Form(default=None),
):
    if invalid_filename(file.filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    dest = DATA_DIR / "raw" / file.filename
    content = await file.read()
    dest.write_bytes(content)

    record = {
        "quest_id": quest_id,
        "quest_name": quest_name,
        "quest_description": quest_description,
        "quest_kind": quest_kind,
        "latitude": latitude,
        "longitude": longitude,
        "target_latitude": target_latitude,
        "target_longitude": target_longitude,
        "treatment": treatment,
        "room_code": room_code,
        "player_id": player_id,
        "filename": file.filename,
        "file_url": f"/files/{file.filename}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "size": len(content),
    }

    meta_path = DATA_DIR / "meta" / f"{Path(file.filename).stem}.json"
    meta_path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    local_database.record_photo_upload(DATA_DIR, record)
    local_database.record_sync_event(
        DATA_DIR,
        event_type="photo_uploaded",
        payload=record,
        player_id=player_id,
    )

    return {"saved": str(dest), "size": len(content), "metadata": record}


@app.get("/files")
def list_files():
    files = sorted(p.name for p in (DATA_DIR / "raw").glob("*") if p.is_file())
    return {"count": len(files), "files": files}


@app.get("/files/{name}")
def get_file(name: str):
    if invalid_filename(name):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = DATA_DIR / "raw" / name

    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(path)


@app.get("/completed")
def completed():
    records = []
    meta_dir = DATA_DIR / "meta"

    for p in sorted(meta_dir.glob("*.json")):
        try:
            records.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue

    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return {"count": len(records), "completed": records}


@app.post("/quests/generate")
def generate_quests(payload: QuestGenerationRequest):
    return generate_quest_feed(
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_m=payload.radius_m,
        limit=payload.limit,
    )


@app.post("/quests/custom")
def create_custom_quest(payload: CustomQuestCreateRequest):
    if not payload.safe_area_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Confirm that the quest is in a permitted area away from traffic",
        )

    quest_id = f"community-{secrets.token_hex(8)}"
    created_at = utc_now()
    quest = {
        "id": quest_id,
        "name": clean_single_line(payload.name),
        "description": clean_single_line(payload.description),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "radius": 30,
        "kind": "photo",
        "order": 1,
        "category": payload.category,
        "source": "community-stationary-confirmed",
        "distance_m": 0,
        "requires_safe_area_confirmation": True,
        "stationary_only": True,
        "creator_name": clean_single_line(payload.player_name),
        "created_at": created_at,
        "created_by": payload.player_id,
        "creation_accuracy_m": round(payload.accuracy, 1),
        "creation_stationary_fixes": payload.stationary_fixes,
        "enabled": True,
    }
    with CUSTOM_QUEST_LOCK:
        path = custom_quest_path(quest_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(quest, indent=2), encoding="utf-8")
    local_database.record_quest(DATA_DIR, quest)
    local_database.record_sync_event(
        DATA_DIR,
        event_type="quest_created",
        payload=quest,
        player_id=payload.player_id,
    )

    public_quest = {
        key: value
        for key, value in quest.items()
        if key not in {"created_by", "enabled"}
    }
    return {"status": "created", "quest": public_quest}


@app.get("/quests/custom")
def list_custom_quests(
    player_id: str = Query(min_length=8, max_length=80),
):
    quests = [
        {
            key: value
            for key, value in quest.items()
            if key not in {"created_by", "enabled"}
        }
        for quest in read_custom_quests()
        if quest.get("created_by") == player_id
    ]
    quests.sort(key=lambda quest: quest["created_at"], reverse=True)
    return {"count": len(quests), "quests": quests}


@app.post("/documents")
def create_document(payload: DocumentCreateRequest):
    if not payload.safe_area_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Confirm a permitted stationary location away from traffic",
        )

    document_id = f"document-{secrets.token_hex(8)}"
    quest_id = f"community-{secrets.token_hex(8)}"
    created_at = utc_now()
    source_path = document_path(document_id, "tex")
    pdf_path = document_path(document_id, "pdf")
    metadata_path = document_path(document_id, "json")
    source_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_text(document_latex(payload), encoding="utf-8")

    try:
        result = subprocess.run(
            [
                os.getenv("TECTONIC_BIN", "tectonic"),
                "-X",
                "compile",
                "--outdir",
                str(source_path.parent),
                str(source_path),
            ],
            capture_output=True,
            check=False,
            text=True,
            timeout=45,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise HTTPException(
            status_code=503,
            detail="The document compiler is unavailable",
        ) from error
    if result.returncode != 0 or not pdf_path.exists():
        raise HTTPException(
            status_code=422,
            detail="The document could not be typeset",
        )

    record = {
        "id": document_id,
        "quest_id": quest_id,
        "title": clean_single_line(payload.title),
        "byline": clean_single_line(payload.byline)
        or clean_single_line(payload.player_name),
        "document_kind": payload.document_kind,
        "template": payload.template,
        "accent": payload.accent,
        "typography": payload.typography,
        "alignment": payload.alignment,
        "puzzle_kind": payload.puzzle_kind,
        "puzzle_prompt": clean_single_line(payload.puzzle_prompt),
        "answer_digest": puzzle_answer_digest(payload.puzzle_answer),
        "created_at": created_at,
        "created_by": payload.player_id,
        "creator_name": clean_single_line(payload.player_name),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "pdf_url": f"/documents/{document_id}.pdf",
        "source_url": f"/documents/{document_id}.tex",
        "source_path": str(source_path),
        "pdf_path": str(pdf_path),
    }
    quest = {
        "id": quest_id,
        "name": f"Read: {record['title']}",
        "description": (
            f"A {payload.document_kind.replace('_', ' ')} left here by "
            f"{record['byline']}. Reach the signal to read it."
        ),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "radius": 30,
        "kind": "checkin",
        "order": 1,
        "category": "story",
        "source": "community-document",
        "distance_m": 0,
        "requires_safe_area_confirmation": True,
        "stationary_only": True,
        "creator_name": record["creator_name"],
        "created_at": created_at,
        "created_by": payload.player_id,
        "creation_accuracy_m": round(payload.accuracy, 1),
        "creation_stationary_fixes": payload.stationary_fixes,
        "document_id": document_id,
        "document_url": record["pdf_url"],
        "document_source_url": record["source_url"],
        "document_kind": payload.document_kind,
        "puzzle_kind": payload.puzzle_kind,
        "puzzle_prompt": record["puzzle_prompt"],
        "enabled": True,
    }

    with DOCUMENT_LOCK:
        metadata_path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    with CUSTOM_QUEST_LOCK:
        quest_path = custom_quest_path(quest_id)
        quest_path.parent.mkdir(parents=True, exist_ok=True)
        quest_path.write_text(json.dumps(quest, indent=2), encoding="utf-8")
    local_database.record_document(DATA_DIR, record)
    local_database.record_quest(DATA_DIR, quest)
    local_database.record_sync_event(
        DATA_DIR,
        event_type="document_created",
        payload={"document": record, "quest": quest},
        player_id=payload.player_id,
    )
    return {
        "status": "created",
        "document": public_document(record, include_access=True),
        "quest": {
            key: value
            for key, value in quest.items()
            if key not in {"created_by", "enabled"}
        },
    }


@app.get("/documents")
def list_documents(
    player_id: str = Query(min_length=8, max_length=80),
):
    records = []
    directory = DATA_DIR / "documents"
    directory.mkdir(parents=True, exist_ok=True)
    for path in directory.glob("document-*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("created_by") == player_id:
                records.append(public_document(record, include_access=True))
        except Exception:
            continue
    records.sort(key=lambda record: record["created_at"], reverse=True)
    return {"count": len(records), "documents": records}


@app.get("/documents/{document_id}.pdf")
def get_document_pdf(document_id: str, token: Optional[str] = None):
    path = document_path(document_id, "pdf")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    metadata_path = document_path(document_id, "json")
    if metadata_path.exists():
        record = json.loads(metadata_path.read_text(encoding="utf-8"))
        require_artifact_access(record, "document", document_id, token)
    return FileResponse(path, media_type="application/pdf", filename=path.name)


@app.get("/documents/{document_id}.tex")
def get_document_source(document_id: str, token: Optional[str] = None):
    path = document_path(document_id, "tex")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    metadata_path = document_path(document_id, "json")
    if metadata_path.exists():
        record = json.loads(metadata_path.read_text(encoding="utf-8"))
        require_artifact_access(record, "document", document_id, token)
    return FileResponse(path, media_type="text/plain", filename=path.name)


@app.post("/songs")
def create_song(payload: SongCreateRequest):
    if not payload.safe_area_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Confirm a permitted stationary location away from traffic",
        )

    composition = validate_song_composition(payload.composition)
    song_id = f"song-{secrets.token_hex(8)}"
    quest_id = f"community-{secrets.token_hex(8)}"
    created_at = utc_now()
    title = clean_single_line(payload.title)
    composition["title"] = title
    record = {
        "id": song_id,
        "quest_id": quest_id,
        "title": title,
        "composition": composition,
        "puzzle_kind": payload.puzzle_kind,
        "puzzle_prompt": clean_single_line(payload.puzzle_prompt),
        "answer_digest": puzzle_answer_digest(payload.puzzle_answer),
        "created_at": created_at,
        "created_by": payload.player_id,
        "creator_name": clean_single_line(payload.player_name),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "song_url": f"/songs/{song_id}",
    }
    quest = {
        "id": quest_id,
        "name": f"Listen: {title}",
        "description": (
            f"An eight-bar chip song left here by {record['creator_name']}. "
            "Reach the signal to recover it."
        ),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "radius": 30,
        "kind": "checkin",
        "order": 1,
        "category": "music",
        "source": "community-chip-song",
        "distance_m": 0,
        "requires_safe_area_confirmation": True,
        "stationary_only": True,
        "creator_name": record["creator_name"],
        "created_at": created_at,
        "created_by": payload.player_id,
        "creation_accuracy_m": round(payload.accuracy, 1),
        "creation_stationary_fixes": payload.stationary_fixes,
        "song_id": song_id,
        "song_url": record["song_url"],
        "puzzle_kind": payload.puzzle_kind,
        "puzzle_prompt": record["puzzle_prompt"],
        "enabled": True,
    }

    path = song_path(song_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with SONG_LOCK:
        path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    with CUSTOM_QUEST_LOCK:
        quest_path = custom_quest_path(quest_id)
        quest_path.parent.mkdir(parents=True, exist_ok=True)
        quest_path.write_text(json.dumps(quest, indent=2), encoding="utf-8")
    local_database.record_song(DATA_DIR, record)
    local_database.record_quest(DATA_DIR, quest)
    local_database.record_sync_event(
        DATA_DIR,
        event_type="song_created",
        payload={"song": record, "quest": quest},
        player_id=payload.player_id,
    )

    return {
        "status": "created",
        "song": public_song(record, include_access=True),
        "quest": {
            key: value
            for key, value in quest.items()
            if key not in {"created_by", "enabled"}
        },
    }


@app.get("/songs")
def list_songs(player_id: str = Query(min_length=8, max_length=80)):
    records = []
    directory = DATA_DIR / "songs"
    directory.mkdir(parents=True, exist_ok=True)
    for path in directory.glob("song-*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("created_by") == player_id:
                records.append(public_song(record, include_access=True))
        except Exception:
            continue
    records.sort(key=lambda record: record["created_at"], reverse=True)
    return {"count": len(records), "songs": records}


@app.get("/songs/{song_id}")
def get_song(song_id: str, token: Optional[str] = None):
    path = song_path(song_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Song not found")
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
        require_artifact_access(record, "song", song_id, token)
        return public_song(record)
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="Song could not be read") from error


@app.post("/artifacts/unlock")
def unlock_artifact(payload: ArtifactUnlockRequest):
    if payload.artifact_kind == "document":
        path = document_path(payload.artifact_id, "json")
    else:
        path = song_path(payload.artifact_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="Artifact could not be read") from error

    submitted = puzzle_answer_digest(payload.answer)
    expected = record.get("answer_digest")
    if expected and not hmac.compare_digest(submitted, expected):
        raise HTTPException(status_code=403, detail="That answer does not unlock it")

    if payload.artifact_kind == "document":
        return {
            "status": "unlocked",
            "artifact_kind": "document",
            "document": public_document(record, include_access=True),
        }
    return {
        "status": "unlocked",
        "artifact_kind": "song",
        "song": public_song(record, include_access=True),
    }


# ---------- Maze / OSM ----------
@app.post("/maze/generate")
async def generate_maze(payload: dict):
    try:
        ways = fetch_osm_highways()
        best_way, best_span = choose_longest_east_west_way(ways)

        if not best_way:
            return fallback_maze_response("No bounded OSM way found")

        path = [{"latitude": p["lat"], "longitude": p["lon"]} for p in best_way]

        return {
            "status": "ok",
            "source": "osm-longest-east-west-way-bounded",
            "span": best_span,
            "path": path,
        }

    except Exception as e:
        return fallback_maze_response(str(e))


@app.get("/maze/test-osm")
def test_osm():
    try:
        ways = fetch_osm_highways()

        bounded_ways = []
        for way in ways:
            geometry = [
                p
                for p in way.get("geometry", [])
                if point_inside_bounds(p, MAZE_SOUTH, MAZE_WEST, MAZE_NORTH, MAZE_EAST)
            ]

            if len(geometry) >= 2:
                bounded_ways.append(
                    {
                        "id": way.get("id"),
                        "name": way.get("tags", {}).get("name"),
                        "highway": way.get("tags", {}).get("highway"),
                        "points": len(geometry),
                    }
                )

        return {
            "status": "ok",
            "bounds": {
                "south": MAZE_SOUTH,
                "west": MAZE_WEST,
                "north": MAZE_NORTH,
                "east": MAZE_EAST,
            },
            "ways": len(ways),
            "bounded_ways": len(bounded_ways),
            "sample": bounded_ways[:10],
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}
