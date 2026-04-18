# Provisioning and Deployment Guide for Surdej Platform

**IMPORTANT: Provisioning and releasing are strictly done interactively by a human starting an AI agent (e.g., GitHub Copilot, Antigravity chat, or similar).**

This guide details how to configure the Surdej platform for production, provision infrastructure on Azure, and manage deployments with the assistance of an agent.

## 1. Production Configuration (`surdej.yaml`)

The `surdej.yaml` file in the root of the repository is the central source of truth for the platform version and configuration. It now includes an `infrastructure` section that defines the mapping to Azure resources.

```yaml
infrastructure:
  azure:
    subscription_id: "..."        # GitHub Var: AZURE_SUBSCRIPTION_ID
    resource_group: "..."         # GitHub Var: RESOURCE_GROUP
  kubernetes:
    cluster_name: "..."           # GitHub Var: AKS_CLUSTER_NAME
    namespace: "surdej-v1"
  database:
    server_name: "..."            # GitHub Var: DB_SERVER_NAME
    default_database: "prod"      # GitHub Var: DATABASE
  key_vault:
    name: "..."                   # GitHub Var: KEY_VAULT_NAME
```

**Action**: Verify that the values in `surdej.yaml` match your intended production environment.

## 2. GitHub Organization Setup

The GitHub Workflows rely on **Organization Secrets and Variables**. You must configure these before running any pipelines.

### Prerequisites

- **GitHub CLI** (`gh`) authenticated with admin scope.
- **Azure CLI** (`az`) login.

### Setup Instructions

1.  **Gather Azure Context**: Run `az account show` to get your Subscription ID and Tenant ID.
2.  **Define Variables**: You need to set the following GitHub Organization Variables (Settings -> Secrets and variables -> Actions -> Variables):

    - `AZURE_SUBSCRIPTION_ID`
    - `AZURE_SUBSCRIPTION_NAME`
    - `AZURE_TENANT_ID`
    - `AZURE_REGION` (e.g., `swedencentral`)
    - `RESOURCE_GROUP` (e.g., `rg-happy-mates-sweden1`)
    - `AKS_CLUSTER_NAME`
    - `KEY_VAULT_NAME`
    - `DB_SERVER_NAME`
    - `DB_ADMIN_USER`
    - `DB_RESOURCE_GROUP`
    - `DATABASE` (Default DB name)
    - `DOMAIN` (e.g., `happymates.dk`)
    - `CONTAINER_REGISTRY` (e.g., `ghcr.io/happy-mates`)

3.  **Define Secrets**: You need to set the following GitHub Organization Secrets:

    - `AZURE_CREDENTIALS`: A JSON object with Service Principal credentials.
        ```bash
        az ad sp create-for-rbac --name "github-actions-happy-mates" --role contributor --scopes "/subscriptions/{subscription-id}" --sdk-auth
        ```
    - `DB_ADMIN_CONNECTION_STRING` (Optional): If not using Key Vault for admin password lookup.
    - `GHCR_TOKEN`: Token for accessing GitHub Container Registry (if needed for scripts).

## 3. Workflows

The repository includes several workflows in `.github/workflows/`:

### `deployment-api-provision.yml`
- **Trigger**: Manual (`workflow_dispatch`)
- **Purpose**: Provisions database resources (schemas, extensions, users) and ensures the Kubernetes namespace exists.
- **Inputs**: Requires confirmation ("yes").
- **Dependencies**: Requires `scripts/provision-db-resources.sh` and `scripts/provision-aks-resources.sh` in configurations that use them.

### `deployment-api-release.yml`
- **Trigger**: Release Published or Manual
- **Purpose**: Builds the API container, pushes to GHCR, and deploys to AKS.
- **Process**:
    1. Builds Docker image.
    2. Pushes to GHCR.
    3. Updates Kubernetes deployment (`k8s/deployment.yaml`) with the new image tag.

### `deployment-docker-build-push.yml`
- **Trigger**: Push to tags `v*.*.*` or Manual
- **Purpose**: Builds and pushes multi-platform Docker images for API and Frontend.

### `ci.yml`
- **Trigger**: Push to main/PRs
- **Purpose**: Runs Linting, Typechecking, and Tests. Builds images on main.

## 4. Local Development vs. Production

To connect your local environment to production resources (READ-ONLY recommended):

1.  **Sync Secrets**: Use the naming convention `{ORG_NAME}-{REPO_NAME}-{SECRET_NAME}` in Key Vault.
2.  **Download to .env**:
    ```bash
    KV_NAME=$(gh variable get KEY_VAULT_NAME --org happy-mates)
    SECRET_PREFIX="happy-mates-surdej-v1"
    ./apps/api/scripts/sync-keyvault-to-env.sh "$KV_NAME" "$SECRET_PREFIX" apps/api/.env
    ```

## 5. Next Steps

1.  Ensure `apps/api/scripts/provision-db-resources.sh` and `scripts/provision-aks-resources.sh` exist and are executable if you intend to use the provisioning workflow.
2.  Create Kubernetes manifests in `k8s/` folder (e.g., `deployment.yaml`, `cloudflare-tunnel.yaml`) for the deployment workflow to apply.
