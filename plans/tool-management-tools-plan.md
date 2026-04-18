# Tool Management Tools Module — Implementation Plan

**Module path:** `modules/tool-management-tools/`
**Member name:** `tool-management`
**Subject:** `tools`
**Entity name:** `Tool`
**Description:** Manage tool definitions, categories, enablement, and routing for portal/extension use cases.

---

## Overview

This module provides a vertical-slice backend + UI for registering, enabling/disabling, and
discovering tools that power the portal and browser extension. It replaces any mock data with a
real Prisma-backed store and exposes a NATS-discoverable API.

## Package Layout

```
modules/tool-management-tools/
├── shared/          # Zod DTOs shared by worker + UI
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── schemas.ts
│       └── index.ts
├── worker/          # Fastify HTTP server + NATS registration + Prisma
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema/
│   │       └── tool_management_tools.prisma
│   └── src/
│       ├── server.ts
│       └── routes.ts
└── ui/              # React components + API hook
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── components/
        │   ├── ToolList.tsx
        │   └── ToolForm.tsx
        ├── hooks/
        │   └── useModuleApi.ts
        ├── commands.ts
        └── index.ts
```

---

## Phase 1 — Structure, DTOs, Scaffolding (current)

- [x] Create `shared/` package with Zod DTOs
- [x] Create `worker/` package with Fastify + in-memory store (pre-Prisma)
- [x] Create `ui/` package with React components
- [x] Register module in `moduleRegistry.ts`
- [x] Register commands in `useCommands.ts`
- [x] Add frontend route pages
- [x] Plans document (this file)

## Phase 2 — Database Integration

- [ ] Run `prisma migrate dev` to create `tool_management_tools` schema
- [ ] Replace in-memory store in `routes.ts` with Prisma client calls
- [ ] Add `tenantId` filtering for multi-tenant isolation
- [ ] Seed built-in tools (web search, RAG, page context, pdf-refinery housing, etc.)

## Phase 3 — Extension Integration

- [ ] Wire extension use-case selection to the tool registry
- [ ] Allow per-use-case prompt templates stored in the DB
- [ ] Expose `/api/module/tool-management-tools/use-cases` endpoint
- [ ] Add session context (use-case ID, prompt prefix) to AI conversation metadata

## Phase 4 — Advanced Features

- [ ] Tool enable/disable toggle with audit log
- [ ] Category-based filtering (search, analysis, generation, etc.)
- [ ] Slash-command routing: `/prospekt <ID> <action>` → tool dispatch
- [ ] CLI integration via `cli/` package
- [ ] Skin/sidebar item registration for all relevant skins

---

## Data Model

```prisma
model Tool {
    id          String   @id @default(uuid())
    tenantId    String?
    name        String                      // e.g. "web_search"
    label       String                      // e.g. "Web Search"
    description String?
    category    String   @default("general") // "search", "analysis", "generation", "context"
    icon        String?                     // Lucide icon name
    isEnabled   Boolean  @default(true)
    isBuiltIn   Boolean  @default(false)
    metadata    Json?                       // arbitrary config
    useCases    String[] @default([])       // associated use-case IDs
    promptTemplate String? @db.Text        // session prompt prefix for this tool
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    deletedAt   DateTime?
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | /    | List all tools |
| GET    | /:id | Get tool by ID |
| POST   | /    | Create tool |
| PUT    | /:id | Update tool |
| DELETE | /:id | Soft-delete tool |
| PATCH  | /:id/toggle | Toggle enabled/disabled |
| GET    | /use-cases | List distinct use-case IDs |

## NATS Subjects

| Subject | Purpose |
|---------|---------|
| `module.register` | Self-registration on startup |
| `module.heartbeat` | Periodic keep-alive |
| `module.deregister` | Graceful shutdown |
| `module.tool-management-tools.>` | Module-scoped events |

## Port

`7005` (next available after 7004 in existing modules)

---

## Next Steps

1. Run `pnpm install` from the repo root to link workspace packages.
2. Run `cd modules/tool-management-tools/worker && pnpm db:generate` once Postgres is available.
3. Run `pnpm db:migrate` to create the database schema.
4. Start the worker: `pnpm --filter @surdej/module-tool-management-tools-worker dev`.
5. The gateway auto-discovers the module via NATS at `/api/module/tool-management-tools/`.
