#Requires -Version 7
<#
.SYNOPSIS
    Task 1 / Step 4: Smoke Test Staging
.DESCRIPTION
    Runs basic health and connectivity checks against staging.
.EXAMPLE
    ./04-smoke-test-staging.ps1
#>

$ErrorActionPreference = 'Stop'

$ApiUrl = if ($env:STAGING_API_URL) { $env:STAGING_API_URL } else { "https://api.example-tenant.net" }
$Namespace = "surdej-v1"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Smoke Test Staging"
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
Test-Check "API health endpoint" ($httpCode -eq 200)

# ── Pod status ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Checking pod status..."
$notRunning = (kubectl get pods -n $Namespace --no-headers 2>$null |
    Select-String -NotMatch "Running|Completed" |
    Measure-Object).Count
Test-Check "All pods Running" ($notRunning -eq 0)

# ── Migration status ──────────────────────────────────────────
Write-Host ""
Write-Host "Checking migration status..."
$migrateOutput = kubectl exec deploy/surdej-api -n $Namespace -- pnpm exec prisma migrate status 2>&1
$pending = ($migrateOutput | Select-String "have not yet been applied" | Measure-Object).Count
Test-Check "No pending migrations" ($pending -eq 0)

# ── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Results: $Pass passed, $Fail failed"
if ($Fail -gt 0) {
    Write-Host "  ⚠️  Staging has issues — investigate before proceeding"
    exit 1
} else {
    Write-Host "  ✅ Staging is healthy — ready for release day"
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
