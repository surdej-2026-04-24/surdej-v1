# Surdej v1 — AI & Developer Instructions

> **This is the canonical source of truth.** All AI tool-specific instruction files
> (`.github/instructions/`, `CLAUDE.md`, `.antigravity/`) reference this document.

---

## 1. What Is This Project?

**Surdej** (Danish: "sourdough") is a **generic application framework starter** — a production-ready
monorepo template that projects fork and build upon. It provides platform-level systems (skinning,
auth, feature flags, AI chat, feedback, accessibility) and defines clear extension points where
derived projects add their domain-specific logic.

**Surdej upstream** aims to stay generic — no domain-specific business logic in the upstream repo.
Derived projects are free to evolve in any direction, including modifying core code when needed.

### The Sourdough Pattern

1. New project **forks** Surdej as its starting point.
2. Project evolves **freely** — adding domain code, modifying core, changing patterns as needed.
3. Useful **generic** improvements are **AI-assisted back-consolidated** into Surdej upstream.
4. Surdej upstream grows. Improvements are **AI-assisted forward-propagated** to other copies.
5. Each instance can diverge; back-consolidation and forward-propagation are selective, not forced.

> **AI-assisted evolution**: Back-consolidation (instance → Surdej) and forward-propagation
> (Surdej → instances) are performed with AI tooling. There are no hard merge constraints —
> each copy is free to accept, reject, or adapt changes.

### Extensibility Principle

**Prefer convention over import.** Domain extensions are easiest to manage when they plug into
the platform through well-known file locations, manifest objects, and runtime discovery.
However, derived projects may modify or extend any part of the codebase as their needs evolve.
See §15 and spec `16-extensibility-model.md`.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui (new-york style), Lucide React |
| **UI Components** | shadcn/ui — Button, Card, Dialog, DropdownMenu, Input, Label, Badge, Tooltip, Avatar, Separator, Switch |
| **State** | React Context (Auth, Features, Feedback, Accessibility) + Zustand (Skins, Commands) |
| **Command System** | Central command registry, ⌘K command palette (cmdk) |
| **Routing** | React Router DOM (navigations triggered via commands, not direct links) |
| **API** | Fastify, Prisma ORM, Zod |
| **Database** | PostgreSQL + pgvector, segmented Prisma schemas per domain/worker |
| **Message Queue** | NATS JetStream (worker communication, job dispatch, events) |
| **Workers** | TypeScript only — each worker owns its own Prisma schema segment |
| **AI** | Vercel AI SDK, Azure OpenAI, AI Foundry (Claude) |
| **MCP** | Model Context Protocol — server (expose tools) + client (consume external) |
| **Auth** | MSAL / Entra ID, Firebase (planned), Demo mode |
| **Package Manager** | pnpm (workspaces) |
| **Node** | ≥ 20 |
| **Build/Deploy** | Docker, Kubernetes (AKS), Cloudflare Zero Trust, GHCR |

### Integration Boundary

The **REST API is the only integration point** between the frontend and everything else.
The frontend never connects to NATS, Prisma, PostgreSQL, workers, Azure Key Vault, or
external services directly. All data flows through the Fastify API:

```
Frontend ──HTTP/REST──▶ API ──┬──▶ PostgreSQL (Prisma)
                              ├──▶ NATS → Workers
                              ├──▶ Azure OpenAI / AI Foundry
                              ├──▶ MCP Servers
                              ├──▶ Blob Storage
                              └──▶ CAKE / Key Vault
```

This means:
- **No AI SDK providers in the frontend.** AI chat uses the API's streaming endpoint, not
  direct `@ai-sdk/azure` calls from the browser.
- **No NATS client in the frontend.** Job dispatch and events go through API routes.
- **No Prisma in the frontend.** All database access is behind API endpoints.
- **No direct Azure/Graph calls from the frontend** (except MSAL auth token acquisition).

---

## 3. Project Structure

```
surdej-v1/
├── .surdej/agents/guidelines/   # ← THIS FILE (canonical AI instructions)
│   ├── instructions.md
│   ├── ai-config.md             # AI instruction strategy docs
│   └── PROVISIONING.md          # Provisioning docs
├── .github/
│   ├── instructions/
│   │   └── copilot-instructions.md  # GitHub Copilot proxy
│   └── prompts/                 # Custom slash commands
├── .antigravity/
│   └── instructions.md          # Antigravity proxy
├── CLAUDE.md                    # Claude Code adapter
├── apps/
│   ├── api/                     # Fastify + Prisma API (port 5001)
│   │   └── src/
│   │       ├── core/            # Generic API modules (auth, health, ai, etc.)
│   │       └── domains/         # ★ Domain-specific API modules go here
│   ├── frontend/                # React + Vite web app
│   │   └── src/
│   │       ├── core/            # Generic UI (contexts, components, services, hooks)
│   │       ├── domains/         # ★ Domain-specific pages/components go here
│   │       └── skins/           # ★ Skin definitions go here
│   ├── extension/               # Chrome extension
│   ├── helper/                  # Express dev-mode bridge (opens files in VS Code)
│   └── proxy/                   # Caddy reverse proxy
├── contracts/                   # Extension contracts (JSON schemas + .d.ts)
│   ├── domain-manifest.schema.json
│   ├── domain-manifest.d.ts
│   ├── worker-messages.schema.json
│   ├── worker-messages.d.ts
│   ├── skin-manifest.schema.json
│   └── skin-manifest.d.ts
├── modules/                     # ★ Self-contained feature modules (preferred for domain features)
│   └── member-example/          #   Naming: member-<feature>
│       ├── shared/              #   Zod DTOs (@surdej/module-<name>-shared)
│       ├── worker/              #   Standalone Fastify server + NATS + Prisma
│       └── ui/                  #   React components (@surdej/module-<name>-ui)
├── packages/
│   └── core/                    # @surdej/core — internal platform code
├── workers/                     # NATS JetStream workers (standalone)
├── infra/
│   └── k8s/                     # Kubernetes manifests
├── scripts/                     # Dev & ops scripts
├── specs/                       # Specifications & requirements
│   ├── core/                    # Generic platform specs
│   └── domain/                  # Domain-specific specs (nexi/, pdf-refinery/)
├── docs/                        # Documentation
├── docker-compose.yml
├── Dockerfile
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

### Guideline: `core/` vs `modules/` vs `domains/`

| Folder | Contents | Typical Surdej upstream | Typical in derived projects |
|--------|----------|------------------------|----------------------------|
| `core/` | Platform code (auth, skins, flags, AI, feedback) | Generic patterns, no domain logic | Modify freely — consider back-consolidating generic improvements |
| `modules/` | **Self-contained feature modules** (shared DTOs + worker + UI) | Example module (`member-example`) | **Preferred approach** for domain-specific features |
| `domains/` | Domain-specific code embedded in frontend/API | Empty (examples only) | Alternative for lighter-weight features that don't need a standalone worker |
| `skins/` | Skin definitions (sidebar items, theme, branding) | Default skin | Add project-specific skins, modify default as needed |

> **Modules are the preferred strategy** for domain-specific functionality. Each module is a
> self-contained vertical slice with its own worker, UI components, shared Zod DTOs, and database
> schema — connected to the core API via NATS-driven self-registration (see §16a).
>
> **No hard boundaries.** Derived projects may modify `core/`, `modules/`, `domains/`, `skins/`,
> or any other part of the codebase. When you improve `core/` in a derived project, consider
> back-consolidating the change to Surdej upstream so other copies benefit.

---

## 4. Command System

The frontend is anchored in a **command system**. Every user-facing action — navigation,
UI toggles, domain operations, tool invocations — is a registered **command**.
Sidebar items, keyboard shortcuts, and the command palette all execute commands.
Nothing in the UI navigates or acts directly; everything goes through the command registry.

### Application Layout

Single layout shell (`routes/layout.tsx`) with these regions, all wrapped in
`WireframeElement` for inspection:

| Region | Contents |
|--------|----------|
| **Sidebar** (264px, collapsible) | Logo/branding header → skin-driven nav items → user avatar dropdown footer |
| **Header / Topbar** (64px) | Hamburger/collapse → breadcrumbs → toolbar: Feedback, Language, QuickChat, Help, Tools, Theme, Fullscreen, Status |
| **Main Content** | `<Outlet />` (routed pages) |
| **Footer** | Version label → Ring badge (user's current ring level) → Active skin name |

Provider hierarchy: `AccessibilityProvider > AuthProvider > FeatureProvider > SkinProvider > WireframeProvider > App`.

### Quick Chat (Toolbar Flyover)

HeaderToolbar’s **MessageCircle** icon toggles a compact AI chat flyover (420px, top-right).
Streams from `/api/ai/chat` (SSE). Escape to close. "Open full chat →" links to `/chat`.

### Wireframe Mode

Toggle via **⌃⌥⌘W** or **⌘K → "Toggle Wireframe Mode"** or Developer page card.
Every high-level layout region is wrapped in `WireframeElement` — when active, each shows
a dashed outline + floating name/description label. Nested depth gets different colours
(red → blue → emerald → amber → purple). Escape to exit. A "🔲 Wireframe" badge appears in
the footer when active. Domain modules should wrap their own high-level components the same way.

Implementation: `core/wireframe/WireframeContext.tsx` (provider + state), `core/wireframe/WireframeElement.tsx` (display component).

### Dev Inspector (Ctrl+Option+Hover)

Toggle via **⌘K → "Toggle Dev Inspector"** or Developer page card. Once active, hold
**Ctrl+Option** (⌃⌥) and hover over any element to see a floating tooltip with:
- `data-component` name (walks up DOM tree to find nearest)
- Element tag, id, and CSS classes
- Element dimensions
- ARIA role/label attributes

Escape to exit. Complementary to wireframe mode: wireframe shows the full structure;
dev inspector inspects one element at a time.

Implementation: `core/devtools/DevInspector.tsx`. Convention: `<div data-component="MyWidget">`
(WireframeElement sets this automatically).

### Helper API (Dev Mode Only)

Local Express server (`apps/helper/`) that bridges the frontend to the developer’s editor.
Binds to `127.0.0.1`, bearer-token auth, runs only during development.

| Endpoint | Purpose |
|----------|---------|
| `POST /open` | Open file in VS Code (`code --goto`) |
| `GET /read` | Read file contents or directory listing |
| `GET /health` | Status check |
| `GET /token` | Session token (origin-restricted) |

Frontend client: `lib/helper-client.ts` configured via `VITE_HELPER_PORT` / `VITE_HELPER_TOKEN`.

### Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Skin Layer  │────▶│  Command Layer   │────▶│  Target Layer    │
│              │     │                  │     │                  │
│  Sidebar     │     │  CommandRegistry │     │  Route           │
│  Palette ⌘K  │     │  (singleton)     │     │  External URL    │
│  Shortcuts   │     │                  │     │  Virtual Page    │
│  Context menu│     │  register()      │     │  Named Action    │
│              │     │  execute(id)     │     │                  │
└──────────────┘     │  search(query)   │     └──────────────────┘
                     └──────────────────┘
```

### Command Definition

```typescript
import type { CommandDefinition } from "@/core/commands/types";

const myCommand: CommandDefinition = {
  id: "navigate.my-domain.dashboard",     // Unique ID (namespace.group.action)
  label: "My Domain Dashboard",            // Human-readable label
  icon: "Briefcase",                       // Lucide icon name
  keywords: ["domain", "dashboard"],       // Search keywords for palette
  category: "navigation",                  // Grouping: navigation | action | tool | domain
  target: { type: "route", path: "/domains/my-domain" },  // What it does
  shortcut: "mod+shift+d",                 // Optional keyboard shortcut
  when: "isAuthenticated",                 // Optional context key expression
};
```

### Target Types

| Type | Description | Example |
|------|-------------|---------|
| `route` | Navigate to an internal route | `{ type: "route", path: "/chat" }` |
| `href` | Open an external URL | `{ type: "href", url: "https://..." }` |
| `virtual-page` | Render a virtual page (JSX compiled at runtime) | `{ type: "virtual-page", pageId: "my-page" }` |
| `action` | Run a named function | `{ type: "action", handler: () => void }` |

### CommandRegistry (Singleton)

```typescript
import { commandRegistry } from "@/core/commands/registry";

// Register commands (returns IDisposable)
const disposable = commandRegistry.register(myCommand);
const disposables = commandRegistry.registerMany(domainCommands);

// Execute
commandRegistry.execute("navigate.my-domain.dashboard");

// Search (fuzzy, for palette — respects `when` conditions)
const results = commandRegistry.search("dashboard");

// List by category
const navCommands = commandRegistry.byCategory("navigation");

// Listen for changes
commandRegistry.onDidRegister(id => { /* rebuild palette */ });

// Teardown
disposable.dispose();   // unregisters single command
disposables.dispose();  // unregisters all domain commands
```

### Command Palette (⌘K)

- Built with `cmdk` (shadcn Command component).
- Fuzzy search across all registered commands.
- Results grouped by category.
- Recent commands shown first.
- Footer trigger for discoverability.
- **All** navigable and actionable items are reachable via the palette.

### Well-Known Commands (built into Surdej core)

| Command ID | Target | Description |
|------------|--------|-------------|
| `navigate.home` | route `/` | Go to home/dashboard |
| `navigate.chat` | route `/chat` | Open AI chat |
| `navigate.settings` | route `/settings` | Open settings |
| `navigate.settings.features` | route `/settings/features` | Feature flags |
| `navigate.settings.accessibility` | route `/settings/accessibility` | Accessibility |
| `navigate.developer` | route `/developer` | Developer tools dashboard |
| `app.toggle-theme` | action | Toggle light/dark mode (⌘⇧T) |
| `app.toggle-sidebar` | action | Toggle sidebar visibility (⌘B) |
| `app.toggle-wireframe` | event | Toggle wireframe mode (⌃⌥⌘W) |
| `app.toggle-dev-inspector` | event | Toggle dev inspector (⌃⌥ hover) |
| `app.logout` | action | Sign out |

Derived projects register additional commands in their `domains/` modules.

### Guidelines for AI Agents

1. **Prefer commands for navigation.** Use `commandRegistry.execute("navigate.xxx")` or link sidebar items to command IDs rather than navigating directly.
2. **Prefer command IDs in sidebar items.** Sidebar items should reference command IDs. The command resolves to the target.
3. **New pages = new command.** Every new page/feature should have a corresponding registered command.
4. **Domain commands use namespace.** E.g. `domain.pdf-refinery.refinery`, `domain.nexi.dispatch`.
5. **Searchable by default.** All commands appear in the ⌘K palette unless explicitly hidden.
6. **Commands return Disposables.** `register()` returns `IDisposable`. Domain modules call `.dispose()` on teardown.
7. **Context key preconditions.** Commands may declare `when` conditions (e.g., `isAuthenticated && skinId == 'pdf-refinery'`). The palette hides commands whose `when` evaluates false.
8. **Typed events for registry changes.** `commandRegistry.onDidRegister` fires when commands are added — enables dynamic palette rebuilding.

---

## 5. Skinning System

The skinning system customizes the UI per deployment. **Skins reference commands, not routes.**

### What a Skin Controls

- **Sidebar navigation**: Which commands appear, their order, grouping, and icons.
- **Theme**: Light/dark mode defaults, CSS design tokens.
- **Branding**: Logo, app name, primary color, typography.
- **Feature visibility**: Skins can hide/show commands independent of feature flags.

### Skin Definition (TypeScript)

```typescript
// skins/my-brand.ts
import type { SkinDefinition } from "@/core/skins/types";

export const myBrandSkin: SkinDefinition = {
  id: "my-brand",
  name: "My Brand",
  branding: {
    appName: "My App",
    logo: "/assets/logo.svg",
    primaryColor: "#A6192E",
    fontFamily: "Montserrat",
  },
  sidebar: [
    { commandId: "navigate.home", group: "main" },
    { commandId: "navigate.chat", group: "main" },
    { commandId: "domain.my-domain.dashboard", group: "domain" },
    { commandId: "navigate.settings", group: "footer" },
  ],
  theme: {
    defaultMode: "light",
  },
};
```

> **Note:** Sidebar items only carry `commandId` and `group`. The label, icon, and target
> are resolved from the command registry. This keeps skins declarative and DRY.

### Built-in Skins

Surdej ships with one skin:

- **Default** — Neutral branding, core navigation commands (Home, Chat, Settings).

Derived projects add their own skins and set the active skin via configuration.

---

## 5a. Lifecycle (Disposable Pattern)

Inspired by VS Code internals (see `specs/core/13-vscode-patterns.md`). Every resource that needs
cleanup implements `IDisposable`. The core provides lifecycle utilities in `@/core/lifecycle/`.

```typescript
import { Disposable, DisposableStore, toDisposable } from "@/core/lifecycle";

// Base class for services with cleanup
class MyService extends Disposable {
  constructor() {
    super();
    // Subscriptions auto-disposed when MyService.dispose() is called
    this._register(someEmitter.onDidChange(() => { ... }));
    this._register(toDisposable(() => clearInterval(this.timer)));
  }
}

// Group multiple disposables for a domain module
const store = new DisposableStore();
store.add(commandRegistry.register(myCommand));
store.add(eventBus.on("change", handler));
// On module teardown:
store.dispose(); // cleans up all at once
```

### Rules
- `register()`, `on()`, `subscribe()` — any method that creates a binding must return `IDisposable`.
- Domain modules collect all disposables in a `DisposableStore` and dispose on unmount.
- Leak tracking is enabled in dev mode.

---

## 5b. Context Keys

Declarative state flags that drive conditional visibility of commands, sidebar items, and UI.

```typescript
import { RawContextKey } from "@/core/context-keys";

// Define well-known keys
const IS_AUTHENTICATED = new RawContextKey<boolean>("isAuthenticated", false);
const SKIN_ID = new RawContextKey<string>("skinId", "default");
const IS_DEMO = new RawContextKey<boolean>("isDemo", false);

// Bind and update
const key = IS_AUTHENTICATED.bindTo(contextKeyService);
key.set(true);
```

### When Clauses

Commands, sidebar items, and menus use `when` expressions for conditional visibility:

```typescript
const myCommand: CommandDefinition = {
  id: "domain.nexi.dispatch",
  label: "LAKA Dispatch",
  when: "isAuthenticated && skinId == 'nexi'",  // only visible in Nexi skin
  // ...
};
```

### Well-Known Context Keys

| Key | Type | Description |
|-----|------|-------------|
| `isAuthenticated` | boolean | User is logged in |
| `isDemo` | boolean | Demo mode active |
| `skinId` | string | Current skin identifier |
| `currentRoute` | string | Active route path |
| `sidebar.collapsed` | boolean | Sidebar is collapsed |
| `palette.open` | boolean | Command palette is open |
| `hasFeature.<id>` | boolean | Feature flag is enabled |

---

## 5c. Event System

Typed event emitters with disposable subscriptions (inspired by VS Code's `Emitter<T>`):

```typescript
import { Emitter, Event } from "@/core/event";

class MyService {
  private readonly _onDidChange = new Emitter<MyChangeEvent>();
  readonly onDidChange: Event<MyChangeEvent> = this._onDidChange.event;

  update(item: Item): void {
    // ... mutate state ...
    this._onDidChange.fire({ item });
  }
}

// Consumer — subscription is disposable
const disposable = myService.onDidChange(event => { ... });
disposable.dispose(); // unsubscribe
```

### Naming Convention
- `onDid*` — event fired **after** something happened.
- `onWill*` — event fired **before** something happens (can be cancelled).

---

## 6. Feature Flags (Ring System)

Progressive rollout via rings. Each user has a **ring level** (persisted to `localStorage`
as `surdej_user_ring`). Features are visible when `feature.ring <= userRing`.

| Ring | Name | Audience |
|------|------|----------|
| 1 | Internal | Developers only |
| 2 | Beta | Testers |
| 3 | Preview | Early adopters |
| 4 | Stable | All users |

The user's ring level is shown in the **footer status bar** and can be changed on the
**Feature Flags settings page** (`/settings/features`).

### Implementation

- **Context**: `core/features/FeatureContext.tsx` — `FeatureProvider`, `useFeature()`, `useFeatures()`
- **API**: Fetches from `/api/features`. Falls back to `DEFAULT_FEATURES` when API is unavailable.
- **Overrides**: Individual features can be toggled via the settings page. Overrides are stored
  in `localStorage` as `surdej_feature_{featureId}` and take priority over ring-based resolution.

### Using Feature Flags

```typescript
import { useFeature } from "@/core/features/FeatureContext";

// Returns true if the feature is enabled for the current user ring
const isEnabled = useFeature("my-feature-id");
```

### Adding a Feature Flag

Add to `DEFAULT_FEATURES` in `core/features/FeatureContext.tsx` (or the API response):

```typescript
{
  id: "unique-id",
  featureId: "my-feature",      // Used for useFeature() lookups
  title: "My Feature",
  description: "What it does",
  ring: 2,                       // 1=Internal, 2=Beta, 3=Preview, 4=Stable
  enabled: false,                // Default state when no override exists
}
```

---

## 7. Authentication

Pluggable auth controlled by `VITE_AUTH_PROVIDER`:

| Provider | Value | Use Case |
|----------|-------|----------|
| Entra ID | `entra` | Enterprise (MSAL, PKCE) |
| Firebase | `firebase` | Google/Microsoft/Email/Anonymous |
| Demo | `demo` | Development, workshops (always-on simulated auth) |
| None | `none` | Local development, no auth |

### Roles

`admin`, `super_admin`, `session_master`, `member`, `book_keeper`

### Demo Mode

- Seeded user database with selectable roles.
- Login screen with role selector overlay.
- Session persisted to `localStorage`.

---

## 8. Feedback & Annotation System

Built-in user feedback collection:

- **Screenshots**: Auto-captured, editable via `AnnotationEditor`.
- **Annotations**: Arrows, text, rectangles, circles, blur.
- **Recordings**: Voice and video.
- **Export**: PDF report (`jspdf`) and ZIP bundle (`jszip`).
- **Storage**: IndexedDB via `feedback-service.ts`.

---

## 9. AI Chat

Streaming chat with multi-model support:

- **SDK**: Vercel AI SDK (`@ai-sdk/azure`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
- **Models**: GPT-4o, GPT-4o-mini, o3, Claude (via AI Foundry)
- **Routing**: Automatic model selection based on task complexity
- **History**: Conversations persisted in IndexedDB
- **UI**: `/chat/[id]` with sidebar, streaming text, auto-titles

---

## 10. Accessibility

Managed by `AccessibilityContext`:

| Feature | Options |
|---------|---------|
| Theme | Light / Dark |
| High Contrast | AAA 7:1 ratios |
| Font Scaling | 100% / 110% / 125% / 150% |
| Reduce Motion | On / Off |

Persisted to `localStorage`. UI at Settings → Accessibility.

---

## 11. Data Providers

Pluggable via `VITE_DATA_PROVIDER`:

| Provider | Use Case |
|----------|----------|
| `indexeddb` | Local/offline development |
| `sharepoint` | Enterprise M365 |
| `api` | Fastify backend + PostgreSQL |
| `firebase` | Firebase Firestore |

---

## 12. Worker Architecture

NATS JetStream-based job queue for **TypeScript-only** workers:

- **Workers**: All TypeScript/Node.js — each in `workers/<type>/` with own `package.json`.
- **Prisma Segmentation**: Each worker owns its own Prisma schema segment (separate PostgreSQL schema).
- **Worker Registry**: Workers register with the API server on startup, send heartbeats every 30s.
- **Pattern**: API publishes job → NATS delivers → Worker processes → Result in worker's schema → Event published.
- **Job Routing**: Registry-aware routing (least-loaded, round-robin, affinity).
- **Lifecycle**: Workers extend `WorkerBase` from `@surdej/core/worker`, auto-register and auto-heartbeat.

### Core Workers (shipped with Surdej)

| Worker | Purpose | Prisma Schema |
|--------|---------|---------------|
| `knowledge` | Article indexing, template validation, training material generation | `knowledge` |
| `document` | Generic document processing, OCR, embedding generation | `document` |

Derived projects add domain workers (e.g., `pdf-refinery`, `laka-dispatch`).

### Segmented Prisma Schemas

| Segment | Owner | Prisma Location |
|---------|-------|------------------|
| `core` (public) | API server | `apps/api/prisma/schema/core.prisma` |
| `knowledge` | Knowledge worker | `workers/knowledge/prisma/schema/knowledge.prisma` |
| `document` | Document worker | `workers/document/prisma/schema/document.prisma` |
| `<domain>` | Domain worker | `workers/<domain>/prisma/schema/<domain>.prisma` |

All schemas target the same PostgreSQL instance. Each generates its own Prisma client.
Migrations are run independently per schema via `pnpm cli:db:migrate --schema <name>`.

## 12a. MCP Integration

Surdej integrates the **Model Context Protocol** as both server and client:

- **Server**: Exposes platform capabilities (commands, search, knowledge, worker status) as MCP tools.
- **Client**: Consumes external MCP servers to augment AI chat with external tools.
- **Endpoint**: Streamable HTTP at `/api/mcp`, stdio for local CLI tools.
- **SDK**: `@modelcontextprotocol/sdk`
- Domain workers can expose domain-specific MCP tools.

## 12b. Knowledge Management

Generic knowledge management built into core:

- **Article authoring** with configurable templates.
- **AI-assisted content refinement** and metadata suggestions.
- **Approval workflows** with role-based chains.
- **Training material generation** with learner progress tracking.
- **Integration adapters** for external systems (ServiceNow, Confluence, etc.).
- **Own Prisma schema** (`knowledge`) managed by the knowledge worker.

Derived projects implement specific adapters. Surdej ships the internal storage adapter.

---

## 13. Development Commands

```bash
# Install dependencies
pnpm install

# Frontend dev server
pnpm run dev

# API dev server
pnpm run dev:api

# Both in parallel
pnpm run dev:all

# Build all
pnpm run build

# Lint
pnpm run lint

# Format
pnpm run format

# Database
pnpm run db:generate    # Generate Prisma client
pnpm run db:migrate     # Run migrations
pnpm run db:push        # Push schema
pnpm run db:seed        # Seed data
pnpm run db:studio      # Open Prisma Studio

# Docker (core services)
docker compose up -d                          # PostgreSQL + NATS
docker compose --profile full up -d           # + API
docker compose --profile workers up -d        # + Workers
docker compose --profile monitoring up -d     # + Prometheus/Grafana
```

### Docker Network Rules

- **Only the API port (5001) may be exposed to the host.** All other services (PostgreSQL,
  NATS, Redis, MinIO, Grafana, Prometheus, module workers) run on the internal Docker network
  only. **Never add `ports:` mappings for non-API services** in `docker-compose.yml` or
  `docker-compose.override.yml`.
- **Database migrations must run inside the Docker network**, not from the host. Use
  `docker compose run --rm api pnpm exec prisma migrate dev` or the equivalent K8s Job.
- **Vite dev proxy routes all `/api` traffic through the API gateway.** Do not add direct
  proxy entries to module workers in `vite.config.ts`. The API gateway discovers modules
  via NATS and proxies requests internally.

---

## 14. Coding Standards

These are the conventions established in Surdej. Derived projects may adapt them as needed,
but following them keeps the codebase consistent and eases back-consolidation.

| Guideline | Detail |
|-----------|--------|
| **Icons** | Prefer `lucide-react` for consistency. |
| **Components** | Prefer reusing from `@/components/ui` (shadcn/ui). See §14a below. |
| **Styling** | Tailwind utility classes preferred. Avoid CSS modules. Global tokens in `index.css`. |
| **Formatting** | Follow project Prettier/ESLint settings. |
| **Commands** | Every navigable page and user action should be a registered command. Prefer executing commands over direct `<Link>` or `navigate()`. |
| **Sidebar** | Sidebar items should reference command IDs rather than routes. Labels and icons come from the command registry. |
| **Routing** | `react-router-dom` in `src/routes`, navigations typically triggered via commands. |
| **Imports** | Use `@/` alias for absolute imports. `@/core/` for platform, `@/domains/` for domain. |
| **API boundary** | Frontend typically talks only to the REST API. Avoid direct NATS, Prisma, AI SDK providers, or Azure calls in frontend code (MSAL auth excepted). |
| **Wireframe** | Wrap high-level layout regions and domain pages in `<WireframeElement name="..." description="...">`. |
| **Component identity** | Add `data-component` and `data-source` attributes to significant components for dev-mode inspection. |
| **State** | React Context for cross-cutting concerns. Zustand for UI state (including command registry). |
| **API Validation** | Zod schemas for request/response types. |
| **Database** | Prisma for DB access. Migrations must run inside the container network (K8s Job / Docker Exec). Avoid raw SQL. |
| **Feature gating** | Wrap new features with `useFeature("feature-id")`. Start at Ring 1. |

### 14a. shadcn/ui Component Guidelines

shadcn/ui is the **mandatory** component library for all UI primitives. Components live in
`apps/frontend/src/components/ui/` and are installed via `npx shadcn@latest add <component>`.

#### Configuration

- **Style**: `new-york` (default style for installed components)
- **Tailwind**: v4 with `@tailwindcss/vite` plugin
- **CSS Variables**: Enabled — all colors use CSS custom properties
- **Icon Library**: `lucide` (matches project convention)
- **Config file**: `apps/frontend/components.json`

#### Installed Components

| Component | Import | Use For |
|-----------|--------|---------|
| `Button` | `@/components/ui/button` | All clickable actions. Use `variant` (default, secondary, ghost, outline, destructive, link) and `size` (default, sm, lg, icon). |
| `Card` | `@/components/ui/card` | Content containers. Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. |
| `Dialog` | `@/components/ui/dialog` | Modals and confirmation dialogs. |
| `DropdownMenu` | `@/components/ui/dropdown-menu` | Context menus, action menus. |
| `Input` | `@/components/ui/input` | Text inputs and form fields. |
| `Label` | `@/components/ui/label` | Form labels (accessible, auto-associated). |
| `Badge` | `@/components/ui/badge` | Status indicators, labels, tags. Use `variant` (default, secondary, destructive, outline). |
| `Tooltip` | `@/components/ui/tooltip` | Hover hints. Wrap app in `TooltipProvider`. |
| `Avatar` | `@/components/ui/avatar` | User avatars with fallback text/image. |
| `Separator` | `@/components/ui/separator` | Visual dividers (horizontal/vertical). |
| `Switch` | `@/components/ui/switch` | Toggle switches for boolean settings. |

#### Guidelines for AI Agents

1. **Prefer shadcn components** for UI primitives (buttons, cards, inputs, dialogs, switches, badges).
   Import from `@/components/ui/<component>`.
2. **Use `cn()` for conditional classes.** Import from `@/lib/utils`. Combines `clsx` + `tailwind-merge`:
   ```typescript
   import { cn } from '@/lib/utils';
   <div className={cn('base-class', isActive && 'active-class')} />
   ```
3. **Prefer Tailwind classes over inline `style={{}}`** for design tokens:
   - Avoid: `style={{ color: 'var(--color-muted-foreground)' }}`
   - Prefer: `className="text-muted-foreground"`
4. **Tailwind v4 `@theme inline` bridge.** All CSS variables (`--background`, `--primary`, etc.)
   are bridged to Tailwind classes via `@theme inline` in `index.css`. This means `bg-primary`,
   `text-muted-foreground`, `border-border`, `text-destructive` all work automatically.
5. **Dark mode uses `.dark` class.** shadcn detects dark mode via `.dark` on `<html>`.
   The `AccessibilityContext` toggles both `data-theme` (legacy) and `.dark` class.
6. **Adding new shadcn components.** Run `npx shadcn@latest add <component>` from `apps/frontend/`.
   The component will auto-install in `src/components/ui/`. No manual config needed.
7. **Variant usage conventions:**
   - Primary actions → `<Button>` (default variant)
   - Secondary actions → `<Button variant="secondary">`
   - Toolbar/icon buttons → `<Button variant="ghost" size="icon">`
   - Destructive actions → `<Button variant="destructive">`
   - Navigation cards → `<Card>` with `onClick` + `cursor-pointer`
   - Status/tags → `<Badge variant="default|secondary|outline">`
   - Boolean settings → `<Switch>` with `<Label>`

---

## 15. Domain Extension Guide

> **Prefer modules (§16a) for new domain features.** Modules are self-contained vertical slices
> with their own worker, UI, shared DTOs, and database schema. The domain extension approach
> below is an alternative for lighter-weight features that live inside the frontend/API apps.

Domain extensions plug into the platform through well-known file locations and manifest objects.
This convention-based approach keeps domains loosely coupled, but derived projects are free to
import from core or take other approaches as needed.
See `specs/core/16-extensibility-model.md` for full rationale.

### Frontend Domain Module

```
apps/frontend/src/domains/my-domain/
├── manifest.ts            # ★ Auto-discovered by Vite plugin
├── pages/
│   ├── DashboardPage.tsx
│   └── DetailPage.tsx
├── components/
│   ├── MyWidget.tsx
│   └── MyList.tsx
├── hooks/
│   └── useMyDomainData.ts
└── services/
    └── my-domain-service.ts
```

#### Step 1: Create domain manifest (prefer no core imports)

```typescript
// domains/my-domain/manifest.ts
// Convention: satisfy the contract shape without importing from @surdej/core.

export const manifest = {
  id: "my-domain",
  name: "My Domain",
  commands: [
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

### Guidelines for AI Agents

1. **Modules are the preferred approach** for new domain-specific features over `domains/` extensions.
2. **One module per feature.** Each `member-*` folder is one vertical slice.
3. **Share DTOs via the `shared/` package.** Avoid duplicating Zod schemas between worker and UI.
4. **Modules self-register via NATS.** No manual route registration needed in the core API.
5. **Prisma schema name = module name** (underscores). Keep tables isolated per module.
6. **UI calls `/api/module/<name>`** — not the worker directly.
7. **Workers are standalone.** Prefer importing only from the module's own `shared/` package.

---

## 17. Deployment

- **CI only** in GitHub Actions — build, test, lint. No auto-deploy.
- **Developer-controlled deploys** via `kubectl apply`.
- **Documentation-first releases** — each release gets a markdown doc in `releases/`.
- **Docker**: Multi-stage builds → GHCR (multi-platform: amd64 + arm64).
- **Infra**: AKS (Azure, Sweden Central), Cloudflare Zero Trust, Azure Key Vault.
- **Database Migrations**: **Must run inside the cluster/network.**
  - **Kubernetes**: Use a `Job` (e.g., `kubectl apply -f k8s/db-migrate-job.yaml`).
  - **Docker Compose**: Use `docker compose exec api ...` or `docker compose run ...`.
  - **Reason**: PostgreSQL is not exposed to the public internet or host machine in production/staging environments.

---

## 17a. Changelog & Feature History

A monthly changelog is maintained in `docs/changelog/`. AI agents and developers **must** log
significant changes when they are made.

### Structure

```
docs/changelog/
├── README.md              # Overview + links to each month
├── 2026-02.md             # February 2026
├── 2026-03.md             # March 2026 (created when first change lands)
└── ...
```

### Format (per month)

```markdown
# Changelog — YYYY-MM

## Week N (dates)

### Feature: <title>
- **Type**: feature | fix | improvement | breaking
- **Scope**: frontend | api | worker | infra | docs
- **Description**: What was changed and why
- **Files**: Key files modified
- **PR/Commit**: Link if available

### Fix: <title>
...
```

### Rules for AI Agents

1. **Log every significant change.** When you modify code, add an entry to the current month's
   changelog file. Create the file if it doesn't exist yet.
2. **Group by week.** Use ISO week numbers or date ranges.
3. **Include context.** Why was the change made? What problem does it solve?
4. **Link to details.** Reference conversation IDs, PR numbers, or commit hashes when available.
5. **Don't log trivial changes.** Typo fixes, comment updates, and formatting don't need entries.
6. **Monthly summary.** At the top of each month file, include a brief summary of highlights.

---

## 17b. Developer Release Hub

The **Release Hub** is available at `/developer/releases` in the frontend.
It provides a dashboard view of recent changes organized by month.

### Features

- **Monthly timeline** — Visual timeline showing each month's changes
- **Change categories** — Grouped by type (features, fixes, improvements)
- **Scope badges** — Color-coded badges for frontend, api, worker, infra
- **Detail links** — Click through to see full change descriptions
- **Version tracking** — Current version from `surdej.yaml` displayed
- **Search** — Filter changes by keyword

### Data Source

The Release Hub reads from `docs/changelog/*.md` files (served via API at `/api/changelog`).

### Implementation

- Frontend: `apps/frontend/src/routes/developer/ReleasesPage.tsx`
- API: `GET /api/changelog` — lists available months
- API: `GET /api/changelog/:month` — returns parsed changelog for a specific month

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

Every project has a `surdej.yaml` in its root. This is the **version synchronization anchor** and
**infrastructure configuration source**.

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

# Infrastructure & Configuration
# Maps repository to Azure resources (synced with GitHub Vars)
infrastructure:
  azure:
    subscription_id: "..."        # GitHub Var: AZURE_SUBSCRIPTION_ID
    resource_group: "..."         # GitHub Var: RESOURCE_GROUP
  kubernetes:
    cluster_name: "aks-..."       # GitHub Var: AKS_CLUSTER_NAME
    namespace: "surdej-v1"
  database:
    server_name: "..."            # GitHub Var: DB_SERVER_NAME
  authentication:
    app_id: "..."                 # Client ID

configuration:
  feature_flags:
    enable_experimental: false
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
7. **Infrastructure Source of Truth.** Refer to `surdej.yaml` for Azure resource names,
   subscription IDs, and database config. This ensures environment consistency.

---

*This document is the single source of truth for all AI agents and developers.
Last updated: 2026-02-25*
