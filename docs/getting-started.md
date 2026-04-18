# Surdej — Getting Started

> The forkable monorepo framework for building internal platforms with AI, workers, and knowledge management.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 22+ | Runtime |
| **pnpm** | 10+ | Package manager (via corepack) |
| **Docker** | 24+ | PostgreSQL, NATS, workers |
| **Git** | 2.40+ | Version control |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/surdej-v1.git
cd surdej-v1
corepack enable
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d          # PostgreSQL + NATS
```

### 3. Set up the database

```bash
cd apps/api
pnpm exec prisma generate     # Generate Prisma client
pnpm exec prisma db push      # Push schema to database
pnpm exec prisma db seed      # Seed demo data
cd ../..
```

### 4. Start development servers

```bash
# Terminal 1: API server
cd apps/api && pnpm dev        # http://localhost:5001

# Terminal 2: Frontend
cd apps/frontend && pnpm dev   # http://localhost:4001
```

Or use the boot workflow if you have the agent configured:
```bash
# /boot
```

### 5. (Optional) Start workers

```bash
docker compose --profile workers up -d
```

### 6. (Optional) Start monitoring

```bash
docker compose --profile monitoring up -d
# Grafana: http://localhost:3000 (admin / surdej_dev)
# Prometheus: http://localhost:9090
```

---

## Project Structure

```
surdej-v1/
├── apps/
│   ├── api/              # Fastify API server (port 5001)
│   ├── frontend/         # Vite + React 19 frontend (port 4001)
│   ├── extension/        # Chrome extension (Manifest V3)
│   ├── helper/           # localhost helper server
│   └── proxy/            # Cloudflare Worker proxy
├── packages/
│   ├── core/             # @surdej/core — shared types, lifecycle, events
│   ├── ui/               # @surdej/ui — shared UI components
│   └── types/            # @surdej/types — contract re-exports
├── workers/
│   ├── _template/        # Worker scaffold template
│   ├── knowledge/        # Knowledge management worker
│   ├── document/         # Document processing worker
│   ├── pdf-refinery/     # PDF Refinery PDF extraction worker
│   └── laka-dispatch/    # Nexi email dispatch worker
├── contracts/            # TypeScript contract definitions
├── infra/
│   ├── k8s/              # Kubernetes manifests
│   └── monitoring/       # Prometheus config
├── cli/                  # CLI tooling
├── docs/                 # Documentation
├── tests/                # Integration/E2E tests
├── plans/                # Implementation plans
└── docker-compose.yml    # Local infrastructure
```

---

## Available Scripts

### Root level

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start frontend dev server |
| `pnpm dev:api` | Start API dev server |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |

### CLI commands

| Script | Description |
|--------|-------------|
| `pnpm cli:workers` | List connected workers + health |
| `pnpm cli:db:status` | Show all Prisma schema segments |
| `pnpm cli:topology:infra` | Generate infrastructure topology |
| `pnpm cli:topology:code` | Generate codebase topology |
| `pnpm cli:topology:flow` | Generate data-flow topology |

---

## Environment Variables

Create a `.env` file in `apps/api/`:

```dotenv
# Database
DATABASE_URL=postgresql://surdej:surdej_dev@localhost:5432/surdej

# Server
PORT=5001
HOST=0.0.0.0
NODE_ENV=development

# Auth
AUTH_PROVIDER=demo    # demo | entra | none

# NATS
NATS_URL=nats://localhost:4222

# CORS
CORS_ORIGIN=http://localhost:4001

# AI (optional)
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
```

Create a `.env` in `apps/frontend/`:

```dotenv
VITE_API_URL=http://localhost:5001/api
VITE_AUTH_PROVIDER=demo
```

---

## Auth Providers

Surdej supports three authentication modes:

| Provider | Use Case | Config |
|----------|----------|--------|
| `demo` | Local development, demos | Seeded demo users, role selector |
| `entra` | Production | Microsoft Entra ID (Azure AD) JWT validation |
| `none` | Testing | No authentication, all requests pass |

Set via `AUTH_PROVIDER` environment variable.

---

## Docker Compose Profiles

| Profile | Services | Command |
|---------|----------|---------|
| *(default)* | PostgreSQL, NATS | `docker compose up -d` |
| `workers` | + all 4 workers | `docker compose --profile workers up -d` |
| `monitoring` | + Prometheus, Grafana, Loki | `docker compose --profile monitoring up -d` |

---

## Next Steps

- [Architecture Guide](./architecture.md) — Platform design and conventions
- [Domain Extension Guide](./domain-extension.md) — How to add your own domain
- [Worker Development Guide](./worker-development.md) — Creating custom workers
- [Skin Creation Guide](./skin-creation.md) — Building custom skins
- [Deployment Guide](./deployment.md) — Deploying to production
