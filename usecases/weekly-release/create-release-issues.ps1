#Requires -Version 7
<#
.SYNOPSIS
    Creates a parent release issue with 4 task sub-issues matching the weekly release SOP.
.DESCRIPTION
    Creates GitHub issues for the 4-task SOP model: usecases/weekly-release/sop.md
.PARAMETER Release
    Release name (e.g. 2026-W17, 2026-W17-E1)
.PARAMETER ReleaseDate
    Release date in YYYY-MM-DD format
.EXAMPLE
    ./create-release-issues.ps1 -Release 2026-W17 -ReleaseDate 2026-04-23
    ./create-release-issues.ps1 2026-W17-E1 2026-04-24
#>
param(
    [Parameter(Mandatory)][string]$Release,
    [Parameter(Mandatory)][string]$ReleaseDate
)

$ErrorActionPreference = 'Stop'
$Repo = "your-org/surdej-v1"
$StagingDate = ([datetime]::Parse($ReleaseDate)).AddDays(-1).ToString("yyyy-MM-dd")
$IsEmergency = $Release -match '-E\d+$'
$Labels = if ($IsEmergency) { "release,deployment,emergency" } else { "release,deployment" }
$ReleaseType = if ($IsEmergency) { "🚨 Emergency release" } else { "Regular release" }

Write-Host "📦 Creating weekly release issues for $Release"
Write-Host "   Repo:          $Repo"
Write-Host "   Type:          $ReleaseType"
Write-Host "   Staging (T-1): $StagingDate"
Write-Host "   Release (T):   $ReleaseDate"
Write-Host ""

# ── Ensure labels exist ─────────────────────────────────────────
foreach ($label in @("release", "deployment", "emergency")) {
    $existing = gh label list --repo $Repo --search $label --json name --jq '.[].name' 2>$null
    if ($existing -notcontains $label) {
        Write-Host "Creating label: $label"
        $color = switch ($label) { "release" { "0E8A16" } "deployment" { "1D76DB" } "emergency" { "D93F0B" } }
        gh label create $label --repo $Repo --color $color --description "$label tracking" 2>$null
    }
}

# ── Helper: create issue and return number ──────────────────────
function New-GhIssue([string]$Title, [string]$Body, [string]$IssueLabels = $Labels) {
    $url = gh issue create --repo $Repo --title $Title --body $Body --label $IssueLabels
    return ($url -split '/')[-1]
}

function Add-SubIssue([string]$ParentNum, [string]$ChildNum) {
    $childId = gh api "/repos/$Repo/issues/$ChildNum" --jq '.id'
    gh api --method POST "/repos/$Repo/issues/$ParentNum/sub_issues" -F sub_issue_id=$childId --silent 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠ Sub-issue linking failed for #$ChildNum."
    }
}

# ── Task 1: Update Pre-Production ──────────────────────────────
Write-Host "Creating Task 1: Update Pre-Production..."
$Task1 = New-GhIssue "1️⃣ [$Release] Update Pre-Production (T-1: $StagingDate)" @"
## Task 1: Update Pre-Production

**Release:** $Release
**Staging Date (T-1):** $StagingDate
**Release Date (T):** $ReleaseDate
**Type:** $ReleaseType

---

### 1.1 Build Container Images (GitHub Actions → GHCR)
- [ ] Tag the release commit: ``git tag $Release && git push origin $Release``
- [ ] Verify ``Build Containers`` workflow completes in GitHub Actions
- [ ] Confirm images available in GHCR:
  | Service | Image | Tag |
  |---------|-------|-----|
  | api | ghcr.io/your-org/surdej-v1-api | $Release |
  | frontend | ghcr.io/your-org/surdej-v1-frontend | $Release |
  | worker-pdf-refinery | ghcr.io/your-org/surdej-v1-worker-pdf-refinery | $Release |
  | worker-knowledge | ghcr.io/your-org/surdej-v1-worker-knowledge | $Release |
  | worker-document | ghcr.io/your-org/surdej-v1-worker-document | $Release |
  | worker-pdf-extractor | ghcr.io/your-org/surdej-v1-worker-pdf-extractor | $Release |
  | worker-member-nosql | ghcr.io/your-org/surdej-v1-worker-member-nosql | $Release |

### 1.2 Refresh Staging Database
- [ ] Create fresh copy of production data into staging PostgreSQL
- [ ] Verify staging DB is reachable and data looks correct

### 1.3 Deploy Staging Images
- [ ] Update image tags in ``k8s/pre-production/`` manifests
- [ ] Apply to staging K8s
- [ ] Run Prisma migrations on staging

### 1.4 Run Staging Smoke Tests
- [ ] Login flow works on staging URL
- [ ] Core feature paths operational
- [ ] API health endpoint returns OK
- [ ] NATS JetStream workers connected
- [ ] Update release YAML status → ``staging``

### Completion
| Check | Result |
|-------|--------|
| Images built in GHCR | ☐ |
| Staging DB refreshed | ☐ |
| Images deployed to staging | ☐ |
| Smoke tests passed | ☐ |
| Release YAML updated | ☐ |

> **All green** → proceed to Task 2 on T ($ReleaseDate)
> **Issues found** → fix and re-deploy; escalate if release day is at risk
"@
Write-Host "  ✅ Task 1 created: #$Task1"

# ── Task 2: Prepare Change ─────────────────────────────────────
Write-Host "Creating Task 2: Prepare Change..."
$Task2 = New-GhIssue "2️⃣ [$Release] Prepare Change (T: $ReleaseDate)" @"
## Task 2: Prepare Change

**Release:** $Release
**Release Date (T):** $ReleaseDate
**Depends on:** #$Task1 (staging must be validated)
**Type:** $ReleaseType

---

### 2.1 Pre-Deployment Checks
- [ ] Confirm staging smoke tests from T-1 are still passing
- [ ] Notify stakeholders of maintenance window
- [ ] Enable maintenance mode
- [ ] Verify maintenance banner visible to end users

### 2.2 Database Backup
- [ ] Create Azure PostgreSQL point-in-time snapshot
- [ ] Verify backup completed successfully
- [ ] Record backup ID/timestamp in this issue
- [ ] Confirm backup retention ≥ 48h

| Database | Backup ID | Timestamp | Verified |
|----------|-----------|-----------|----------|
| psql-surdej | _fill in_ | _fill in_ | ☐ |

### 2.3 Apply Changes to Production
- [ ] Run ``prisma migrate deploy``
- [ ] Deploy container images with tag ``$Release``
- [ ] Apply K8s manifests
- [ ] Wait for all pods ``Running``
- [ ] Verify health endpoints

### 2.4 Validate Deployment
- [ ] Smoke test: login flow
- [ ] Smoke test: core feature paths
- [ ] Monitoring dashboards — latency, error rate, CPU/memory
- [ ] Feature flags in expected state
- [ ] NATS JetStream worker connectivity

| Check | Status | Notes |
|-------|--------|-------|
| Login | | |
| Core features | | |
| Error rate | | |
| Workers | | |

### 2.5 Go / No-Go Decision

**Go Criteria (ALL required):**
- [ ] All health checks passing
- [ ] No critical/high blocking issues
- [ ] Backup verified and accessible
- [ ] Core user flows validated
- [ ] Stable monitoring metrics

> **Decision:** ☐ GO → Task 4 / ☐ NO-GO → Task 3
> **Decided by:** ___
> **Timestamp:** ___
> **Rationale:** ___
"@
Write-Host "  ✅ Task 2 created: #$Task2"

# ── Task 3: Rollback Change ────────────────────────────────────
Write-Host "Creating Task 3: Rollback Change..."
$Task3 = New-GhIssue "3️⃣ [$Release] Rollback Change" @"
## Task 3: Rollback Change (NO-GO path)

**Release:** $Release
**Triggered by:** NO-GO decision in #$Task2
**Type:** $ReleaseType

> ⚠️ **Only execute this task if the Go/No-Go decision in Task 2 is NO-GO.**

---

### 3.1 Revert Services
- [ ] Identify previous stable image tags
- [ ] Roll back K8s deployments to previous image tags
- [ ] Wait for rollout to complete
- [ ] Verify pods running with previous version
- [ ] Confirm health endpoints return OK

### 3.2 Restore Database (if needed)
- [ ] Determine if DB restore is needed (schema changed? data corrupted?)
- [ ] Retrieve backup ID from Task 2 (sub-task 2.2)
- [ ] Restore Azure PostgreSQL from backup
- [ ] Verify data integrity

### 3.3 Verify Rollback & Disable Maintenance
- [ ] Full smoke test on reverted production
- [ ] Monitoring dashboards show pre-deployment baseline
- [ ] Disable maintenance mode
- [ ] Update release YAML status → ``cancelled``
- [ ] Document root cause and next steps

### Post-Rollback
- [ ] Schedule post-mortem within 24h
- [ ] Create follow-up issue(s) for blocking problem
- [ ] Communicate rollback outcome to stakeholders
"@
Write-Host "  ✅ Task 3 created: #$Task3"

# ── Task 4: Commit Change ──────────────────────────────────────
Write-Host "Creating Task 4: Commit Change..."
$Task4 = New-GhIssue "4️⃣ [$Release] Commit Change" @"
## Task 4: Commit Change (GO path)

**Release:** $Release
**Triggered by:** GO decision in #$Task2
**Type:** $ReleaseType

> ✅ **Only execute this task if the Go/No-Go decision in Task 2 is GO.**

---

### 4.1 Disable Maintenance Mode
- [ ] Disable maintenance mode
- [ ] Verify maintenance banner removed
- [ ] Confirm system accessible to all users

### 4.2 Stakeholder Notification
- [ ] Send release announcement
- [ ] Notify support team of new features / known caveats

### 4.3 Finalize Release Record
- [ ] Close all task issues
- [ ] Update release YAML status → ``complete``
- [ ] Verify git tag ``$Release`` exists
- [ ] Verify release notes published on GitHub Releases

### Release Summary
> **Release:** ``$Release``
> **Deployed at:** ___
> **Maintenance window:** _start_ → _end_ (_duration_)
> **Outcome:** ✅ Success
"@
Write-Host "  ✅ Task 4 created: #$Task4"

# ── Parent Issue ───────────────────────────────────────────────
Write-Host ""
Write-Host "Creating parent issue..."
$Parent = New-GhIssue "📦 Release $Release — Weekly Release ($ReleaseDate)" @"
# Release $Release

**Type:** $ReleaseType
**Staging (T-1):** $StagingDate
**Release (T):** $ReleaseDate

## Tasks
- [ ] #$Task1 — Update Pre-Production (T-1)
- [ ] #$Task2 — Prepare Change (T)
- [ ] #$Task3 — Rollback (NO-GO path)
- [ ] #$Task4 — Commit (GO path)

## Container Registry
All images are built via GitHub Actions and pushed to GHCR: ``ghcr.io/your-org/surdej-v1-*``

## Status
| Phase | Status | Timestamp |
|-------|--------|-----------|
| Staging | ☐ | |
| Production | ☐ | |
| Outcome | ☐ | |
"@
Write-Host "  ✅ Parent created: #$Parent"

# ── Link sub-issues ────────────────────────────────────────────
Write-Host ""
Write-Host "Linking sub-issues to parent #$Parent..."
foreach ($child in @($Task1, $Task2, $Task3, $Task4)) {
    Add-SubIssue $Parent $child
    Write-Host "  ✅ Linked #$child → #$Parent"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ All issues created for $Release"
Write-Host ""
Write-Host "  Parent: #$Parent"
Write-Host "  Task 1: #$Task1 (Pre-Prod)"
Write-Host "  Task 2: #$Task2 (Prepare)"
Write-Host "  Task 3: #$Task3 (Rollback)"
Write-Host "  Task 4: #$Task4 (Commit)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
