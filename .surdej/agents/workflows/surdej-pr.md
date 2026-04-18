---
name: surdej-pr
description: Analyze a pull request's changes, assess impact, and recommend developer actions (install, migrate, rebuild, restart)
---

## Objective

Inspect the current branch's pull request (or diff against `main`), categorize every changed
file by impact area, and produce a clear **impact summary** plus an **actionable checklist**
of commands the developer should run to get their local environment in sync.

## Steps

### 1. Identify the Pull Request

- Detect the current branch and look for an active GitHub PR.
  ```bash
  echo "Branch: $(git branch --show-current)"
  gh pr view --json number,title,url,baseRefName,headRefName,state 2>/dev/null || echo "No open PR found — will diff against main"
  ```
- If no PR exists, fall back to comparing against `origin/main`.

### 2. Gather the Changed Files

- List all files changed in the PR (or branch diff).
  // turbo
  ```bash
  BASE=$(gh pr view --json baseRefName -q '.baseRefName' 2>/dev/null || echo "main")
  git fetch origin "$BASE" --quiet 2>/dev/null
  git diff --stat "origin/$BASE"...HEAD
  echo "---"
  git diff --name-only "origin/$BASE"...HEAD
  ```

### 3. Categorize Changes by Impact Area

For each changed file, classify it into one or more of the following categories.
Use the path prefixes as the primary signal:

| Category | Path patterns | Impact |
|----------|--------------|--------|
| **Dependencies** | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `*/package.json` | Need `pnpm install` |
| **Database / Prisma** | `**/prisma/**`, `*.prisma`, `**/migrations/**` | Need migration run |
| **Docker / Infrastructure** | `docker-compose*.yml`, `Dockerfile*`, `infra/**`, `k8s/**` | Need Docker rebuild/restart |
| **API code** | `apps/api/**` | Need API restart (or hot-reload if using tsx watch) |
| **Frontend code** | `apps/frontend/**` | Usually hot-reloaded by Vite; may need restart for config changes |
| **Worker code** | `workers/**`, `modules/*/worker/**` | Need worker restart |
| **Module shared DTOs** | `modules/*/shared/**` | Rebuild shared package, restart consumers |
| **Module UI** | `modules/*/ui/**` | Frontend hot-reload or restart |
| **Environment / Config** | `.env*`, `surdej.yaml`, `*.config.*`, `tsconfig*` | May need env update or full restart |
| **Kubernetes manifests** | `k8s/**`, `infra/k8s/**` | Need `kubectl apply` for production |
| **Skins / Commands** | `apps/frontend/src/skins/**`, `**/commands.ts` | Skin or command registry changes |
| **Specs / Docs** | `specs/**`, `docs/**`, `plans/**`, `*.md` | Informational only — no action needed |
| **CI / GitHub** | `.github/**`, `scripts/**` | Pipeline changes — review needed |

### 4. Detect Specific Signals

Scan the actual diff content for high-impact patterns:

```bash
BASE=$(gh pr view --json baseRefName -q '.baseRefName' 2>/dev/null || echo "main")

echo "=== Prisma schema changes ==="
git diff "origin/$BASE"...HEAD -- '**/*.prisma' --stat 2>/dev/null | head -20

echo ""
echo "=== New migrations ==="
git diff --name-only "origin/$BASE"...HEAD | grep -i 'migration' | head -20

echo ""
echo "=== package.json dependency changes ==="
git diff "origin/$BASE"...HEAD -- '**/package.json' | grep -E '^\+.*"(dependencies|devDependencies|peerDependencies)"' | head -10

echo ""
echo "=== New/changed environment variables ==="
git diff "origin/$BASE"...HEAD -- '.env*' 'docker-compose*.yml' | grep -E '^\+.*[A-Z_]{3,}=' | head -20

echo ""
echo "=== Docker image or build changes ==="
git diff "origin/$BASE"...HEAD -- 'Dockerfile*' 'docker-compose*.yml' --stat 2>/dev/null | head -10
```

### 5. Generate Impact Report

Compile the analysis into a structured report with these sections:

#### A. PR Summary
- PR number, title, branch, state
- Total files changed, insertions, deletions

#### B. Impact Areas Table

| Area | Files Changed | Impact Level | Details |
|------|--------------|-------------|---------|
| Dependencies | N | 🔴 High / 🟡 Medium / 🟢 Low | ... |
| Database | N | ... | ... |
| ... | ... | ... | ... |

Impact levels:
- 🔴 **High** — Requires manual action before the app will work
- 🟡 **Medium** — Recommended action, but app may partially work without it
- 🟢 **Low** — Informational, auto-handled, or no action needed

#### C. Required Actions Checklist

Present a numbered checklist of commands to run, **in the correct order**.
Only include actions that are actually needed based on the detected changes.

Possible actions (include only if relevant):

1. **Install dependencies** — `pnpm install`
   *(When: package.json or pnpm-lock.yaml changed)*

2. **Rebuild Docker containers** — `docker compose build` or `docker compose up -d --build`
   *(When: Dockerfile or docker-compose.yml changed)*

3. **Restart Docker infrastructure** — `docker compose down && docker compose up -d`
   *(When: docker-compose.yml service config changed)*

4. **Run API database migrations** — `pnpm db:migrate`
   *(When: apps/api/prisma/ migrations added or schema changed)*

5. **Run module database migrations** — `cd modules/<name>/worker && pnpm prisma:migrate`
   *(When: module prisma schemas changed — list specific modules)*

6. **Regenerate Prisma client** — `pnpm exec prisma generate`
   *(When: .prisma schema changed but no new migration files)*

7. **Restart API server** — restart the `pnpm dev:api` process
   *(When: API source code changed, especially config/plugin registration)*

8. **Restart workers** — restart specific worker processes
   *(When: worker code changed — list which workers)*

9. **Restart frontend** — restart `pnpm dev` (rare, Vite HMR handles most)
   *(When: vite.config.ts, tailwind config, or tsconfig changed)*

10. **Update .env file** — check for new/changed environment variables
    *(When: .env.example or docker-compose env vars changed)*

11. **Apply Kubernetes manifests** — `kubectl apply -f k8s/`
    *(When: k8s/ or infra/k8s/ manifests changed — production only)*

#### D. Notable Changes

Highlight anything that deserves extra attention:
- Breaking API changes (new required fields, removed endpoints)
- New feature flags
- New domain commands or skin changes
- Security-related changes (auth, MSAL config)
- New module registrations

### 6. Offer Follow-Up

After presenting the report, ask the developer:
> "Would you like me to run any of these actions now?"
