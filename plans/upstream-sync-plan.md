# Upstream Sync Plan: pdf-refinery → surdej-v1

> Generated: 2026-02-21
> Source: `/Users/niels/Code/pdf-refinery-surdej-v1` (derived instance — "PDF Refinery / Surdej")
> Target: `/Users/niels/Code/surdej-v1` (core upstream)

---

## Context

`pdf-refinery-surdej-v1` was cloned from `surdej-v1` and has since accumulated improvements that belong in the core platform. This plan lists every delta between the two repos (excluding `.surdejignore`-matched paths) and recommends an action for each.

### `.surdejignore` exclusions (will NOT be synced)

| Pattern | Matched in pdf-refinery |
|---|---|
| `/.surdej/` | `README.md`, `business-areas.md`, `company-profile.md`, `people.md`, `photos/`, `seed-surdej.ts` |
| `/apps/api/prisma/seed-surdej.ts` | Working copy of client seed |
| `/.env`, `/.env.local` | Instance-specific env |
| `node_modules/`, `dist/`, `.turbo/`, `*.tsbuildinfo` | Build artifacts |
| `.idea/`, `.vscode/` | IDE state |
| `/data/`, `/postgres-data/` | Docker volumes |
| `.DS_Store`, `Thumbs.db` | OS files |

---

## Files to Copy Upstream (pdf-refinery → surdej-v1)

### 1. New file — `.surdejignore` ✅ COPY WHOLESALE

The `.surdejignore` convention itself should live in the core so every derived project inherits it.

```
pdf-refinery:  .surdejignore  (57 lines)
surdej:  (does not exist)
Action:  cp .surdejignore → surdej-v1/.surdejignore
```

---

### 2. `surdej.yaml` — MERGE (add `authentication` block)

PDF Refinery added a Microsoft Entra ID authentication section (lines 89-96). This is generic platform config, not client-specific.

```diff
+  # Microsoft Entra ID (Azure AD) App Registration
+  authentication:
+    provider: "microsoft-entra-id"
+    app_id: "d82c0787-5b10-4faf-bc04-a792fc9195ea"
+    tenant_id: "31f35f1f-b9e8-432b-b233-d3ed528749c4"
```

**Action:** Add the `authentication:` block under `infrastructure:` in surdej-v1's `surdej.yaml`.

---

### 3. `docker-compose.yml` — MERGE (parameterise API port)

PDF Refinery made the API port configurable via env var:

```diff
-      - "127.0.0.1:5001:5001"
+      - "127.0.0.1:${API_PORT:-5001}:5001"
```

**Action:** Apply this one-line change to surdej-v1. Allows derived projects to bind to different host ports without editing the compose file.

---

### 4. `apps/frontend/vite.config.ts` — MERGE (env-driven config)

PDF Refinery converted the Vite config from a static object to a function that reads `.env` values for `FRONTEND_PORT` and `API_URL`:

| Aspect | surdej-v1 (current) | pdf-refinery (improved) |
|---|---|---|
| Config style | `defineConfig({...})` | `defineConfig(({ mode }) => {...})` |
| Port | Hardcoded `4001` | `env.FRONTEND_PORT \|\| 4001` |
| API proxy target | Hardcoded `http://localhost:5001` | `env.API_URL \|\| 'http://localhost:5001'` |
| Extra import | — | `loadEnv` from `'vite'` |

**Action:** Replace the vite.config.ts in surdej-v1 with the pdf-refinery version. This is a pure improvement that makes every instance configurable via `.env`.

---

### 5. `apps/frontend/src/lib/api.ts` — MERGE (use `||` with empty-string fallback)

```diff
-const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api';
+const BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

**Action:** Copy pdf-refinery's version. The `||` operator treats an empty string as falsy (which `??` does not), and `/api` is the correct relative path when Vite proxies are active.

---

### 6. `apps/frontend/src/routes/chat/ChatPage.tsx` — MERGE (same `||` fix)

```diff
-const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api';
+const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

**Action:** One-line change — same pattern as `api.ts`.

---

### 7. `apps/frontend/src/routes/knowledge/DocumentsPage.tsx` — MERGE (same `||` fix)

```diff
-const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
+const API_BASE = import.meta.env.VITE_API_URL || '';
```

**Action:** One-line change — same pattern.

---

### 8. `apps/frontend/src/routes/layout/QuickChat.tsx` — MERGE (same `||` fix)

```diff
-const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api';
+const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

**Action:** One-line change — same pattern.

---

### 9. `apps/frontend/src/routes/login/LoginPage.tsx` — MERGE (API health check + demo dialog)

This is the largest delta. PDF Refinery added:

- **API health check on mount** — `useEffect` that calls `/api/health` and sets `apiHealthy` state
- **Connection-lost banner** — `<WifiOff>` indicator when API is unreachable
- **Demo login dialog** — `<Dialog>` component listing `demoUsers` with click-to-login
- **Guard on submit button** — `disabled` when API is unhealthy

**Action:** Copy pdf-refinery's `LoginPage.tsx` wholesale to surdej-v1. All these features are platform-level improvements. The `demoUsers` array is already defined in the shared code; the dialog just surfaces it properly.

---

### 10. `apps/api/src/server.ts` — MERGE (Zod error handler refinement)

```diff
-    if (error instanceof ZodError) {, '/api/auth/lookup', '/api/auth/resolve-host'
+    if (error instanceof ZodError) {
```

PDF Refinery has the cleaner version (the surdej-v1 line appears to have an editing artifact with stray route strings).

**Action:** Copy pdf-refinery's line. This is a bugfix.

---

### 11. `apps/helper/package.json` — MERGE (add `dotenv` dependency)

PDF Refinery added:
```json
"dotenv": "^17.3.1"       // runtime dep
"@types/dotenv": "^8.2.3" // dev dep
```

**Action:** Add both dependencies to surdej-v1's `apps/helper/package.json`.

---

### 12. `apps/helper/src/server.ts` — MERGE (load `.env` from root)

PDF Refinery added:
```ts
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
```
And added `join` to the `path` import.

**Action:** Apply these additions to surdej-v1's helper server. This lets the helper read the root `.env` for port configuration.

---

### 13. `.surdej/agents/guidelines/instructions.md` — MERGE (DB migration docs)

PDF Refinery added a paragraph clarifying that database migrations must run inside the container network (K8s Job / Docker Exec), and updated the "Database" row in the tech-stack table.

**Action:** Merge these documentation improvements into surdej-v1's instructions.

---

### 14. `.surdej/agents/workflows/surdej-boot.md` — ⚠️ REVIEW CAREFULLY

The two versions have **fundamentally different approaches**:

| | surdej-v1 | pdf-refinery |
|---|---|---|
| Style | Step-by-step with `// turbo` annotations, explicit bash blocks | High-level prose instructions referencing `pnpm` scripts |
| DB init | Native Prisma commands | Docker exec-based |
| API start | Native `npx tsx` | Docker container |

**Action:** **Replace with pdf-refinery's version.** These workflows are never executed in the core surdej-v1 repo — they only run in derived instances. Taking the pdf-refinery version keeps them consistent across all instances.

---

### 15. `.surdej/agents/workflows/surdej-init.md` — REPLACE

PDF Refinery's version is more comprehensive (full workstation setup including `.env` generation, Docker config, deps, GitHub variable sync).

**Action:** **Replace with pdf-refinery's version.** Same rationale — never executed in core, stays consistent.

---

## Files ONLY in surdej-v1 (do NOT overwrite)

| Path | Reason |
|---|---|
| `apps/api/.data/` | Local API data directory |
| `apps/frontend/src/routes/admin/skins/` | Skin admin UI — not yet in pdf-refinery |
| `packages/core/coverage/` | Test coverage output |
| `workers/.gitkeep` | Placeholder |

These are surdej-v1–only additions; no action needed.

---

### ✅ Also Replace (2 workflow files — never executed in core)

| # | File | Recommendation |
|---|---|---|
| 14 | **`surdej-boot.md`** | **Replace** — take pdf-refinery's env-driven version |
| 15 | **`surdej-init.md`** | **Replace** — take pdf-refinery's comprehensive version |

---

## Execution Order

| # | File | Type | Risk |
|---|---|---|---|
| 1 | `.surdejignore` | New file | 🟢 Low |
| 2 | `surdej.yaml` | Merge | 🟢 Low |
| 3 | `docker-compose.yml` | Merge | 🟢 Low |
| 4 | `apps/frontend/vite.config.ts` | Replace | 🟡 Medium — test dev server starts correctly |
| 5 | `apps/frontend/src/lib/api.ts` | Merge | 🟢 Low |
| 6 | `apps/frontend/src/routes/chat/ChatPage.tsx` | Merge | 🟢 Low |
| 7 | `apps/frontend/src/routes/knowledge/DocumentsPage.tsx` | Merge | 🟢 Low |
| 8 | `apps/frontend/src/routes/layout/QuickChat.tsx` | Merge | 🟢 Low |
| 9 | `apps/frontend/src/routes/login/LoginPage.tsx` | Replace | 🟡 Medium — largest change, verify UI |
| 10 | `apps/api/src/server.ts` | Merge | 🟢 Low — bugfix |
| 11 | `apps/helper/package.json` | Merge | 🟢 Low |
| 12 | `apps/helper/src/server.ts` | Merge | 🟢 Low |
| 13 | `.surdej/agents/guidelines/instructions.md` | Merge | 🟢 Low |
| 14 | `.surdej/agents/workflows/surdej-boot.md` | Replace | 🟢 Low — never runs in core |
| 15 | `.surdej/agents/workflows/surdej-init.md` | Replace | 🟢 Low — never runs in core |

---

## Post-Sync Checklist

- [ ] Run `pnpm install` in surdej-v1 (new `dotenv` dep)
- [ ] Run `pnpm dev` and verify frontend starts on port 4001
- [ ] Verify `/api/health` proxy works
- [ ] Verify login page shows health check + demo dialog
- [ ] Commit with message: `feat: sync platform improvements from pdf-refinery instance`
