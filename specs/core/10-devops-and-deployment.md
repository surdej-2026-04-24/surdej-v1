# 10 — DevOps & Deployment

## Principles

- **Developer-controlled deploys** — No auto-deploy via GitHub Actions
- **Documentation-first releases** — Each release gets a markdown document before deploy
- **CI only in Actions** — Build, test, lint. No automatic production deployments
- **Manual deploy via kubectl** — After review, manually trigger deployment

## CI/CD Pipelines (GitHub Actions)

### Node.js Services (API, Frontend, Extension)

1. **Version Bump:** Auto-increment patch version on push to main, creates git tag
2. **Docker Build:** Triggered by version tag, builds 3 images (API, Frontend, Combined)
3. **Push to GHCR:** Multi-platform (`linux/amd64` + `linux/arm64`), build attestations
4. **Manual Deploy:** Developer runs `kubectl apply` after verification

### Python Services (LAKA Dispatch)

1. **CI:** Lint with `ruff`, Docker build test, PostgreSQL service container
2. **Release & Deploy:** Build Docker → push to GHCR → deploy to AKS
3. **Triggers:** Release creation, push to main (path-filtered), or `workflow_dispatch`

### Path Filtering

Workflows are path-filtered to prevent cross-interference:
- Node.js workflows: `apps/api/**`, `apps/frontend/**`, `packages/**`
- Python workflows: `apps/laka-dispatch-phase1/**`

## Docker

### Multi-Stage Build (Node.js)

7-stage Dockerfile:

| Stage | Purpose |
|-------|---------|
| `base` | Node 20 Alpine + pnpm 10.21 |
| `deps` | Install all dependencies |
| `api-builder` | Build Fastify API |
| `frontend-builder` | Build React frontend |
| `api-production` | Minimal API image |
| `frontend-production` | nginx serving static files |
| `combined-production` | API + Frontend via nginx + node |

### Python Build (LAKA Dispatch)

Single-stage: `python:3.13-slim` → uvicorn on port 8000.

### Docker Compose Profiles

| Profile | Services |
|---------|----------|
| (default) | PostgreSQL, NATS |
| `full` | + API, LAKA Dispatch |
| `workers` | + Python, Node.js, Go, PowerShell workers |
| `monitoring` | + Prometheus, Grafana, Loki, Promtail, cAdvisor, exporters |

## Kubernetes (AKS — Sweden Central)

### Per-Service Manifests

Each service gets:
- `SecretProviderClass` — Azure Key Vault CSI driver for secrets
- `Deployment` — Pods with health probes, resource limits
- `Service` — Internal TCP routing
- `Ingress` — nginx ingress with TLS (cert-manager)
- `Kustomization` — Orchestrates all manifests

### Resource Defaults

| Resource | Request | Limit |
|----------|---------|-------|
| Memory | 128Mi | 512Mi |
| CPU | 100m | 500m |

### Health Probes

- Liveness: HTTP GET `/health`
- Readiness: HTTP GET `/health`

## Cloudflare Zero Trust

| Component | Purpose |
|-----------|---------|
| DNS | Domain management |
| WAF | Web Application Firewall |
| Access | Identity-aware access policies |
| Tunnels | Secure connection to AKS (no public ingress) |

## Azure Resources

| Resource | Purpose |
|----------|---------|
| AKS | Kubernetes cluster (Sweden Central) |
| Key Vault | Secrets: DB passwords, API keys, tunnel tokens |
| AI Services | Azure OpenAI, AI Foundry |
| Container Registry | GHCR (GitHub, not ACR) |

### Required Secrets

| Secret | Source |
|--------|--------|
| `AZURE_CREDENTIALS` | Service principal JSON |
| `GHCR_TOKEN` | GitHub PAT |
| `DB_ADMIN_CONNECTION_STRING` | PostgreSQL admin connection |
| `postgres-admin-password` | Key Vault |
| `openai-api-key` | Key Vault |
| `cloudflare-tunnel-token` | Key Vault |

### Required Variables

| Variable | Value |
|----------|-------|
| `AKS_CLUSTER_NAME` | `aks-pdf-refinery` |
| `RESOURCE_GROUP` | Sweden region |
| `KEY_VAULT_NAME` | `kv-pdf-refinery` |
| `DOMAIN` | `example-tenant.net` |

## Release Management Process

1. Create release markdown document (from template)
2. Document: overview, changes, pre-deploy checklist, deploy steps, post-deploy verification, rollback plan
3. Run database migrations
4. Build and push Docker images
5. Apply Kubernetes manifests (`kubectl apply`)
6. Verify deployment (health checks, smoke tests)
7. If issues: execute rollback plan

---

*Consolidated from: `specs/release-management.md`, `docs/docker-workflows.md`, `docs/github-secrets-setup.md`, `plan/02-docker-compose.md`, `plan/03-ci-cd.md`, `plan/04-k8s-manifests.md`, `plan/05-cleanup.md`.*
