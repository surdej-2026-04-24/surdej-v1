#Requires -Version 7
<#
.SYNOPSIS
    Task 1 / Step 3: Deploy to Staging
.DESCRIPTION
    Applies k8s manifests and waits for rollouts on staging.
    Uses manifests from k8s/pre-production/ with image tags for this release.
.EXAMPLE
    ./03-deploy-staging.ps1
#>

$ErrorActionPreference = 'Stop'

$AksCluster = "aks-surdej"
$AksResourceGroup = "Sweden"
$Namespace = "surdej-v1"
$RepoRoot = git rev-parse --show-toplevel
$ManifestDir = "$RepoRoot/k8s/pre-production"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Deploy to Staging (pre-production)"
Write-Host "  Manifests: k8s/pre-production/"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# ── Get AKS credentials ────────────────────────────────────────
Write-Host "🔐 Getting AKS credentials..."
az aks get-credentials `
    --resource-group $AksResourceGroup `
    --name $AksCluster `
    --overwrite-existing

# ── Apply namespace ────────────────────────────────────────────
Write-Host ""
Write-Host "📁 Ensuring namespace..."
kubectl apply -f "$ManifestDir/namespace.yaml"

# ── Apply secrets provider ─────────────────────────────────────
Write-Host ""
Write-Host "🔐 Applying secret provider class..."
kubectl apply -f "$ManifestDir/secret-provider-class.yaml"

# ── Apply config ───────────────────────────────────────────────
Write-Host ""
Write-Host "⚙️  Applying config..."
kubectl apply -f "$ManifestDir/api-config.yaml"

# ── Run database migration ────────────────────────────────────
Write-Host ""
Write-Host "🗄️  Running database migration..."
kubectl delete job/surdej-db-migrate-2026-w17 -n $Namespace --ignore-not-found
kubectl apply -f "$ManifestDir/db-migrate-job.yaml"
Write-Host "⏳ Waiting for migration job (timeout 5m)..."
kubectl wait --for=condition=complete --timeout=300s -n $Namespace job/surdej-db-migrate-2026-w17

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration job failed or timed out!"
    kubectl logs -n $Namespace -l job-type=db-migrate --tail=50
    exit 1
}
Write-Host "✅ Database migration complete"

# ── Apply infrastructure ──────────────────────────────────────
Write-Host ""
Write-Host "🏗️  Applying infrastructure..."
kubectl apply -f "$ManifestDir/infrastructure.yaml"
kubectl rollout status deployment/nats -n $Namespace --timeout=120s

# ── Deploy all services ───────────────────────────────────────
Write-Host ""
Write-Host "🚀 Deploying services..."
kubectl apply -f "$ManifestDir/deployment.yaml"

# ── Wait for rollouts ─────────────────────────────────────────
Write-Host ""
Write-Host "⏳ Waiting for rollouts..."
kubectl rollout status deployment/surdej-api -n $Namespace --timeout=120s
kubectl rollout status deployment/surdej-frontend -n $Namespace --timeout=120s
Write-Host "✅ Core services rolled out"

$Workers = @(
    "surdej-worker-pdf-refinery"
    "surdej-worker-knowledge"
    "surdej-worker-document"
    "surdej-module-nosql"
)

foreach ($w in $Workers) {
    kubectl rollout status "deployment/$w" -n $Namespace --timeout=120s 2>$null
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Staging deployment complete"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
