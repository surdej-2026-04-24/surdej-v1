# 17 — Virtual Pages

## Overview

Virtual Pages are user-authored React components that live in the database, are edited
in the browser, and render inside sandboxed iframes. They are the Surdej equivalent of a
**Lovable-style page builder** — anyone with Editor+ access can create, modify, and
publish interactive content pages without touching the codebase or deploying code.

Virtual pages integrate with the rest of Surdej through:

- **Skin system** — pages are scoped to a skin; the skin's sidebar and activity bar can
  reference them via dedicated command targets
- **API persistence** — CRUD over REST, stored as Prisma JSON on the `Skin` model or as a
  standalone `VirtualPage` model (see Data Model below)
- **AI-assisted coding** — an embedded chat panel ("Vibe Coding") streams code edits into
  the editor via the platform's existing AI chat endpoint
- **Sandboxed execution** — compiled output runs in an `<iframe sandbox="allow-scripts">`
  with an error bridge via `postMessage`

> **Prior art**: Originally prototyped in `nexi-msops-knowledge-management-v1` under
> `components/skin/VirtualPage*.tsx` + `services/virtualPageCompiler.ts`, using Zustand +
> IndexedDB for local storage. This spec adapts that implementation to Surdej's
> Prisma/Fastify backend and server-managed skin model.

---

## Data Model

### Option A — Standalone Prisma model (recommended)

Add a `VirtualPage` model to the core Prisma schema. This gives proper relational
integrity, migration history, and avoids unbounded JSON growth on the `Skin` row.

```prisma
model VirtualPage {
  id          String   @id @default(uuid())
  skinId      String
  tenantId    String?

  name        String              // human-readable title
  slug        String              // URL-safe slug, unique within its skin
  description String?
  source      String   @db.Text   // raw TSX source code
  compiled    String?  @db.Text   // transpiled JS (cached)
  compiledAt  DateTime?

  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  skin        Skin     @relation(fields: [skinId], references: [id], onDelete: Cascade)
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])

  @@unique([skinId, slug])
}
```

The `Skin` model gets a reverse relation:

```prisma
model Skin {
  // ... existing fields ...
  virtualPages  VirtualPage[]
}
```

### Option B — JSON field on Skin

Simpler but less scalable. Add `virtualPages Json?` to the `Skin` model, storing an array:

```ts
interface VirtualPageEntry {
  id: string;
  name: string;
  slug: string;
  description: string;
  source: string;
  compiledAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Recommendation**: Use **Option A** for production. The pages can hold substantial source
code and may grow in number; a JSON column will become awkward to query and migrate.

---

## API Endpoints

All endpoints live under the skins namespace:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/skins/:skinId/pages` | List all virtual pages for a skin |
| `GET` | `/api/skins/:skinId/pages/:pageId` | Get single page (with source) |
| `POST` | `/api/skins/:skinId/pages` | Create a new virtual page |
| `PUT` | `/api/skins/:skinId/pages/:pageId` | Update page (name, source, etc.) |
| `DELETE` | `/api/skins/:skinId/pages/:pageId` | Soft-delete a virtual page |
| `POST` | `/api/skins/:skinId/pages/:pageId/compile` | Server-side compile (optional) |

### Schemas (Zod)

```ts
const createVirtualPageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),  // auto-generated from name
  description: z.string().max(500).optional(),
  source: z.string().max(100_000),  // 100 KB limit for source
});

const updateVirtualPageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  description: z.string().max(500).optional(),
  source: z.string().max(100_000).optional(),
  compiled: z.string().optional(),
  compiledAt: z.string().datetime().optional(),
});
```

### Access Control

- **Read**: Any authenticated user can view pages of their active skin
- **Create/Update/Delete**: Requires `EDITOR` or `ADMIN` role
- Built-in skins' virtual pages are read-only (clone the skin to edit)
- Tenant-scoped: pages inherit tenant isolation from the skin

---

## Frontend Architecture

### Component Hierarchy

```
VirtualPageManager              ← CRUD list (settings/skins/:skinId)
├── VirtualPageEditor           ← split-panel editor
│   ├── VirtualPagePreview      ← sandboxed iframe renderer
│   ├── MonacoEditor            ← source code editor (monaco-editor)
│   ├── VirtualPageChat         ← AI vibe-coding assistant
│   └── VirtualPageErrorPanel   ← compile + runtime error display
└── VirtualPageRenderer         ← standalone route /vp/:skinId/:slug
```

### File Locations

```
apps/frontend/src/
├── core/virtual-pages/
│   ├── VirtualPageManager.tsx
│   ├── VirtualPageEditor.tsx
│   ├── VirtualPagePreview.tsx
│   ├── VirtualPageErrorPanel.tsx
│   ├── VirtualPageChat.tsx
│   └── VirtualPageRenderer.tsx
├── services/
│   └── virtualPageCompiler.ts
└── types/
    └── virtual-page.ts
```

---

## Compiler Service

### `virtualPageCompiler.ts`

Client-side TSX → JS transpilation using `@babel/standalone`:

```ts
import * as Babel from '@babel/standalone';

interface CompileResult {
  success: boolean;
  code?: string;
  errors: CompileError[];
}

function compileVirtualPage(source: string): CompileResult {
  try {
    const transformed = Babel.transform(source, {
      presets: ['react', 'typescript'],
      filename: 'virtual-page.tsx',
    });
    return { success: true, code: transformed.code || '', errors: [] };
  } catch (err) {
    return {
      success: false,
      errors: [{ line: err.loc?.line ?? 1, column: err.loc?.column ?? 0, message: err.message, severity: 'error' }],
    };
  }
}
```

### React UMD Loading

React 18 UMD bundles are served from `/vendor/` (checked into `public/vendor/`):

- `react.production.min.js`
- `react-dom.production.min.js`

Fetched once, cached in a module-level singleton, and inlined into each iframe's `srcdoc`.
This avoids CORS issues with sandboxed iframes loading external scripts.

### Iframe Sandbox

The compiled code runs in:

```html
<iframe sandbox="allow-scripts" title="Virtual Page Preview" />
```

The generated `srcdoc` includes:

1. Inlined React UMD bundles
2. An `ErrorBoundary` class component
3. Global `window.onerror` + `unhandledrejection` handlers
4. A `postMessage` bridge that reports errors back to the parent:
   - `VP_ERROR` — runtime / boundary / compilation errors
   - `VP_READY` — successful mount
5. The transpiled user code, decoded from a base64-encoded string
6. Auto-detection of the user's `Component` export and mounting it via `ReactDOM.createRoot`

**Security**: `sandbox="allow-scripts"` allows JS execution but blocks:
- `allow-same-origin` (no cookie/localStorage access to parent)
- `allow-forms` (no form submissions)
- `allow-popups` (no `window.open`)
- `allow-top-navigation` (no redirect of parent)

---

## VirtualPageEditor — Layout

A three-panel split editor inspired by VS Code / Lovable:

```
┌──────────────────────────────────────────────────────────────────┐
│ Header:  [page name]  [unsaved badge]  │ ⊞ Preview │ ⊟ Source  │
│                                        │ 💬 Chat   │ ⛶ Full    │
│                                        │           │ 💾 Save   │
├───────────────────────────────┬────────-┼───────────────────────┤
│           Preview             │         │                       │
│     (sandboxed iframe)        │  ◉ drag │      Chat             │
│                               │  handle │   ("Vibe Coding")     │
├── ═══ drag handle ═══════════ ┤         │                       │
│           Source              │         │   AI-assisted code    │
│     (Monaco Editor)           │         │   generation with     │
│                               │         │   streaming SSE       │
├───────────────────────────────┴─────────┴───────────────────────┤
│ Error Panel:  ▸ Errors (2)  — compile L12:4 — runtime TypeError │
└──────────────────────────────────────────────────────────────────┘
```

### Resizer Interactions

Two drag handles:

| Handle | Direction | Controls |
|--------|-----------|----------|
| Vertical | ↕ `row-resize` | Split between Preview (top) and Source (bottom) |
| Horizontal | ↔ `col-resize` | Split between left column (Preview+Source) and Chat |

Both use mouse event listeners attached on `mousedown`, tracking fraction (clamped 0.15–0.85).

### Panel Toggles

Each of the three panels (Preview, Source, Chat) can be toggled via header buttons.
At least one panel must remain visible.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘S` / `Ctrl+S` | Save page |
| `Escape` (in fullscreen) | Exit fullscreen |

---

## VirtualPageChat — "Vibe Coding"

An AI-powered coding assistant embedded in the editor's right panel.

### Configuration

Settings stored in `localStorage` under `vibe-coding-settings`:

```ts
interface VibeCodingSettings {
  endpoint: string;   // e.g. "https://swedencentral.api.cognitive.microsoft.com/"
  model: string;      // e.g. "o4-mini"
  apiKey: string;
}
```

**Future**: Route through the platform's existing `/api/ai/chat` endpoint instead of
direct Azure OpenAI calls, inheriting auth, rate limiting, and model routing.

### System Prompt

The AI is instructed to:

- Always name the exported function `Component`
- Use only `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback` (in scope, no imports)
- Use only inline styles (no CSS/Tailwind — the iframe has no build tooling)
- Return **complete** component code, never partial diffs
- Wrap code in ` ```tsx ` fenced blocks

### Streaming Behaviour

1. User message is appended to conversation
2. An empty assistant message is added (will be streamed into)
3. SSE stream is opened to the AI endpoint
4. As tokens arrive:
   - Message content is updated live
   - Partial code blocks are extracted and applied to the editor (with 30-char minimum threshold)
   - `onStreamingChange(true)` signal enables the preview's cinematic overlay
5. On stream complete:
   - Final complete code block is extracted and applied
   - `onStreamingChange(false)` clears the overlay
6. Abort button sends `AbortController.abort()`

### Context Injection

Each AI request includes:

- Page name
- Current full source code
- Active compile errors (with line numbers)
- Active runtime errors
- Last ~10 conversation messages

### Streaming Preview Overlay

While the AI is coding, the preview shows a cinematic overlay:

- Subtle gradient backdrop
- Animated scanning line (top→bottom sweep)
- Pulsing corner accent brackets
- Centre badge: "Vibe is coding" with animated dots
- Border glow effect

All animations use CSS `@keyframes` injected inline.

---

## VirtualPagePreview

Sandboxed rendering with a toolbar showing:

- "Preview" label + streaming indicator
- Error indicator (AlertCircle) when errors are present
- Manual refresh button

### Rendering Pipeline

1. Source string → `compileVirtualPage()` → transpiled JS
2. `getReactUmd()` → cached UMD bundles (fetched once from `/vendor/`)
3. `generateIframeHtml(code, origin, reactUmd)` → complete HTML document
4. Set `iframe.srcdoc = html`
5. Listen for `VP_READY` / `VP_ERROR` messages from iframe

### Debouncing

- Normal editing: 500ms debounce
- During AI streaming: 1500ms debounce (reduces flicker during rapid updates)

---

## VirtualPageErrorPanel

Collapsible panel displayed below the editor when errors exist:

- Groups compile errors (red XCircle) and runtime errors (amber AlertTriangle)
- Click-to-navigate on compile errors (line:column)
- Clear all button
- Collapse toggle with count badge

---

## VirtualPageManager

CRUD list panel for managing a skin's virtual pages:

| Action | Description |
|--------|-------------|
| **Create** | Inline form: name input → scaffold with default template |
| **Edit** | Opens `VirtualPageEditor` inline (replaces list) |
| **Delete** | Confirm dialog → soft delete |
| **Copy Link** | Deep link: `?skin=:skinId&tab=pages&edit=:pageId` |
| **Open in Tab** | Navigate to `/vp/:skinId/:pageId` (standalone render) |

### Default Template

New pages are scaffolded with:

```tsx
function Component() {
  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontWeight: 300 }}>Page Name</h1>
      <p style={{ color: "#666" }}>Start building your page here.</p>
    </div>
  );
}
```

---

## VirtualPageRenderer

Standalone route for viewing published virtual pages:

| Route | Component |
|-------|-----------|
| `/vp/:skinId/:slug` | `VirtualPageRenderer` |

Features:

- Minimal header: back arrow + page name + edit link
- Full-viewport iframe for the compiled page
- Error banner if compilation or runtime errors occur
- 404 state if page/skin not found

---

## Routing Integration

### Routes to Add

```tsx
// In router config:
{ path: '/vp/:skinId/:slug', element: <VirtualPageRenderer /> }
```

### Skin Editor Integration

The `VirtualPageManager` is embedded as a tab/section within the existing
`SkinEditorPage` at `/settings/skins/:skinId`:

```
SkinEditorPage
├── Branding (column 1)
├── Sidebar Items (column 2)
├── Activity Bar (column 3)
└── Virtual Pages (full-width section below)
    └── VirtualPageManager
```

### Virtual Commands

**Every virtual page automatically registers a virtual command.** This is the key
integration point: virtual pages become first-class navigation targets that skins can
reference in their sidebar and activity bar — indistinguishable from built-in routes
from the end-user's perspective.

When a virtual page is created, a command is auto-registered:

```ts
// Auto-generated command for a virtual page
{
  id: 'vp.default.custom-dashboard',         // pattern: vp.<skinId>.<slug>
  label: 'Custom Dashboard',                 // from page name
  description: 'Virtual page',
  icon: 'FileCode',                          // default; overridable per page
  group: 'virtual-pages',
  target: {
    type: 'virtual-page',
    skinId: 'default',
    pageId: 'abc-123',
  },
  keywords: ['custom', 'dashboard', 'virtual'],
}
```

#### Surfacing in Sidebar

Skin sidebar items reference virtual commands via their `commandId` field — the same
mechanism used for built-in routes:

```json
{
  "sidebar": [
    { "commandId": "navigate.home", "group": "Main" },
    { "commandId": "vp.default.custom-dashboard", "group": "Custom" },
    { "commandId": "vp.default.team-directory", "group": "Custom" }
  ]
}
```

#### Surfacing in Activity Bar

Activity bar items can point to virtual pages via their `path` field:

```json
{
  "activityBar": [
    { "id": "home", "label": "Overview", "icon": "Home", "path": "" },
    { "id": "custom", "label": "Dashboard", "icon": "LayoutDashboard", "path": "/vp/default/custom-dashboard" }
  ]
}
```

#### Command Palette (⌘K)

All virtual commands appear in the command palette search. Users can find and navigate
to virtual pages by typing any part of the page name or keywords.

#### Lifecycle

| Event | Effect |
|-------|--------|
| Page created | Command auto-registered in the command registry |
| Page renamed | Command label + keywords updated |
| Page deleted | Command unregistered; sidebar/activity bar items referencing it show a "missing" badge |
| Skin switched | Previous skin's VP commands unregistered; new skin's VP commands registered |

This means a skin author can: create a virtual page → it appears in the command palette
immediately → drag its command into the sidebar or add it to the activity bar → the page
is now navigable like any built-in route.

---

## Export / Import

Export format for both **skins** and **virtual pages** is **YAML**. Exports can be
downloaded as `.yaml` files and imported back via file upload or paste.

### Why YAML

- Human-readable and editable — TSX source code survives multi-line block scalars
- Git-friendly for version control of custom skins
- Lighter than JSON for multi-line string content (no escape sequences)
- `yaml` package is already in the project's dependency tree

### Virtual Page Export

A single virtual page can be exported independently:

```yaml
# virtual-page.yaml
kind: VirtualPage
version: 1
exportedAt: "2026-02-16T14:00:00Z"
skinId: "abc-123"

page:
  name: Custom Dashboard
  slug: custom-dashboard
  description: KPI overview for tenants
  source: |
    function Component() {
      const [count, setCount] = useState(0);
      return (
        <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
          <h1 style={{ fontWeight: 300 }}>Dashboard</h1>
          <button onClick={() => setCount(c => c + 1)}>
            Clicks: {count}
          </button>
        </div>
      );
    }
```

### Skin Export (with embedded pages)

A full skin export bundles branding, sidebar, activity bar, **and** all virtual pages:

```yaml
# skin.yaml
kind: Skin
version: 1
exportedAt: "2026-02-16T14:00:00Z"

skin:
  name: My Custom Skin
  description: A fully themed workspace skin
  branding:
    appName: Surdej Dashboard
    logo: /logos/custom.svg
    primaryColor: "#6366f1"
    fontFamily: Inter
  sidebar:
    - commandId: navigate.home
      group: Main
    - commandId: vp.default.custom-dashboard
      group: Custom
  activityBar:
    - id: home
      label: Overview
      icon: Home
      path: ""
    - id: custom
      label: Dashboard
      icon: LayoutDashboard
      path: /vp/default/custom-dashboard
  theme:
    defaultMode: dark
  virtualPages:
    - name: Custom Dashboard
      slug: custom-dashboard
      description: KPI overview for tenants
      source: |
        function Component() {
          return (
            <div style={{ padding: "24px" }}>
              <h1>Dashboard</h1>
            </div>
          );
        }
    - name: Team Directory
      slug: team-directory
      description: Interactive team member list
      source: |
        function Component() {
          return <div style={{ padding: "24px" }}>Team page</div>;
        }
```

### Import Flow

On import (file upload or YAML paste), the system detects the `kind` field and runs
the appropriate handler.

#### Step 1 — Parse & Validate

```ts
import YAML from 'yaml';

const doc = YAML.parse(fileContent);
// Validate against Zod schema based on doc.kind
```

#### Step 2 — Conflict Detection

For each importable entity (skin or virtual page), check for existing matches:

| Entity | Match Key | Conflict Condition |
|--------|-----------|-------------------|
| Skin | `name` within the tenant | A skin with the same name already exists |
| Virtual Page | `slug` within the target skin | A page with the same slug already exists |

#### Step 3 — Import Dialog

When conflicts are found, an **Import Dialog** is presented:

```
┌─────────────────────────────────────────────────────────┐
│  Import: skin.yaml                                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 🎨 Skin: "My Custom Skin"                        │  │
│  │    ⚠ A skin with this name already exists         │  │
│  │                                                   │  │
│  │    ○ Overwrite existing skin                      │  │
│  │    ● Create as new skin (copy)                    │  │
│  │    ○ Skip                                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 📄 Page: "Custom Dashboard" (custom-dashboard)    │  │
│  │    ⚠ Slug already exists in target skin           │  │
│  │                                                   │  │
│  │    ● Overwrite existing page                      │  │
│  │    ○ Create with new slug (custom-dashboard-2)    │  │
│  │    ○ Skip                                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 📄 Page: "Team Directory" (team-directory)        │  │
│  │    ✓ No conflicts — will be created               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│              [ Cancel ]            [ Import ]            │
└─────────────────────────────────────────────────────────┘
```

**When no conflicts exist**, the dialog shows a simple confirmation summary
and imports directly.

#### Resolution Options

| Option | Skin Behaviour | Virtual Page Behaviour |
|--------|---------------|----------------------|
| **Overwrite** | Updates branding, sidebar, activityBar, theme. Existing virtual pages are merged (see below) | Replaces name, description, and source of the matched page |
| **Create new** | Creates a new skin with `" (imported)"` suffix on the name; gets a new UUID | Creates page with auto-incremented slug (`-2`, `-3`, etc.) |
| **Skip** | Entity is not imported | Page is not imported |

#### Merge Semantics (Skin Overwrite)

When overwriting a skin that has virtual pages:

- Pages in the import file are matched by `slug` against the existing skin's pages
- Matched pages: user chooses overwrite/new/skip (per page, in the dialog)
- Unmatched import pages: created as new
- Existing pages NOT in the import file: **kept** (import is additive for pages)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/skins/import` | Import a skin (with pages) from YAML |
| `GET` | `/api/skins/:skinId/export` | Export a skin as YAML (includes pages) |
| `POST` | `/api/skins/:skinId/pages/import` | Import virtual pages into an existing skin |
| `GET` | `/api/skins/:skinId/pages/:pageId/export` | Export a single virtual page as YAML |

The `POST` import endpoints accept `Content-Type: text/yaml` or
`multipart/form-data` (file upload). Response includes a conflict report if
`?dryRun=true` is set, allowing the frontend to show the import dialog
before committing.

### Frontend Components

```
apps/frontend/src/core/virtual-pages/
├── ImportDialog.tsx          ← conflict resolution UI
├── ExportButton.tsx          ← download trigger (skin or page)
└── ImportDropZone.tsx        ← file upload area (reusable)
```

The `VirtualPageManager` header includes **Export** and **Import** buttons.
The `SkinEditorPage` header also includes export/import for the full skin.

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| **XSS via user code** | `sandbox="allow-scripts"` without `allow-same-origin` — iframe cannot access parent's cookies, localStorage, or DOM |
| **Infinite loops** | Browser enforces iframe execution limits; consider adding a `setTimeout` watchdog in the iframe that posts `VP_ERROR` if the component doesn't mount within 10s |
| **Exfiltration** | Without `allow-same-origin`, the iframe cannot read the parent's auth tokens; outbound network requests from the iframe are possible (CSP can restrict if needed) |
| **Source size** | API enforces 100KB max source size; compiled output is similarly bounded |
| **Stored XSS in page name/description** | Standard React escaping; never `dangerouslySetInnerHTML` for metadata |
| **API abuse** | Standard rate limiting + auth on all CRUD endpoints |

### Future: CSP Headers

For additional isolation, the iframe srcdoc can include a meta CSP:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src * data:; font-src *;">
```

---

## Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `@babel/standalone` | Client-side TSX→JS transpilation | ~2.8 MB gzipped; lazy-load on editor mount |
| `@monaco-editor/react` | Source code editor | Already in project |
| `react-markdown` | Render chat messages | Already in project |
| React UMD bundles | Iframe runtime | Checked into `public/vendor/` (~140 KB gzipped total) |
| `yaml` | YAML parse/stringify for import/export | Already in project |

### Lazy Loading Strategy

The virtual page editor is heavy (~3 MB with Babel + Monaco). It should be:

1. **Code-split** via `React.lazy()` — only loaded when navigating to the editor
2. **Prefetched** via `<link rel="prefetch">` on the skin settings page
3. The Babel/Monaco chunks should be in a separate Vite chunk group

---

## Types

```ts
// types/virtual-page.ts

export interface VirtualPage {
  id: string;
  skinId: string;
  name: string;
  slug: string;
  description?: string;
  source: string;
  compiledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface RuntimeError {
  message: string;
  stack?: string;
  timestamp: string;
  componentStack?: string;
}

export interface CompileResult {
  success: boolean;
  code?: string;
  errors: CompileError[];
}
```

---

## Implementation Phases

### Phase 1 — Data Layer & API

1. Add `VirtualPage` model to Prisma schema
2. Create + run migration
3. Implement CRUD routes under `/api/skins/:skinId/pages`
4. Implement YAML export/import endpoints for skins and pages
5. Add `?dryRun=true` conflict detection for import

### Phase 2 — Compiler & Preview

5. Port `virtualPageCompiler.ts` to `apps/frontend/src/services/`
6. Add React UMD bundles to `public/vendor/`
7. Implement `VirtualPagePreview` with iframe sandbox
8. Implement `VirtualPageErrorPanel`

### Phase 3 — Editor

9. Implement `VirtualPageEditor` with split-panel layout
10. Add Monaco Editor integration (existing dep)
11. Implement panel toggles, resizers, fullscreen, keyboard shortcuts
12. Wire save to API

### Phase 4 — AI Chat ("Vibe Coding")

13. Implement `VirtualPageChat` panel
14. Integrate with AI endpoint (initially direct Azure OpenAI, move to `/api/ai/chat`)
15. Implement streaming code application + cinematic preview overlay
16. Add settings management (localStorage)

### Phase 5 — Manager, Routing & Import/Export

17. Implement `VirtualPageManager` (CRUD list)
18. Add `/vp/:skinId/:slug` route + `VirtualPageRenderer`
19. Embed manager into `SkinEditorPage`
20. Register virtual pages as commands in the command registry
21. Build `ImportDialog`, `ExportButton`, and `ImportDropZone` components

### Phase 6 — Polish

22. Deep-link support (URL params for skin/tab/page)
23. Lazy loading / code splitting for editor bundle
24. CSP hardening for iframe
25. Execution timeout watchdog
26. Template gallery (pre-built page templates)

---

*Virtual pages specification. Extends the skinning system (spec 02) with a
Lovable-style browser-based page builder.*
