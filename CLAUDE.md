# CLAUDE.md — Claude Code Instructions

> **📘 Canonical Source**: `.agent/instructions.md`
>
> Read `.agent/instructions.md` fully before making any changes.
> This file exists for Claude Code auto-detection. The canonical source
> contains the complete project context.

---

## Project: Surdej v1

**Surdej** ("sourdough" in Danish) is a **generic application framework starter**.
It is a template monorepo that projects fork and build upon.
Derived projects are free to evolve in any direction — AI-assisted back-consolidation
brings generic improvements back to Surdej upstream.

### Guidelines

1. **`core/` vs `modules/` vs `domains/` is organizational, not restrictive.**
   - `apps/frontend/src/core/` and `apps/api/src/core/` = platform code.
   - `modules/member-<feature>/` = **preferred** for domain features (self-contained: shared DTOs + worker + UI).
   - `apps/frontend/src/domains/` and `apps/api/src/domains/` = alternative for lighter-weight features.
   - Derived projects may modify any part. Consider back-consolidating generic improvements.

3. **The frontend is anchored in a command system.**
   - Every navigable page and user action is a registered command.
   - `CommandRegistry` singleton: `register()`, `execute(id)`, `search(query)`.
   - ⌘K command palette (cmdk) gives fuzzy access to all commands.
   - Prefer executing commands over direct `<Link>` or `navigate()`.
   - Every new page should have a command registered in `domains/<name>/commands.ts`.
   - Command ID convention: `namespace.group.action` (e.g. `domain.pdf-refinery.refinery`).

4. **Skinning = commands in the sidebar.** Sidebar items reference **command IDs**,
   not routes. Labels and icons resolve from the command registry. Don't hardcode navigation.

5. **Feature flags gate everything.** New features use `useFeature("id")` and start at Ring 1.

### Tech Stack

React 19 / Vite / TypeScript / Tailwind / Shadcn UI / Lucide / Fastify / Prisma / PostgreSQL /
pgvector / NATS JetStream / Vercel AI SDK / Azure OpenAI / MSAL / pnpm workspaces

### Coding Standards

- Icons: `lucide-react` only
- Commands: every page/action = registered command. Prefer commands over direct `<Link>` or `navigate()`
- Sidebar: items reference command IDs, prefer over hardcoded routes
- Components: reuse from `@/core/components/ui`
- Imports: `@/core/` for platform, `@/domains/` for domain
- Styling: Tailwind utilities, no CSS modules, design tokens in `index.css`
- State: React Context for cross-cutting, Zustand for UI state (incl. command registry), no Redux
- Validation: Zod schemas for API request/response
- DB: Prisma ORM, migrations for schema changes
- Formatting: Prettier + ESLint project config

### Commands

```bash
pnpm run dev          # Frontend dev server
pnpm run dev:api      # API dev server
pnpm run dev:all      # Both in parallel
pnpm run build        # Production build
pnpm run db:migrate   # Run Prisma migrations
```

### Domain Extension Points

**Modules (preferred for domain features):**
- `modules/member-<feature>/shared/` — Zod DTOs shared between worker and UI
- `modules/member-<feature>/worker/` — Standalone Fastify server + NATS + Prisma
- `modules/member-<feature>/ui/` — React components
- Self-register via NATS; gateway proxies `/api/module/<name>/*`

**Domain extensions (lighter-weight alternative):**
- Frontend domains: `apps/frontend/src/domains/<name>/` (incl. `commands.ts`)
- API domains: `apps/api/src/domains/<name>/`

**Skins:** `apps/frontend/src/skins/<name>.ts` (sidebar = list of command IDs)

---

*Full documentation: `.agent/instructions.md`*
