#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d frontend/node_modules ]]; then
  echo "Frontend dependencies not installed. Run: npm run setup" >&2
  exit 1
fi

PORT="${PROMPT_STUDIO_WEB_PORT:-61010}"
echo "Frontend: http://127.0.0.1:${PORT}"
exec npm run dev --prefix frontend -- --host 127.0.0.1 --port "$PORT" --strictPort
