# SOP: Weekly Release

> **Process owner:** Release Manager
> **Cadence:** Weekly — T-1 (Wednesday) staging, T (Thursday) production
> **Repo:** `happy-pdf-refinery/surdej-v1`
> **Related:** `releases/schedule.yaml`, `plans/release-planning.md`

---

## Overview

Every week the team executes a controlled release following a two-day cycle:

| Day | Code | Activity |
|-----|------|----------|
| Wednesday afternoon | **T-1** | Update pre-production (staging) environment |
| Thursday afternoon  | **T**   | Deploy to production if staging passed |

The release is tracked as a **parent GitHub issue** with **4 main task issues**,
each containing sub-task checklists. This gives an auditable trail directly in
GitHub Projects.

```
📦 Release YYYY-WNN — Weekly Release (YYYY-MM-DD)            ← parent
 ├── 1️⃣  Update Pre-Production (T-1)
 │     ├── Build container images (GitHub Actions → GHCR)
 │     ├── Refresh staging database
 │     ├── Deploy staging images
 │     └── Run staging smoke tests
 ├── 2️⃣  Prepare Change (T)
 │     ├── Pre-deployment checks
 │     ├── Database backup
 │     ├── Apply changes to production
 │     └── Validate deployment
 ├── 3️⃣  Rollback Change (if NO-GO)
 │     ├── Revert services
 │     ├── Restore database (if needed)
 │     └── Verify rollback
 └── 4️⃣  Commit Change (if GO)
       ├── Stakeholder notification
       ├── Finalize release record
       └── Disable maintenance mode
```

---

## Labels

```bash
gh label create "release"    --repo happy-pdf-refinery/surdej-v1 --color "0E8A16" 2>/dev/null || true
gh label create "deployment" --repo happy-pdf-refinery/surdej-v1 --color "1D76DB" 2>/dev/null || true
```

---

## Container Images

Images are built via **GitHub Actions** and pushed to **GHCR** (`ghcr.io/happy-pdf-refinery`).

| Image | Dockerfile | Description |
|-------|-----------|-------------|
| `surdej-v1-api` | `apps/api/Dockerfile` | Fastify API server |
| `surdej-v1-frontend` | `apps/frontend/Dockerfile` | React SPA (nginx) |
| `surdej-v1-worker-pdf-refinery` | `workers/pdf-refinery/Dockerfile` | PDF refinement worker |
| `surdej-v1-worker-knowledge` | `workers/knowledge/Dockerfile` | Knowledge ingestion worker |
| `surdej-v1-worker-document` | `workers/document/Dockerfile` | Document processing worker |
| `surdej-v1-worker-pdf-extractor` | `workers/pdf-refinery/extractor/Dockerfile` | PDF extraction (Python) |
| `surdej-v1-worker-member-nosql` | `modules/member-nosql/worker/Dockerfile` | Member NoSQL module |

### Build Trigger

Container images are built on:
- **Git tag push** (e.g. `2026-W17`) — triggers the `Build Containers` workflow
- **Manual dispatch** via `workflow_dispatch` on the `Build Containers` workflow

The workflow pushes images with tags: `<git-tag>`, `<sha>`, and `latest`.

---

## Task 1 — Update Pre-Production (T-1)

**When:** Wednesday afternoon (T-1)
**Goal:** Refresh the staging environment with the upcoming release so the team
can validate before going to production.

### GitHub Issue

```
Title: 1️⃣ [YYYY-WNN] Update Pre-Production (T-1)
Labels: release, deployment
```

### Sub-tasks

#### 1.1 Build Container Images

- [ ] Tag the release commit in git: `git tag YYYY-WNN && git push origin YYYY-WNN`
- [ ] Verify the `Build Containers` GitHub Actions workflow completes successfully
- [ ] Confirm images are available in GHCR:
  ```bash
  docker pull ghcr.io/happy-pdf-refinery/surdej-v1-api:YYYY-WNN
  docker pull ghcr.io/happy-pdf-refinery/surdej-v1-frontend:YYYY-WNN
  ```

#### 1.2 Refresh Staging Database

- [ ] Create a fresh copy of production data into the staging PostgreSQL instance
  ```bash
  az postgres flexible-server restore \
    --resource-group Sweden \
    --name psql-pdf-refinery-staging \
    --source-server psql-pdf-refinery \
    --restore-point-in-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  ```
- [ ] Verify staging DB is reachable and data looks correct (spot-check key tables)

#### 1.3 Deploy Staging Images

- [ ] Update K8s manifests in `k8s/pre-production/` with the release tag
- [ ] Apply to staging K8s
  ```bash
  kubectl apply -f k8s/pre-production/
  ```
- [ ] Run Prisma migrations on staging
  ```bash
  kubectl exec deploy/surdej-api -n surdej-v1 -- pnpm exec prisma migrate deploy
  ```

#### 1.4 Run Staging Smoke Tests

- [ ] Login flow works on staging URL
- [ ] Core feature paths operational
- [ ] API health endpoint returns OK: `GET /api/health`
- [ ] NATS JetStream workers connected
- [ ] Monitoring dashboards show normal metrics
- [ ] Update release YAML status → `staging`

### Completion Criteria

| Check | Result |
|-------|--------|
| Images built in GHCR | ☐ |
| Staging DB refreshed | ☐ |
| Images deployed to staging | ☐ |
| Smoke tests passed | ☐ |
| Release YAML updated | ☐ |

### Outcome

- **All green** → proceed to Task 2 on T (Thursday)
- **Issues found** → fix and re-deploy to staging; escalate if release day is at risk

---

## Task 2 — Prepare Change (T)

**When:** Thursday afternoon (T)
**Goal:** Deploy the validated staging build to production with full safety checks.

### GitHub Issue

```
Title: 2️⃣ [YYYY-WNN] Prepare Change (T)
Labels: release, deployment
```

### Sub-tasks

#### 2.1 Pre-Deployment Checks

- [ ] Confirm staging smoke tests from T-1 are still passing
- [ ] Notify stakeholders of maintenance window
- [ ] Enable maintenance mode
  ```
  POST /api/system/maintenance { "enabled": true }
  ```
- [ ] Verify maintenance banner visible to end users
- [ ] Confirm no active long-running operations

#### 2.2 Database Backup

- [ ] Create Azure PostgreSQL point-in-time snapshot
- [ ] Verify backup completed successfully
- [ ] Record backup ID/timestamp in this issue
- [ ] Export feature flags and tenant configuration
- [ ] Confirm backup retention ≥ 48h

| Database | Backup ID | Timestamp | Verified |
|----------|-----------|-----------|----------|
| psql-pdf-refinery | _fill in_ | _fill in_ | ☐ |

#### 2.3 Apply Changes to Production

- [ ] Run `prisma migrate deploy`
- [ ] Deploy container images (api, frontend, workers) with tag `YYYY-WNN`
- [ ] Apply K8s manifests
  ```bash
  kubectl apply -f k8s/production/
  ```
- [ ] Wait for all pods `Running`
- [ ] Verify health endpoints: `GET /api/health`
- [ ] Run post-migration fixups (if any)

#### 2.4 Validate Deployment

- [ ] Smoke test: login flow
- [ ] Smoke test: core feature paths
- [ ] API responses match expected schema
- [ ] Monitoring dashboards — latency, error rate, CPU/memory
- [ ] `prisma migrate status` shows no pending migrations
- [ ] Feature flags in expected state
- [ ] NATS JetStream worker connectivity

| Check | Status | Notes |
|-------|--------|-------|
| Login | | |
| Core features | | |
| Error rate | | |
| Workers | | |

#### 2.5 Go / No-Go Decision

Evaluate all sub-tasks above and make a structured decision:

**Go Criteria (ALL required):**
- [ ] All health checks passing
- [ ] No critical/high blocking issues
- [ ] Backup verified and accessible
- [ ] Core user flows validated
- [ ] Stable monitoring metrics

**No-Go Triggers (ANY → Task 3):**
- Critical issue found
- Data integrity concern
- Security vulnerability
- \>2 high-severity issues without workaround

> **Decision:** ☐ GO → proceed to **Task 4** / ☐ NO-GO → proceed to **Task 3**
> **Decided by:** ___
> **Timestamp:** ___
> **Rationale:** ___

---

## Task 3 — Rollback Change (NO-GO path)

**When:** Immediately after a NO-GO decision in Task 2
**Goal:** Safely revert production to the previous known-good state.

### GitHub Issue

```
Title: 3️⃣ [YYYY-WNN] Rollback Change
Labels: release, deployment
```

### Sub-tasks

#### 3.1 Revert Services

- [ ] Identify previous stable image tags

| Service | Previous Tag | Current Tag |
|---------|-------------|-------------|
| api | _fill in_ | YYYY-WNN |
| frontend | _fill in_ | YYYY-WNN |
| workers | _fill in_ | YYYY-WNN |

- [ ] Roll back K8s deployments to previous image tags
  ```bash
  kubectl set image deployment/surdej-api api=ghcr.io/happy-pdf-refinery/surdej-v1-api:<prev>
  kubectl set image deployment/surdej-frontend frontend=ghcr.io/happy-pdf-refinery/surdej-v1-frontend:<prev>
  ```
- [ ] Wait for rollout to complete
  ```bash
  kubectl rollout status deployment/surdej-api -n surdej-v1
  kubectl rollout status deployment/surdej-frontend -n surdej-v1
  ```
- [ ] Verify pods running with previous version
- [ ] Confirm health endpoints return OK

#### 3.2 Restore Database (if needed)

- [ ] Determine if DB restore is needed (schema changed? data corrupted?)
  - If no schema/data changes → skip restore, mark as N/A
- [ ] Retrieve backup ID from Task 2 (sub-task 2.2)
- [ ] Restore Azure PostgreSQL from backup
  ```bash
  az postgres flexible-server restore \
    --resource-group Sweden \
    --name psql-pdf-refinery-restored \
    --source-server psql-pdf-refinery \
    --restore-point-in-time <timestamp-from-task-2>
  ```
- [ ] Update connection strings to point to restored server (or swap)
- [ ] Verify data integrity — spot-check key tables
- [ ] `prisma migrate status` confirms migration state matches previous version

| Database | Backup Used | Restore Timestamp | Verified |
|----------|-------------|-------------------|----------|
| psql-pdf-refinery | _from Task 2_ | | ☐ |

#### 3.3 Verify Rollback & Disable Maintenance

- [ ] Full smoke test on reverted production
- [ ] Monitoring dashboards show pre-deployment baseline
- [ ] Disable maintenance mode
  ```
  POST /api/system/maintenance { "enabled": false }
  ```
- [ ] Verify maintenance banner removed
- [ ] Update release YAML status → `cancelled`
- [ ] Document root cause and next steps in this issue

### Post-Rollback

- [ ] Schedule post-mortem within 24 hours
- [ ] Create follow-up issue(s) for the blocking problem
- [ ] Communicate rollback outcome to stakeholders

---

## Task 4 — Commit Change (GO path)

**When:** Immediately after a GO decision in Task 2
**Goal:** Finalize the release, notify stakeholders, and return the platform to
normal operation.

### GitHub Issue

```
Title: 4️⃣ [YYYY-WNN] Commit Change
Labels: release, deployment
```

### Sub-tasks

#### 4.1 Stakeholder Notification

- [ ] Send release announcement
  - Version: `YYYY-WNN`
  - Release date: `YYYY-MM-DD`
  - Summary of changes (link to release notes)
- [ ] Notify support team of new features / known caveats
- [ ] Update internal changelog / wiki

#### 4.2 Finalize Release Record

- [ ] Close all task issues (1–3 if opened, otherwise 1–2)
- [ ] Update release YAML status → `complete`
  ```yaml
  status: complete
  production:
    deployed_at: "YYYY-MM-DDTHH:MM:SSZ"
    deployed_by: "<name>"
  ```
- [ ] Tag release in git (if not already tagged in Task 1)
  ```bash
  git tag YYYY-WNN && git push origin YYYY-WNN
  ```
- [ ] Verify release notes published on GitHub Releases

#### 4.3 Disable Maintenance Mode

- [ ] Disable maintenance flag
  ```
  POST /api/system/maintenance { "enabled": false }
  ```
- [ ] Verify maintenance banner is no longer visible
- [ ] Confirm system is accessible to all users
- [ ] Document maintenance window duration

### Release Summary

> **Release:** `YYYY-WNN`
> **Deployed at:** ___
> **Maintenance window:** _start_ → _end_ (_duration_)
> **Outcome:** ✅ Success

---

## Timeline Summary

```
Wednesday (T-1)
  14:00  ─── Task 1: Update Pre-Production ──────────────────
              1.1 Build containers (GitHub Actions → GHCR)
              1.2 Refresh staging DB
              1.3 Deploy staging images
              1.4 Smoke tests
         ─── End of T-1 ─────────────────────────────────────

Thursday (T)
  14:00  ─── Task 2: Prepare Change ─────────────────────────
              2.1 Pre-deployment checks + maintenance mode
              2.2 Database backup
              2.3 Apply changes to production
              2.4 Validate deployment
              2.5 Go / No-Go decision
         ─────────────────────────────────────────────────────
              │
              ├── GO    → Task 4: Commit Change
              │           4.1 Notify stakeholders
              │           4.2 Finalize release record
              │           4.3 Disable maintenance
              │
              └── NO-GO → Task 3: Rollback Change
                          3.1 Revert services
                          3.2 Restore database
                          3.3 Verify & disable maintenance
```

---

## Automation

Create all issues for a release using the release issue script:

```bash
./usecases/weekly-release/create-release-issues.ps1 -Release YYYY-WNN -ReleaseDate YYYY-MM-DD
```

This creates the parent issue and all sub-issues with the checklists above.

---

## References

- [SOP - Weekly Release](sop.md)
- [Release Plan 2026](plan-2026.md)
- [Build Containers Workflow](../../.github/workflows/build-containers.yml)
- [Deploy AKS Workflow](../../.github/workflows/deploy-aks.yml)
- [K8s Manifests](../../k8s/)
