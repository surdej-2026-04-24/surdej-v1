# Synopsis: Surdej v1

This document outlines the core concepts and architecture of the Surdej v1 framework, based on the codebase at `/Users/niels/Code/surdej-v1`.

## What is Surdej?

**Surdej** ("sourdough" in Danish) is a **generic application framework starter**. It serves as a production-ready monorepo template for building scalable web applications.

### Core Philosophy

1.  **Generic Foundation**: Surdej provides the platform (auth, UI, command system), but contains **NO domain-specific business logic**.
2.  **The Sourdough Pattern**: Projects fork Surdej, add their unique "flavor" (domain logic), and improvements to the core platform are back-ported to Surdej for everyone's benefit.
3.  **Extensibility by Convention**: Features are added via well-defined extension points (manifests, standardized folder structures) rather than tight coupling.

## Key Technical Pillars

*   **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui.
*   **Backend**: Fastify API, Prisma ORM, PostgreSQL.
*   **Architecture**:
    *   **Command System**: Every user action is a registered command (accessible via ⌘K palette).
    *   **Skinning System**: UI theming and sidebar navigation are dynamic and defined by "skins".
    *   **Worker Queues**: Heavy lifting is offloaded to NATS JetStream workers.
*   **AI Integration**: Built-in support for Vercel AI SDK, allowing for chat and tool use.

## Project Structure

The codebase is organized as a monorepo:

*   `apps/frontend`: Recent React application.
*   `apps/api`: Fastify REST API.
*   `packages/core`: Shared platform logic.
*   `workers/`: Standalone background workers.

---

*This synopsis is a living document and will be expanded with more details.*
    {
      id: "domain.my-domain.dashboard",
      label: "My Domain Dashboard",
      icon: "Briefcase",
      keywords: ["my-domain", "dashboard"],
      category: "domain",
      target: { type: "route", path: "/domains/my-domain" },
    },
  ],
  routes: [
    { path: "/domains/my-domain", lazy: () => import("./pages/DashboardPage") },
    { path: "/domains/my-domain/:id", lazy: () => import("./pages/DetailPage") },
  ],
  contextKeys: [
    { key: "domain.my-domain.hasData", type: "boolean", default: false },
  ],
  sidebarItems: [
    { commandId: "domain.my-domain.dashboard", group: "domain" },
  ],
} as const;
```

The Vite plugin auto-discovers all `src/domains/*/manifest.ts` at build time.
No central `domains/index.ts` to maintain. Drop a folder, restart dev server, done.

For optional type safety during development, domains may use `@surdej/types` (types-only,
never bundled): `import type { DomainManifest } from "@surdej/types";`

#### Step 2: Add to skin sidebar

```typescript
// skins/my-brand/manifest.ts — sidebar entry
sidebarItems: [
  { commandId: "domain.my-domain.dashboard", group: "domain" },
]
```

### API Domain Module

```
apps/api/src/domains/my-domain/
├── plugin.ts              # ★ Auto-discovered by API server at startup
├── routes.ts
├── service.ts
├── schema.ts              # Zod schemas
└── types.ts
```

```typescript
// domains/my-domain/plugin.ts
import type { FastifyInstance } from "fastify";

export default async function (app: FastifyInstance) {
  const { myDomainRoutes } = await import("./routes");
  app.register(myDomainRoutes, { prefix: "/api/domains/my-domain" });
}
```

The API server scans `src/domains/*/plugin.ts` at startup. No central registration file.

---

## 16. Adding a Domain Worker (Standalone)

Workers are **fully standalone** TypeScript projects. They communicate with the platform
exclusively through NATS subjects and their own Prisma schema. No imports from `@surdej/core`.

1. Create `workers/my-worker/` with `package.json`, `tsconfig.json`, `Dockerfile`.
2. Add a Prisma schema at `workers/my-worker/prisma/schema/my_worker.prisma`.
3. Connect to NATS and register via `worker.register` subject.
4. Subscribe to job subjects: `job.my-worker.<action>`.
5. Add to `docker-compose.yml` under the `workers` profile.
6. Add K8s manifests in `infra/k8s/my-worker/`.

```typescript
// workers/my-worker/src/index.ts
// No imports from @surdej/core — fully standalone
import { connect, JSONCodec } from "nats";

const nc = await connect({ servers: process.env.NATS_URL ?? "nats://localhost:4224" });
const codec = JSONCodec();

// Register with the worker registry (convention: worker.register subject)
await nc.publish("worker.register", codec.encode({
  workerId: crypto.randomUUID(),
  workerType: "my-worker",
  version: "1.0.0",
  capabilities: ["process-thing"],
  prismaSchema: "my_worker",
  maxConcurrency: 5,
}));

// Subscribe to jobs (convention: job.<type>.<action>)
const sub = nc.subscribe("job.my-worker.*");
for await (const msg of sub) {
  const action = msg.subject.split(".").pop();
  const payload = codec.decode(msg.data);
  const result = await handlers[action](payload);
  msg.respond(codec.encode(result));
}
```

Workers can be developed in **completely separate git repositories**. They only need NATS
connection details and knowledge of message conventions. See `specs/core/16-extensibility-model.md`.

---

## 16a. Module System (Self-Registering Feature Modules)

Modules are **self-contained business feature packages** that live in `modules/`. Unlike domain
extensions (§15), modules are fully standalone vertical slices with their own worker, UI components,
shared DTOs, and database schema — all connected to the core API via NATS-driven discovery.

### Module Structure

```
modules/
└── member-example/              # Naming convention: member-<feature>
    ├── shared/                  # Zod DTOs shared between worker and UI
    │   ├── package.json         # @surdej/module-<name>-shared
    │   └── src/
    │       ├── index.ts
    │       └── schemas.ts       # Zod schemas + TypeScript types
    ├── worker/                  # Standalone Fastify HTTP server
    │   ├── package.json         # @surdej/module-<name>-worker
    │   ├── prisma/schema/       # Own Prisma schema (PostgreSQL schema = module name)
    │   │   └── member_example.prisma
    │   └── src/
    │       ├── server.ts        # HTTP server + NATS registration
    │       └── routes.ts        # Module routes (CRUD)
    └── ui/                      # React components package
        ├── package.json         # @surdej/module-<name>-ui
        └── src/
            ├── index.ts
            ├── hooks/           # useModuleApi() — calls /api/module/<name>
            └── components/      # React components
```

### Shared DTOs (Zod)

The `shared/` package contains Zod schemas that define the API contract. Both the worker
(server-side validation) and the UI (client-side validation) import from the same schemas:

```typescript
// modules/member-example/shared/src/schemas.ts
import { z } from 'zod';

export const MODULE_NAME = 'member-example';

export const CreateItemSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
});
export type CreateItem = z.infer<typeof CreateItemSchema>;
```

### NATS Self-Registration

When a module worker starts, it connects to NATS and publishes `module.register`:

```typescript
nc.publish('module.register', codec.encode({
    moduleId: 'unique-instance-id',
    moduleName: 'member-example',
    version: '0.1.0',
    baseUrl: 'http://localhost:7001',  // Worker's HTTP endpoint
    routes: ['GET /', 'POST /', 'PUT /:id', 'DELETE /:id'],
}));
```

The worker sends heartbeats every 30s on `module.heartbeat` and publishes `module.deregister`
on shutdown.

### Core API Gateway

The core API server subscribes to `module.register` and dynamically proxies incoming requests:

```
Frontend → /api/module/member-example/items → Core API Gateway → http://localhost:7001/items
```

- **`/api/module`** — list all registered modules
- **`/api/module/<name>/*`** — proxy to the module's worker HTTP endpoint
- Unhealthy modules (90s without heartbeat) return `503 Service Unavailable`
- Unregistered modules return `404 Module not found`

### Prisma Schema Segment

Each module worker owns its own Prisma schema with a PostgreSQL schema name matching the
module name (hyphens replaced with underscores):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "member_example"]
}

model ExampleItem {
  id   String @id @default(uuid())
  name String
  @@schema("member_example")
}
```

### Package Names

| Component | Package Name |
|-----------|------|
| Shared DTOs | `@surdej/module-<name>-shared` |
| Worker | `@surdej/module-<name>-worker` |
| UI Components | `@surdej/module-<name>-ui` |

All module packages are part of the pnpm workspace (glob: `modules/*/*`).

### Rules for AI Agents

1. **One module per feature.** Each `member-*` folder is one vertical slice.
2. **Shared DTOs are mandatory.** Never duplicate Zod schemas between worker and UI.
3. **Modules self-register via NATS.** No manual route registration in the core API.
4. **Prisma schema name = module name** (underscores). Never share tables with core or other modules.
5. **UI calls `/api/module/<name>`** — never the worker directly.
6. **Workers are standalone.** No imports from `@surdej/core` or `apps/api`. Only from `shared/`.

---

## 17. Deployment

- **CI only** in GitHub Actions — build, test, lint. No auto-deploy.
- **Developer-controlled deploys** via `kubectl apply`.
- **Documentation-first releases** — each release gets a markdown doc in `releases/`.
- **Docker**: Multi-stage builds → GHCR (multi-platform: amd64 + arm64).
- **Infra**: AKS (Azure, Sweden Central), Cloudflare Zero Trust, Azure Key Vault.

---

## 18. Core & Derived Projects Strategy

Surdej uses a **core-plus-copies** distribution model. `surdej-v1` is the **core project** —
the canonical upstream that contains all generic platform functionality. Derived projects
(e.g., `surdej-test-nexi`, `surdej-test-pdf-refinery`) are **full copies** of the core, each living
in its own Git repository, with domain-specific additions layered on top.

### Why Full Copies (Not Forks)

- Each derived project is an independent, deployable application.
- Domain teams can move at their own pace without core release pressure.
- No complex monorepo tooling or package versioning.
- Copy-based approach means any developer can understand the full system by reading one repo.

### Project Hierarchy

```
surdej-v1  (core — canonical upstream)
  ├── surdej-test-nexi     (derived — Nexi/LAKA domain)
  └── surdej-test-pdf-refinery   (derived — PDF Refinery/Surdej domain)
```

All projects share the same structure. The key difference is the `domains/` and `skins/` folders:

| Folder | In Core (surdej-v1) | In Derived Projects |
|--------|---------------------|---------------------|
| `core/` | ✅ Maintained here | 🔒 Synced from core — avoid local edits |
| `domains/` | ❌ Empty | ✅ Domain-specific code lives here |
| `skins/` | Default skin only | ✅ Project-specific skins added here |
| `docker-compose.yml` | Core config (ports 5001/4001) | Adjusted ports per instance |
| `surdej.yaml` | Source of truth for version | Carries `based_on` to track sync point |

### The `surdej.yaml` Manifest

Every project has a `surdej.yaml` in its root. This is the **version synchronization anchor**.

**In the core (`surdej-v1/surdej.yaml`):**

```yaml
version: "1.2.0"                    # Updated on every git tag
repository: "https://github.com/happy-mates/surdej-v1.git"
derived:
  - name: surdej-test-nexi
    repository: "https://github.com/happy-mates/surdej-test-nexi.git"
    ports:
      frontend: 4002
      api: 5002
      helper: 6002
```

**In a derived project (`surdej-test-nexi/surdej.yaml`):**

```yaml
based_on:
  core_repository: "https://github.com/happy-mates/surdej-v1.git"
  core_version: "1.1.0"             # Last synced core tag
project:
  name: surdej-test-nexi
  ports:
    frontend: 4002
    api: 5002
    helper: 6002
```

### Version & Tagging Workflow

1. **Develop in core.** All generic platform features go into `surdej-v1`.
2. **Tag a release.** When ready, create a git tag (e.g., `v1.2.0`) on `surdej-v1`.
3. **Update `surdej.yaml`.** The `/release` workflow updates the `version` field in `surdej.yaml`
   to match the new tag.
4. **Sync derived projects.** When ready to update a derived project, compare:
   - What changed in `surdej-v1` between the derived project's `core_version` and the latest tag.
   - Apply those changes to the derived project, excluding `domains/` and `skins/`.
5. **Bump `core_version`.** After sync, update `based_on.core_version` in the derived project's
   `surdej.yaml`.

### Synchronization (AI-Assisted Diff)

When asked to sync a derived project, AI agents should:

1. Read `surdej.yaml` in both the core and the target derived project.
2. Identify the version gap: `based_on.core_version` → current core `version`.
3. Diff the `core/`, `packages/`, `apps/api/src/core/`, and infrastructure files.
4. **Exclude** from sync: `domains/`, `skins/` (except default), `docker-compose.yml` port configs,
   `surdej.yaml` itself, and any files in project-specific `.gitignore`.
5. Present the diff and apply changes with developer approval.

### Port Allocation

Each instance uses a unique port set to allow simultaneous local development:

| Instance | Preview (build) | Dev (HMR) | API | Helper |
|----------|-----------------|-----------|-----|--------|
| `surdej-v1` (core) | 3001 | 4001 | 5001 | 5050 |
| `surdej-test-nexi` | 3002 | 4002 | 5002 | 6002 |
| `surdej-test-pdf-refinery` | 3003 | 4003 | 5003 | 6003 |

When adding a new derived project, allocate the next available port set and register it
in the core `surdej.yaml`.

### Docker Compose Isolation

Each derived project uses a unique `COMPOSE_PROJECT_NAME` to avoid container conflicts:

```bash
COMPOSE_PROJECT_NAME=surdej-nexi docker compose up -d       # Nexi
COMPOSE_PROJECT_NAME=surdej-pdf-refinery docker compose up -d     # PDF Refinery
```

This gives each instance its own isolated network, volumes, and container names.

### Rules for AI Agents

1. **Core changes go in `surdej-v1`.** If a change is generic (not domain-specific), make it
   in the core project. Never add generic features only in a derived project.
2. **Domain changes go in the derived project.** Business logic, domain skins, domain workers,
   and domain API routes belong in `domains/`, `skins/`, or `workers/` of the derived project.
3. **Respect port assignments.** When editing configs (vite, docker-compose, server.ts, helper),
   always use the ports from `surdej.yaml`.
4. **Track versions.** When creating a release in the core, update `surdej.yaml` version field.
5. **Sync on request.** When the user asks to update a derived project, follow the sync workflow above.
6. **Never overwrite domain code.** Sync operations must preserve `domains/` and `skins/` in
   the derived project.

---

*This document is the single source of truth for all AI agents and developers.
Last updated: 2026-02-18*
