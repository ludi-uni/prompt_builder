$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Prompt Studio setup" -ForegroundColor Cyan
Write-Host "    cwd: $Root"

if (-not (Test-Path ".venv")) {
    Write-Host "==> Creating Python venv..." -ForegroundColor Yellow
    python -m venv .venv
}

Write-Host "==> Installing Python dependencies..." -ForegroundColor Yellow
& .\.venv\Scripts\python -m pip install -r backend\requirements.txt

Write-Host "==> Installing Frontend dependencies..." -ForegroundColor Yellow
npm install --prefix frontend

if (-not (Test-Path "config\llm.yaml")) {
    Copy-Item "config\llm.yaml.example" "config\llm.yaml"
    Write-Host "==> Created config\llm.yaml from example" -ForegroundColor Green
}

if (-not (Test-Path "config\llama.yaml")) {
    Copy-Item "config\llama.yaml.example" "config\llama.yaml"
    Write-Host "==> Created config\llama.yaml from example" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "  npm run dev     - start Backend + Frontend"
Write-Host "  npm run test    - run tests"
