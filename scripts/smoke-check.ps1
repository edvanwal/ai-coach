param(
  [string]$BaseUrl
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path -Path $PSScriptRoot -ChildPath "..\.env.local"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $val = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

if (-not $BaseUrl) {
  $BaseUrl = $env:SMOKE_BASE_URL
}
if (-not $BaseUrl) {
  $BaseUrl = "http://localhost:3001"
}

$BaseUrl = $BaseUrl.TrimEnd("/")

function Assert-Ok($name, $url, $headers = $null) {
  try {
    $res = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -UseBasicParsing -TimeoutSec 25
    if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300) {
      Write-Host "OK: $name" -ForegroundColor Green
      return $true
    }
    Write-Host "FAIL: $name (HTTP $($res.StatusCode))" -ForegroundColor Red
    return $false
  } catch {
    Write-Host "FAIL: $name ($($_.Exception.Message))" -ForegroundColor Red
    return $false
  }
}

$ok = $true
$ok = (Assert-Ok "Homepage" "$BaseUrl/") -and $ok
$ok = (Assert-Ok "Profile API" "$BaseUrl/api/profile") -and $ok
$ok = (Assert-Ok "Tasks API" "$BaseUrl/api/tasks") -and $ok

if ($env:CRON_SECRET) {
  $headers = @{ Authorization = "Bearer $($env:CRON_SECRET)" }
  $ok = (Assert-Ok "Cron check-reminders" "$BaseUrl/api/cron/check-reminders" $headers) -and $ok
} else {
  Write-Host "SKIP: Cron check-reminders (CRON_SECRET ontbreekt)" -ForegroundColor Yellow
}

if (-not $ok) { exit 1 }
Write-Host "Smoke-check OK ($BaseUrl)" -ForegroundColor Cyan

