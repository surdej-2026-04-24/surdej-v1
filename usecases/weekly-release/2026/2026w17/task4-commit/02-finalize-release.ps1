#Requires -Version 7
<#
.SYNOPSIS
    Task 4 / Step 2: Finalize Release
.DESCRIPTION
    Tags the release in git and updates the release YAML.
.EXAMPLE
    ./02-finalize-release.ps1
#>

$ErrorActionPreference = 'Stop'

$Repo = "your-org/surdej-v1"
$Release = "2026-W17"
$ReleaseDate = "2026-04-23"
$RepoRoot = git rev-parse --show-toplevel
$ReleaseYaml = "$RepoRoot/releases/2026/2026-W17.yaml"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Finalize Release $Release"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# ── Tag release ────────────────────────────────────────────────
Write-Host "🏷️  Tagging release..."
$existingTag = git tag -l $Release
if ($existingTag) {
    Write-Host "  Tag $Release already exists"
} else {
    git tag $Release
    Write-Host "  Created tag: $Release"
    Write-Host "  ⚠️  Run 'git push origin $Release' to push the tag"
}

# ── Update release YAML ──────────────────────────────────────
if (Test-Path $ReleaseYaml) {
    Write-Host ""
    Write-Host "📝 Updating release YAML..."
    $DeployedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $DeployedBy = git config user.name 2>$null
    if (-not $DeployedBy) { $DeployedBy = "unknown" }

    $content = Get-Content $ReleaseYaml -Raw
    $content = $content -replace 'status: .*', "status: complete"
    $content = $content -replace 'deployed_at: null', "deployed_at: `"$DeployedAt`""
    $content = $content -replace 'deployed_by: null', "deployed_by: `"$DeployedBy`""
    Set-Content -Path $ReleaseYaml -Value $content -NoNewline
    Write-Host "  ✅ Updated $ReleaseYaml"
} else {
    Write-Host "  ⚠️  Release YAML not found: $ReleaseYaml"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Release $Release finalized!"
Write-Host ""
Write-Host "  Release:    $Release"
Write-Host "  Date:       $ReleaseDate"
Write-Host "  Deployed:   $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
Write-Host "  Outcome:    ✅ Success"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
