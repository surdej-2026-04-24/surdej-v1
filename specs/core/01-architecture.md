# 01 — Architecture

## Tech Stack (Consolidated)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | React 19, Vite 7, TypeScript 5.9 | Shared across all domain modules |
| **Styling** | Tailwind CSS 3.4, Shadcn UI, Lucide React | Global design tokens in `index.css` |
| **State** | React Context + Zustand | Context: Auth, Features, Feedback, Accessibility. Zustand: Skins, Commands |
| **Routing** | React Router DOM 7.9 | File-based structure in `src/routes` |
| **API** | Fastify, Prisma ORM, Zod | Modular, JWT auth |
| **Database** | PostgreSQL 15 + pgvector | Segmented Prisma schemas per domain/worker |
| **Message Queue** | NATS 2.10 JetStream | Streams, object stores, DLQ, worker registry |
| **Workers** | TypeScript / Node.js only | Each worker has its own Prisma schema segment |
| **AI** | Azure OpenAI, AI Foundry (Claude), Vercel AI SDK | GPT-4o, GPT-4o-mini, o3, text-embedding-3-* |
| **MCP** | `@modelcontextprotocol/sdk` | Server + client, stdio/SSE/HTTP transport |
| **Auth** | MSAL / Entra ID, Demo mode, Firebase (planned) | PKCE browser flow, CLI tokens |
| **Extension** | Chrome extension (Manifest V3) | `@crxjs/vite-plugin` |
| **Infra** | Docker, AKS, Cloudflare Zero Trust | Multi-stage builds, GHCR registry |
| **CI/CD** | GitHub Actions | CI only, developer-controlled deploys |
| **Package Manager** | pnpm 10.21 | Workspaces, Node ≥20 |

## Integration Boundary

The **REST API is the sole integration point** between the frontend and all backend services.
The frontend communicates exclusively with the Fastify API over HTTP/REST. It never connects
to NATS, PostgreSQL, workers, or external AI providers directly.

```
Frontend ──HTTP/REST──▶ API ──┬──▶ PostgreSQL (Prisma)
                              ├──▶ NATS → Workers
                              ├──▶ Azure OpenAI / AI Foundry
                              ├──▶ MCP Servers
                              ├──▶ Blob Storage
                              └──▶ CAKE / Key Vault
```

The only direct external call the frontend makes is **MSAL auth** (Entra ID token acquisition).
All other data, AI streaming, job dispatch, and file access go through API endpoints.

## Monorepo Structure (Proposed)

```
surdej-v1/
├── apps/
│   ├── api/                    # Fastify + Prisma API server (port 5001)
│   │   └── prisma/
│   │       └── schema/
│   │           └── core.prisma     # Core schema (users, features, ai, etc.)
│   ├── frontend/               # React 19 + Vite web app
│   ├── extension/              # Chrome extension ("Peeler-Mate")
│   ├── helper/                 # Express utility server
│   └── proxy/                  # Caddy reverse proxy
├── workers/
│   ├── knowledge/              # Knowledge management worker (TypeScript)
│   │   └── prisma/
│   │       └── schema/
│   │           └── knowledge.prisma  # Knowledge schema segment
│   ├── document/               # Document processing worker (TypeScript)
│   │   └── prisma/
│   │       └── schema/
│   │           └── document.prisma   # Document schema segment
│   └── <domain-worker>/        # Domain-specific workers added by derived projects
│       └── prisma/
│           └── schema/
│               └── <domain>.prisma
├── packages/
│   ├── core/                   # @surdej/core — shared types, utils, constants, lifecycle
│   ├── ui/                     # (future) shared UI component library
│   └── config/                 # (future) shared configs (eslint, tsconfig, tailwind)
├── infra/
│   └── k8s/                    # Kubernetes manifests (per-service)
├── scripts/                    # Dev & ops scripts
├── docs/                       # Documentation
├── specs/
│   ├── core/                   # Generic platform specs
│   └── domain/                 # Domain-specific specs (nexi/, pdf-refinery/)
├── tests/                      # Production / E2E tests
├── .agent/                     # AI agent instructions
├── .github/                    # GitHub Actions workflows, Copilot instructions
├── docker-compose.yml
├── Dockerfile
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Segmented PostgreSQL & Prisma Schemas

A single PostgreSQL database with multiple **schema segments** — each owned by a specific
worker or sub-API. Every segment has its own Prisma schema file, its own generated client,
and its own migration history.

### Why Segmented Schemas?

- **Isolation** — Each worker/domain owns its data. No cross-contamination of migrations.
- **Independent evolution** — A worker's schema can change without affecting the core API.
- **TypeScript-only** — All Prisma schemas are managed by TypeScript services. No Python/Go ORM mismatch.
- **Clear ownership** — The team/module that owns the worker owns its schema.

### Schema Segments

| Segment | Owner | PostgreSQL Schema | Prisma Location |
|---------|-------|-------------------|-----------------|
| `core` | API server | `public` | `apps/api/prisma/schema/core.prisma` |
| `knowledge` | Knowledge worker | `knowledge` | `workers/knowledge/prisma/schema/knowledge.prisma` |
| `document` | Document worker | `document` | `workers/document/prisma/schema/document.prisma` |
| `<domain>` | Domain worker | `<domain>` | `workers/<domain>/prisma/schema/<domain>.prisma` |

### Core Schema (always present)

The `core` schema contains platform-level models shared across all deployments:

| Model | Purpose |
|-------|---------|
| `User` | User accounts and profiles |
| `Session` | Auth sessions |
| `FeatureFlag` | Feature flag definitions and ring assignments |
| `AiConversation` | AI chat conversations |
| `AiMessage` | AI chat messages |
| `AiUsageLog` | AI usage tracking and cost analytics |
| `FeedbackEntry` | User feedback submissions |
| `WorkerRegistration` | Server-side worker registry |
| `WorkerHeartbeat` | Worker health heartbeats |
| `McpServerConfig` | Configured MCP servers |

### Domain Schema Example (derived project adds)

```prisma
// workers/pdf-refinery/prisma/schema/pdf_refinery.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["pdf_refinery"]
}

generator client {
  provider        = "prisma-client-js"
  output          = "../generated/client"
  previewFeatures = ["multiSchema"]
}

model PdfDocument {
  id        String   @id @default(uuid())
  filename  String
  status    String
  // ...
  @@schema("pdf_refinery")
}
```

### CLI for Schema Management

```bash
pnpm cli:db:status                    # Show all schema segments and their migration status
pnpm cli:db:migrate --schema core     # Run migrations for core schema only
pnpm cli:db:migrate --schema knowledge # Run migrations for knowledge schema
pnpm cli:db:migrate --all             # Run all migrations in dependency order
pnpm cli:gen                          # Generate Prisma clients for all schemas
```

## Worker Architecture (TypeScript Only)

All workers are TypeScript/Node.js applications managed by pnpm. No polyglot workers —
this ensures all data access goes through Prisma and all workers share the same toolchain.

### Worker Lifecycle

```
Start → Connect NATS → Register with Worker Registry → Subscribe to Job Subjects → Heartbeat Loop
```

### Worker Types (Core)

| Worker | Purpose | Prisma Schema |
|--------|---------|---------------|
| `knowledge` | Article indexing, template validation, training material generation | `knowledge` |
| `document` | Generic document processing, OCR, embedding generation | `document` |

Derived projects add their own workers in `workers/<name>/`.

### NATS Communication

| Subject Pattern | Purpose |
|----------------|---------|
| `job.<worker-type>.<action>` | Job dispatch (e.g., `job.knowledge.index-article`) |
| `worker.register` | Worker registration |
| `worker.heartbeat` | Health heartbeats (every 30s) |
| `worker.deregister` | Graceful shutdown |
| `event.<domain>.<action>` | Domain events (e.g., `event.knowledge.article-published`) |

## Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "workers/*"
  - "tests"
```

## Infrastructure Services (docker-compose)

### Core Services (default profile)

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| PostgreSQL | `pgvector/pgvector:pg15` | 5434 | Primary database with vector extensions |
| NATS | `nats:2.10-alpine` | 4224, 8224 | Message queue with JetStream |

### Application Services (profile: `full`)

| Service | Port | Description |
|---------|------|-------------|
| API (Fastify) | 5001 | Core platform API |

### Worker Services (profile: `workers`)

| Service | Language | Purpose |
|---------|----------|---------|
| Knowledge Worker | TypeScript | Article indexing, training content, template validation |
| Document Worker | TypeScript | Document processing, OCR, embeddings |

### Monitoring (profile: `monitoring`)

Prometheus, Grafana, Loki, Promtail, cAdvisor, Node Exporter, PostgreSQL Exporter, NATS Exporter.

## Deployment Topology

```
DNS → Cloudflare Edge (WAF) → Cloudflare Access → CF Tunnel → AKS Ingress (nginx)
  ├── API Service (Fastify, port 3000)
  ├── Frontend Service (nginx, port 80)
  └── Workers (internal, NATS-connected)
```

- **AKS** (Azure Kubernetes Service) in Sweden Central
- **Cloudflare Zero Trust**: DNS, WAF, Access policies, Tunnels
- **Azure Key Vault**: Database credentials, API keys, tunnel tokens
- **GHCR** (GitHub Container Registry): Docker images with build attestations

## Multi-Stage Docker Build

Layered Dockerfile producing multiple targets:
1. `api-production` — Node.js Fastify server
2. `frontend-production` — nginx serving static React build
3. `combined-production` — Both API + Frontend via nginx + node (uses `start.sh`)
4. `worker-<type>` — Per-worker images

---

*Consolidated from: both `docker-compose.yml`, `Dockerfile`, `pnpm-workspace.yaml`, `package.json`,
`.agent/instructions.md`, `docs/docker-workflows.md`, architecture specs.*
