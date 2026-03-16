param(
  [string]$Env = "local" # local of production
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$requiredVars = @(
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "PUSHOVER_TOKEN",
  "PUSHOVER_USER",
  "CRON_SECRET"
)

$loadedFrom = @()
foreach ($fileName in @(".env.local", ".env")) {
  $envPath = Join-Path $root $fileName
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($key, $val, "Process")
      }
    }
    $loadedFrom += $fileName
  }
}

if ($loadedFrom.Count -eq 0) {
  Write-Warning "Geen .env(.local) gevonden in $root"
}

$missing = @()
foreach ($k in $requiredVars) {
  if (-not $env:$k -or [string]::IsNullOrWhiteSpace($env:$k)) {
    $missing += $k
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Preflight FAILED. Ontbrekende env-variabelen:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host "Preflight OK. Env geladen uit: $($loadedFrom -join ', ')" -ForegroundColor Green
Write-Host "Doelomgeving: $Env"

