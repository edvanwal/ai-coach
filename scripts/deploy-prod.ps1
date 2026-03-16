param(
  [string]$Env = "production"
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== AI Coach deploy ($Env) ==" -ForegroundColor Cyan

& "$PSScriptRoot\preflight-deploy.ps1" -Env $Env
if ($LASTEXITCODE -ne 0) {
  Write-Error "Deploy afgebroken door mislukte preflight."
  exit 1
}

Write-Host "Stap 1/3: build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Error "Build mislukt."
  exit $LASTEXITCODE
}

Write-Host "Stap 2/3: Prisma migraties naar Neon..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Prisma migrate deploy gaf een fout. Controleer de database in Neon."
}

Write-Host "Stap 3/3: gereed. Push naar GitHub triggert Vercel automatisch." -ForegroundColor Cyan

if ($env:SMOKE_BASE_URL) {
  Write-Host "Extra: smoke-check ($env:SMOKE_BASE_URL)..." -ForegroundColor Cyan
  & "$PSScriptRoot\smoke-check.ps1" -BaseUrl $env:SMOKE_BASE_URL
}

try {
  & "$PSScriptRoot\notify-done.ps1" "AI coach: deploy script klaar"
} catch {
  Write-Warning "Pushover-notificatie versturen mislukt: $_"
}

