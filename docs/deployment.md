# Surdej — Deployment Guide

> How to deploy Surdej to production using Docker, Kubernetes, and CI/CD.

---

## Overview

Production deployment targets:

| Component | Runtime | Image |
|-----------|---------|-------|
| **API** | Node.js 22 | `ghcr.io/<org>/surdej-v1/api:latest` |
| **Frontend** | Nginx 1.27 | `ghcr.io/<org>/surdej-v1/frontend:latest` |
| **Workers** | Node.js 22 | `ghcr.io/<org>/surdej-v1/worker-<name>:latest` |
| **PostgreSQL** | pgvector on pg15 | Managed (Azure Database for PostgreSQL) |
| **NATS** | 2.10 JetStream | Self-hosted or managed |

---

## 1. Docker Images

### Building locally

```bash
# API
docker build -f apps/api/Dockerfile -t surdej-api .

# Frontend
docker build -f apps/frontend/Dockerfile \
  --build-arg VITE_API_URL=https://api.example.com/api \
  --build-arg VITE_AUTH_PROVIDER=entra \
  -t surdej-frontend .

# Workers
docker build -f workers/pdf-refinery/Dockerfile -t surdej-worker-pdf-refinery .
docker build -f workers/laka-dispatch/Dockerfile -t surdej-worker-laka-dispatch .
```

### CI/CD automated builds

Push to `main` triggers the CI pipeline:

1. **Quality checks** — lint, typecheck, test
2. **Docker builds** — multi-platform (amd64 + arm64)
3. **Push to GHCR** — tagged with git SHA + `latest`

Images are built using GitHub Actions with Docker Buildx and GHA caching.

---

## 2. Kubernetes Deployment

### Prerequisites

- AKS cluster (Azure Kubernetes Service) or any K8s cluster
- `kubectl` configured with cluster access
- Secrets configured in K8s

### Create namespace and secrets

```bash
# Create namespace
kubectl apply -f infra/k8s/namespace.yaml

# Create secrets
kubectl create secret generic surdej-secrets \
  --namespace surdej \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/surdej" \
  --from-literal=AZURE_OPENAI_API_KEY="your-key"

# Create config
kubectl create configmap surdej-config \
  --namespace surdej \
  --from-literal=CORS_ORIGIN="https://app.example.com"
```

### Deploy with Kustomize

```bash
kubectl apply -k infra/k8s/
```

This deploys:
- API (2 replicas, readiness/liveness probes)
- Frontend (2 replicas, Nginx with SPA routing)
- All 4 workers (1–2 replicas each)
- Ingress with TLS

### Verify

```bash
kubectl get pods -n surdej
kubectl get services -n surdej
kubectl get ingress -n surdej
```

---

## 3. Environment Variables

### API (Production)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NATS_URL` | ✅ | NATS server address |
| `PORT` | | API port (default: 5001) |
| `HOST` | | Bind address (default: 0.0.0.0) |
| `NODE_ENV` | | Set to `production` |
| `AUTH_PROVIDER` | ✅ | `entra` for production |
| `CORS_ORIGIN` | ✅ | Frontend URL |
| `AZURE_OPENAI_ENDPOINT` | | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | | Azure OpenAI API key |
| `JWT_AUDIENCE` | | Expected JWT audience |
| `JWT_ISSUER` | | Expected JWT issuer |

### Frontend (Build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | API endpoint URL |
| `VITE_AUTH_PROVIDER` | ✅ | `entra` for production |

### Workers

| Variable | Required | Description |
|----------|----------|-------------|
| `NATS_URL` | ✅ | NATS server address |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NODE_ENV` | | Set to `production` |

---

## 4. Database Migrations

Before deploying a new version, run migrations:

```bash
# From CI/CD or a migration job
pnpm --filter @surdej/api exec prisma migrate deploy
```

For new schema segments:
```bash
pnpm --filter @surdej/api exec prisma db push
```

---

## 5. Health Checks

### API

```
GET /api/health → 200 OK
```

### Frontend (Nginx)

```
GET /health → 200 OK
```

### K8s probes

Both deployments include:
- **Readiness probe** — checks if the service is ready to accept traffic
- **Liveness probe** — checks if the service is still running

---

## 6. Resource Defaults

| Component | Memory Request | Memory Limit | CPU Request | CPU Limit |
|-----------|---------------|-------------|-------------|-----------|
| API | 128Mi | 512Mi | 100m | 500m |
| Frontend | 64Mi | 256Mi | 50m | 200m |
| Workers | 128Mi | 512Mi | 100m | 500m |

---

## 7. Monitoring

Deploy the monitoring stack:

```bash
kubectl apply -f infra/monitoring/

# Or via Docker Compose locally:
docker compose --profile monitoring up -d
```

Endpoints:
| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / surdej_dev |
| Prometheus | http://localhost:9090 | — |
| Loki | http://localhost:3100 | — |

---

## 8. Release Checklist

```markdown
## Release vX.Y.Z

### Pre-deploy
- [ ] All CI checks pass (lint, typecheck, test)
- [ ] Docker images built and pushed to GHCR
- [ ] Database migrations reviewed
- [ ] Environment variables updated (if needed)

### Deploy
- [ ] Run database migrations
- [ ] Deploy API (rolling update)
- [ ] Deploy Frontend (rolling update)
- [ ] Deploy Workers (rolling update)

### Verify
- [ ] API health check returns 200
- [ ] Frontend loads correctly
- [ ] Workers register and show healthy
- [ ] AI chat streaming works
- [ ] Key user flows tested

### Rollback (if needed)
- [ ] Revert to previous image tag
- [ ] Rollback database migration (if applicable)
- [ ] Verify health checks
```

---

## 9. Cloudflare Setup (Optional)

If using Cloudflare Tunnel for ingress:

```bash
# Deploy tunnel
pnpm cli:tunnel

# Configure DNS in Cloudflare dashboard
# - api.example.com → tunnel → surdej-api:5001
# - app.example.com → tunnel → surdej-frontend:80
```

---

## See Also

- [Getting Started](./getting-started.md) — Local development
- [Architecture Guide](./architecture.md) — Platform design
