# 2026W17 Release Scripts

> **Staging (T-1):** 2026-04-22
> **Release (T):** 2026-04-23

## Script Structure

Scripts are organized by task, matching the release issues:

```
2026w17/
├── task1-update-preprod/     ← Update Pre-Production (T-1)
│   ├── 01-build-containers.ps1
│   ├── 02-refresh-staging-db.ps1
│   ├── 03-deploy-staging.ps1
│   └── 04-smoke-test-staging.ps1
├── task2-prepare-change/     ← Prepare Change (T)
│   ├── 01-pre-deployment-checks.ps1
│   ├── 02-backup-database.ps1
│   ├── 03-deploy-production.ps1
│   └── 04-validate-deployment.ps1
├── task3-rollback/           ← Rollback Change
│   ├── 01-revert-services.ps1
│   ├── 02-restore-database.ps1
│   └── 03-verify-rollback.ps1
└── task4-commit/             ← Commit Change
    ├── 01-disable-maintenance.ps1
    └── 02-finalize-release.ps1
```

## Key Differences from nexi-ms-ops

| Aspect | PDF Refinery | Nexi MS Ops |
|--------|--------|-------------|
| Container Registry | GHCR (`ghcr.io/happy-pdf-refinery`) | ACR (`msops.azurecr.io`) |
| Build Method | GitHub Actions workflow | Local Docker build |
| AKS Cluster | `aks-pdf-refinery` | `msops1` |
| Resource Group | `Sweden` | `kubernetes` |
| Namespace | `surdej-v1` | `ms-ops` |
| API URL | `https://api.example-tenant.net` | `https://ms-ops-api.cluster1.nexi-ms-ops-nordics.net` |
| DB Server | `psql-pdf-refinery` | `db-sweden-1` |
| Workers | pdf-refinery, knowledge, document, member-nosql | + office-graph, graph-sync, organisation, copilot, power-platform |
