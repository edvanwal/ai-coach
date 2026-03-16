# Stuur een Pushover-melding naar iPhone zodra een taak klaar is.
# Vereist PUSHOVER_TOKEN en PUSHOVER_USER in .env.local

$envFile = Join-Path -Path $PSScriptRoot -ChildPath "..\\.env.local"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $val = $matches[2].Trim()
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

$token = $env:PUSHOVER_TOKEN
$user = $env:PUSHOVER_USER
$message = if ($args[0]) { $args[0] } else { "AI coach: taak afgerond" }

if (-not $token -or -not $user) {
  Write-Warning "PUSHOVER_TOKEN of PUSHOVER_USER ontbreekt in .env.local"
  exit 1
}

$body = @{
  token = $token
  user = $user
  message = $message
}

Invoke-RestMethod -Uri "https://api.pushover.net/1/messages.json" -Method POST -Body $body | Out-Null
Write-Output "Pushover-melding verstuurd."
