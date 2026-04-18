# Surdej v1 — Generalization Plan

> Goal: Remove all Example-Tenant / pdf-refinery / example.com domain-specific content so Surdej is a clean, generic application framework starter.

---

## Phase 1 — Delete domain-specific modules, workers & domains

- [ ] Delete `modules/pdf-refinery-core/`
- [ ] Delete `modules/pdf-refinery-prospects/`
- [ ] Delete `workers/prospect-harvester/`
- [ ] Delete `workers/mcp-prospects/`
- [ ] Delete `apps/frontend/src/domains/pdf-refinery/`
- [ ] Delete `apps/api/src/domains/pdf-refinery/`
- [ ] Delete `.pdf-refinery/` (if present)
- [ ] Remove pdf-refinery-prospects and prospect-harvester services from `docker-compose.yml`
- [ ] Remove pdf-refinery imports/registrations from frontend domain index (`apps/frontend/src/domains/index.ts` or equivalent)
- [ ] Remove pdf-refinery imports/registrations from API domain index (`apps/api/src/domains/index.ts` or equivalent)

## Phase 2 — Delete Example-Tenant seed data & utility scripts

- [ ] Delete `seed-surdej-prod.mjs`
- [ ] Delete `apps/api/prisma/seed-surdej.ts`
- [ ] Delete `modules/tool-management-tools/worker/prisma/seed-pdf-refinery.ts` (if present)
- [ ] Delete `apps/api/src/trigger-example-tenant.ts`
- [ ] Delete root utility scripts: `list_tenants.mjs`, `remote_reprocess.mjs`, `trigger_prod.mjs`, `trigger_prod_all.mjs`, `test-chat-uploads.mjs`
- [ ] Delete temp/test files: `test.csv`, `test.json`, `test.txt`, `resume.md`, `temp_seed.ts`
- [ ] Update `apps/api/prisma/seed.ts` — remove any import/call to `seed-surdej`
- [ ] Update `apps/api/src/check-status.ts` — remove example-tenant reference (line 14)
- [ ] Update `apps/api/src/cli.ts` — remove example-tenant example URL (line 237)

## Phase 3 — Generalize configuration & infrastructure

- [ ] `surdej.yaml` — replace all Example-Tenant values with generic placeholders (`your-org`, `your-cluster`, etc.)
- [ ] `docker-compose.override.yml` — remove any red-specific overrides
- [ ] `.vscode/tasks.json` — remove Cloudflare tunnel task referencing `niels-macmini-happy-pdf-refinery`
- [ ] K8s manifests — parameterize or template:
  - [ ] `k8s/infrastructure.yaml`
  - [ ] `k8s/production/ingress.yaml`
  - [ ] `k8s/production/deployment.yaml`
  - [ ] `k8s/canary/secret-provider-class.yaml`
  - [ ] `k8s/production/README.md`
- [ ] GitHub Actions / CI — update any `happy-pdf-refinery` org references
- [ ] `package.json` — update repo URL if it points to `happy-pdf-refinery`

## Phase 4 — Clean up skins & commands

- [ ] Remove or generalize any skin that references pdf-refinery commands (check `apps/frontend/src/skins/`)
- [ ] Remove pdf-refinery command registrations from any shared command files
- [ ] Ensure default skin only references generic/example commands

## Phase 5 — Clean up documentation, plans & specs

- [ ] `specs/core/00-project-overview.md` — remove "pdf-refinery-happymate-framework" reference
- [ ] `specs/core/10-devops-and-deployment.md` — generalize DOMAIN var
- [ ] `specs/core/13-vscode-patterns.md` — update pdf-refinery examples to generic
- [ ] `plan/translations.md` — remove pdf-refinery-specific entries
- [ ] `plans/project-management-v1.md` — remove Example Tenant team structure or delete
- [ ] `plans/upstream-sync-plan.md` — remove seed-surdej references
- [ ] `summary.md` — remove example-tenant endpoint URL
- [ ] `.surdej/superprompts/browser-extension.md` — remove example-tenant endpoint
- [ ] `.surdej/agents/workflows/surdej-cloudflare.md` — remove example-tenant references
- [ ] `demo/` folder — delete or replace with generic demo content
- [ ] `usecases/weekly-release/` — generalize org/cluster references or delete release-specific scripts
- [ ] `partners/` — remove Example-Tenant partner content if present

## Phase 6 — Update Prisma & seed to generic example

- [ ] Ensure Prisma seed creates a generic example tenant (e.g. `acme-corp`)
- [ ] Remove any pdf-refinery-specific comments in Prisma schemas
- [ ] Verify migrations still apply cleanly

## Phase 7 — Validate

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds (or fix broken imports from deleted modules)
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Docker compose starts without errors (infra only)
- [ ] Frontend loads with default skin, no pdf-refinery pages
- [ ] Grep for remaining `red|pdf-refinery|example-tenant|red\.dk|happy-pdf-refinery|surdej|example-external-service|prospect` — zero hits outside this plan file

---

## What stays (generic framework core)

- Command system & CommandRegistry
- Skinning / sidebar (command-ID based)
- Feature flags (ring-based)
- Auth (MSAL, ACL, tenancy)
- Domain extension pattern (manifests)
- Module pattern (`member-*` examples)
- Workers: PDF refinery, knowledge, document, extraction (generic AI/data processing)
- API framework: Fastify + Prisma + NATS
- Frontend: React 19, Vite, Tailwind, Shadcn UI
- E2E testing (Playwright)
- K8s templates (after parameterization)
- VS Code extension scaffold
- MCP helper scaffold
