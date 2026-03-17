# Toont de WhatsApp webhook-URL voor copy-paste naar Meta.
# Leest de productie-URL uit docs/DEPLOYMENT.md (tabel Project-identifiers).

$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$root = Split-Path -Parent $scriptDir
$dep = Join-Path $root "docs\DEPLOYMENT.md"
if (-not (Test-Path -LiteralPath $dep)) {
    Write-Host "docs/DEPLOYMENT.md niet gevonden. Gebruik handmatig: https://<jouw-productie-domein>/api/mobile/whatsapp/webhook"
    exit 1
}
$content = Get-Content $dep -Raw
if ($content -match '\|\s*Productie-URL\s*\|\s*`?(https://[^`\s|]+)') {
    $base = $Matches[1].TrimEnd('`')
    $url = $base.TrimEnd('/') + "/api/mobile/whatsapp/webhook"
    Write-Host ""
    Write-Host "WhatsApp webhook-URL (plak bij Meta -> WhatsApp -> Configuration -> Webhook):"
    Write-Host ""
    Write-Host $url
    Write-Host ""
    Write-Host "Als je een vaste domeinnaam hebt (bijv. ai-coach.vercel.app), gebruik die voor een stabiele webhook."
} else {
    Write-Host "Productie-URL niet gevonden in docs/DEPLOYMENT.md. Vul handmatig in: https://<domein>/api/mobile/whatsapp/webhook"
}
