#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/ruff ]]; then
  echo "Virtualenv not found. Run: npm run setup" >&2
  exit 1
fi

.venv/bin/ruff check --fix backend
exec .venv/bin/ruff format backend
