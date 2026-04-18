#Requires -Version 7
<#
.SYNOPSIS
    Task 2 / Step 3: Deploy to Production
.DESCRIPTION
    Applies k8s manifests to the production AKS cluster.
    Image tags are baked into the manifests under k8s/production/.
.EXAMPLE
    ./03-deploy-production.ps1
#>

$ErrorActionPreference = 'Stop'

$AksCluster = "aks-surdej"
$AksResourceGroup = "Sweden"
$Namespace = "surdej-v1"
$RepoRoot = git rev-parse --show-toplevel
$ManifestDir = "$RepoRoot/k8s/production"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Deploy to Production"
Write-Host "  Manifests: k8s/production/"
Write-Host "  Cluster:   $AksCluster"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# ── Azure + AKS credentials ───────────────────────────────────
Write-Host "🔐 Getting AKS credentials..."
az aks get-credentials `
    --resource-group $AksResourceGroup `
    --name $AksCluster `
    --overwrite-existing

# ── Create namespace (if needed) ──────────────────────────────
Write-Host ""
Write-Host "📁 Ensuring namespace..."
kubectl apply -f "$ManifestDir/namespace.yaml"

# ── Apply secrets provider ─────────────────────────────────────
Write-Host ""
Write-Host "🔐 Applying secret provider class..."
kubectl apply -f "$ManifestDir/secret-provider-class.yaml"

# ── Run database migration (via K8s Job) ─────────────────────
Write-Host ""
Write-Host "🗄️  Running database migration..."
kubectl delete job/surdej-db-migrate-2026-w17 -n $Namespace --ignore-not-found
kubectl apply -f "$ManifestDir/db-migrate-job.yaml"

Write-Host "⏳ Waiting for migration job to complete (timeout 5m)..."
kubectl wait --for=condition=complete `
    --timeout=300s `
    -n $Namespace `
    job/surdej-db-migrate-2026-w17

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration job failed or timed out!"
    kubectl logs -n $Namespace -l job-type=db-migrate --tail=50
    exit 1
}
Write-Host "✅ Database migration complete"

# ── Deploy infrastructure (NATS, ConfigMap) ───────────────────
Write-Host ""
Write-Host "🏗️  Deploying infrastructure..."
kubectl apply -f "$ManifestDir/api-config.yaml"
Write-Host "  ✅ ConfigMap deployed"

kubectl apply -f "$ManifestDir/infrastructure.yaml"
Write-Host "  ✅ Infrastructure deployed (NATS)"

Write-Host "⏳ Waiting for NATS..."
kubectl rollout status deployment/nats -n $Namespace --timeout=120s

# ── Deploy all services ───────────────────────────────────────
Write-Host ""
Write-Host "🚀 Deploying services..."
kubectl apply -f "$ManifestDir/deployment.yaml"
Write-Host "✅ All deployments applied"

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

# ── Health check ───────────────────────────────────────────────
Write-Host ""
Write-Host "🏥 Checking health endpoint..."
$ApiUrl = "https://api.example-tenant.net"
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -SkipHttpErrorCheck -TimeoutSec 10
    $httpCode = $response.StatusCode
} catch {
    $httpCode = 0
}

if ($httpCode -eq 200) {
    Write-Host "✅ Health check passed"
} else {
    Write-Host "⚠️  Health check returned HTTP $httpCode"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Production deployment complete!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
kubectl get pods -n $Namespace
Write-Host ""
Write-Host "  Next: 04-validate-deployment.ps1"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
