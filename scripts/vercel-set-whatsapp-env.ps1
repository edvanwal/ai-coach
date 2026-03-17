# Synct de WhatsApp env-variabelen uit .env.local naar Vercel.
# Voer uit na het invullen van de vier Meta-tokens in .env.local.
# Leest VERCEL_TOKEN uit .env.local indien niet in env gezet.

param(
  [string]$Project = "ai-coach",
  [string]$TeamSlug = "edwins-projects-e31e97b7"
)

$ErrorActionPreference = "Stop"

function Require($name, $value) {
  if (-not $value -or [string]::IsNullOrWhiteSpace($value)) {
    Write-Host "Ontbreekt: $name" -ForegroundColor Red
    exit 1
  }
}

function LoadEnvLocal {
  $root = Split-Path -Parent $PSScriptRoot
  $path = Join-Path $root ".env.local"
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host ".env.local niet gevonden." -ForegroundColor Red
    exit 1
  }
  $vars = @{}
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $key = $matches[1]
      $val = $matches[2].Trim().Trim('"')
      $vars[$key] = $val
    }
  }
  return $vars
}

if (-not $env:VERCEL_TOKEN -or [string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  $root = Split-Path -Parent $PSScriptRoot
  $envPath = Join-Path $root ".env.local"
  if (Test-Path -LiteralPath $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match '^VERCEL_TOKEN=' } | Select-Object -First 1
    if ($line) {
      $parts = $line.Split("=", 2)
      if ($parts.Count -eq 2) {
        $env:VERCEL_TOKEN = $parts[1].Trim().Trim('"')
      }
    }
  }
}

Require "VERCEL_TOKEN" $env:VERCEL_TOKEN

$envVars = LoadEnvLocal
$whatsappKeys = @("WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID")
$toAdd = @()
foreach ($key in $whatsappKeys) {
  $val = $envVars[$key]
  if ($val) {
    # Vercel staat voor sensitive vars geen target=development toe.
    $toAdd += @{ key = $key; value = $val; type = "sensitive"; target = @("production", "preview") }
  } else {
    Write-Host "Overgeslagen (leeg): $key" -ForegroundColor Yellow
  }
}

if ($toAdd.Count -eq 0) {
  Write-Host "Geen WhatsApp variabelen met waarden in .env.local. Vul ze eerst in." -ForegroundColor Red
  exit 1
}

function ApiGetJson($url) {
  $raw = curl.exe -sS -H "Authorization: Bearer $env:VERCEL_TOKEN" "$url"
  return ($raw | ConvertFrom-Json)
}

function ApiPostJson($url, $obj) {
  $headers = @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" }
  $body = $obj | ConvertTo-Json -Depth 10 -Compress
  return Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
}

Write-Host "WhatsApp env naar Vercel ($Project, team: $TeamSlug)..." -ForegroundColor Cyan

$teams = ApiGetJson "https://api.vercel.com/v2/teams"
$team = $teams.teams | Where-Object { $_.slug -eq $TeamSlug } | Select-Object -First 1
if (-not $team) { Write-Host "Team niet gevonden: $TeamSlug" -ForegroundColor Red; exit 1 }
$teamId = $team.id

$baseUrl = "https://api.vercel.com/v10/projects/$Project/env"
$query = "?teamId=$teamId&upsert=true"

foreach ($item in $toAdd) {
  $res = ApiPostJson "$baseUrl$query" $item
  if ($res.error) {
    $message = $res.error.message
    throw "Vercel API fout voor $($item.key): $message"
  }
  Write-Host "OK: $($item.key) ingesteld" -ForegroundColor Green
}

Write-Host ""
Write-Host "Klaar. Redeploy de app om de nieuwe env te laden (push naar main of handmatig via Vercel Dashboard)." -ForegroundColor Cyan
