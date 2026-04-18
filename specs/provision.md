# Surdej Provisioning Specification

This document summarizes the core infrastructure requirements and sequential provisioning steps needed to bootstrap a production-grade instance of the **Surdej** platform (and its derived tenant instances).

Provisioning is currently oriented around the **Microsoft Azure** ecosystem and relies upon GitHub Actions for continuous delivery.

## 1. Core Prerequisites
The following dependencies must be established before provisioning the infrastructure:
- **Azure Account**: Active subscription with sufficient permissions to create Resource Groups, AKS clusters, and Azure Databases.
- **GitHub Organization**: Access to the `happy-mates` GitHub Organization to manage packages (GHCR) and Action Variables.
- **Domain Identity**: Ownership of the target apex domain (e.g., `happymates.dk`), typically managed via Cloudflare or Azure DNS.

---

## 2. Infrastructure Footprint
As outlined in `surdej.yaml`, the platform requires the following mapped resources. 

| Resource Type | Resource Name Example | Purpose |
| --- | --- | --- |
| **Resource Group** | `rg-happy-mates-sweden1` | Logical container for all platform resources. |
| **Kubernetes (AKS)** | `aks-happy-mates-sweden1` | Hosts the Surdej API, Frontend, and async Worker pods. |
| **Relational DB** | `db-sweden-1.postgres.database.azure.com` | Azure Database for PostgreSQL (Flexible Server) hosting the central application state. |
| **Key Vault** | `kv-happy-mates-sweden1` | Secure vault for API keys, DB connection strings, and worker secrets. |
| **Container Registry**| `ghcr.io/happy-mates` | GitHub Container Registry (GHCR) storing the compiled `api`, `frontend`, and `worker-*` Docker images. |

---

## 3. Provisioning Sequence (Step-by-Step)

### Phase A: Azure Foundations
1. **Create the Resource Group**
   Create the primary resource group in the target region (e.g., `swedencentral`).
   
2. **Provision Azure Database for PostgreSQL**
   Deploy a Flexible Server instance.
   - Configure a private endpoint or specific firewall rules to lock down connectivity.
   - Create the default database (e.g., `prod`).

3. **Deploy Azure Key Vault**
   Initialize the Key Vault and populate the essential baseline secrets matching the `happy-mates-surdej-v1` prefix:
   - `DATABASE_URL` (Postgres connection string)
   - Additional LLM or Integration API keys.

### Phase B: Auth & Identity (Entra ID)
1. **App Registration**
   Create a new Application (Client) in Microsoft Entra ID (Azure AD).
   - E.g., App Name: `Happy Mates` (`surdej-v1`).
2. **Platform Redirect URIs**
   Register the exact domain pathways in the Authentication blade for Single-Page Applications (SPA):
   - `https://<DOMAIN>/auth.html`
   - `http://localhost:4001/auth.html` (for local dev)
3. **App Roles**
   Assign the following required static roles inside the App Manifest to synchronize privileges automatically through Surdej:
   - `admin` (Level: Admin)
   - `member` (Level: Member)
   - `superadmin` (Level: Super Admin)
   - `reader` (Level: Reader)

### Phase C: Cluster & Workloads
1. **Deploy Azure Kubernetes Service (AKS)**
   Provision the kubernetes cluster using a standard node pool configuration. Enable Managed Identity and connect the cluster to the Azure Key Vault using Secrets Store CSI Driver.
2. **Install NGINX Ingress Controller**
   Apply the Nginx Ingress class (`ingress_class: nginx`) to support internal routing out to the public target host.
3. **Establish GHCR Pull Secrets**
   Since Surdej consumes application images from the private GitHub Container Registry, inject a `docker-registry` secret into the AKS `surdej-v1` namespace containing a valid GitHub PAT.

### Phase D: GitHub Actions Integration
Bind the repository to the live infrastructure. Inside the GitHub Repository (`surdej-v1`) Settings -> Secrets and Variables -> Actions: 

**Required Variables (`vars`)**:
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`
- `RESOURCE_GROUP`
- `AKS_CLUSTER_NAME`
- `DB_SERVER_NAME`, `DB_ADMIN_USER`, `DATABASE`
- `KEY_VAULT_NAME`
- `DOMAIN`
- `CONTAINER_REGISTRY`
- `VITE_API_URL`
- `VITE_AUTH_PROVIDER` (e.g., `entra`)

**Required Secrets (`secrets`)**:
- `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` (Service Principal for deployment)

### Phase E: First Run Initialization
1. Ensure the `CI` workflow has successfully built and pushed the `api`, `frontend`, and all `worker` container artifacts to GHCR.
2. Apply the Kubernetes Deployment specifications (e.g., `k8s/deployment.yaml`).
3. Run the Prisma Migration Job against the provisioned PostgreSQL database to generate the tables (`pnpm prisma db push` / `migrate deploy`).
4. Ensure at least one Entra ID user is granted the `superadmin` App Role.
5. Log into the UI via the registered apex domain to bootstrap the local Admin User object.
