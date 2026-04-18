# PDF Refinery Surdej — AKS Deployment Plan

> Deploy `surdej-test-pdf-refinery` to **AKS `aks-pdf-refinery`** in the **Example-Tenant** tenant
> **Namespace**: `surdej-v1` (self-contained — includes NATS, Cloudflare tunnel, everything)
> **Replace** old `happymate-framework-v1`. Same DNS. All workers. Azure Blob Storage.

---

## 📋 Infrastructure Audit (Example-Tenant / Prod)

| Component | Resource | Status |
|-----------|----------|--------|
| **Tenant** | Example-Tenant (`31f35f1f-b9e8-...`, `example.com`) | ✅ |
| **Subscription** | Prod (`f2999427-2e4a-...`) | ✅ |
| **Resource Group** | `Sweden` (swedencentral) | ✅ |
| **AKS** | `aks-pdf-refinery` — K8s 1.33, 2 nodes | ✅ |
| **PostgreSQL** | `psql-pdf-refinery.postgres.database.azure.com` (v16), db: `pdf-refinery` | ✅ |
| **Key Vault** | `kv-pdf-refinery` — `openai-api-key`, `postgres-admin-password` | ✅ |
| **Azure OpenAI** | `oai-pdf-refinery` → `https://oai-pdf-refinery.openai.azure.com/` | ✅ |
| **Azure Blob Storage** | `happypdf-refineryprod` (StorageV2) | ✅ |
| **CF Tunnel** | `22900e0b-...` → `api.example-tenant.net` + `ai.example-tenant.net` | ✅ |
| **GitHub CI** | `build-containers.yml` + `deploy-aks.yml` | ✅ |

---

## 🚀 Execution Steps

### Step 1: Create namespace, copy secrets

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Copy GHCR pull secret
kubectl get secret ghcr-secret -n api -o yaml \
  | sed 's/namespace: api/namespace: surdej-v1/' \
  | kubectl apply -f -

# Copy Cloudflare tunnel credentials
kubectl get secret cloudflare-tunnel-credentials -n api -o yaml \
  | sed 's/namespace: api/namespace: surdej-v1/' \
  | kubectl apply -f -
```

### Step 2: Create ConfigMap + Secrets

```bash
# ConfigMap
kubectl create configmap surdej-api-config \
  --namespace surdej-v1 \
  --from-literal=NODE_ENV=production \
  --from-literal=PORT=3000 \
  --from-literal=NATS_URL=nats://nats-service.surdej-v1.svc.cluster.local:4222 \
  --from-literal=ALLOWED_ORIGINS="*" \
  --from-literal=AI_PROVIDER=azure \
  --from-literal=AZURE_OPENAI_API_VERSION=2024-08-01-preview \
  --from-literal=AZURE_OPENAI_MODEL_LOW=gpt-4o-mini \
  --from-literal=AZURE_OPENAI_MODEL_MEDIUM=gpt-5.2-chat \
  --from-literal=AZURE_OPENAI_MODEL_REASONING=o3 \
  --from-literal=AUTH_PROVIDER=entra \
  --from-literal=STORAGE_PROVIDER=AZURE \
  --from-literal=STORAGE_BUCKET=surdej

# Secrets (from Key Vault + Storage Account)
DB_PASS=$(az keyvault secret show --vault-name kv-pdf-refinery --name postgres-admin-password --query value -o tsv)
OAI_KEY=$(az keyvault secret show --vault-name kv-pdf-refinery --name openai-api-key --query value -o tsv)
BLOB_CONN=$(az storage account show-connection-string --name happypdf-refineryprod --resource-group Sweden -o tsv)

kubectl create secret generic surdej-api-secrets \
  --namespace surdej-v1 \
  --from-literal=DATABASE_URL="postgresql://pdf-refineryadmin:${DB_PASS}@psql-pdf-refinery.postgres.database.azure.com:5432/pdf-refinery?sslmode=require" \
  --from-literal=AZURE_OPENAI_API_KEY="${OAI_KEY}" \
  --from-literal=AZURE_OPENAI_ENDPOINT="https://oai-pdf-refinery.openai.azure.com/" \
  --from-literal=AZURE_STORAGE_CONNECTION_STRING="${BLOB_CONN}"
```

### Step 3: Set repo-level GitHub variables

```bash
gh variable set VITE_API_URL --repo happy-mates/surdej-test-pdf-refinery --body "https://api.example-tenant.net/api"
gh variable set VITE_AUTH_PROVIDER --repo happy-mates/surdej-test-pdf-refinery --body "entra"
```

### Step 4: Verify pgvector extension

```bash
az postgres flexible-server execute \
  --name psql-pdf-refinery --resource-group Sweden \
  --database-name pdf-refinery \
  --querytext "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Step 5: Release & trigger CI

```bash
git add -A && git commit -m "feat: PDF split-view, RAG chat, profile, i18n, AKS deploy"
# Edit surdej.yaml → version: "0.2.0"
git add surdej.yaml && git commit -m "chore(release): bump version to v0.2.0"
git tag "v0.2.0"
git push origin main && git push origin "v0.2.0"
gh release create "v0.2.0" --generate-notes --title "Release v0.2.0"
```

### Step 6: CI Pipeline (automatic)

```
git push tag → build-containers.yml
  ├─ quality (lint, typecheck, test)
  ├─ build-api         → ghcr.io/happy-mates/surdej-test-pdf-refinery-api:v0.2.0
  ├─ build-frontend    → ghcr.io/happy-mates/surdej-test-pdf-refinery-frontend:v0.2.0
  └─ build-workers     → pdf-refinery, knowledge, document
      ↓ on success
deploy-aks.yml
  ├─ az login → aks get-credentials (aks-pdf-refinery / Sweden)
  ├─ kubectl apply namespace
  ├─ db-migrate job → wait for completion
  ├─ deploy infrastructure (NATS, CF tunnel)
  ├─ deploy services (API, frontend, 3 workers)
  └─ rollout status → verify
```

### Step 7: Clean up old namespaces

```bash
# Delete everything from the old deployment
kubectl delete namespace api
kubectl delete namespace frontend
kubectl delete namespace nats
kubectl delete namespace pgadmin
```

### Step 8: Verify

```bash
kubectl get pods -n surdej-v1
curl -s https://api.example-tenant.net/api/health | jq .
curl -s -o /dev/null -w "%{http_code}" https://ai.example-tenant.net/
```

---

## 📦 K8s Manifests

| File | Contents |
|------|----------|
| `k8s/namespace.yaml` | Namespace `surdej-v1` |
| `k8s/infrastructure.yaml` | NATS JetStream + Cloudflare Tunnel (with config) |
| `k8s/deployment.yaml` | API, Frontend, 3 Workers (pdf-refinery, knowledge, document) |
| `k8s/db-migrate-job.yaml` | Prisma migration Job |

### What runs in `surdej-v1`:

| Deployment | Image | Ports |
|------------|-------|-------|
| `nats` | `nats:2.10-alpine` | 4222, 8222 |
| `cloudflare-tunnel` | `cloudflare/cloudflared:latest` | — |
| `surdej-api` | `ghcr.io/.../surdej-test-pdf-refinery-api:<tag>` | 3000 |
| `surdej-frontend` | `ghcr.io/.../surdej-test-pdf-refinery-frontend:<tag>` | 80 |
| `surdej-worker-pdf-refinery` | `ghcr.io/.../surdej-test-pdf-refinery-worker-pdf-refinery:<tag>` | — |
| `surdej-worker-knowledge` | `ghcr.io/.../surdej-test-pdf-refinery-worker-knowledge:<tag>` | — |
| `surdej-worker-document` | `ghcr.io/.../surdej-test-pdf-refinery-worker-document:<tag>` | — |

### DNS Routing (via Cloudflare Tunnel):

| Hostname | → Service |
|----------|-----------|
| `api.example-tenant.net` | `surdej-api-service.surdej-v1:3000` |
| `ai.example-tenant.net` | `surdej-frontend-service.surdej-v1:80` |

---

## 🔑 Environment Reference

### ConfigMap (`surdej-api-config`)
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `NATS_URL` | `nats://nats-service.surdej-v1.svc.cluster.local:4222` |
| `AI_PROVIDER` | `azure` |
| `AUTH_PROVIDER` | `entra` |
| `STORAGE_PROVIDER` | `AZURE` |
| `STORAGE_BUCKET` | `surdej` |
| `AZURE_OPENAI_MODEL_LOW` | `gpt-4o-mini` |
| `AZURE_OPENAI_MODEL_MEDIUM` | `gpt-5.2-chat` |
| `AZURE_OPENAI_MODEL_REASONING` | `o3` |
| `AZURE_OPENAI_API_VERSION` | `2024-08-01-preview` |

### Secret (`surdej-api-secrets`)
| Key | Source |
|-----|--------|
| `DATABASE_URL` | `psql-pdf-refinery` + `kv-pdf-refinery/postgres-admin-password` |
| `AZURE_OPENAI_API_KEY` | `kv-pdf-refinery/openai-api-key` |
| `AZURE_OPENAI_ENDPOINT` | `https://oai-pdf-refinery.openai.azure.com/` |
| `AZURE_STORAGE_CONNECTION_STRING` | `happypdf-refineryprod` storage account |
