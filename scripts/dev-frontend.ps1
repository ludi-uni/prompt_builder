$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path "frontend\node_modules")) {
    Write-Error "Frontend dependencies not installed. Run: npm run setup"
}

$port = if ($env:PROMPT_STUDIO_WEB_PORT) { $env:PROMPT_STUDIO_WEB_PORT } else { "61010" }

Write-Host "Frontend: http://127.0.0.1:$port" -ForegroundColor Cyan
npm run dev --prefix frontend -- --host 127.0.0.1 --port $port --strictPort
exit $LASTEXITCODE
