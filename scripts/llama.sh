#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "Virtualenv not found. Run: npm run setup" >&2
  exit 1
fi

exec .venv/bin/python scripts/llama_launch.py "$@"
