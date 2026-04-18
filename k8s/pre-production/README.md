---
environment: pre-production
azure_subscription: Prod
azure_subscription_id: f2999427-2e4a-4403-8574-fbe040e08d0a
aks_cluster: YOUR_AKS_CLUSTER
aks_resource_group: Sweden
namespace: surdej-v1
---

# K8s Environment: Pre-Production

Staging environment that mirrors production. Used for final validation
before the go/no-go decision in the release process.

| Property | Value |
|----------|-------|
| Azure Subscription | Prod |
| AKS Cluster | YOUR_AKS_CLUSTER |
| Resource Group | Sweden |
| Namespace | surdej-v1 |
| API Host | api.YOUR_DOMAIN (Cloudflare Tunnel) |
| App Host | app.YOUR_DOMAIN (Cloudflare Tunnel) |
| Container Registry | ghcr.io/YOUR_ORG |
