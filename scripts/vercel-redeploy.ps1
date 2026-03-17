param(
  [string]$ProjectName = "ai-coach",
  [string]$TeamSlug = "edwins-projects-e31e97b7",
  [string]$Target = "production"
)

$ErrorActionPreference = "Stop"

function Require($name, $value) {
  if (-not $value -or [string]::IsNullOrWhiteSpace($value)) {
    Write-Host "Ontbreekt: $name" -ForegroundColor Red
    exit 1
  }
}

if (-not $env:VERCEL_TOKEN -or [string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  $envPath = Join-Path $PSScriptRoot "..\.env.local"
  if (Test-Path $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match '^VERCEL_TOKEN=' } | Select-Object -First 1
    if ($line) {
      $parts = $line.Split("=", 2)
      if ($parts.Count -eq 2) {
        $env:VERCEL_TOKEN = $parts[1].Trim().Trim('"')
      }
    }
  }
}

Require "VERCEL_TOKEN (env)" $env:VERCEL_TOKEN

$headers = @{
  Authorization = "Bearer $env:VERCEL_TOKEN"
  "Content-Type" = "application/json"
}

$teams = Invoke-RestMethod -Uri "https://api.vercel.com/v2/teams" -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN" }
$team = $teams.teams | Where-Object { $_.slug -eq $TeamSlug } | Select-Object -First 1
if (-not $team) {
  Write-Host "Team niet gevonden: $TeamSlug" -ForegroundColor Red
  exit 1
}
$teamId = $team.id

$projectList = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?teamId=$teamId&limit=100" -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN" }
$project = $projectList.projects | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1
if (-not $project -or -not $project.id) {
  Write-Host "Project niet gevonden: $ProjectName" -ForegroundColor Red
  exit 1
}

$deps = Invoke-RestMethod -Uri "https://api.vercel.com/v6/deployments?projectId=$($project.id)&target=$Target&limit=1&teamId=$teamId" -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN" }
$latest = $deps.deployments | Select-Object -First 1
if (-not $latest -or -not $latest.uid) {
  Write-Host "Geen bestaande deployment gevonden om te redeployen." -ForegroundColor Red
  exit 1
}

$body = @{
  name = $ProjectName
  deploymentId = $latest.uid
  target = $Target
} | ConvertTo-Json -Compress

$newDeployment = Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v13/deployments?teamId=$teamId" -Headers $headers -Body $body
Write-Host "Redeploy gestart: $($newDeployment.id)" -ForegroundColor Green
Write-Host "Nieuwe URL: https://$($newDeployment.url)" -ForegroundColor Cyan
