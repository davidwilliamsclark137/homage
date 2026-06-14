# backend/server.py
from __future__ import annotations
from typing import Optional

import json
import requests
from datetime import datetime, timezone
from fastapi import Form

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse


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

@asynccontextmanager
async def lifespan(app: FastAPI):
    for sub in SUBDIRS:
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)
    yield

app = FastAPI(title="QR Backend MVP", lifespan=lifespan)

# CORS so a simple web client can talk to us later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Minimal “product” ----------
@app.get("/", response_class=HTMLResponse)
def root():
    return f"""
    <html>
      <head><title>QR Backend MVP</title></head>
      <body style="font-family: system-ui; margin: 2rem;">
        <h1>QR Backend is live ✅</h1>
        <p>DATA_DIR: <code>{DATA_DIR}</code></p>
        <ul>
          <li><a href="/healthz">/healthz</a> – health check</li>
          <li><a href="/files">/files</a> – list uploaded files</li>
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
    quest_id: Optional[str]  = Form(default=None),
    quest_name: Optional[str]  = Form(default=None),
    quest_description: Optional[str] = Form(default=None),
    quest_kind: Optional[str]  = Form(default=None),
    latitude: Optional[str] = Form(default=None),
    longitude: Optional[str] = Form(default=None),
    target_latitude: Optional[str] = Form(default=None),
    target_longitude: Optional[str] = Form(default=None),
):
    
    # small safety check
    if ".." in file.filename or file.filename.startswith("/"):
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
    
    return {"saved": str(dest), "size": len(content)}

@app.get("/files")
def list_files():
    files = sorted(p.name for p in (DATA_DIR / "raw").glob("*") if p.is_file())
    return {"count": len(files), "files": files}

@app.get("/files/{name}")
def get_file(name: str):
    if ".." in name or name.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = DATA_DIR / "raw" / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)

@app.get("/completed")
def complete():
    records = []
    meta_dir = DATA_DIR / "meta"

    for p in sorted(meta_dir.glob("*.json")):
        try:
            records.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return {"count": len(records), "completed": records}

@app.post("/maze/generate")
async def generate_maze(payload: dict):
    # For now this is a fake street-like route inside Downtown McKinney.
    # Later this endpoint will use OpenStreetMap to generate the route.

    return {
        "status": "ok",
        "source": "fake-hardcoded-v1",
        "path": [
            {"latitude": 33.19702, "longitude": -96.61435},
            {"latitude": 33.19702, "longitude": -96.61535},
            {"latitude": 33.19648, "longitude": -96.61535},
            {"latitude": 33.19648, "longitude": -96.61615},
            {"latitude": 33.19705, "longitude": -96.61615},
            {"latitude": 33.19705, "longitude": -96.61735}
        ]
    }
@app.get("/maze/test-osm")
def test_osm():
    query = """
    [out:json][timeout:25];
    way["highway"](33.196,-96.618,33.198,-96.614);
    out geom;
    """

    try:
        r = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query.encode("utf-8"),
            headers={
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json",
                "User-Agent": "HomageMazePrototype/0.1",
            },
            timeout=30,
        )

        try:
            data = r.json()
        except Exception:
            data = {"elements": []}

        return {
            "status_code": r.status_code,
            "content_type": r.headers.get("content-type"),
            "text_preview": r.text[:500],
            "elements": len(data.get("elements", [])),
        }

    except Exception as e:
        return {"error": str(e)}
