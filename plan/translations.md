# Translation Corrections Plan

> **System**: `I18nContext` via `useTranslation()` hook from `core/i18n/I18nProvider.tsx`
> **Locale files**: `core/i18n/locales/en.ts` (canonical) · `core/i18n/locales/da.ts` (Danish)
> **Date**: 2026-03-02

---

## Summary

Many UI components render **hardcoded English or Danish strings** instead of using `t('key')` from the `I18nContext`. Some pages mix in raw Danish without offering an English counterpart, while others are fully English-only with no `useTranslation` import at all.

### Legend

| Icon | Meaning |
|------|---------|
| 🔴 | Page has **zero** i18n — no `useTranslation` import |
| 🟡 | Page uses `useTranslation` but still has **hardcoded strings** |
| ✅ | Page is fully translated (both EN + DA) |

---

## Pages Using `useTranslation` ✅

These pages **already** import `useTranslation` and use `t()` calls:

| Page | File | Status |
|------|------|--------|
| Login | `routes/login/LoginPage.tsx` | ✅ Fully translated |
| Home / Dashboard | `routes/home/HomePage.tsx` | ✅ Fully translated |
| Settings Hub | `routes/settings/SettingsPage.tsx` | ✅ Fully translated |
| Accessibility | `routes/settings/AccessibilitySettingsPage.tsx` | ✅ Fully translated |
| Chat | `routes/chat/ChatPage.tsx` | ✅ Fully translated |
| Header | `routes/layout/Header.tsx` | ✅ Fully translated |
| Sidebar | `routes/layout/Sidebar.tsx` | ✅ Fully translated |
| Root Layout / Footer | `routes/layout/RootLayout.tsx` | ✅ Fully translated |
| Language Switcher | `components/LanguageSwitcher.tsx` | ✅ Fully translated |

---

## 🔴 Pages With ZERO i18n (No `useTranslation` import)

These components render only hardcoded strings and need full i18n wiring.

### 1. `FeaturesSettingsPage.tsx`
**File**: `routes/settings/FeaturesSettingsPage.tsx`
**Hardcoded strings** (all English, need EN + DA keys):
- `"Loading features…"` → `t('common.loading')`
- `"Feature Flags"` (h1) → `t('featureFlags.title')`
- `"Feature Matrix"` (button) → new key `featureFlags.matrix`
- `"Toggle features on or off. Features graduate through rings: Internal → Beta → Preview → Stable."` → `t('featureFlags.subtitle')` (already exists, but not used)
- `"Your Ring Level"` → new key `featureFlags.ringLevel`
- `"You see features at or above your ring level"` → new key `featureFlags.ringLevelDesc`

### 2. `SkinsSettingsPage.tsx`
**File**: `routes/settings/SkinsSettingsPage.tsx`
**Hardcoded strings**:
- `"Skins & Branding"` (h1) → `t('skins.title')` (key exists but unused)
- `"New Skin"` (button) → new key `skins.newSkin`
- `"Choose a skin to configure the navigation and branding of your workspace."` → `t('skins.subtitle')` (key exists but unused)
- `"Built-in"` (badge) → `t('skins.builtIn')`
- `"{n} items"` → `t('skins.sidebarItemsCount', { count })`
- `"Default"` (button) → `t('skins.setDefault')`
- `"Edit"` (button) → `t('common.edit')`
- `"Clone"` (button) → `t('skins.clone')`
- `"+{n} more…"` → new key `common.moreItems`
- `"App: {name}"` → new key `skins.appName`
- `"Unnamed"` → new key `skins.unnamed`

### 3. `WorkersPage.tsx`
**File**: `routes/workers/WorkersPage.tsx`
**Hardcoded strings**:
- `"Workers"` (h1) → `t('workers.title')`
- `"NATS Connected"` / `"NATS Disconnected"` → new keys `workers.natsConnected` / `workers.natsDisconnected`
- `"Refresh"` → `t('common.refresh')`
- `"Monitor and manage worker processes across the platform."` → `t('workers.subtitle')` (key exists but unused)
- `"Total"`, `"Online"`, `"Degraded"`, `"Unhealthy"`, `"Draining"`, `"Offline"` → existing keys in `workers.*`
- `"No Workers Registered"` → `t('workers.noWorkers')`
- `"Start workers with pnpm dev:workers…"` → `t('workers.noWorkersDesc')` (key exists but unused)
- `"Drain"` → `t('workers.drain')`
- `"Processed:"`, `"Failed:"`, `"Memory:"` → new keys `workers.processed`, `workers.failed`, `workers.memory`
- `"just now"`, `"{n}s ago"`, `"{n}m ago"`, `"{n}h ago"` → existing `time.*` keys
- `"never"` → new key `workers.never`

### 4. `WorkerDetailPage.tsx`
**File**: `routes/workers/WorkerDetailPage.tsx`
**Action**: Needs full audit + i18n wiring (likely similar pattern to WorkersPage)

### 5. `KnowledgePage.tsx`
**File**: `routes/knowledge/KnowledgePage.tsx`
**Hardcoded strings**:
- `"Knowledge"` (h1) → `t('knowledge.title')`
- `"Refreshing…"` / `"Refresh"` → `t('common.refreshing')` / `t('common.refresh')`
- `"New Article"` → new key `knowledge.newArticle`
- `"Manage articles, templates, and training materials."` → new key `knowledge.subtitle`
- `"Articles"`, `"Templates"`, `"Training"`, `"Documents"` → existing keys in `knowledge.*`
- `"Search articles…"` → new key `knowledge.searchArticles`
- Status labels: `"Draft"`, `"In Review"`, `"Approved"`, `"Published"`, `"Archived"` → new keys `knowledge.status.*`
- `"No articles yet"` → new key `knowledge.noArticles`
- `"Create your first article to start building your knowledge base."` → new key `knowledge.noArticlesDesc`
- `"Create Article"` → new key `knowledge.createArticle`
- `"Showing {n} of {total} articles"` → new key `knowledge.showingCount`
- `"Templates"` (section heading) → `t('knowledge.templates')`
- `"Training Modules"` → new key `knowledge.trainingModules`
- `"Default"` (badge) → new key `common.default`
- `"Published"` (badge) → reuse status key
- `"article"` / `"articles"` plurals → new keys
- `"learner"` / `"learners"` → new keys `knowledge.learner` / `knowledge.learners`
- `"Untitled Article"` (create default) → new key
- Time helpers (`"just now"`, `"{n}m ago"`, `"{n}h ago"`, `"{n}d ago"`) → existing `time.*` keys

### 6. `ArticleDetailPage.tsx`
**File**: `routes/knowledge/ArticleDetailPage.tsx`
**Action**: Needs full audit (likely many edit/save/delete strings)

### 7. `DocumentsPage.tsx`
**File**: `routes/knowledge/DocumentsPage.tsx`
**Action**: Needs full audit

### 8. `TemplatesPage.tsx`
**File**: `routes/knowledge/TemplatesPage.tsx`
**Action**: Needs full audit

### 9. `TrainingPage.tsx` / `TrainingDetailPage.tsx`
**Files**: `routes/knowledge/TrainingPage.tsx`, `routes/knowledge/TrainingDetailPage.tsx`
**Action**: Needs full audit

### 10. `FeedbackPage.tsx` 🟠 (Mixed Danish + English, no i18n)
**File**: `routes/feedback/FeedbackPage.tsx`
**Hardcoded strings** — **mix of raw Danish and English**:
- `"Feedbacksessioner"` (h1, Danish) → needs `feedback.title` (EN: "Feedback Sessions", DA: "Feedbacksessioner")
- `"Gennemgå feedbacksessioner med skærmbilleder, optagelser og navigationshistorik."` (Danish) → new key `feedback.pageSubtitle`
- `"Opdater"` (Danish = "Refresh") → `t('common.refresh')`
- `"Alle"`, `"Aktive"`, `"Afsluttede"` (Danish filter labels) → new keys in `feedback.*`
- `"Active"`, `"Sat på pause"`, `"Afsluttet"` (mixed!) → new keys `feedback.statusActive`, `feedback.statusPaused`, `feedback.statusCompleted`
- `"Ingen sessioner endnu"` (Danish) → new key `feedback.noSessions`
- `"Start en feedbacksession fra…"` → new key `feedback.noSessionsDesc`
- `"Ingen beskrivelse"` (Danish) → new key `feedback.noDescription`
- `"Vælg en session"` / `"Vælg en session fra listen…"` → new keys `feedback.selectSession` / `feedback.selectSessionDesc`
- `"🎫 Opret Ticket"` → new key `feedback.createTicket`
- `"Genoptag"` (Danish = "Resume") → new key `feedback.resume`
- `"Varighed"`, `"Sider"`, `"Skærmbilleder"`, `"Lyd"`, `"Video"`, `"Chats"` (Danish) → new keys `feedback.duration`, `feedback.pages`, `feedback.screenshots`, etc.
- `"Navigationshistorik"` → new key `feedback.navigationHistory`
- `"Skærmbilleder"` (section) → new key
- `"Lydoptagelser"` → new key `feedback.audioRecordings`
- `"Videooptagelser"` → new key `feedback.videoRecordings`
- `"Sessionsinfo"` → new key `feedback.sessionInfo`
- `"Start-URL:"`, `"Oprettet:"`, `"Afsluttet:"`, `"Sessions-ID:"`, `"Deep link:"` → new keys
- `"Chat-samtaler"` → new key `feedback.chatTranscripts`
- `"beskeder"` (Danish) → new key
- `"Kopier som YAML"` / `"Åbn chat"` → new keys
- `"Loading…"` (English) → `t('common.loading')`
- `"Chat session"` → new key
- `"Screenshot"` → new key

### 11. `ProfilePage.tsx`
**File**: `routes/profile/ProfilePage.tsx`
**Hardcoded strings** (all English):
- `"User"`, `"No email"`, `"Unknown"` → existing / new keys
- `"Not set"` → new key `common.notSet`
- `"Account"` (section header) → new key `profile.account`
- `"Display Name"`, `"Email"`, `"Role"`, `"Login Method"`, `"User ID"` → new `profile.*` keys
- `"Tenant"` (section) → new key `profile.tenant`
- `"Organization"`, `"Slug"`, `"Tenant ID"`, `"Created"` → new keys
- `"Session"` (section) → new key `profile.session`
- `"Current Time"`, `"Browser"` → new keys
- `"Sign Out"` → `t('common.logout')`

### 12. `HelpPage.tsx`
**File**: `routes/help/HelpPage.tsx`
**Hardcoded strings**:
- `"Help & Support"` → new key `help.title`
- `"Find answers, learn how to use the platform…"` → new key `help.subtitle`
- `"Documentation"`, `"Send Feedback"`, `"Release Notes"`, `"Video Tutorials"` → new keys `help.documentation`, `help.sendFeedback`, etc.
- All descriptions → new keys `help.documentationDesc`, `help.feedbackDesc`, etc.
- `"Surdej v0.1.0 · Built with ❤️ by Happy Mates"` → `t('footer.version')` or new key

### 13. `ProcessesPage.tsx`
**File**: `routes/processes/ProcessesPage.tsx`
**Hardcoded strings**:
- `"Processes"` (h1) → new key `processes.title`
- `"Active background tasks, batch jobs, and processing pipelines"` → new key `processes.subtitle`
- `"Running"`, `"Completed"`, `"Queued"`, `"Failed"`, `"Paused"` → new keys `processes.status.*`
- `"items"` → new key `processes.items`

### 14. `ProjectsPage.tsx`
**File**: `routes/projects/ProjectsPage.tsx`
**Hardcoded strings**:
- `"Projects"` (h1) → new key `projects.title`
- `"Organize work into projects for tracking and collaboration"` → new key `projects.subtitle`
- `"New Project"` → new key `projects.newProject`
- `"tasks"` / `"members"` → new keys

### 15. `AdminPage.tsx`
**File**: `routes/admin/AdminPage.tsx`
**Hardcoded strings**:
- `"Administration"` (h1) → new key `admin.title`
- `"Admin Only"` → new key `admin.adminOnly`
- `"System administration, tenant management, and security controls."` → new key `admin.subtitle`
- All tool titles and descriptions → new `admin.*` keys
- `"Coming Soon"` → new key `common.comingSoon`

### 16. `PlatformPage.tsx`
**File**: `routes/platform/PlatformPage.tsx`
**Hardcoded strings**:
- `"Platform"` (h1) → new key `platform.title`
- `"Infrastructure, workers, and system-level tooling"` → new key `platform.subtitle`
- All tool titles + descriptions → new `platform.*` keys
- `"Coming Soon"` → `t('common.comingSoon')`

### 17. `DeveloperPage.tsx`
**File**: `routes/developer/DeveloperPage.tsx`
**Hardcoded strings**:
- `"Developer Tools"` (h1) → new key `developer.title`
- All tool titles + descriptions → new `developer.*` keys
- `"Coming Soon"` → `t('common.comingSoon')`
- Impersonation panel strings → new `developer.impersonate.*` keys

### 18. `McpSettingsPage.tsx`
**File**: `routes/settings/McpSettingsPage.tsx`
**Hardcoded strings**: (extensive — title, subtitles, add/delete/test buttons, labels)
- Needs new `settings.sections.mcp*` key expansions + dedicated `mcp.*` section

### 19. `TenantsSettingsPage.tsx`
**File**: `routes/settings/TenantsSettingsPage.tsx`
**Hardcoded strings**: (extensive — create dialog, CRUD buttons, status labels)
- Needs new `tenants.*` key section

### 20. `TenantEditorPage.tsx`
**File**: `routes/settings/TenantEditorPage.tsx`
**Hardcoded strings**: (form labels, save/delete/restore buttons, metadata labels)

### 21. `SkinEditorPage.tsx`
**File**: `routes/settings/SkinEditorPage.tsx`
**Hardcoded strings**: (extensive — section headers, color picker labels, JSON export, etc.)
- Needs new `skins.editor.*` key section

### 22. `QuickChat.tsx`
**File**: `routes/layout/QuickChat.tsx`
**Hardcoded strings**: (greeting, placeholder, save, suggestions)
- Some keys already exist in `quickChat.*` but are not wired up

### 23. `TopologyHubPage.tsx` / `TopologyViewerPage.tsx`
**Files**: `routes/topology/TopologyHubPage.tsx`, `routes/topology/TopologyViewerPage.tsx`
**Note**: Keys exist in `topology.*` but pages may not use `useTranslation`

### 24. `ModulesHubPage.tsx` / `ModuleIndexPage.tsx` / `ModuleLayout.tsx`
**Files**: `routes/modules/ModulesHubPage.tsx`, etc.
**Hardcoded strings**: All headers, descriptions, and labels

### 25. `HealthDashboardPage.tsx` / `DatabaseExplorerPage.tsx`
**Files**: `routes/platform/HealthDashboardPage.tsx`, `routes/platform/DatabaseExplorerPage.tsx`
**Action**: Needs full audit

### 26. `FeedbackTicketsPage.tsx`
**File**: `routes/modules/member-feedback/FeedbackTicketsPage.tsx`
**Action**: Needs full audit

### 27. Domain pages (PDF Refinery)
**Files**: `domains/pdf-refinery/pages/*.tsx` (18 files)
**Note**: Domain-specific strings. May warrant a dedicated `pdf-refinery.*` namespace in both locale files.

---

## New Locale Keys Needed

The following **new namespaces** must be added to both `en.ts` and `da.ts`:

| Namespace | Description |
|-----------|-------------|
| `profile.*` | Profile page labels |
| `help.*` | Help & Support page |
| `processes.*` | Processes page |
| `projects.*` | Projects page |
| `admin.*` | Administration page |
| `platform.*` | Platform hub page |
| `developer.*` | Developer tools page |
| `mcp.*` | MCP Settings (expanded) |
| `tenants.*` | Tenant management + editor |
| `modules.*` | Modules hub page |
| `knowledge.status.*` | Article status labels |
| `knowledge.subtitle` | Knowledge page subtitle |
| `knowledge.newArticle` | New article button |
| `knowledge.searchArticles` | Search placeholder |
| `knowledge.noArticles{Desc}` | Empty state strings |
| `feedback.status*` | Session statuses (Active/Paused/Completed) |
| `feedback.pageSubtitle` | Subtitle text |
| `feedback.*` (expanded) | ~30 new keys for session detail labels |
| `workers.natsConnected` | NATS connection status |
| `workers.processed/failed/memory` | Metric labels |
| `featureFlags.matrix` | Feature Matrix button |
| `featureFlags.ringLevel{Desc}` | Ring level labels |
| `skins.newSkin` | New Skin button |
| `skins.editor.*` | Skin editor labels |
| `common.comingSoon` | "Coming Soon" badge |
| `common.notSet` | "Not set" placeholder |
| `common.default` | "Default" badge |
| `common.moreItems` | "+{n} more…" |

---

## Execution Order (Recommended)

> [!TIP]
> Start with the **highest-impact pages** (the ones users see most often) and work outward.

### Phase 1 — Quick Wins (keys already exist, just wire up `t()`) ✅ DONE
- [x] `FeaturesSettingsPage.tsx` — keys in `featureFlags.*` exist
- [x] `SkinsSettingsPage.tsx` — keys in `skins.*` exist
- [x] `WorkersPage.tsx` — keys in `workers.*` exist
- [x] `QuickChat.tsx` — keys in `quickChat.*` exist
- [x] `TopologyHubPage.tsx` — keys in `topology.*` exist

### Phase 2 — FeedbackPage (fix mixed Danish ⚠️) ✅ DONE
- [x] Add ~30 new keys to both `en.ts` and `da.ts` under `feedback.*`
- [x] Wire all hardcoded strings in `FeedbackPage.tsx`

### Phase 3 — Knowledge Pages ✅ DONE
- [x] Add new keys to `knowledge.*` namespace
- [x] Wire `KnowledgePage.tsx`
- [ ] Wire `ArticleDetailPage.tsx`
- [ ] Wire `DocumentsPage.tsx`
- [ ] Wire `TemplatesPage.tsx`
- [ ] Wire `TrainingPage.tsx` + `TrainingDetailPage.tsx`

### Phase 4 — Profile, Help, Processes, Projects ✅ DONE
- [x] Add `profile.*`, `help.*`, `processes.*`, `projects.*` namespaces
- [x] Wire `ProfilePage.tsx`
- [x] Wire `HelpPage.tsx`
- [x] Wire `ProcessesPage.tsx`
- [x] Wire `ProjectsPage.tsx`

### Phase 5 — Admin, Platform, Developer ✅ DONE
- [x] Add `admin.*`, `platform.*`, `developer.*` namespaces
- [x] Wire `AdminPage.tsx`
- [x] Wire `PlatformPage.tsx`
- [x] Wire `DeveloperPage.tsx`

### Phase 6 — Settings Detail Pages ✅
- [x] Expand `mcp.*`, `tenants.*`, `tenantEditor.*`, `skinEditor.*`, `featureMatrix.*`, `acl.*` namespaces
- [x] Wire `McpSettingsPage.tsx`
- [x] Wire `TenantsSettingsPage.tsx`
- [x] Wire `TenantEditorPage.tsx`
- [x] Wire `SkinEditorPage.tsx`
- [x] Wire `FeatureMatrixPage.tsx` + `AclMatrixPage.tsx`

### Phase 7 — Modules & Platform Detail ✅
- [x] Add `modules.*`, `health.*`, `database.*`, `feedbackTickets.*` namespaces + extend `workers.*`
- [x] Wire `ModulesHubPage.tsx`, `ModuleIndexPage.tsx`, `ModuleLayout.tsx`
- [x] Wire `HealthDashboardPage.tsx`, `DatabaseExplorerPage.tsx`
- [x] Wire `FeedbackTicketsPage.tsx`
- [x] Wire `WorkerDetailPage.tsx`

### Phase 8 — Domain Pages (PDF Refinery)
- [ ] Add `pdf-refinery.*` namespace (or per-domain namespacing)
- [ ] Wire all 18 pages in `domains/pdf-refinery/pages/`

---

## Notes

- **The `da.ts` file is type-checked** against `en.ts` via `TranslationKeys`, so any key added to `en.ts` **must** also be added to `da.ts` or TypeScript will error.
- **Fallback**: When a key is missing, `getNestedValue` returns the key path itself (e.g. `"profile.account"`), so nothing will crash — but it looks broken to the user.
- **The FeedbackPage is the most urgent fix** — it has hardcoded Danish text, so English users see an untranslated page.
