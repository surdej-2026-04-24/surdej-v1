#Requires -Version 7
<#
.SYNOPSIS
    Task 1 / Step 1: Build Container Images via GitHub Actions
.DESCRIPTION
    Tags the release commit and triggers the Build Containers GitHub Actions workflow.
    Images are built in CI and pushed to GHCR (ghcr.io/your-org).
.PARAMETER Tag
    Image tag (e.g. 2026-W17). Defaults to 2026-W17.
.EXAMPLE
    ./01-build-containers.ps1 -Tag 2026-W17
#>
param(
    [string]$Tag = "2026-W17"
)

$ErrorActionPreference = 'Stop'

$Registry = "ghcr.io/your-org"
$ImagePrefix = "surdej-v1"
$Repo = "your-org/surdej-v1"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Build Container Images → $Registry"
Write-Host "  Tag: $Tag"
Write-Host "  Method: GitHub Actions → GHCR"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# ── Create and push git tag ────────────────────────────────────
$existingTag = git tag -l $Tag
if ($existingTag) {
    Write-Host "🏷️  Tag $Tag already exists locally"
} else {
    Write-Host "🏷️  Creating tag: $Tag"
    git tag $Tag
}

Write-Host "🚀 Pushing tag to trigger GitHub Actions workflow..."
git push origin $Tag 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push tag"
    exit 1
}
Write-Host "✅ Tag pushed — Build Containers workflow should be triggered"

# ── Wait for workflow to start ─────────────────────────────────
Write-Host ""
Write-Host "⏳ Waiting for workflow to start..."
Start-Sleep -Seconds 10

$runId = gh run list --repo $Repo --workflow "Build Containers" --branch $Tag --limit 1 --json databaseId --jq '.[0].databaseId' 2>$null
if (-not $runId) {
    Write-Host "⚠️  Could not find workflow run. Check GitHub Actions manually:"
    Write-Host "   https://github.com/$Repo/actions/workflows/build-containers.yml"
    Write-Host ""
    Write-Host "Once the build completes, verify images are available:"
    Write-Host "   docker pull $Registry/$ImagePrefix-api:$Tag"
    Write-Host "   docker pull $Registry/$ImagePrefix-frontend:$Tag"
    exit 0
}

Write-Host "📋 Workflow run: $runId"
Write-Host "🔗 https://github.com/$Repo/actions/runs/$runId"
Write-Host ""

# ── Watch the workflow ─────────────────────────────────────────
Write-Host "⏳ Watching workflow (this may take several minutes)..."
gh run watch $runId --repo $Repo --exit-status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build Containers workflow failed!"
    Write-Host "   Review logs: https://github.com/$Repo/actions/runs/$runId"
    exit 1
}

# ── Verify images ──────────────────────────────────────────────
Write-Host ""
Write-Host "🔍 Verifying images in GHCR..."

$Images = @(
    "api",
    "frontend",
    "worker-pdf-refinery",
    "worker-knowledge",
    "worker-document",
    "worker-pdf-extractor",
    "worker-member-nosql"
)

$Found = 0
$Missing = @()

foreach ($name in $Images) {
    $fullImage = "$Registry/$ImagePrefix-$name"
    # Check if the image exists via gh api
    $result = gh api "/orgs/your-org/packages/container/$ImagePrefix-$name/versions" --jq ".[].metadata.container.tags[]" 2>$null
    if ($result -and ($result -split "`n") -contains $Tag) {
        Write-Host "  ✅ ${fullImage}:${Tag}"
        $Found++
    } else {
        Write-Host "  ⚠️  ${fullImage}:${Tag} — not found (may need more time)"
        $Missing += $name
    }
}

# ── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Build workflow completed"
Write-Host "  Found: $Found / $($Images.Count) images"
if ($Missing.Count -gt 0) {
    Write-Host "  ⚠️  Missing: $($Missing -join ', ')"
    Write-Host "     (Some images may not have been built if sources were unchanged)"
}
Write-Host "  Tag: $Tag"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
