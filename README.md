# Homage

Fast demo: mobile capture app (Expo) + hosted backend (FastAPI).

## Backend (Render)
- Code: `backend/`
- Requirements: `backend/requirements.txt`
- Entry: `backend.server:app`
- Persistent uploads folder: `DATA_DIR` (Render: `/data`)
- Blueprint: `render.yaml`

## Mobile App
- Code: `app/`
- Uses Expo Router
- Config: `app/app.config.js` (API_BASE defaults to hosted backend)

## Dev (local)
### Backend
```bash
cd /Users/davidwilliamclark/projects/homage
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
```

### Phone remote dev
```bash
cd /Users/davidwilliamclark/projects/homage/app
npm run dev:remote
```

### Stable two-phone testing
Use the Render backend instead of the local ngrok backend:

```bash
cd /Users/davidwilliamclark/projects/homage/app
API_BASE=https://homage-backend.onrender.com npx expo start --tunnel -c
```
