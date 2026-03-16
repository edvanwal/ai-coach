param(
  [string]$Project = "ai-coach",
  [string]$TeamSlug = "edwins-projects-e31e97b7",
  [string]$Fix = "auto" # auto | prisma-buildcommand | node-version-22
)

$ErrorActionPreference = "Stop"

function Require($name, $value) {
  if (-not $value -or [string]::IsNullOrWhiteSpace($value)) {
    Write-Host "Ontbreekt: $name" -ForegroundColor Red
    exit 1
  }
}

Require "VERCEL_TOKEN (env)" $env:VERCEL_TOKEN

function ApiGetJson($url) {
  $raw = curl.exe -sS -H "Authorization: Bearer $env:VERCEL_TOKEN" "$url"
  return ($raw | ConvertFrom-Json)
}

function ApiPatchJson($url, $obj) {
  $tmp = New-TemporaryFile
  try {
    ($obj | ConvertTo-Json -Depth 10) | Set-Content -Path $tmp.FullName -Encoding utf8
    $raw = curl.exe -sS -X PATCH -H "Authorization: Bearer $env:VERCEL_TOKEN" -H "Content-Type: application/json" --data-binary "@$($tmp.FullName)" "$url"
    return ($raw | ConvertFrom-Json)
  } finally {
    Remove-Item -Force $tmp.FullName -ErrorAction SilentlyContinue
  }
}

Write-Host "Vercel autofix voor project: $Project (team: $TeamSlug), fix: $Fix" -ForegroundColor Cyan

$teams = ApiGetJson "https://api.vercel.com/v2/teams"
$team = $teams.teams | Where-Object { $_.slug -eq $TeamSlug } | Select-Object -First 1
if (-not $team) { Write-Host "Team niet gevonden: $TeamSlug" -ForegroundColor Red; exit 1 }
$teamId = $team.id

$projectUrl = "https://api.vercel.com/v9/projects/$Project?teamId=$teamId"
$proj = ApiGetJson $projectUrl

function Fix-PrismaBuildCommand() {
  $desired = "npx prisma generate && npm run build"
  if ($proj.buildCommand -eq $desired) {
    Write-Host "OK: buildCommand staat al goed." -ForegroundColor Green
    return
  }
  $patched = ApiPatchJson $projectUrl @{ buildCommand = $desired }
  if ($patched.buildCommand -eq $desired) {
    Write-Host "OK: buildCommand aangepast naar Prisma-generate + build." -ForegroundColor Green
  } else {
    Write-Host "Waarschuwing: buildCommand patch niet bevestigd." -ForegroundColor Yellow
  }
}

function Fix-Node22() {
  $desired = "22.x"
  if ($proj.nodeVersion -eq $desired) {
    Write-Host "OK: nodeVersion staat al op $desired." -ForegroundColor Green
    return
  }
  $patched = ApiPatchJson $projectUrl @{ nodeVersion = $desired }
  if ($patched.nodeVersion -eq $desired) {
    Write-Host "OK: nodeVersion aangepast naar $desired." -ForegroundColor Green
  } else {
    Write-Host "Waarschuwing: nodeVersion patch niet bevestigd." -ForegroundColor Yellow
  }
}

if ($Fix -eq "prisma-buildcommand") {
  Fix-PrismaBuildCommand
  exit 0
}
if ($Fix -eq "node-version-22") {
  Fix-Node22
  exit 0
}

# Auto: alleen veilige, bekende fixes
Fix-PrismaBuildCommand

