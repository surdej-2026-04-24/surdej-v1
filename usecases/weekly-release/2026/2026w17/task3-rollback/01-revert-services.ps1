#Requires -Version 7
<#
.SYNOPSIS
    Task 3 / Step 1: Revert Services
.DESCRIPTION
    Rolls back K8s deployments to the previous image tags.
.PARAMETER PreviousTag
    The previous release tag to roll back to (e.g. 2026-W16).
.EXAMPLE
    ./01-revert-services.ps1 -PreviousTag 2026-W16
#>
param(
    [Parameter(Mandatory)][string]$PreviousTag
)

$ErrorActionPreference = 'Stop'

$Registry = "ghcr.io/your-org"
$ImagePrefix = "surdej-v1"
$Namespace = "surdej-v1"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ⛔ Revert Services"
Write-Host "  Rolling back to: $PreviousTag"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

$Deployments = @(
    @{ Deploy = "surdej-api";                  Image = "api" }
    @{ Deploy = "surdej-frontend";             Image = "frontend" }
    @{ Deploy = "surdej-worker-pdf-refinery";  Image = "worker-pdf-refinery" }
    @{ Deploy = "surdej-worker-knowledge";     Image = "worker-knowledge" }
    @{ Deploy = "surdej-worker-document";      Image = "worker-document" }
    @{ Deploy = "surdej-module-nosql";         Image = "worker-member-nosql" }
)

Write-Host "⏪ Reverting images..."
foreach ($entry in $Deployments) {
    $deploy = $entry.Deploy
    $image = $entry.Image
    Write-Host "  $deploy → $Registry/$ImagePrefix-${image}:$PreviousTag"
    kubectl set image "deployment/$deploy" `
        "${deploy}=$Registry/$ImagePrefix-${image}:$PreviousTag" `
        -n $Namespace 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠ $deploy not found, skipping"
    }
}

Write-Host ""
Write-Host "⏳ Waiting for rollouts..."
kubectl rollout status deployment/surdej-api -n $Namespace --timeout=120s
kubectl rollout status deployment/surdej-frontend -n $Namespace --timeout=120s

foreach ($entry in $Deployments) {
    $deploy = $entry.Deploy
    if ($deploy -eq "surdej-api" -or $deploy -eq "surdej-frontend") { continue }
    kubectl rollout status "deployment/$deploy" -n $Namespace --timeout=120s 2>$null
}

Write-Host ""
Write-Host "🏥 Checking health..."
$ApiUrl = "https://api.example-tenant.net"
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    Write-Host "  Health: HTTP $($response.StatusCode)"
} catch {
    Write-Host "  Health: HTTP 0 (unreachable)"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Services reverted to $PreviousTag"
Write-Host "  Next: 02-restore-database.ps1 (if schema changed)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
