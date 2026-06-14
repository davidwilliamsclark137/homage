from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse


# ---------- Storage resolution ----------
def resolve_data_dir() -> Path:
    env = os.getenv("DATA_DIR")
    candidates = []

    if env:
        candidates.append(Path(env))

    candidates += [
        Path("/var/data"),
        Path("/tmp/data"),
        Path(__file__).resolve().parent / "data",
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
SUBDIRS = ["raw", "processed", "thumbs", "meta"]

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
    yield


app = FastAPI(title="Homage Backend MVP", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Helpers ----------
def invalid_filename(name: str) -> bool:
    return ".." in name or name.startswith("/")


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
          <li><a href="/files">/files</a> – list uploaded files</li>
          <li><a href="/completed">/completed</a> – completed quest records</li>
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
    }


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
        "filename": file.filename,
        "file_url": f"/files/{file.filename}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "size": len(content),
    }

    meta_path = DATA_DIR / "meta" / f"{Path(file.filename).stem}.json"
    meta_path.write_text(json.dumps(record, indent=2), encoding="utf-8")

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
