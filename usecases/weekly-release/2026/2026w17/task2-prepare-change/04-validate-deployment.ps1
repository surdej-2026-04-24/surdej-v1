#Requires -Version 7
<#
.SYNOPSIS
    Task 2 / Step 4: Validate Production Deployment
.DESCRIPTION
    Runs smoke tests and monitoring checks against production.
.EXAMPLE
    ./04-validate-deployment.ps1
#>

$ErrorActionPreference = 'Stop'

$ApiUrl = if ($env:PROD_API_URL) { $env:PROD_API_URL } else { "https://api.example-tenant.net" }
$Namespace = "surdej-v1"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Validate Production Deployment"
Write-Host "  API: $ApiUrl"
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

# ── API Health ─────────────────────────────────────────────────
Write-Host "Checking API health..."
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    $httpCode = $response.StatusCode
} catch {
    $httpCode = 0
}
Test-Check "API health (HTTP $httpCode)" ($httpCode -eq 200)

# ── Pod status ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Checking pods..."
$notRunning = (kubectl get pods -n $Namespace --no-headers 2>$null |
    Select-String -NotMatch "Running|Completed" |
    Measure-Object).Count
Test-Check "All pods Running ($notRunning not running)" ($notRunning -eq 0)

# ── Migration status ──────────────────────────────────────────
Write-Host ""
Write-Host "Checking migrations..."
$migrateOutput = kubectl exec deploy/surdej-api -n $Namespace -- pnpm exec prisma migrate status 2>&1
$pending = ($migrateOutput | Select-String "have not yet been applied" | Measure-Object).Count
Test-Check "No pending migrations" ($pending -eq 0)

# ── Pod restart count ─────────────────────────────────────────
Write-Host ""
Write-Host "Checking for pod restarts..."
$podLines = kubectl get pods -n $Namespace --no-headers 2>$null
$restarts = 0
foreach ($line in ($podLines -split "`n")) {
    $cols = $line -split '\s+'
    if ($cols.Count -ge 5) { $restarts += [int]$cols[3] }
}
Test-Check "No recent restarts (total: $restarts)" ($restarts -lt 3)

# ── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Results: $Pass passed, $Fail failed"
Write-Host ""
if ($Fail -gt 0) {
    Write-Host "  ⚠️  Issues detected — review before Go/No-Go decision"
    Write-Host "  Decision: consider NO-GO → task3-rollback/"
} else {
    Write-Host "  ✅ All checks passed"
    Write-Host "  Decision: GO → task4-commit/"
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
