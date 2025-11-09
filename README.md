# Homage

Fast demo: mobile capture app (Expo) + hosted backend (FastAPI).

## Backend (Render)
- Code: `backend/`
- Requirements: `backend/requirements.txt`
- Entry: `server.py`
- Persistent uploads folder: `DATA_DIR` (Render: `/data`)

## Mobile App
- Code: `app/`
- Uses Expo Router
- Config: `app/app.config.js` (API_BASE defaults to hosted backend)

## Dev (local)
### Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
