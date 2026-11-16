$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '=== OFFSET R3 / submission-candidate hardening ===' -ForegroundColor Cyan
$node = node --version
$npm = npm --version
Write-Host "NODE=$node"
Write-Host "NPM=$npm"

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing pinned dependencies...' -ForegroundColor Yellow
  npm install --no-audit --no-fund
}

Write-Host 'Running production build gate...' -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw 'OFFSET_BUILD_GATE=FAIL' }
Write-Host 'OFFSET_BUILD_GATE=PASS' -ForegroundColor Green

Write-Host ''
Write-Host 'Starting OFFSET on http://127.0.0.1:4173' -ForegroundColor Green
Write-Host 'Bundled sparring hero demo: http://127.0.0.1:4173/'
Write-Host 'Optional remote Mux fallback: http://127.0.0.1:4173/?remote=1'
Write-Host 'Use Ctrl+C here when finished.' -ForegroundColor DarkGray

Start-Process 'http://127.0.0.1:4173/'
npm run preview -- --host 127.0.0.1 --port 4173

