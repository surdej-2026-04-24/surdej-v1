# Core Issues Module

> Internal issue tracker with labels, assignment, comments, audit trail, and image redaction.

## Architecture

```
modules/core-issues/
├── shared/          # @surdej/module-core-issues-shared — Zod schemas + NATS subjects
│   └── src/
│       ├── index.ts
│       └── schemas.ts
├── worker/          # @surdej/module-core-issues-worker — Fastify API on port 7004
│   ├── prisma/schema/core_issues.prisma
│   └── src/
│       ├── server.ts       # Entrypoint, NATS registration, heartbeat
│       ├── routes.ts       # All CRUD + filter endpoints (in-memory)
│       ├── db.ts           # Prisma client placeholder
│       └── services/
│           ├── auditTrail.ts     # IssueEvent emitter
│           ├── mentionParser.ts  # @mention extractor
│           └── imageAnalysis.ts  # Azure AI Vision + sharp
└── ui/              # @surdej/module-core-issues-ui — React components
    └── src/
        ├── index.ts
        ├── commands.ts     # Module commands + sidebar items
        ├── hooks/
        │   └── useIssueApi.ts    # Typed API client
        └── components/
            ├── IssueList.tsx         # Filterable, paginated list
            ├── IssueDetail.tsx       # Detail with comments/history tabs
            ├── IssueForm.tsx         # Create/edit form
            ├── LabelManager.tsx      # Label CRUD + color picker
            ├── MarkdownEditor.tsx    # Split-pane markdown editor
            └── ImageRedactionPreview.tsx  # PII region visualizer
```

## Running

```bash
# Start the worker (requires NATS on localhost:4222)
cd modules/core-issues/worker
pnpm dev

# Frontend is served at /modules/core-issues via Vite dev server
# Vite proxy: /api/module/core-issues → http://localhost:7004
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List issues (with filtering + cursor pagination) |
| POST | `/` | Create issue |
| GET | `/:id` | Get issue by ID |
| PUT | `/:id` | Update issue |
| DELETE | `/:id` | Soft delete (archive) |
| POST | `/:id/restore` | Restore archived issue |
| PUT | `/:id/assign` | Update assignees |
| PUT | `/:id/labels` | Update labels |
| GET | `/:id/comments` | List comments |
| POST | `/:id/comments` | Add comment |
| GET | `/:id/history` | Audit trail |
| GET | `/labels` | List all labels |
| POST | `/labels` | Create label |
| PUT | `/labels/:id` | Update label |
| DELETE | `/labels/:id` | Delete label |
| POST | `/analyse-image` | Analyse image for PII redaction |

### Filtering (GET /)

| Param | Type | Description |
|-------|------|-------------|
| `status` | `open \| in_progress \| closed` | Filter by status |
| `priority` | `low \| medium \| high` | Filter by priority |
| `assignee` | UUID | Filter by assignee |
| `label` | UUID | Filter by label |
| `q` | string | Full-text search (title + description) |
| `dueBefore` | ISO datetime | Due date before |
| `dueAfter` | ISO datetime | Due date after |
| `includeArchived` | boolean | Include archived issues (default: false) |
| `cursor` | UUID | Cursor for pagination |
| `limit` | number (1-100) | Page size (default: 25) |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `MODULE_PORT` | `7004` | Worker HTTP port |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `IMAGE_ANALYSIS_ENDPOINT` | — | Azure AI Vision endpoint |
| `IMAGE_ANALYSIS_KEY` | — | Azure AI Vision key |

## Frontend Routes

| Route | Component | View |
|-------|-----------|------|
| `/modules/core-issues` | `CoreIssuesPage` | Issue list |
| `/modules/core-issues/:issueId` | `CoreIssuesPage` | Issue detail |

## NATS Subjects

| Subject | Payload | Description |
|---------|---------|-------------|
| `module.register` | Registration | Module self-registration |
| `module.heartbeat` | Heartbeat | 30s heartbeat |
| `module.core-issues.issue.created` | Issue | New issue created |
| `module.core-issues.issue.updated` | Issue | Issue updated |
| `module.core-issues.issue.archived` | Issue | Issue archived |
| `module.core-issues.issue.restored` | Issue | Issue restored |
| `module.core-issues.event` | IssueEvent | Audit event |
| `module.core-issues.mention` | Mention | @mention notification |
