#Requires -Version 7
<#
.SYNOPSIS
    Task 4 / Step 1: Disable Maintenance Mode
.DESCRIPTION
    Turns off maintenance mode after a successful GO decision.
.EXAMPLE
    ./01-disable-maintenance.ps1
#>

$ErrorActionPreference = 'Stop'

$ApiUrl = if ($env:PROD_API_URL) { $env:PROD_API_URL } else { "https://api.example-tenant.net" }

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Disable Maintenance Mode"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

Write-Host "🔧 Disabling maintenance mode..."
try {
    $body = @{ enabled = $false } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/system/maintenance" `
        -Method Post -Body $body -ContentType "application/json" -SkipHttpErrorCheck -TimeoutSec 10
    $httpCode = $response.StatusCode
} catch {
    $httpCode = 0
}

if ($httpCode -eq 200 -or $httpCode -eq 204) {
    Write-Host "✅ Maintenance mode disabled"
} else {
    Write-Host "⚠️  Response: HTTP $httpCode — verify manually"
}

Write-Host ""
Write-Host "🔍 Verifying system is accessible..."
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    $healthCode = $response.StatusCode
} catch {
    $healthCode = 0
}

if ($healthCode -eq 200) {
    Write-Host "✅ System is accessible (HTTP 200)"
} else {
    Write-Host "⚠️  Health check returned HTTP $healthCode"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Maintenance disabled"
Write-Host "  Next: 02-finalize-release.ps1"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
