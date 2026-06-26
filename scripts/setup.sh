#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Prompt Studio setup"
echo "    cwd: $ROOT"

if [[ ! -d .venv ]]; then
  echo "==> Creating Python venv..."
  python3 -m venv .venv
fi

echo "==> Installing Python dependencies..."
.venv/bin/pip install -r backend/requirements.txt

echo "==> Installing Frontend dependencies..."
npm install --prefix frontend

if [[ ! -f config/llm.yaml ]]; then
  cp config/llm.yaml.example config/llm.yaml
  echo "==> Created config/llm.yaml from example"
fi

echo ""
echo "Setup complete."
echo "  npm run dev     - start Backend + Frontend"
echo "  npm run test    - run tests"
