#!/usr/bin/env bash
# Start FastAPI worker + Next.js dashboard for Conductor Run / local dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_PORT="${CONDUCTOR_PORT:-3000}"
if [[ -n "${CONDUCTOR_PORT:-}" ]]; then
  WORKER_PORT=$((CONDUCTOR_PORT + 1))
else
  WORKER_PORT="${WORKER_PORT:-4000}"
fi

export WORKER_PORT
export WORKER_URL="http://127.0.0.1:${WORKER_PORT}"

if [[ ! -x "$ROOT/worker/.venv/bin/uvicorn" ]]; then
  echo "Worker venv missing. Run: cd worker && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if [[ ! -d "$ROOT/web/node_modules" ]]; then
  echo "Installing web dependencies..."
  (cd "$ROOT/web" && npm install)
fi

echo "Web:    http://127.0.0.1:${WEB_PORT}"
echo "Worker: http://127.0.0.1:${WORKER_PORT}  (WORKER_URL=${WORKER_URL})"

# Keep both in one process group so Conductor can stop them together.
exec npx --yes concurrently -k --names worker,web --prefix-colors blue,green \
  "cd \"$ROOT/worker\" && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${WORKER_PORT}" \
  "cd \"$ROOT/web\" && npm run dev -- --hostname 127.0.0.1 --port ${WEB_PORT}"
