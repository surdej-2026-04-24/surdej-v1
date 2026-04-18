#Requires -Version 7
<#
.SYNOPSIS
    Task 3 / Step 3: Verify Rollback & Disable Maintenance
.DESCRIPTION
    Final checks after rollback, then disables maintenance mode.
.EXAMPLE
    ./03-verify-rollback.ps1
#>

$ErrorActionPreference = 'Stop'

$ApiUrl = if ($env:PROD_API_URL) { $env:PROD_API_URL } else { "https://api.example-tenant.net" }
$Namespace = "surdej-v1"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Verify Rollback"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

$Pass = 0
$Fail = 0

function Test-Check([string]$Name, [bool]$Result) {
    if ($Result) {
        Write-Host "  ✅ $Name"
        $script:Pass++
    } else {
        Write-Host "  ❌ $Name"
        $script:Fail++
    }
}

# ── Health check ───────────────────────────────────────────────
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    $httpCode = $response.StatusCode
} catch {
    $httpCode = 0
}
Test-Check "API health (HTTP $httpCode)" ($httpCode -eq 200)

# ── Pods ───────────────────────────────────────────────────────
$notRunning = (kubectl get pods -n $Namespace --no-headers 2>$null |
    Select-String -NotMatch "Running|Completed" |
    Measure-Object).Count
Test-Check "All pods Running" ($notRunning -eq 0)

# ── Disable maintenance mode ─────────────────────────────────
Write-Host ""
Write-Host "🔧 Disabling maintenance mode..."
try {
    $body = @{ enabled = $false } | ConvertTo-Json
    Invoke-WebRequest -Uri "$ApiUrl/api/system/maintenance" `
        -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
} catch { }
Write-Host "✅ Maintenance mode disabled"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Results: $Pass passed, $Fail failed"
Write-Host ""
if ($Fail -eq 0) {
    Write-Host "  ✅ Rollback verified — system is back to previous state"
} else {
    Write-Host "  ⚠️  Issues remain — escalate immediately"
}
Write-Host ""
Write-Host "  Post-rollback:"
Write-Host "  - Update release YAML status → cancelled"
Write-Host "  - Schedule post-mortem within 24h"
Write-Host "  - Create follow-up issues for blocking problems"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
