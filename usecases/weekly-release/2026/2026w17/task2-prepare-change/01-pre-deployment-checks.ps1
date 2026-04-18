#Requires -Version 7
<#
.SYNOPSIS
    Task 2 / Step 1: Pre-Deployment Checks
.DESCRIPTION
    Verifies staging is still healthy and enables maintenance mode.
.EXAMPLE
    ./01-pre-deployment-checks.ps1
#>

$ErrorActionPreference = 'Stop'

$ApiUrl = if ($env:PROD_API_URL) { $env:PROD_API_URL } else { "https://api.example-tenant.net" }
$Release = "2026-W17"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Pre-Deployment Checks"
Write-Host "  Release: $Release"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# ── Verify staging is healthy ──────────────────────────────────
Write-Host "🔍 Checking staging health..."
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    $httpCode = $response.StatusCode
} catch {
    $httpCode = 0
}

if ($httpCode -ne 200) {
    Write-Host "❌ API health check failed (HTTP $httpCode)"
    Write-Host "   Resolve staging issues before proceeding."
    exit 1
}
Write-Host "✅ API is healthy"

# ── Enable maintenance mode ───────────────────────────────────
Write-Host ""
Write-Host "🔧 Enabling maintenance mode..."
try {
    $body = @{ enabled = $true; message = "System upgrade to $Release in progress" } | ConvertTo-Json
    $maintResponse = Invoke-WebRequest -Uri "$ApiUrl/api/system/maintenance" `
        -Method Post -Body $body -ContentType "application/json" -SkipHttpErrorCheck -TimeoutSec 10
    $maintCode = $maintResponse.StatusCode
} catch {
    $maintCode = 0
}

if ($maintCode -eq 200 -or $maintCode -eq 204) {
    Write-Host "✅ Maintenance mode enabled"
} else {
    Write-Host "⚠️  Maintenance mode response: HTTP $maintCode"
    Write-Host "   Verify manually and continue if appropriate."
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Pre-deployment checks complete"
Write-Host "  Next: 02-backup-database.ps1"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
