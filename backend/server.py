# server.py — Homage backend (FastAPI)
import io, os, uuid, json, hashlib, datetime as dt
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from dotenv import load_dotenv

# ---------- Config & storage ----------
load_dotenv()
DATA_DIR = Path(os.getenv("DATA_DIR", "qr_vision_data")).resolve()
(DATA_DIR / "raw").mkdir(parents=True, exist_ok=True)

# ---------- App ----------
app = FastAPI(title="Homage QR Data Collector API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later for prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve files (images & thumbs) under /files
app.mount("/files", StaticFiles(directory=str(DATA_DIR), html=False), name="files")

def safe_slug(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in (s or "").strip().lower())

SCHEMA = {
  "required_form_fields": [
    "photo", "gps_lat", "gps_lon", "captured_utc"
  ],
  "optional_form_fields": [
    "session_id", "annotator", "captured_local",
    "gps_alt_m", "gps_h_acc_m", "gps_v_acc_m",
    "heading_deg", "pitch_deg", "roll_deg",
    "device_model", "device_os", "focal_mm", "exposure_iso", "exposure_time_s",
    "labels_scene", "labels_object", "labels_conditions", "labels_puzzle",
    "qr_present", "qr_decoded_text", "ocr_text_top3", "notes"
  ],
  "notes": "Repeat list fields multiple times to send many values. All images are normalized to JPEG."
}

# ---------- Health & misc ----------
@app.get("/health")
def health():
    return {"ok": True, "data_dir": str(DATA_DIR)}

@app.get("/metadata-schema")
def metadata_schema():
    return SCHEMA

@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)  # no content; silence browser 404

# ---------- Recent feed ----------
@app.get("/recent")
def recent(limit: int = 20):
    """
    Return the most recent uploads with thumbnail/full URLs.
    Paths are relative to /files mount; clients should prefix with server origin.
    """
    items = []
    raw_dir = DATA_DIR / "raw"
    if not raw_dir.exists():
        return {"items": []}

    for sess in raw_dir.glob("*"):
        if not sess.is_dir():
            continue
        for meta in sess.glob("*.json"):
            try:
                data = json.loads(meta.read_text("utf-8"))
                thumb = (data.get("thumbnails") or {}).get("512px", "")
                image = data.get("image_filename", "")
                items.append({
                    "session": sess.name,
                    "meta": meta.name,
                    "image": image,
                    "thumb": thumb,
                    "labels": data.get("labels", {}),
                    "captured_utc": data.get("captured_utc"),
                    "gps": data.get("gps", {}),
                    "url_thumb": f"/files/raw/{sess.name}/{thumb}" if thumb else None,
                    "url_full": f"/files/raw/{sess.name}/{image}" if image else None,
                })
            except Exception:
                # Skip bad JSON lines/files gracefully
                pass

    # Newest first — filenames start with UTC timestamps (YYYYMMDDTHHMMSSZ)
    items.sort(key=lambda x: x.get("image") or "", reverse=True)
    return {"items": items[: max(1, min(100, limit))]}

# ---------- Upload ----------
@app.post("/upload")
async def upload(
    photo: UploadFile = File(...),
    captured_utc: str = Form(...),
    captured_local: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    annotator: Optional[str] = Form(None),
    gps_lat: float = Form(...),
    gps_lon: float = Form(...),
    gps_alt_m: Optional[float] = Form(None),
    gps_h_acc_m: Optional[float] = Form(None),
    gps_v_acc_m: Optional[float] = Form(None),
    heading_deg: Optional[float] = Form(None),
    pitch_deg: Optional[float] = Form(None),
    roll_deg: Optional[float] = Form(None),
    device_model: Optional[str] = Form(None),
    device_os: Optional[str] = Form(None),
    focal_mm: Optional[float] = Form(None),
    exposure_iso: Optional[int] = Form(None),
    exposure_time_s: Optional[float] = Form(None),
    labels_scene: List[str] = Form([]),
    labels_object: List[str] = Form([]),
    labels_conditions: List[str] = Form([]),
    labels_puzzle: List[str] = Form([]),
    qr_present: bool = Form(False),
    qr_decoded_text: Optional[str] = Form(None),
    ocr_text_top3: List[str] = Form([]),
    notes: Optional[str] = Form(None),
):
    # Validate and read image
    content = await photo.read()
    if not content:
        raise HTTPException(400, "Empty upload")
    try:
        tmp = Image.open(io.BytesIO(content))
        tmp.verify()
    except Exception:
        raise HTTPException(400, "Invalid image")

    img = Image.open(io.BytesIO(content)).convert("RGB")

    # Session directory
    sess = safe_slug(session_id) or dt.datetime.utcnow().strftime("%Y-%m-%d_session")
    out_dir = DATA_DIR / "raw" / sess
    out_dir.mkdir(parents=True, exist_ok=True)

    # Filenames
    uid = uuid.uuid4().hex[:8]
    stem = f"{dt.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}_{uid}"
    img_name = f"{stem}.jpg"
    meta_name = f"{stem}.json"
    thumb_name = f"{stem}_512.jpg"

    # Save full-res
    img.save(out_dir / img_name, "JPEG", quality=90, optimize=True)

    # Thumbnail
    thumb = img.copy()
    thumb.thumbnail((512, 512))
    thumb.save(out_dir / thumb_name, "JPEG", quality=85, optimize=True)

    # Checksums
    md5 = hashlib.md5(content).hexdigest()

    # Metadata
    meta: Dict[str, Any] = {
        "image_filename": img_name,
        "session_id": session_id,
        "annotator": annotator,
        "captured_local": captured_local,
        "captured_utc": captured_utc,
        "gps": {
            "lat": gps_lat, "lon": gps_lon,
            "alt_m": gps_alt_m, "h_acc_m": gps_h_acc_m, "v_acc_m": gps_v_acc_m
        },
        "orientation": {"heading_deg": heading_deg, "pitch_deg": pitch_deg, "roll_deg": roll_deg},
        "device": {
            "model": device_model, "os": device_os,
            "focal_mm": focal_mm, "exposure_iso": exposure_iso, "exposure_time_s": exposure_time_s
        },
        "labels": {
            "qr_present": qr_present,
            "qr_decoded_text": qr_decoded_text,
            "scene": [safe_slug(x) for x in labels_scene],
            "object": [safe_slug(x) for x in labels_object],
            "conditions": [safe_slug(x) for x in labels_conditions],
            "puzzle": [safe_slug(x) for x in labels_puzzle]
        },
        "ocr_text_top3": [x for x in ocr_text_top3 if x],
        "notes": notes,
        "thumbnails": {"512px": thumb_name},
        "checksums": {"md5": md5}
    }

    (out_dir / meta_name).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "ok": True,
        "image": img_name,
        "meta": meta_name,
        "session_dir": str(out_dir.relative_to(DATA_DIR)),
        "url_full": f"/files/raw/{sess}/{img_name}",
        "url_thumb": f"/files/raw/{sess}/{thumb_name}",
    }

