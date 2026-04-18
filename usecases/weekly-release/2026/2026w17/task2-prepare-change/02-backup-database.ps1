#Requires -Version 7
<#
.SYNOPSIS
    Task 2 / Step 2: Backup Production Database
.DESCRIPTION
    Creates a point-in-time snapshot before applying changes.
.EXAMPLE
    ./02-backup-database.ps1
#>

$ErrorActionPreference = 'Stop'

$ResourceGroup = "Sweden"
$ProdServer = "psql-surdej"
$Release = "2026-W17"
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$BackupName = "pre-$Release-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Backup Production Database"
Write-Host "  Server: $ProdServer"
Write-Host "  Backup: $BackupName"
Write-Host "  Timestamp: $Timestamp"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

Write-Host "💾 Creating backup..."
az postgres flexible-server backup create `
    --resource-group $ResourceGroup `
    --name $ProdServer `
    --backup-name $BackupName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backup creation failed"
    exit 1
}

Write-Host ""
Write-Host "🔍 Verifying backup..."
az postgres flexible-server backup list `
    --resource-group $ResourceGroup `
    --name $ProdServer `
    --query "[?name=='$BackupName']" `
    -o table

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  ✅ Backup complete"
Write-Host ""
Write-Host "  📋 Record in release issue:"
Write-Host "     Backup ID: $BackupName"
Write-Host "     Timestamp: $Timestamp"
Write-Host ""
Write-Host "  Next: 03-deploy-production.ps1"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
