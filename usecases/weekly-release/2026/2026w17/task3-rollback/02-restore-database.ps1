#Requires -Version 7
<#
.SYNOPSIS
    Task 3 / Step 2: Restore Database
.DESCRIPTION
    Restores production database from the pre-release backup.
    Only needed if migrations changed the schema.
.PARAMETER BackupName
    The backup name from Task 2 Step 2 (e.g. pre-2026-W17-20260423-140000).
.PARAMETER RestoreTime
    The restore point timestamp (e.g. 2026-04-23T13:55:00Z).
.EXAMPLE
    ./02-restore-database.ps1 -BackupName pre-2026-W17-20260423-140000 -RestoreTime 2026-04-23T13:55:00Z
#>
param(
    [Parameter(Mandatory)][string]$BackupName,
    [Parameter(Mandatory)][string]$RestoreTime
)

$ErrorActionPreference = 'Stop'

$ResourceGroup = "Sweden"
$ProdServer = "psql-surdej"
$RestoredServer = "$ProdServer-restored"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ⛔ Restore Database"
Write-Host "  Source: $ProdServer"
Write-Host "  Backup: $BackupName"
Write-Host "  Restore to: $RestoreTime"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

Write-Host "🗄️  Restoring database..."
az postgres flexible-server restore `
    --resource-group $ResourceGroup `
    --name $RestoredServer `
    --source-server $ProdServer `
    --restore-point-in-time $RestoreTime

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database restore failed"
    exit 1
}

Write-Host ""
Write-Host "✅ Database restored to $RestoredServer"
Write-Host ""
Write-Host "⚠️  Manual steps required:"
Write-Host "  1. Update connection strings to point to $RestoredServer"
Write-Host "  2. Verify data integrity — spot-check key tables"
Write-Host "  3. Run: prisma migrate status (confirm previous migration state)"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Next: 03-verify-rollback.ps1"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
