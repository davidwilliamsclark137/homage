# Render Backend Deployment

This is the stable backend target for two-phone Homage testing.

## Why

The ngrok backend tunnel changes every restart. That makes two-phone testing fragile because Phone A and Phone B can accidentally use different backend URLs or stale Expo bundles.

Render gives the backend a stable public URL:

```text
https://homage-backend.onrender.com
```

## Render Blueprint

The repo includes `render.yaml`.

It configures:

- Python web service named `homage-backend`
- build command: `pip install -r backend/requirements.txt`
- start command: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
- health check: `/healthz`
- persistent data disk mounted at `/data`
- `DATA_DIR=/data`

## App Configuration

The Expo app defaults to the hosted backend:

```text
https://homage-backend.onrender.com
```

For local remote testing, `npm run dev:remote` still injects a temporary ngrok API URL as `API_BASE`.

For stable two-phone testing, prefer the Render backend:

```bash
cd /Users/davidwilliamclark/projects/homage/app
API_BASE=https://homage-backend.onrender.com npx expo start --tunnel -c
```

## Validation

After Render deploys, check:

```text
https://homage-backend.onrender.com/healthz
https://homage-backend.onrender.com/debug/routes
https://homage-backend.onrender.com/local/database
```

The app should show the same API URL at the top of both phones.

## Current Privacy Boundary

The backend stores:

- GPS coordinates
- public metadata
- nonce
- algorithm
- ciphertext

The backend should not store:

- plaintext document body
- unlock phrase
- encryption key

Phone A encrypts locally. Phone B decrypts locally.
