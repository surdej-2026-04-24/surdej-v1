# 03 — API Backend

## Overview

A Fastify-based API server with Prisma ORM, providing modular platform services. The API
is the **sole integration point** between the frontend and all backend services — the
frontend never connects to NATS, PostgreSQL, workers, or external providers directly.

The API server owns the `core` Prisma schema and orchestrates communication with TypeScript
workers via NATS JetStream. Domain-specific data lives in worker-owned schema segments.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 20+, Fastify |
| **ORM** | Prisma (PostgreSQL + pgvector), segmented schemas |
| **Validation** | Zod |
| **Auth** | JWT (jsonwebtoken, jwks-rsa), MSAL |
| **AI** | Vercel AI SDK (`@ai-sdk/azure`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) |
| **MCP** | `@modelcontextprotocol/sdk` (server + client) |
| **Azure** | `@azure/identity`, `@azure/keyvault-secrets`, `@azure/storage-blob` |
| **Graph** | `@microsoft/microsoft-graph-client` |
| **Messaging** | NATS (nats.ws) |
| **Logging** | Pino |
| **Dev** | tsx (watch mode), Vitest, ESLint, TypeScript 5.9 |

## Key Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with tsx watch |
| `pnpm build` | TypeScript compilation |
| `pnpm db:generate` | Generate Prisma client (core schema) |
| `pnpm db:migrate` | Run Prisma migrations (core schema) |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm cli:*` | CLI utilities (login, logout, whoami, token, test, tunnel, workers) |

## API Modules (Core Platform)

The API server contains only **generic platform modules**. Domain-specific logic lives in
workers and domain extensions.

### Core Modules

| Module | Purpose |
|--------|---------|
| `auth` | Authentication, session management, JWT validation |
| `users` | User accounts, profiles, roles |
| `features` | Feature flag CRUD and ring assignment |
| `feedback` | Feedback submission and storage |
| `ai/chat` | AI chat sessions, streaming, history |
| `ai/models` | Model routing, provider configuration |
| `ai/rag` | RAG search endpoint (semantic + keyword) |
| `mcp` | MCP server endpoint (Streamable HTTP at `/api/mcp`) |
| `mcp/config` | MCP client configuration (external servers) |
| `workers` | Worker registry dashboard API |
| `blobs` | File/blob storage and retrieval |
| `health` | Health checks, readiness probes |
| `config` | Runtime configuration API |
| `knowledge` | Knowledge management API (delegates to knowledge worker) |

### Domain Extension Point

Derived projects add domain API modules in `apps/api/src/domains/`:

```
apps/api/src/domains/my-domain/
├── routes.ts              # Fastify route handlers
├── service.ts             # Business logic
├── schema.ts              # Zod schemas
└── types.ts               # TypeScript types
```

Register in `apps/api/src/domains/index.ts`.

## Segmented Prisma Schemas

The API server owns the `core` schema. Workers own their domain schemas. All schemas
target the same PostgreSQL instance but use separate PostgreSQL schemas for isolation.

### Core Schema (owned by API server)

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
| `McpToolInvocation` | MCP tool invocation audit log |

> Worker-owned schemas (knowledge, document, domain-specific) are documented in their
> respective worker specs. See spec 01 — Architecture for the full segmentation model.

## Worker Communication (NATS JetStream)

### Core Streams

| Stream | Purpose |
|--------|---------|
| `job.<worker-type>.<action>` | Job dispatch to workers |
| `event.<domain>.<action>` | Domain events |
| `worker.register` | Worker registration |
| `worker.heartbeat` | Health heartbeats |
| `dlq.<stream>` | Dead letter queues per stream |

### Job Pattern

```
API receives request → Validates input (Zod) → Publishes job to NATS
  → Worker picks up job → Processes → Stores result in its schema
  → Publishes completion event → API reads result or streams to frontend
```

## CAKE API Integration

**C**lient **A**PI **K**ey **E**xchange — secure key vault service:

- Endpoint: `https://cake.happymates.dk`
- Flow: Exchange Entra token → CAKE session token → retrieve API keys by ID
- Intelligent fallback: environment variable → CAKE API
- Key IDs: `github-models`, `openai`, `anthropic`

## Blob Storage

PostgreSQL-based binary storage for documents and images:

- Image variants: thumb (150px), small (320px), medium (800px), large (1200px), full (1920px) in WebP
- ETag-based conditional requests with `304 Not Modified`
- API: `GET /api/blobs/{key}`, document listing, markdown view, stats

---

*Core platform API specification. Domain-specific API modules are documented in their
respective domain specs.*
