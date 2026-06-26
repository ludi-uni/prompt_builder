$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\pytest.exe")) {
    Write-Error "Virtualenv not found. Run: npm run setup"
}

& .\.venv\Scripts\pytest backend\tests -v @args
