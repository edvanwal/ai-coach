# Roept de check-reminders API aan. Plan dit elke minuut via Windows Taakplanner.
# Voorbeeld: .\check-reminders.ps1
# Of: .\check-reminders.ps1 -BaseUrl "https://jouw-app.vercel.app"

param(
  [string]$BaseUrl = "http://localhost:3001"
)

$envFile = Join-Path -Path $PSScriptRoot -ChildPath "..\.env.local"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $val = $matches[2].Trim()
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

$url = "$BaseUrl/api/cron/check-reminders"
$headers = @{}
if ($env:CRON_SECRET) {
  $headers["Authorization"] = "Bearer $env:CRON_SECRET"
}

try {
  $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -ErrorAction Stop
  if ($response.sent -gt 0) {
    Write-Output "Reminders verstuurd: $($response.sent)"
  }
} catch {
  Write-Warning "Check-reminders mislukt: $_"
  exit 1
}
