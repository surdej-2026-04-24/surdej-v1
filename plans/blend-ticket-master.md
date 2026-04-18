# 🎫 Blend Plan: The Ticket Master (core-issues)

## Analysis

### Existing State
The project already has a **`member-feedback`** module (`modules/member-feedback/`) with:
- ✅ Ticket entity with statuses (new, open, in_progress, waiting_customer, etc.), priorities, categories
- ✅ AI analysis integration (sentiment, urgency, suggested routing)
- ✅ Comments (with internal/external flag)
- ✅ Status transitions with validation rules
- ✅ NATS self-registration, heartbeat, event publishing
- ✅ Prisma schema, Zod DTOs, Fastify routes
- ✅ UI components: TicketList, TicketDetail, TicketCreate
- ✅ Frontend route at `/modules/member-feedback/`

### What the Super Prompt Adds (Delta)
The Ticket Master recipe adds these capabilities ON TOP of the existing module:

| Feature | member-feedback | core-issues (new) |
|---|---|---|
| Labels (CRUD + color picker) | Tags (string array) | ✅ Label entity + IssueLabel join |
| Due dates | ❌ | ✅ dueDate field + filtering |
| Assignee(s) | Single assigneeId | ✅ assigneeIds (multi) |
| @Mentions + notifications | ❌ | ✅ @mention parser + NATS events |
| Image redaction (PII blur) | ❌ | ✅ Azure AI Vision + sharp |
| Audit trail (IssueEvent) | Transitions only | ✅ Full event history (all mutations) |
| Soft delete / archive | ❌ | ✅ archivedAt + restore |
| Cursor-based pagination | ❌ | ✅ cursor + limit |
| Advanced filtering | Basic listing | ✅ status, priority, assignee, label, q, date range |
| Markdown editor with preview | ❌ | ✅ Split-pane live preview |
| Redaction preview UI | ❌ | ✅ ImageRedactionPreview component |

### Architectural Decision
**Create a NEW module** `core-issues` at `modules/core-issues/` rather than modifying `member-feedback`. Reasons:
1. `member-feedback` is customer-facing feedback with AI routing — different domain
2. `core-issues` is internal project/issue tracking (like GitHub Issues) — different use case
3. The super prompt specifies `core` as the member name and `issues` as the subject
4. Keeping them separate avoids breaking the existing feedback system

### Risks & Dependencies
- **Azure AI Vision** for image redaction requires API credentials (env vars)
- **sharp** library needs native binaries (may need Docker build adjustment)
- **Notification engine** for @mentions requires NATS consumer (can start with publish-only)
- **Blob Storage** for media requires Azure connection string

---

## Implementation Plan

### Phase 1: Module Scaffolding
- [x] **1.1** Scaffold `modules/core-issues/shared/` — package.json, tsconfig, schemas (Issue, Comment, Label, IssueEvent, IssueFilter, PaginatedIssueList)
- [x] **1.2** Scaffold `modules/core-issues/worker/` — package.json, tsconfig, server.ts, .env
- [x] **1.3** Create Prisma schema `worker/prisma/schema/core_issues.prisma` with all 5 models (Issue, Comment, Label, IssueLabel, IssueEvent)
- [x] **1.4** Scaffold `modules/core-issues/ui/` — package.json, tsconfig, commands.ts, index.ts
- [x] **1.5** Run `pnpm install` and verify workspace packages

### Phase 2: Worker Services
- [x] **2.1** Create `worker/src/db.ts` — Prisma client init
- [x] **2.2** Create `worker/src/services/auditTrail.ts` — emitEvent() with DB insert + NATS publish
- [x] **2.3** Create `worker/src/services/mentionParser.ts` — @mention extractor + NATS notification
- [x] **2.4** Create `worker/src/services/imageAnalysis.ts` — Azure AI Vision + sharp redaction

### Phase 3: Worker Routes (API)
- [x] **3.1** Issue CRUD routes — GET / (with filtering + pagination), POST /, GET /:id, PUT /:id
- [x] **3.2** Soft delete + restore — DELETE /:id (sets archivedAt), POST /:id/restore
- [x] **3.3** Assignment route — PUT /:id/assign
- [x] **3.4** Comment routes — GET /:id/comments, POST /:id/comments
- [x] **3.5** Label CRUD routes — GET /labels, POST /labels, PUT /labels/:id, DELETE /labels/:id
- [x] **3.6** History route — GET /:id/history
- [x] **3.7** Image analysis endpoint — POST /analyse-image

### Phase 4: UI Components
- [x] **4.1** `useIssueApi` hook — API client with filtering, pagination, all endpoints
- [x] **4.2** `IssueList` component — filterable, searchable, paginated list
- [x] **4.3** `IssueForm` component — create/edit with assignee picker, label picker, due date, priority, markdown editor
- [x] **4.4** `IssueDetail` component — full view with comment thread, history sidebar, assignee/label panel
- [x] **4.5** `MarkdownEditor` component — split-pane editor with live preview + @mention autocomplete
- [x] **4.6** `ImageRedactionPreview` component — shows detected PII regions, allows add/remove before upload
- [x] **4.7** `LabelManager` component — admin CRUD for labels with color picker

### Phase 5: Frontend Integration
- [x] **5.1** Create frontend route page at `apps/frontend/src/routes/modules/core-issues/`
- [x] **5.2** Register module commands and sidebar items
- [x] **5.3** Wire up routing in `App.tsx`

### Phase 6: Database & Verification
- [x] **6.1** Generate Prisma client and run migrations
- [x] **6.2** Start worker and verify NATS registration
- [x] **6.3** End-to-end test: create issue, add comments, assign, label, filter, archive/restore

### Phase 7: Documentation
- [x] **7.1** Write `docs/modules/core-issues.md` with architecture, API reference, and configuration
