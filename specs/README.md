# Surdej v1 — Specifications

> Consolidated requirements from **pdf-refinery-happymate-framework-v1** and **nexi-msops-knowledge-management-v1**.

Specs are split into **core** (generic platform — ships with Surdej) and **domain**
(project-specific — examples from derived projects).

```
specs/
├── README.md
├── core/                              ← generic platform (part of Surdej)
│   ├── 00-project-overview.md
│   ├── 01-architecture.md
│   ├── 02-frontend.md
│   ├── 03-api-backend.md
│   ├── 04-ai-capabilities.md
│   ├── 06-knowledge-management.md
│   ├── 08-auth-and-identity.md
│   ├── 09-feature-flags.md
│   ├── 10-devops-and-deployment.md
│   ├── 11-chrome-extension.md
│   ├── 12-cli-and-testing.md
│   ├── 13-vscode-patterns.md
│   ├── 14-mcp-handling.md
│   ├── 15-worker-registry.md
│   ├── 16-extensibility-model.md
│   └── 17-virtual-pages.md
└── domain/                            ← domain-specific (examples, not shipped)
    ├── nexi/
    │   └── 07-laka-dispatch.md
    └── pdf-refinery/
        └── 05-data-refinery.md
```

---

## Core Specs (Generic Platform)

| Document | Description |
|----------|-------------|
| [core/00-project-overview.md](core/00-project-overview.md) | Vision, goals, and scope — the sourdough pattern |
| [core/01-architecture.md](core/01-architecture.md) | Tech stack, monorepo structure, segmented Prisma schemas, TS workers |
| [core/02-frontend.md](core/02-frontend.md) | Frontend: UI, skinning, command system, accessibility |
| [core/03-api-backend.md](core/03-api-backend.md) | API server: Fastify, core Prisma schema, NATS, MCP endpoint |
| [core/04-ai-capabilities.md](core/04-ai-capabilities.md) | AI chat, multi-model routing, RAG pipeline, MCP tool integration |
| [core/06-knowledge-management.md](core/06-knowledge-management.md) | Article authoring, templates, approval workflows, training materials |
| [core/08-auth-and-identity.md](core/08-auth-and-identity.md) | Authentication, RBAC, demo mode, Entra ID, Firebase |
| [core/09-feature-flags.md](core/09-feature-flags.md) | Ring-based feature rollout system |
| [core/10-devops-and-deployment.md](core/10-devops-and-deployment.md) | CI/CD, Docker, Kubernetes, Cloudflare, release management |
| [core/11-chrome-extension.md](core/11-chrome-extension.md) | Browser extension ("Peeler-Mate") |
| [core/12-cli-and-testing.md](core/12-cli-and-testing.md) | CLI tooling, testing strategy, schema management |
| [core/13-vscode-patterns.md](core/13-vscode-patterns.md) | VS Code architectural patterns (Disposable, Context Keys, Events, DI) |
| [core/14-mcp-handling.md](core/14-mcp-handling.md) | Model Context Protocol — server + client, tool exposure, transports |
| [core/15-worker-registry.md](core/15-worker-registry.md) | Server-side worker registry, health monitoring, job routing |
| [core/16-extensibility-model.md](core/16-extensibility-model.md) | Convention-based extensibility: manifests, discovery, standalone workers |
| [core/17-virtual-pages.md](core/17-virtual-pages.md) | Lovable-style browser page builder: TSX editor, sandboxed preview, AI chat, virtual commands |

## Domain Specs — PDF Refinery

| Document | Description |
|----------|-------------|
| [domain/pdf-refinery/05-data-refinery.md](domain/pdf-refinery/05-data-refinery.md) | PDF pipeline, rental property analysis, `pdf_refinery` Prisma schema |

## Domain Specs — Nexi

| Document | Description |
|----------|-------------|
| [domain/nexi/07-laka-dispatch.md](domain/nexi/07-laka-dispatch.md) | AI email routing for LAKA key accounts, `laka_dispatch` Prisma schema |

---

*Last updated: 2026-02-14*
