# Comprehensive Research: nexi-msops-knowledge-management-v1

> **Date:** 2026-02-14
> **Purpose:** Full project research for monorepo consolidation into surdej-v1

---

## Table of Contents

1. [Agent Instructions](#1-agent-instructions)
2. [Ideas](#2-ideas)
3. [Specs](#3-specs)
4. [Features](#4-features)
5. [Plan](#5-plan-laka-dispatch-merge)
6. [Docs](#6-docs)
7. [Issues](#7-issues)
8. [Infrastructure](#8-infrastructure)
9. [Apps & Packages](#9-apps--packages)
10. [Resume & Start Script](#10-resume--start-script)
11. [Consolidation Notes](#11-consolidation-notes)

---

## 1. Agent Instructions

### `.agent/instructions.md` (Canonical)

**Project:** Happy Mates Core V1 — AI & Developer Instructions

**Tech Stack:**
- **Frontend:** React (Vite), TypeScript, Tailwind CSS
- **UI:** Shadcn UI, Lucide React Icons
- **State:** React Context (FeedBack, Auth, Feature, Accessibility)
- **Styling:** `index.css` global styles, Tailwind utility classes preferred

**Feature Flags:** Ring-based system (Ring 1=Internal/Alpha → Ring 4=Stable/GA). Features defined in `apps/frontend/src/services/features/config.ts`. Use `useFeature("feature-id")` hook.

**Demo User & Auth:**
- `isDemoMode` always `true`
- Roles: `admin`, `super_admin`, `session_master`, `member`, `book_keeper`
- Settings restricted to `admin`/`super_admin`

**Feedback System:** Built-in screenshot/annotation/recording tool. Exports PDF (jspdf) and ZIP (jszip). Stored in IndexedDB.

**Dev Commands:** `pnpm run dev`, `pnpm run build`

**Coding Standards:** Always `lucide-react` for icons, reuse `@/components/ui`, `react-router-dom` routing.

---

## 2. Ideas

### 2.1 `ideas/ai.md` — AI Features Implementation Plan (✅ Implemented)

**Stack:** Vercel AI SDK + GitHub Models (OpenAI-compatible API), IndexedDB for chat storage.

**Core Feature:** Chat with History (`/chat/[id]`)
- Streaming real-time responses
- Conversation persistence in IndexedDB
- Auto-generated titles
- Data model: `ChatConversation` and `ChatMessage` interfaces

**Implementation Phases:**
1. Dependencies (`ai`, `@ai-sdk/openai`)
2. AI Service Layer (`ai-service.ts`)
3. Chat Persistence Service (`chat-service.ts`)
4. Route Structure (`/chat/[id]`)
5. UI Components (ChatInput, ChatMessage, ChatThread, ChatSidebar, StreamingText)

**Security:** CAKE API for runtime key retrieval (never expose API keys in client code). Token limits tracked in IndexedDB.

**Status:** ✅ Implemented with streaming responses, conversation persistence, auto-generated titles, CAKE API integration.

---

### 2.2 `ideas/cli.md` — CLI & Integration Testing Plan

**Three phases:**

**Phase 1: CLI Authentication**
- Commands: `cli:login`, `cli:logout`, `cli:whoami`
- Uses `@azure/msal-node` for Node.js CLI auth
- Per-project token storage at `~/.happymates/tokens-{PROJECT_CODE}.json`
- Browser-based OAuth flow with local HTTP server
- Dependencies: `@azure/msal-node`, `keytar`, `open`, `chalk`, `commander`

**Phase 2: Integration Test Framework (Vitest)**
- Tests against real SharePoint (`https://happymates.sharepoint.com/sites/MOVE`)
- Requires `cli:login` first for auth tokens
- Separate `vitest.config.ts` with path aliases
- Scripts: `test:unit`, `test:integration`, `test:coverage`

**Phase 3: SharePoint List/Field Management UI**
- "Danger Zone" in Settings for list deletion
- Reset all Happy Mates data (with project code confirmation)
- `deleteList()`, `deleteColumn()`, `resetAllLists()` API methods

**Shared MSAL Config:**
- Client ID: `5ae59eb3-a490-466e-8c31-e1b975cb6a75`
- Tenant ID: `8bfad545-8650-4872-a917-20c9720b906b`
- Scopes: `User.Read`, `Sites.Manage.All`

---

### 2.3 `ideas/data.md` — Firebase Integration Plan

**Goal:** Add Firebase as pluggable data and auth provider alongside existing IndexedDB, SharePoint, and API providers.

**Providers:**
| Provider | Storage | Status |
|----------|---------|--------|
| `indexeddb` | Browser IndexedDB | ✅ Default |
| `sharepoint` | Microsoft Graph | ✅ Available |
| `api` | External Backend | ⏳ Coming |
| `firebase` | Firestore | 🆕 New |

**Auth Providers:** `entra` | `firebase` | `none` — controlled via `VITE_AUTH_PROVIDER` env var.

**Key Config:**
- `VITE_DATA_PROVIDER` selects storage layer
- `VITE_AUTH_PROVIDER` selects auth provider
- Firebase config via `VITE_FIREBASE_*` env vars
- Entra config: Client ID `5ae59eb3-a490-466e-8c31-e1b975cb6a75`, Tenant `8bfad545-8650-4872-a917-20c9720b906b`

**Firestore Collections:** `users/`, `projects/`, `tasks/`, `tenants/`

**Implementation:** `firebase-provider.ts` implementing `DataProvider` interface with full CRUD for all entity types. Security rules for Firestore included.

---

### 2.4 `ideas/demouser.md` — Demo User Authentication System

**Purpose:** Simulated auth for demos, workshops, and dev environments.

**Features:**
- `isDemoMode` boolean in auth context
- Seeded user database with versioned seeding (`SEED_VERSION`)
- Visual login screen with branded landing page
- Role selector overlay with search, role filters, responsive grid
- Session management via `localStorage`
- Guest access option

**Data Models:** `DemoAccount`, `Member`, `RoleAssignment`

**NFRs:** Role selector renders <200ms, seeding completes <2s, session restore <50ms, supports 50+ members.

**Status:** Partially implemented (login screen, role selector, auth context done; i18n, unit tests, E2E pending).

---

### 2.5 `ideas/disablity.md` — Accessibility Implementation Plan

**Features:**
- **High Contrast Mode**: AAA (7:1) contrast, pure B/W with yellow/cyan highlights, `.high-contrast` CSS class, `prefers-contrast: more` media query support
- **Dynamic Font Scaling**: Normal (100%), Medium (110%), Large (125%), Extra Large (150%) via root font size manipulation
- **Reduce Animations**: Maps to `prefers-reduced-motion`
- **AccessibilityContext**: Persists preferences in localStorage
- Settings UI: `Settings > Accessibility`

---

### 2.6 `ideas/feature.md` — Feature Ring System

**Ring System:**
- Ring 1 (Internal/Alpha) → Ring 4 (GA/Stable)
- `FeatureDefinition` objects in central registry
- `FeatureContext` provider with `isEnabled(featureId)` and `toggleFeature(featureId)`
- `useFeature(featureId)` hook
- Settings page at `/settings/features`
- Persisted to LocalStorage/IndexedDB

---

### 2.7 `ideas/help.md` — Help/Feedback Email

Short spec: Add deep link button on feedback session page to create M365 Outlook email to `help@happymates.dk` with title as subject, description as body, and instructions to upload the ZIP/PDF feedback files.

---

### 2.8 `ideas/storyboard-salesforce-support-einstein-alternative.md` — Generic MDX Storyboard System

**Architecture for interactive presentation system:**
- "Deck" = overarching MDX entry point
- "Slide" = individual screen/state in separate MDX files
- Core components: `<SlideDeck />` (context provider, router, keyboard nav) and `<Slide />` (layout wrapper with enter/exit animations)
- URL routing: `/storyboard/[deckId]/[slideId]`
- Optional live editor mode
- File structure: `/src/storyboards/{demo-name}/index.mdx` + `/slides/*.mdx` + `/components/`

---

## 3. Specs

### 3.1 `specs/overview.md` — Interactive Architecture Visualization ("Globe View")

Comprehensive specification for a zoomable, interactive architecture visualization:
- **Level 0 (Globe):** Development vs Production "continents"
- **Level 1 (Region):** Dev workstation, GitHub, Docker; Prod: Cloudflare, AKS, Azure services
- **Level 2 (City):** Monorepo deep dive, GitHub workflow orchestration, security/networking
- **Level 3 (Street):** Key Vault secrets, CSI secret store, rotation schedules

**Production stack:** Cloudflare Zero Trust (DNS, WAF, Access, Tunnels) → AKS (API, Web, Worker pods) → Azure managed services (PostgreSQL/pgvector, Key Vault, OpenAI, Doc Intelligence)

---

### 3.2 `specs/ai-best.md` — AI Model Best Practices

**Budget:** Sub $5,000/month, Sweden Central region.

**Recommended models:**
| Use Case | Primary | Alternative |
|----------|---------|-------------|
| Document Analysis | GPT-4o | Claude Opus 4.5 (complex) |
| Chat | GPT-4o-mini | o3 (reasoning) |
| Embeddings | text-embedding-3-small | text-embedding-3-large |

**Tiered model routing strategy:** Select model based on task complexity. Monthly cost estimate: ~$34/month (moderate) to ~$400/month (heavy).

---

### 3.3 `specs/ai-implementation-plan.md` — AI Implementation Plan (4-6 weeks)

**Phase 1 (Week 1-2):** Azure infrastructure setup, AI config service, model routing, cost tracking
**Phase 2 (Week 2-3):** Enhanced analysis with document complexity scoring, Claude fallback, batch support
**Phase 3 (Week 3-4):** RAG implementation (planned)
**Phase 4 (Week 4-6):** Chat enhancement with model routing (planned)

---

### 3.4 `specs/data-refinery-integration.md` — Data Refinery Integration

**Goal:** Transform desktop PDF/data extraction (Electron/SQLite) into distributed web-accessible system using NATS JetStream and multi-language workers.

**Architecture:** Web Frontend → Fastify API → NATS JetStream → Workers (Python/Node.js/Go)

**Pipeline:** PDF Upload → Text Extraction → AI Analysis → Embeddings/RAG

**Prisma Models:** `Source`, `Property`, `ExtractionMetadata`, `DocumentChunk`

**API Routes:** `POST /api/pdf/upload`, `GET /api/pdf/sources`, `POST /api/pdf/sources/:id/process`

---

### 3.5 `specs/document-analysis-rag-extraction.md` — Document Analysis RAG & Extraction

**RAG Capabilities:**
- Markdown-aware chunking (512-1024 tokens, 10% overlap)
- Embedding model: `text-embedding-3-small` (1536 dimensions)
- Storage: PostgreSQL with `pgvector`
- Search endpoint: `POST /api/refinery/search`

**Rental Unit Extraction:**
- New entity: `PdfRentalUnit` (per-unit extraction from Danish "Salgsopstillinger")
- Fields: unitName, usageType, areaM2, rentExclVAT, operatingCosts, parkingSpaces, etc.
- New job types: `VECTORIZE_DOCUMENT`, `EXTRACT_RENTAL_UNITS`

---

### 3.6 `specs/fix-ai-plan.md` — Fix Plan: AI Chat Integration (✅ FIXED)

**Issues found and resolved:**
1. Azure API version mismatch (AI Foundry vs OpenAI endpoint) → Fixed to use `AZURE_OPENAI_*` credentials
2. Route authentication blocker → Moved AI routes to public block for testing

**Two Azure AI configs:**
- Azure AI Foundry Project: `AZURE_AI_PROJECT_*`
- Azure OpenAI Service: `AZURE_OPENAI_*` (used for chat)

---

### 3.7 `specs/improve-rental-v1.md` — Rental Property Data Extraction Improvement

**Current gaps:**
- Image-based PDF extraction (scanned docs → empty extraction)
- Rental unit extraction not populated
- Table-aware extraction missing
- OCR integration needed

**Phase 1:** Integrate Azure Document Intelligence for robust OCR + layout analysis
**Phase 2:** Structured prompt for multi-unit rental extraction (Danish "lejeliste" tables)

**AI Prompt:** Danish-language prompt for extracting rental units with normalization (monthly→annual), DKK currency, confidence scores.

---

### 3.8 `specs/monorepo-component-map.md` — Monorepo Component Map Specification

**Interactive zoomable code topology visualization** at `/monorepo` route.

**4 semantic zoom tiers:** Workspace → App/Package → Module → File

**Components to map:**
- 5 apps (frontend, api, laka-dispatch-phase1, extension, proxy)
- 1 package (@pdf-refinery/core)
- 4 worker runtimes (Python, Node.js, Go, PowerShell)
- 20+ API modules
- 26+ frontend routes
- Infrastructure configs (Docker, K8s, GitHub Actions)

**Generator script:** `scripts/generate-monorepo-map.ts` → outputs `monorepo-map.json`

---

### 3.9 `specs/pdf-blob-storage.md` — PDF Refinery Blob Store

**PostgreSQL-based binary storage** for PDFs and extracted images with variant support.

**Tables:** `blob_store` (main binary storage), `image_variants` (resized versions)

**Image variants:** thumb (150px), small (320px), medium (800px), large (1200px), full (1920px) — all WebP format

**API endpoints:** `GET /api/blobs/{key}`, `GET /api/blobs/documents/{docId}`, `GET /api/blobs/documents/{docId}/markdown`, `GET /api/blobs/stats`

**Caching:** ETag support, 304 Not Modified, 1-day default cache, 1-week for variants.

---

### 3.10 `specs/pdf-refinery-data-model.md` — PDF Refinery Data Model

**Full lifecycle models:**
- `PdfDocument` — Central entity with status lifecycle (PENDING → EXTRACTING → EXTRACTED → ANALYZING → INDEXED)
- `PdfExtraction` — Raw extraction with quality metrics (readableRatio, keywordsFound)
- `PdfAiAnalysis` — Structured AI-extracted data (address, pricing, building info, confidence)
- `PdfPage` — Per-page content with vision descriptions
- `PdfTable` — Classified tables (FINANCIAL, AREA, FEATURES, TIMELINE, CONTACT)
- `PdfImage` — Classified images (EXTERIOR, INTERIOR, FLOOR_PLAN, MAP, AERIAL)
- `PdfChunk` — RAG chunks with pgvector embeddings
- `PdfProcessingJob` — Job tracking

---

### 3.11 `specs/worker-nats-comms.md` — Worker-NATS Communications Specification

**Architecture:** All workers connect to shared NATS broker, publish periodic heartbeats. API maintains in-memory Service Catalogue.

**NATS Subjects:**
- `workers.heartbeat` — all workers publish here
- `workers.{instanceId}.{action}` — targeted request/reply
- `workers.events.{eventType}` — domain events

**Heartbeat payload:** `WorkerHeartbeat` interface with identity, network, versioning, capabilities, health, and stats fields.

**Heartbeat intervals:** laka-dispatch=15s, pdf/nodejs/go workers=30s, powershell=60s

**Staleness detection:** <2x interval=online, <4x=degraded, ≥4x=offline, >5min=removed

**API endpoints:** `GET /api/services` (filterable catalogue), SSE streaming for real-time events.

---

## 4. Features

### `features/laka-dispatch-v1.md` — LAKA Dispatch v1.0

**Status:** In Progress (65% complete)

**Purpose:** AI-powered email routing and dispatching for Large Key Accounts (LAKA) across Finland and Sweden.

**Phases:**

**Phase 1: Foundation (mostly ✅ ready)**
- System Prompt — Email routing rules (VIP, geographic, issue-type)
- Interactive Troubleshooter — Step-by-step queue finder
- Queue Routing Engine — FI/SE queue mapping for 7 issue categories
- VIP Customer Detection — 8 VIP customers with special routing
- Dashboard — KPI cards + Queue distribution visualization
- Dispatch Guide Editor — Rich markdown editor with preview

**Phase 2: Intelligence (in progress/planned)**
- Automated Report Pattern Matching (in progress)
- Email Ingestion — Mailbox Integration (planned)
- AI Auto-Classification via LLM (planned)
- Teams Notification — Urgency Alerts (planned)

**Phase 3: Scale (planned)**
- Audit Trail & Routing History
- DK/NO Region Support

**Source:** Single-page React component at `/area/laka-dispatch-fi-sv`

---

## 5. Plan (Laka Dispatch Merge)

### `plan/00-overview.md` — Merge Plan Overview

**Goal:** Merge standalone Python/FastAPI `laka-dispatch-phase1-server` repo into the monorepo as `apps/laka-dispatch-phase1/`.

**Status:** ✅ Complete (Phases 1-4 executed, Phase 5 partial — archival pending)

**Key decisions:**
1. Keep as Python (don't rewrite to Node.js) — polyglot monorepo
2. Placed under `apps/laka-dispatch-phase1/`
3. Separate CI workflow with path-based triggers
4. Own DB schema (`laka_dispatch_phase1`)
5. NOT in `pnpm-workspace.yaml` (Python, not managed by pnpm)

**Source service characteristics:**
- Python 3.13, FastAPI, SQLAlchemy, Pydantic
- PostgreSQL (Azure, schema `laka_dispatch_phase1`)
- Azure OpenAI GPT-4o (structured JSON output)
- MS Graph (SharePoint prompt), Teams Webhooks
- Docker → GHCR → AKS with CSI Secret Store

### `plan/01-file-migration.md` — Phase 1: File Migration
- Git history preservation via `git filter-repo`
- Target structure with `app/`, `tests/`, `admin.py`, `requirements.txt`, `Dockerfile`
- `.env.example` with all required env vars
- Python `.gitignore` patterns added

### `plan/02-docker-and-compose.md` — Phase 2: Docker & Compose
- Existing Dockerfile unchanged (Python 3.13-slim, uvicorn)
- Added to `docker-compose.yml` with `profiles: [full, support]`
- Environment variable mapping (namespaced to avoid collisions)
- PostgreSQL schema initialization

### `plan/03-cicd-workflows.md` — Phase 3: CI/CD
- `laka-dispatch-phase1-release.yml` — Build, push to GHCR, deploy to AKS
- `laka-dispatch-phase1-ci.yml` — Lint & test on PR
- Path-filtered triggers: `apps/laka-dispatch-phase1/**`

### `plan/04-k8s-manifests.md` — Phase 4: K8s Manifests
- `k8s/`: secret-provider.yaml, deployment.yaml, ingress.yaml, kustomization.yaml
- Azure Key Vault CSI integration for secrets
- Ingress: `laka-dispatch-phase1-server.mates.nexigroup.com`
- Resource limits: 128Mi-512Mi memory, 100m-500m CPU

### `plan/05-cleanup-and-archival.md` — Phase 5: Cleanup
- Archive source repo on GitHub
- Update monorepo README with services table
- Update VS Code workspace file
- Update external references (AKS, Cloudflare, Logic App, docs)

### `plan/ai-resources.md` — AI Resources & Quotas

**Azure OpenAI Resource:** `logic-receive-from-sap-openai-af01` in Sweden Central
**Tenant:** `79dc228f-c8f2-4016-8bf0-b990b6c72e98` (Nexi Group)

**Deployed models:**
| Model | Deployment | Quota (TPM) |
|-------|-----------|-------------|
| gpt-4o | gpt-4o | 450K |
| gpt-4o-mini | gpt-4o-mini | 3,036K |
| o3 | o3 | 150K |
| text-embedding-3-small | text-embedding-3-small | 1,000K |
| text-embedding-3-large | text-embedding-3-large | 120K |
| gpt-4.1-mini | gpt-4.1-mini | 10,484K (pre-existing) |

**Monthly cost estimate (500 users):** ~$340-860/month (~2,360-5,970 DKK)

**AI Foundry:** Claude Opus 4.5 via Anthropic (configured, not actively used)

---

## 6. Docs

### `docs/README.md` — Documentation Hub
Sections: Marketing, Use, Test, Compliance, Security, Admin. Project overview: Multi-tenant SharePoint-integrated app framework with Entra ID, Graph API, schema migrations, PWA.

### `docs/docker-workflows.md` — Docker & Version Management
- Version bump workflow: auto-increment patch on push to main
- Docker build workflow: 3 images (API, Frontend, Combined)
- Multi-stage Dockerfile, GHCR registry
- Cross-platform builds (amd64 + arm64)

### `docs/marketing/overview.md` — Product Overview
"Happy Mates Core" — modern web framework for M365 organizations. Features: Entra ID auth, SharePoint integration, schema migrations, PWA, CLI tools.

### `docs/security/authentication.md` — Auth Architecture
- Browser: PKCE Authorization Code flow via MSAL
- CLI: Browser flow (localhost:3847/callback) or Device Code flow
- Tokens: Access (60-90min), Refresh (90 days), ID Token
- App Registration: SPA type, MS Graph permissions

### `docs/security/cake-api.md` — CAKE (Client API Key Exchange)
- Endpoint: `https://cake.happymates.dk`
- Flow: User authenticates with Entra ID → exchange Entra token for CAKE token → retrieve API keys
- Scoped key retrieval per tenant

### Doc Subdirectories (content exists for):
- `admin/`: README, deployment, installation, troubleshooting
- `compliance/`: LICENSE-AGREEMENT, README, data-handling, privacy
- `marketing/`: README, overview, target-audience, value-proposition
- `security/`: README, authentication, best-practices, cake-api
- `test/`: README, integration-testing, testing-strategy
- `use/`: README, authentication, getting-started

---

## 7. Issues

### `issues/README.md` — Issue Tracking
Structured wishlist from stakeholder requests.

### `issues/wishlist/` — 11 Wishlist Items

**Category 1: AI Tool for Creating Articles (Issues 01-04)**
1. Create article based on templates (WI, KA, News) with AI
2. AI-driven template validation
3. Approval flow for articles
4. ServiceNow integration

**Category 2: AI Tool for Creating Training Materials (Issues 05-11)**
5. Create training material based on framework
6. Create training schedule with time breakdown
7. Base training on knowledge articles
8. Customize training sessions (drag-and-drop)
9. Automation for daily material updates (KB articles, ServiceNow, MS Product Library)
10. Learners individual checklist (inspired by All Gravy LMS)
11. Reporting possibilities (employee level, team level, CORP Id)

---

## 8. Infrastructure

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `package.json` (Root)
- **Name:** `core-v1`, **Version:** `1.0.55`
- **Node:** >=20.0.0, **Package Manager:** pnpm@10.21.0
- **Scripts:** `dev` (frontend), `dev:api`, `dev:all` (parallel), `build`, `lint`, `test:api`, `format`
- **Dev Dependencies:** `prettier`

### `docker-compose.yml`
**Project name:** `ms-ops-knowledge`

**Core services:**
| Service | Image/Build | Port | Description |
|---------|-------------|------|-------------|
| postgres | pgvector/pgvector:pg15 | 5434:5432 | PostgreSQL with pgvector |
| nats | nats:2.10-alpine | 4224:4222, 8224:8222 | NATS JetStream |
| api | ./apps/api | 5001 | Node.js/TypeScript Fastify API |
| laka-dispatch-phase1 | ./apps/laka-dispatch-phase1 | 8000 | Python/FastAPI dispatch |

**Workers:**
| Worker | Port | Language | Queue |
|--------|------|----------|-------|
| worker-python | 8081:8080 | Python | pdf.jobs |
| worker-nodejs | 8082:8080 | Node.js | tasks.nodejs |
| worker-go | 8083:8080 | Go | tasks.go |
| worker-powershell | 8084:8080 | PowerShell | tasks.powershell |

**Monitoring stack (profile: monitoring):**
- Prometheus (9090), Grafana (3000), Loki (3100), Promtail, cAdvisor (8085), Node Exporter (9100), PostgreSQL Exporter (9187), NATS Exporter (7777)

**Volumes:** `ms_ops_knowledge_postgres_data`, `ms_ops_knowledge_nats_data`, `ms_ops_knowledge_prometheus_data`, `ms_ops_knowledge_grafana_data`, `ms_ops_knowledge_loki_data`

### `Dockerfile` (Root — Multi-stage)
7 stages:
1. **base** — node:20-alpine + pnpm@10.21.0
2. **deps** — Install dependencies (frozen lockfile)
3. **api-builder** — Build API (TypeScript)
4. **frontend-builder** — Build Frontend (Vite)
5. **api-production** — Node.js API server on port 3000
6. **frontend-production** — nginx serving static files on port 80
7. **combined-production** — API + Frontend with nginx proxy on ports 80/3000

### `start.sh`
```bash
#!/bin/sh
set -e
nginx &
cd /app/api
exec node dist/index.js
```

---

## 9. Apps & Packages

### `apps/api/` — @happymates/api v1.0.0
**Description:** Happy Mates Member Management API with Fastify, Prisma, TypeScript

**Key dependencies:**
- Runtime: `fastify`, `@prisma/client`, `nats`, `ai`, `@ai-sdk/azure`, `@ai-sdk/openai`, `zod`, `jsonwebtoken`, `jwks-rsa`, `@azure/identity`, `@azure/keyvault-secrets`, `@azure/storage-blob`, `@microsoft/microsoft-graph-client`, `dotenv`, `pino`
- Dev: `prisma`, `vitest`, `tsx`, `typescript`, `eslint`

**Scripts:** `dev`, `build`, `start`, `start:worker`, `lint`, `test`, `test:integration`, `db:*` (generate, migrate, push, seed, reset, studio), `docker:*`, `setup`, `job:*` (cleanup-tokens, archive-audit-logs, cleanup-outbox, process-stuck-outbox, maintain-database), `cli:*` (login, logout, whoami, token, test, tunnel)

**20+ API Modules:** ai-integration, auth, blobs, calendar, commerce, communications, documents, feature-flags, financials, health, knowledge, laka-dispatch, me, members, pdf-processing, properties, pdf-refinery-proxy, tenants, users, vendors

---

### `apps/frontend/` — frontend v0.0.0
**Stack:** React 19, Vite 7, TypeScript 5.9

**Key dependencies:**
- UI: `react`, `react-dom`, `react-router-dom`, `lucide-react`, `framer-motion`, `tailwind-merge`, `class-variance-authority`, `clsx`, `cmdk`
- AI: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/azure`, `@ai-sdk/openai`
- Auth: `@azure/msal-browser`, `@azure/msal-react`
- SharePoint: `@pnp/graph`, `@pnp/sp`, `@pnp/logging`, `@pnp/queryable`
- Radix UI: `dialog`, `select`, `switch`, `tooltip`
- Data/Maps: `leaflet`, `react-leaflet`, `zustand`, `yaml`
- Media: `html2canvas`, `jspdf`, `jszip`
- Editor: `@monaco-editor/react`, `@babel/standalone`
- Markdown: `react-markdown`, `remark-gfm`
- Other: `date-fns`, `react-zoom-pan-pinch`, `vite-plugin-pwa`
- Dev: `tailwindcss`, `autoprefixer`, `postcss`, `vite`, `vitest`, `tsx`, `typescript`, `eslint`, `chalk`, `commander`, `open`, `@azure/msal-node`

**Scripts:** `dev`, `build`, `lint`, `preview`, `test`, `test:unit`, `test:integration`, `cli:*`

---

### `apps/extension/` — peeler v1.0.28
**Description:** Chrome/browser extension ("Peeler-Mate")
**Stack:** React 19, TypeScript, Vite, `xlsx`
**Build:** `@crxjs/vite-plugin`, `vite-plugin-zip-pack`

---

### `apps/proxy/` — @happy-mates/proxy v0.0.0
**Purpose:** Reverse proxy using Caddy
**Script:** `dev` → `caddy reverse-proxy --from localhost:4324 --to localhost:5177`

---

### `apps/helper/` — @happymates/helper v1.0.0
**Purpose:** Dev-mode helper service (editor bridge for monorepo map file links)
**Stack:** Express, CORS
**Scripts:** `dev` (tsx watch), `start`

---

### `apps/laka-dispatch-phase1/` — Python/FastAPI
**Requirements:**
```
fastapi>=0.115.0, uvicorn>=0.32.0, sqlalchemy>=2.0.36, psycopg2-binary>=2.9.10,
python-dotenv>=1.0.1, openai>=1.54.0, azure-identity>=1.19.0,
azure-keyvault-secrets>=4.9.0, httpx>=0.27.2, typer>=0.12.5,
pydantic>=2.9.2, pydantic-settings>=2.6.0, pyjwt>=2.8.0, nats-py>=2.7.0
```
**API endpoints:** `POST /api/dispatch/analyse`, `POST /api/dispatch/status`, `GET /api/config/test`, `GET /health`

---

### `packages/core/` — @pdf-refinery/core v1.0.0
**Description:** Core shared logic for PDF Refinery applications
**Exports:** `.` (main), `./utils`, `./types`, `./constants`
**Dependencies:** `zod`
**Content:** Shared TypeScript types (DanishAddress, PropertyType), utilities (formatters, parsers), constants (regions, cities, labels)

---

## 10. Resume & Start Script

### `resume.md` — Resume Work: AI Chat
**Date:** 2026-01-29

**Completed:**
- Backend: CORS for streaming, Azure OpenAI config, service URL fix, public AI routes
- Chat2 frontend: Three-panel layout (history sidebar, main chat, property panel), welcome screen, streaming, theme-aware

**Files modified:**
- `apps/api/src/config/index.ts` — Azure OpenAI env vars
- `apps/api/src/modules/ai-integration/service.ts` — Fixed Azure OpenAI URL
- `apps/api/src/modules/ai-integration/controller.ts` — CORS for streaming
- `apps/frontend/src/routes/chat2/layout.tsx` — NEW three-panel layout
- `apps/frontend/src/routes/chat2/page.tsx` — NEW chat page with streaming

**How to resume:** Start PostgreSQL + NATS, API on :5002, Frontend on :5173, test at `/chat` and `/chat2`

**Next steps:** Polish UI, property panel actions, persist conversations, re-enable auth, model selection

---

## 11. Consolidation Notes

### Key Identifiers & Naming
- **Original names:** `Happy Mates Core`, `MS Ops Knowledge Management`
- **Root package name:** `core-v1`
- **API package:** `@happymates/api`
- **Core package:** `@pdf-refinery/core`
- **Extension:** `peeler` (Peeler-Mate)
- **Helper:** `@happymates/helper`
- **Proxy:** `@happy-mates/proxy`

### Environment/Infra Constants
- **Azure Tenant (Nexi):** `79dc228f-c8f2-4016-8bf0-b990b6c72e98`
- **Entra Client ID (frontend):** `5ae59eb3-a490-466e-8c31-e1b975cb6a75`
- **Entra Client ID (API):** `5fe7f123-a01e-45df-8f92-2d5aa804a649`
- **API App ID URI:** `api://ai-nexi-ms-ops-nordics.nexigroup.com`
- **Azure OpenAI Resource:** `logic-receive-from-sap-openai-af01`
- **AKS Cluster:** `aks-happy-mates-sweden1`
- **Resource Group:** `rg-happy-mates-sweden1`
- **GHCR Image base:** `ghcr.io/nexi-intra/knowledge-management-v1/`
- **CAKE API:** `https://cake.happymates.dk`
- **Clarity ID:** `ujqh5efess`

### Polyglot Architecture
- **TypeScript/Node.js:** API (Fastify), Frontend (React/Vite), Extension, Helper, Node.js Worker
- **Python:** Laka Dispatch Phase1 (FastAPI), PDF Worker
- **Go:** Go Worker
- **PowerShell:** PowerShell Worker

### Data Stores
- PostgreSQL with pgvector (primary)
- NATS JetStream (messaging + object store)
- IndexedDB (client-side)
- Azure Blob Storage
- SharePoint (via Graph API)
- Firebase Firestore (planned)

### Auth Providers
- Microsoft Entra ID (primary, MSAL)
- Firebase Auth (planned)
- Demo mode (simulated)

### AI Services
- Azure OpenAI (GPT-4o, GPT-4o-mini, o3, embeddings)
- Azure AI Foundry (Claude Opus 4.5)
- Azure Document Intelligence (OCR)
- Google Vertex AI (planned)
- GitHub Models (via Vercel AI SDK, in ideas)

### Key Shared Patterns
1. Ring-based feature flags
2. CAKE API for secure key exchange
3. NATS heartbeat-based service catalogue
4. Multi-provider data layer (IndexedDB/SharePoint/Firebase/API)
5. Multi-provider auth (Entra/Firebase/Demo)
6. PDF Refinery pipeline (upload → extract → analyze → embed)
7. Worker architecture (Python/Node.js/Go/PowerShell)
