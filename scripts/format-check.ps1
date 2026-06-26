$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\ruff.exe")) {
    Write-Error "Virtualenv not found. Run: npm run setup"
}

& .\.venv\Scripts\ruff format --check backend
