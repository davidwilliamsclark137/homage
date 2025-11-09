# backend/server.py
from __future__ import annotations

import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI

# -----------------------------
# Storage directory resolution
# -----------------------------
def resolve_data_dir() -> Path:
    """
    Determine a writable base directory for app data.

    Priority:
      1) DATA_DIR env var (recommended: /data when using a Render Disk)
      2) /var/data
      3) /tmp/data
      4) <repo>/backend/data
      5) /tmp  (last resort; no subdirs auto-created here)
    """
    env = os.getenv("DATA_DIR")
    candidates: list[Path] = []

    if env:
        candidates.append(Path(env))

    # Common writable places
    candidates.extend([
        Path("/var/data"),
        Path("/tmp/data"),
        Path(__file__).resolve().parent / "data",
    ])

    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            t = c / ".write_test"
            t.write_text("ok", encoding="utf-8")
            t.unlink(missing_ok=True)
            return c
        except Exception:
            continue

    # Fallback
    return Path("/tmp")


DATA_DIR: Path = resolve_data_dir()
SUBDIRS = ["raw", "processed", "thumbs"]  # adjust to your project

# -----------------------------
# FastAPI app with lifespan
# -----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create subdirectories at startup (NOT at import time)
    for sub in SUBDIRS:
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)
    yield

app = FastAPI(title="QR Backend", lifespan=lifespan)


# -----------------------------
# Health check
# -----------------------------
@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        "data_dir": str(DATA_DIR),
        "subdirs": [str(DATA_DIR / s) for s in SUBDIRS],
    }


# =========================================================
# ⬇️  YOUR EXISTING ROUTES GO BELOW (unchanged in behavior)
#     Example:
#
# from fastapi import UploadFile, File
# @app.post("/upload")
# async def upload(file: UploadFile = File(...)):
#     dest = (DATA_DIR / "raw" / file.filename)
#     with dest.open("wb") as f:
#         f.write(await file.read())
#     return {"saved": str(dest)}
#
# Keep using DATA_DIR like: DATA_DIR / "raw" / "filename.ext"
# =========================================================

