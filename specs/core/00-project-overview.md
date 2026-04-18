# 00 — Project Overview

## What is Surdej?

**Surdej** (Danish for "sourdough") is a **starter template** — a generic, production-ready application framework that projects fork and evolve from.

Like a sourdough starter, Surdej is:

- **Alive** — It grows and improves as the best patterns from derived projects are consolidated back.
- **Generic** — It contains no domain-specific business logic. Real estate, knowledge management, dispatch systems — those live in the projects that *use* Surdej, not in Surdej itself.
- **Opinionated** — It prescribes a tech stack, folder structure, skinning system, and development patterns so every derived project starts with a strong, consistent foundation.
- **Forkable** — A new project starts by forking Surdej and filling in its domain-specific extension points.

## The Sourdough Lifecycle

```
┌─────────────────────────────────────────────┐
│                 surdej-v1                    │
│            (generic starter)                 │
│                                              │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Skinning│  │ Feature  │  │    AI      │  │
│  │ System  │  │  Flags   │  │   Chat     │  │
│  ├─────────┤  ├──────────┤  ├────────────┤  │
│  │  Auth   │  │ Feedback │  │Accessibility│  │
│  └─────────┘  └──────────┘  └────────────┘  │
└──────────┬──────────────────────┬────────────┘
           │ fork                 │ fork
           ▼                     ▼
   ┌───────────────┐    ┌────────────────────┐
   │  Project A    │    │    Project B        │
   │  (real estate)│    │  (knowledge mgmt)  │
   │               │    │                    │
   │  + domains/   │    │  + domains/        │
   │    pdf-refinery/    │    │    nexi/           │
   │    rentals/   │    │    laka-dispatch/  │
   └───────┬───────┘    └────────┬───────────┘
           │ back-consolidate    │ back-consolidate
           │ generic patterns    │ generic patterns
           └──────────┬──────────┘
                      ▼
              surdej-v1 grows
```

## Origin

Surdej v1 is being distilled from two production projects:

| Project | Domain | Key Contribution to Surdej |
|---------|--------|---------------------------|
| **pdf-refinery-happymate-framework-v1** | Danish real estate data processing | Skinning system, feedback/annotation, AI chat, storyboards, data refinery architecture |
| **nexi-msops-knowledge-management-v1** | Nexi MS Ops knowledge management | LAKA dispatch patterns, wishlist/issue workflows, polyglot service integration |

Only the **generic, domain-agnostic** parts are brought into Surdej. Domain-specific code (rental extraction, ServiceNow integration, VIP routing) remains in the derived projects.

## What Surdej Provides (Generic Core)

| System | Description |
|--------|-------------|
| **Skinning** | Sidebar-driven UI skins. Skins control navigation items, order, and visibility. Design tokens, theming (light/dark), branding via CSS custom properties. |
| **Feature Flags** | Ring-based progressive rollout (Internal → Beta → Preview → Stable). `useFeature()` hook. |
| **Authentication** | Pluggable providers: Entra ID (MSAL), Firebase, Demo mode, None. RBAC with configurable roles. |
| **Feedback & Annotation** | Screenshot capture, annotation tools, voice/video recording, PDF/ZIP export. |
| **AI Chat** | Streaming chat with Vercel AI SDK. Multi-model routing. Conversation persistence. |
| **Accessibility** | High contrast, font scaling (100–150%), reduce motion. Persisted preferences. |
| **Command Palette** | ⌘K command palette with fuzzy search, command registry, extensible actions. |
| **Data Providers** | Pluggable: IndexedDB (offline), SharePoint (M365), API (Fastify), Firebase. |
| **CLI Tooling** | Authentication, token management, dev utilities. |
| **Worker Architecture** | NATS JetStream job queue pattern for polyglot workers (Python, Node.js, Go). |
| **Deployment** | Docker multi-stage builds, K8s manifests, Cloudflare Zero Trust, GHCR. |

## What Surdej Does NOT Contain

- ❌ Real estate models, rental extraction, property analysis
- ❌ Knowledge article templates, ServiceNow integration
- ❌ LAKA email dispatch rules, VIP routing
- ❌ Any business-specific data models, prompts, or workflows
- ❌ Customer-specific branding (logos, colors, copy)

These belong in the `domains/` extension points of derived projects.

## Domain Extension Points

Derived projects add their domain logic in designated locations:

```
my-project/                          # forked from surdej-v1
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── domains/             # ← DOMAIN UI GOES HERE
│   │       │   ├── my-domain/
│   │       │   │   ├── pages/       #   domain-specific pages
│   │       │   │   ├── components/  #   domain-specific components
│   │       │   │   ├── hooks/       #   domain-specific hooks
│   │       │   │   └── routes.ts    #   domain route definitions
│   │       │   └── index.ts         #   domain registry
│   │       ├── core/                # ← SURDEJ CORE (don't modify)
│   │       │   ├── contexts/
│   │       │   ├── components/
│   │       │   ├── services/
│   │       │   └── hooks/
│   │       └── skins/               # ← SKIN DEFINITIONS
│   │           ├── default.ts
│   │           └── my-brand.ts
│   ├── api/
│   │   └── src/
│   │       ├── domains/             # ← DOMAIN API MODULES HERE
│   │       │   └── my-domain/
│   │       │       ├── routes.ts
│   │       │       ├── service.ts
│   │       │       └── schema.ts
│   │       └── core/                # ← SURDEJ CORE (don't modify)
│   └── laka-dispatch-phase1/        # ← DOMAIN SERVICE (polyglot)
├── packages/
│   ├── core/                        # @surdej/core — shared generic code
│   └── domain-types/                # domain-specific shared types
├── skins/                           # skin configuration & assets
├── specs/                           # project-specific specs
└── features/                        # project-specific feature docs
```

## Consolidation Principles

1. **Generic over specific** — Only domain-agnostic patterns enter Surdej. If it serves one customer, it's a domain concern.
2. **Extension points, not forks** — Surdej defines *where* domain code goes. Derived projects fill those slots.
3. **Back-consolidation** — When a derived project invents a useful generic pattern, it gets upstreamed into Surdej.
4. **Skinnable identity** — Brand, navigation, and theme are controlled by skins. Surdej ships with a neutral default skin.
5. **Polyglot-friendly** — Python, Go, and other non-Node services are first-class citizens via the worker architecture.
6. **Independent deployability** — Each app/service has its own Dockerfile and K8s manifests.

---

*Last updated: 2026-02-14*
