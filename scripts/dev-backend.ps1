$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\uvicorn.exe")) {
    Write-Error "Virtualenv not found. Run: npm run setup"
}

$port = if ($env:PROMPT_STUDIO_API_PORT) { $env:PROMPT_STUDIO_API_PORT } else { "61000" }

Write-Host "Backend: http://127.0.0.1:$port/docs" -ForegroundColor Cyan
& .\.venv\Scripts\uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port $port
exit $LASTEXITCODE
