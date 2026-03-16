# Registreert een Windows-taak die elke minuut de reminder-check uitvoert.
# Voer uit vanaf de projectroot: .\scripts\setup-reminder-cron.ps1

$taskName = "AI Coach - Check Reminders"
$scriptPath = Join-Path $PSScriptRoot "check-reminders.ps1"
$projectRoot = Join-Path $PSScriptRoot ".."

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings
Write-Output "Taak '$taskName' geregistreerd. Roept elke minuut check-reminders aan."
