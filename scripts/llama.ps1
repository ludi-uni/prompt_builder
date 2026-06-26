$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Virtualenv not found. Run: npm run setup"
}

& .\.venv\Scripts\python scripts\llama_launch.py @args
