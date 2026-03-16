param(
  [string]$Project = "ai-coach",
  [string]$TeamSlug = "edwins-projects-e31e97b7",
  [int]$EventsLimit = 200
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
  if (-not $raw) { return $null }
  return ($raw | ConvertFrom-Json)
}

function ApiGetText($url) {
  return (curl.exe -sS -H "Authorization: Bearer $env:VERCEL_TOKEN" "$url")
}

Write-Host "Vercel debug voor project: $Project (team: $TeamSlug)" -ForegroundColor Cyan

# 1) TeamId ophalen
$teams = ApiGetJson "https://api.vercel.com/v2/teams"
$team = $teams.teams | Where-Object { $_.slug -eq $TeamSlug } | Select-Object -First 1
if (-not $team) {
  Write-Host "Team niet gevonden: $TeamSlug" -ForegroundColor Red
  exit 1
}
$teamId = $team.id

# 2) Project ophalen (incl. latest deployment)
$proj = ApiGetJson "https://api.vercel.com/v9/projects/$Project?teamId=$teamId"
if (-not $proj -or -not $proj.id) {
  Write-Host "Project niet gevonden: $Project" -ForegroundColor Red
  exit 1
}

$latest = $null
if ($proj.targets -and $proj.targets.production -and $proj.targets.production.id) {
  $latest = $proj.targets.production
} elseif ($proj.latestDeployments -and $proj.latestDeployments.Count -gt 0) {
  $latest = $proj.latestDeployments[0]
}

if (-not $latest -or -not $latest.id) {
  Write-Host "Geen deployments gevonden voor dit project (nog nooit gebouwd?)" -ForegroundColor Yellow
  exit 2
}

$deploymentId = $latest.id
$state = $latest.readyState
$url = $latest.url

Write-Host "Laatste deployment: $deploymentId ($state) URL: https://$url" -ForegroundColor Cyan

# 3) Events ophalen en top-error vinden
$eventsRaw = ApiGetText "https://api.vercel.com/v2/deployments/$deploymentId/events?limit=$EventsLimit"
$events = $eventsRaw | ConvertFrom-Json

$stderr = $events | Where-Object { $_.type -eq "stderr" } | ForEach-Object { $_.payload.text }
$stdout = $events | Where-Object { $_.type -eq "stdout" } | ForEach-Object { $_.payload.text }

$topError =
  ($stderr | Where-Object { $_ -match "Error:" } | Select-Object -First 1)
if (-not $topError) {
  $topError = ($stderr | Select-Object -First 1)
}

if ($topError) {
  Write-Host "TOP-ERROR: $topError" -ForegroundColor Red
} else {
  Write-Host "Geen stderr gevonden in events." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Tip: bekijk volledige logs met:" -ForegroundColor Gray
Write-Host "https://vercel.com/$TeamSlug/$Project/deployments/$deploymentId" -ForegroundColor Gray

