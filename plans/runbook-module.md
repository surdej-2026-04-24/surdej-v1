# Runbook Module — Implementation Plan

> **Date:** 2026-02-27
> **Module:** `member-runbook`
> **Scope:** Full vertical-slice module with shared DTOs, worker, UI, flyer printing

---

## Overview

The Runbook Module manages **runbooks** (guided AI agent workflows/prompts) with:
- Full CRUD with database persistence
- Front page hero images + markdown content stored in **blob storage**
- **Document tagging system** — purpose-based tags across all documents (runbooks, PDF refinery docs, etc.)
- **Flyer printing** — generate print-ready A4 folded flyers from any runbook
- **Flyer layout store** — multiple layouts per business unit (Happy Mates, Example Tenant, PDF Refinery)

### Naming Convention
- `/surdej-*` prefix → Platform/framework runbooks (owned by Happy Mates)
- `/red-*` prefix → Customer-specific runbooks (Example Tenant / PDF Refinery)

---

## Architecture

```
modules/member-runbook/
├── shared/                          # @surdej/module-member-runbook-shared
│   ├── package.json
│   └── src/
│       ├── index.ts
│       └── schemas.ts               # Zod schemas for Runbook, FlyerLayout, Tags
├── worker/                          # @surdej/module-member-runbook-worker
│   ├── package.json
│   ├── prisma/schema/
│   │   └── member_runbook.prisma    # Runbook, FlyerLayout, DocumentTag tables
│   └── src/
│       ├── server.ts                # Fastify + NATS registration
│       ├── routes.ts                # CRUD routes
│       └── flyer-renderer.ts        # HTML flyer generation
└── ui/                              # @surdej/module-member-runbook-ui
    ├── package.json
    └── src/
        ├── index.ts
        ├── hooks/
        │   └── useRunbookApi.ts
        └── components/
            ├── RunbookList.tsx
            ├── RunbookEditor.tsx
            ├── RunbookViewer.tsx
            ├── FlyerPreview.tsx
            └── FlyerLayoutSelector.tsx
```

---

## Data Model

### 1. Runbook (in `member_runbook` schema)

```prisma
model Runbook {
  id            String   @id @default(uuid())
  tenantId      String?
  slug          String   @unique           // e.g. "surdej-init", "red-reprocess"
  prefix        String                      // "surdej" or "red" (or custom)
  title         String                      // "Den Første Ælte"
  subtitle      String?                     // "AI Arbejdsprocesser"
  description   String?  @db.Text          // Short description
  content       String   @db.Text          // Full markdown content
  heroImagePath String?                     // Blob storage path for front page image
  insideImagePath String?                   // Blob storage path for inside image
  category      String   @default("workflow") // "workflow", "guide", "reference"
  tags          String[] @default([])       // e.g. ["platform", "setup", "daily"]
  status        String   @default("draft")  // "draft", "published", "archived"
  version       String   @default("1.0.0")
  authorId      String?
  flyerLayoutId String?                     // Default flyer layout for this runbook
  metadata      Json?                       // Extra fields (steps[], contact info, etc.)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  flyerLayout   FlyerLayout? @relation(fields: [flyerLayoutId], references: [id])
  @@schema("member_runbook")
}
```

### 2. FlyerLayout (in `member_runbook` schema)

```prisma
model FlyerLayout {
  id            String   @id @default(uuid())
  tenantId      String?
  name          String                      // "Happy Mates Nordic Kitchen"
  slug          String   @unique           // "happy-mates-nordic"
  description   String?
  scope         String   @default("common") // "common", "business-unit"
  businessUnit  String?                     // null=common, "happy-mates", "example-tenant", "pdf-refinery"
  
  // Back cover (left side page 1)
  backCoverConfig Json                      // { logo, name, role, bio, contact, website, csrText }
  
  // Front cover style
  frontCoverConfig Json                     // { overlayGradient, titleFont, subtitleStyle, footerBrand }
  
  // Inside spread style  
  insideConfig Json                         // { leftBg, rightBg, accentColor, quoteStyle }
  
  // Color palette
  colorPalette Json                         // { primary, secondary, background, accent, text }
  
  // Typography
  typography  Json?
  
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  runbooks    Runbook[]
  @@schema("member_runbook")
}
```

### 3. Document Tags Extension (core schema)

Extend the existing `Blob` model with a `tags` field (already has `String[] @default([])` pattern from `Article`):

```prisma
// Add to Blob model in schema.prisma:
tags        String[] @default([])     // Purpose tags: "pdf-refinery", "runbook", "knowledge", etc.
purpose     String?                    // Primary purpose: "runbook-hero", "runbook-inside", "prospect", "analysis"
```

---

## Tag Taxonomy

| Tag | Applies To | Description |
|-----|-----------|-------------|
| `pdf-refinery` | Blob (PDFs) | Property prospectus document |
| `prospect` | Blob | Sales prospectus |
| `analysis` | Blob | AI analysis output |
| `runbook` | Blob, Article | Runbook-related content |
| `runbook-hero` | Blob | Hero image for a runbook flyer |
| `runbook-inside` | Blob | Inside image for a runbook flyer |
| `platform` | Runbook | Surdej platform workflow |
| `customer` | Runbook | Customer-specific workflow |
| `daily` | Runbook | Daily-use workflow |
| `setup` | Runbook | One-time setup workflow |
| `release` | Runbook | Release/deploy workflow |

---

## Flyer Layout System

Each flyer layout defines the visual identity for a business unit:

### Pre-seeded Layouts

| Layout | Business Unit | Color Palette |
|--------|--------------|---------------|
| **Nordic Kitchen** | Happy Mates (default) | Wood `#3E332A`, Wheat `#FAF7F2`, Olive `#6C7A65` |
| **Example Tenant Corporate** | Example Tenant | Navy `#1a1a2e`, Red accent `#e63946`, White |
| **PDF Refinery Operations** | PDF Refinery | Dark blue `#002273`, Teal `#00A3DA`, White |

### Flyer Structure (4-panel A4 fold)

```
Page 1 (Outside):
┌────────────────┬────────────────┐
│   BACK COVER   │  FRONT COVER   │
│  (layout info) │ (hero + title) │
│  Contact, bio  │  /slug-name    │
│  CSR text      │  Subtitle      │
│  Website       │  Brand footer  │
└────────────────┴────────────────┘

Page 2 (Inside — rotated 180° for duplex):
┌────────────────┬────────────────┐
│  INSIDE LEFT   │  INSIDE RIGHT  │
│  Description   │  Inside image  │
│  Quote         │  Step-by-step  │
│  Architecture  │  from markdown │
└────────────────┴────────────────┘
```

---

## API Endpoints

Via module gateway: `/api/module/member-runbook/...`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/runbooks` | List all runbooks (with filter/search) |
| GET | `/runbooks/:id` | Get runbook by ID |
| GET | `/runbooks/slug/:slug` | Get runbook by slug |
| POST | `/runbooks` | Create runbook |
| PUT | `/runbooks/:id` | Update runbook |
| DELETE | `/runbooks/:id` | Delete runbook |
| POST | `/runbooks/:id/hero` | Upload hero image (multipart) |
| POST | `/runbooks/:id/inside-image` | Upload inside image |
| GET | `/runbooks/:id/flyer` | Generate flyer HTML |
| GET | `/runbooks/:id/flyer/pdf` | Generate flyer PDF (future) |
| GET | `/layouts` | List flyer layouts |
| GET | `/layouts/:id` | Get layout details |
| POST | `/layouts` | Create layout |
| PUT | `/layouts/:id` | Update layout |
| DELETE | `/layouts/:id` | Delete layout |
| POST | `/runbooks/import-from-agents` | Scan `.surdej/agents/workflows/` and import |

---

## Implementation Steps

1. **Scaffold module** — Copy `member-example`, rename to `member-runbook`
2. **Shared schemas** — Define Zod DTOs for Runbook, FlyerLayout
3. **Prisma schema** — Create `member_runbook.prisma` with models
4. **Worker routes** — CRUD + flyer generation endpoint
5. **Flyer renderer** — HTML generation following the Nordic Kitchen pattern
6. **Blob tags** — Extend core `Blob` model with `tags` and `purpose`
7. **UI components** — RunbookList, RunbookEditor, FlyerPreview
8. **Seed data** — Import existing `.surdej/agents/workflows/` as runbooks
9. **Seed layouts** — Create 3 default flyer layouts

---

*This plan is the implementation specification for the Runbook Module.*
*Last updated: 2026-02-27*
