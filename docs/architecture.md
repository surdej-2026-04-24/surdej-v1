# Surdej — Architecture Guide

> Platform design, conventions, and the mental model behind the Surdej framework.

---

## Overview

Surdej is a **generic starter framework** — a forkable monorepo that provides authentication, skinning, AI chat, worker orchestration, knowledge management, and a convention-based extensibility model. No domain-specific business logic ships in the core.

Derived projects extend Surdej by adding **domain manifests**, **workers**, and **API plugins** without modifying core code.

---

## Core Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Generic over specific** | No domain logic in core packages |
| 2 | **Command-driven navigation** | Every page is a command; no direct `<Link>` routing |
| 3 | **Convention over import** | Domains extend via manifests, not imports |
| 4 | **API is the sole integration point** | Frontend ↔ API only; no direct DB access from frontend |
| 5 | **Segmented Prisma schemas** | Each worker/domain owns its data in a separate schema |
| 6 | **Feature flags gate everything** | New features start at Ring 1 (Internal) |
| 7 | **Disposable lifecycle** | Every resource cleanup follows `IDisposable` |
| 8 | **TypeScript only** | Unified toolchain; Prisma for all data access |

---

## High-Level Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   API Server │────▶│  PostgreSQL  │
│   (Vite)     │     │  (Fastify)   │     │  (pgvector)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────┴───────┐
                    │   NATS       │
                    │  JetStream   │
                    └──────┬───────┘
               ┌───────────┼───────────┐
               ▼           ▼           ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐
         │ Worker 1 │ │ Worker 2 │ │ Worker N │
         └──────────┘ └──────────┘ └──────────┘
```

### Component Responsibilities

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Frontend** | Vite 7 + React 19 | 4001 | SPA shell, command system, skin engine |
| **API Server** | Fastify | 5001 | REST API, auth, domain plugins, AI chat |
| **PostgreSQL** | pgvector on pg15 | 5432 | Persistent storage, vector embeddings |
| **NATS** | JetStream | 4222 | Job routing, worker communication |
| **Workers** | TypeScript (tsx) | — | Background processing, domain-specific |

---

## The Command System

The command system is the backbone of navigation and actions in Surdej. Every page, every action, every keyboard shortcut is a **command**.

```typescript
// Registering a command
commandRegistry.register({
    id: 'navigate.knowledge.articles',
    title: 'Knowledge Articles',
    icon: 'BookOpen',
    when: 'isAuthenticated',
    handler: () => navigate('/knowledge/articles'),
});
```

**Key rules:**
- Every route has an associated command
- Sidebar items reference commands, not URLs
- The command palette (⌘K) searches all registered commands
- `when` clauses filter visibility using context key expressions

---

## Context Keys

Context keys are reactive boolean/string values that control command visibility and UI state:

```typescript
// Well-known context keys
isAuthenticated     // User is logged in
isDemo              // Running in demo mode
skinId              // Current active skin ID
sidebar.collapsed   // Sidebar is collapsed
palette.open        // Command palette is open
```

Commands use `when` clauses to conditionally appear:
```typescript
when: 'isAuthenticated && !isDemo'
```

---

## The Skin System

Skins control the **branding and sidebar composition** — not just colors, but which commands appear in the sidebar and in what order.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Skin Record │────▶│ User Pref    │────▶│ Active Sidebar  │
│ (DB)        │     │ (DB)         │     │ Items           │
└─────────────┘     └──────────────┘     └─────────────────┘
```

- **Skin** = shared record (branding + sidebar items + theme)
- **UserSkinPreference** = per-user join (default, active, custom order)
- Built-in skins are seeded and immutable
- Users can clone and customize skins

---

## Domain Extensibility Model

Domains extend the platform through **manifests** — declarative files that register commands, routes, sidebar items, and topologies:

```typescript
// domains/pdf-refinery/manifest.ts
export const manifest: DomainManifest = {
    id: 'pdf-refinery',
    name: 'PDF Refinery PDF Refinery',
    version: '1.0.0',
    commands: [
        { id: 'domain.pdf-refinery.refinery', title: 'PDF Refinery Dashboard', icon: 'FileStack' },
    ],
    routes: [
        { path: '/pdf-refinery', commandId: 'domain.pdf-refinery.refinery', component: 'pages/RefineryDashboard' },
    ],
    sidebarItems: [
        { commandId: 'domain.pdf-refinery.refinery', group: 'PDF Refinery', order: 1 },
    ],
    topologies: ['pdf-refinery-architecture', 'pdf-refinery-data-flow'],
    activateOn: 'isAuthenticated',
};
```

### Extension Points

| Extension Point | Location | Discovery |
|----------------|----------|-----------|
| **Frontend domain** | `apps/frontend/src/domains/<name>/manifest.ts` | Vite plugin scan at build |
| **API plugin** | `apps/api/src/domains/<name>/plugin.ts` | Auto-discovered at startup |
| **Worker** | `workers/<name>/` | Registers via NATS on start |
| **Topology** | `domains/<name>/topologies/*.ts` | Referenced in manifest |
| **Skin** | `apps/frontend/src/skins/<name>/manifest.ts` | Vite plugin scan at build |

---

## Worker Architecture

Workers are standalone TypeScript processes that connect to NATS and process jobs:

```typescript
const worker = new WorkerBase({
    type: 'pdf-refinery',
    version: '1.0.0',
    capabilities: ['extract-text', 'ocr', 'analyze', 'embed'],
    maxConcurrency: 4,
    prismaSchema: 'pdf_refinery',
});

worker.handle('job.pdf-refinery.extract-text', async (job) => {
    // Process the job...
    return { status: 'completed', pages: 42 };
});

worker.start();
```

### Worker Lifecycle

```
  start()
    │
    ▼
  Connect NATS → Register (worker.register) → Subscribe to jobs
    │
    ▼
  Heartbeat loop (every 30s)
    │              │
    ▼              ▼
  Process jobs   Health state machine:
                 healthy → degraded → unhealthy → offline
    │
    ▼
  drain() → Finish active jobs → Deregister → Disconnect
```

### NATS Subject Conventions

| Pattern | Purpose |
|---------|---------|
| `job.<domain>.<action>` | Job request (e.g. `job.pdf-refinery.extract-text`) |
| `worker.register` | Worker registration |
| `worker.heartbeat` | Worker health check (30s interval) |
| `worker.deregister` | Worker graceful shutdown |
| `event.<domain>.<event>` | Domain events |
| `dlq.<domain>.<action>` | Dead letter queue |

---

## Topology System

Topologies are declarative graphs describing infrastructure, code structure, or data flow. The platform provides a Google Maps-like viewer; derived projects provide the data.

```
TopologyDefinition
  ├── layers[]  (toggleable, like map layers)
  │   └── nodes[]  (recursive, with children)
  ├── actors[]  (external entities)
  └── connections[] (edges between nodes)
```

### Topology Types

| Type | Generated By | Shows |
|------|-------------|-------|
| `infrastructure` | `cli:topology:infra` | Docker, AKS, Azure, Cloudflare |
| `codebase` | `cli:topology:code` | Packages, apps, workers, routes |
| `data-flow` | `cli:topology:flow` or manual | NATS subjects, API endpoints, pipelines |

---

## Database Design

Surdej uses **segmented Prisma schemas**. Each domain/worker owns its data in a separate PostgreSQL schema:

| Schema | Owner | Tables |
|--------|-------|--------|
| `public` | Core API | User, Session, FeatureFlag, Skin, AiConversation, etc. |
| `knowledge` | Knowledge worker | Article, Template, TrainingSession, etc. |
| `pdf_refinery` | PDF Refinery worker | (planned) |
| `laka_dispatch` | LAKA Dispatch worker | (planned) |

**Key rule:** Workers never cross-reference schemas. Each schema has its own migration directory.

---

## Feature Flags

Features follow a **ring model** for progressive rollout:

| Ring | Name | Audience |
|------|------|----------|
| 1 | Internal | Development team only |
| 2 | Beta | Opted-in beta testers |
| 3 | Preview | Selected user group |
| 4 | Stable | All users |

```typescript
// Checking a feature
const isEnabled = useFeature('feature.ai.chat');
```

---

## AI Capabilities

| Capability | Model | Use Case |
|-----------|-------|----------|
| Chat (low) | gpt-4o-mini | Quick questions, summaries |
| Chat (medium) | gpt-4o | Complex reasoning, analysis |
| Chat (reasoning) | o3 | Deep reasoning, planning |
| Embeddings | text-embedding-3-small | RAG vector search |
| Classification | gpt-4o | Email/document classification |

AI access is brokered through the API — the frontend never holds API keys.

---

## See Also

- [Getting Started](./getting-started.md)
- [Domain Extension Guide](./domain-extension.md)
- [Worker Development Guide](./worker-development.md)
- [Skin Creation Guide](./skin-creation.md)
- [Deployment Guide](./deployment.md)
