#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Virtualenv not found. Run: npm run setup" >&2
  exit 1
fi

PORT="${PROMPT_STUDIO_API_PORT:-61000}"
echo "Backend: http://127.0.0.1:${PORT}/docs"
exec .venv/bin/uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port "$PORT"
