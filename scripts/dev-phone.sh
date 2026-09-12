#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"
BACKEND_PORT="${HOMAGE_BACKEND_PORT:-8000}"
EXPO_PORT="${HOMAGE_EXPO_PORT:-8081}"
NGROK_API="http://127.0.0.1:4040/api/tunnels"
NODE_BIN="${HOMAGE_NODE_BIN:-}"
LOG_DIR="$ROOT_DIR/tmp/dev"
MODE="${HOMAGE_MODE:-lan}"
EXPO_TUNNEL_ATTEMPTS="${HOMAGE_EXPO_TUNNEL_ATTEMPTS:-3}"
NGROK_BIN="${HOMAGE_NGROK_BIN:-}"
RENDER_API_BASE="${HOMAGE_RENDER_API_BASE:-https://homage-backend.onrender.com}"
BUILD_LABEL="${HOMAGE_BUILD_LABEL:-phone-dev}"

mkdir -p "$LOG_DIR"

info() {
  printf '\n%s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

detect_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null \
      || ipconfig getifaddr en1 2>/dev/null \
      || true
  elif command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  elif command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}'
  fi
}

port_pids() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

stop_port() {
  local port="$1"
  local pids
  pids="$(port_pids "$port")"
  if [[ -n "$pids" ]]; then
    info "Stopping existing process on port $port: $pids"
    kill $pids 2>/dev/null || true
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  printf '%s did not become ready: %s\n' "$label" "$url" >&2
  return 1
}

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${NGROK_PID:-}" ]]; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

require_command curl
require_command lsof

if [[ -n "$NODE_BIN" && -d "$NODE_BIN" ]]; then
  export PATH="$NODE_BIN:$PATH"
fi
require_command npx

if [[ "$MODE" == "remote" ]]; then
  MODE="render"
fi

if [[ "$MODE" != "lan" && "$MODE" != "tunnel" && "$MODE" != "render" ]]; then
  printf 'Unsupported HOMAGE_MODE: %s\nUse HOMAGE_MODE=lan, HOMAGE_MODE=tunnel, or HOMAGE_MODE=remote.\n' "$MODE" >&2
  exit 1
fi

if [[ "$MODE" == "tunnel" ]]; then
  require_command python3
  if [[ -z "$NGROK_BIN" ]]; then
    NGROK_BIN="$(command -v ngrok || true)"
  fi
  if [[ ! -x "$NGROK_BIN" ]]; then
    printf 'Missing executable ngrok CLI: %s\n' "$NGROK_BIN" >&2
    printf 'Set HOMAGE_NGROK_BIN=/path/to/ngrok if your ngrok binary lives elsewhere.\n' >&2
    exit 1
  fi
fi

info "Homage phone dev launch"
info "Project: $ROOT_DIR"
info "Mode: $MODE"

if [[ "${HOMAGE_CLEAN_PORTS:-1}" == "1" ]]; then
  stop_port "$BACKEND_PORT"
  stop_port "$EXPO_PORT"
  if [[ "$MODE" == "tunnel" ]]; then
    stop_port 4040
  fi
fi

if [[ "$MODE" == "render" ]]; then
  API_BASE="$RENDER_API_BASE"
  EXPO_ARGS=(start --tunnel -c --port "$EXPO_PORT")
  info "Using Render backend"
  wait_for_url "$API_BASE/healthz" "Render backend"
elif [[ "$MODE" == "tunnel" ]]; then
  info "Starting FastAPI backend on port $BACKEND_PORT"
  (
    cd "$ROOT_DIR"
    python3 -m uvicorn backend.server:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) >"$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID="$!"

  wait_for_url "http://127.0.0.1:$BACKEND_PORT/healthz" "Backend"
  info "Starting ngrok backend tunnel"
  "$NGROK_BIN" http "$BACKEND_PORT" --log=stdout >"$LOG_DIR/ngrok.log" 2>&1 &
  NGROK_PID="$!"

  wait_for_url "$NGROK_API" "ngrok"

  API_BASE="$(
    python3 - <<'PY'
import json
import time
import urllib.request

for _ in range(30):
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=5) as response:
        data = json.load(response)

    for tunnel in data.get("tunnels", []):
        public_url = tunnel.get("public_url", "")
        if public_url.startswith("https://"):
            print(public_url)
            raise SystemExit(0)
    time.sleep(1)

raise SystemExit("No HTTPS ngrok tunnel found")
PY
  )"
  EXPO_ARGS=(start --tunnel -c --port "$EXPO_PORT")
else
  require_command python3
  info "Starting FastAPI backend on port $BACKEND_PORT"
  (
    cd "$ROOT_DIR"
    python3 -m uvicorn backend.server:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) >"$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID="$!"

  wait_for_url "http://127.0.0.1:$BACKEND_PORT/healthz" "Backend"
  LAN_IP="$(detect_lan_ip)"
  LAN_IP="${LAN_IP:-127.0.0.1}"
  API_BASE="http://$LAN_IP:$BACKEND_PORT"
  EXPO_ARGS=(start --lan -c --port "$EXPO_PORT")
fi

info "Backend API_BASE: $API_BASE"
info "Build label: $BUILD_LABEL"
info "Starting Expo"
if [[ "$MODE" == "render" ]]; then
  info "Remote mode: Render backend + Expo tunnel. Open the exp.direct URL printed below in Expo Go."
elif [[ "$MODE" == "tunnel" ]]; then
  info "Tunnel mode: local backend through ngrok. Use only when explicitly testing local backend changes."
else
  info "LAN mode: open the Expo Go URL printed below. Phone and Mac must be on the same Wi-Fi."
fi

cd "$APP_DIR"
if [[ "$MODE" == "render" || "$MODE" == "tunnel" ]]; then
  for ((attempt = 1; attempt <= EXPO_TUNNEL_ATTEMPTS; attempt++)); do
    info "Expo tunnel attempt $attempt of $EXPO_TUNNEL_ATTEMPTS"
    if API_BASE="$API_BASE" HOMAGE_BUILD_LABEL="$BUILD_LABEL" npx expo "${EXPO_ARGS[@]}"; then
      exit 0
    fi
    if [[ "$attempt" -lt "$EXPO_TUNNEL_ATTEMPTS" ]]; then
      info "Expo tunnel exited early; retrying in 3 seconds."
      sleep 3
    fi
  done
  exit 1
fi

API_BASE="$API_BASE" HOMAGE_BUILD_LABEL="$BUILD_LABEL" npx expo "${EXPO_ARGS[@]}"
