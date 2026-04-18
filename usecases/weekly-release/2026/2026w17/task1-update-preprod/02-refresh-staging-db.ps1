#Requires -Version 7
<#
.SYNOPSIS
    Task 1 / Step 2: Refresh Staging Database
.DESCRIPTION
    Creates a point-in-time copy of production DB for staging.
.EXAMPLE
    ./02-refresh-staging-db.ps1
#>

$ErrorActionPreference = 'Stop'

$ResourceGroup = "Sweden"
$ProdServer = "psql-surdej"
$StagingServer = "psql-surdej-staging"
$RestoreTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Refresh Staging Database"
Write-Host "  Source: $ProdServer"
Write-Host "  Target: $StagingServer"
Write-Host "  Restore point: $RestoreTime"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

Write-Host "🗄️  Restoring production database to staging..."
az postgres flexible-server restore `
    --resource-group $ResourceGroup `
    --name $StagingServer `
    --source-server $ProdServer `
    --restore-point-in-time $RestoreTime

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database restore failed"
    exit 1
}

Write-Host ""
Write-Host "✅ Staging database restored from $RestoreTime"
Write-Host ""
Write-Host "Next: verify staging DB connectivity and spot-check key tables."
