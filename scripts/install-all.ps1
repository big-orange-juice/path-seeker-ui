$ErrorActionPreference = "Stop"

Write-Host "[install-all] Checking pnpm..."
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is not installed. Install pnpm first, then rerun this script."
}

Write-Host "[install-all] Installing workspace dependencies from repo root..."
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
pnpm install

Write-Host "[install-all] Done."