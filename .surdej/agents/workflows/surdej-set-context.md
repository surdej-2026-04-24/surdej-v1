---
name: surdej-set-context
description: Set the Azure subscription and Kubernetes context to match the values defined in surdej.yaml
---

## Steps

> **Configuration is read from `surdej.yaml`** in the repo root.
> Key values: `infrastructure.azure.subscription_id`, `infrastructure.kubernetes.cluster_name`,
> `infrastructure.kubernetes.resource_group`, `infrastructure.kubernetes.namespace`.

1. **Parse surdej.yaml for target context**
   // turbo
   ```bash
   echo "--- Target Context from surdej.yaml ---"
   SUB_ID=$(grep 'subscription_id:' surdej.yaml | head -1 | awk '{print $2}' | tr -d '"')
   SUB_NAME=$(grep 'subscription_name:' surdej.yaml | head -1 | awk '{print $2}' | tr -d '"')
   CLUSTER=$(grep 'cluster_name:' surdej.yaml | head -1 | awk '{print $2}' | tr -d '"')
   RG=$(grep -A1 'kubernetes:' surdej.yaml | grep 'resource_group:' | head -1 | awk '{print $2}' | tr -d '"')
   NS=$(grep -A3 'kubernetes:' surdej.yaml | grep 'namespace:' | head -1 | awk '{print $2}' | tr -d '"')
   echo "  Subscription: $SUB_NAME ($SUB_ID)"
   echo "  AKS Cluster:  $CLUSTER (RG: $RG)"
   echo "  Namespace:    $NS"
   ```

2. **Set Azure subscription**
   ```bash
   SUB_ID=$(grep 'subscription_id:' surdej.yaml | head -1 | awk '{print $2}' | tr -d '"')
   echo "Setting Azure subscription..."
   az account set --subscription "$SUB_ID"
   echo "Active subscription:"
   az account show --query '{name: name, id: id, state: state}' -o table
   ```

3. **Set Kubernetes context (AKS)**
   ```bash
   CLUSTER=$(grep 'cluster_name:' surdej.yaml | head -1 | awk '{print $2}' | tr -d '"')
   RG=$(grep -A1 'kubernetes:' surdej.yaml | grep 'resource_group:' | head -1 | awk '{print $2}' | tr -d '"')
   NS=$(grep -A3 'kubernetes:' surdej.yaml | grep 'namespace:' | head -1 | awk '{print $2}' | tr -d '"')

   echo "Fetching AKS credentials for $CLUSTER..."
   az aks get-credentials --resource-group "$RG" --name "$CLUSTER" --overwrite-existing

   echo "Setting default namespace to $NS..."
   kubectl config set-context --current --namespace="$NS"
   ```

4. **Verify active context**
   // turbo
   ```bash
   echo "--- Verification ---"
   echo ""
   echo "Azure Subscription:"
   az account show --query '{name: name, id: id}' -o table 2>/dev/null
   echo ""
   echo "Kubernetes Context:"
   kubectl config current-context
   echo "Default Namespace: $(kubectl config view --minify -o jsonpath='{.contexts[0].context.namespace}')"
   echo ""
   echo "Cluster Nodes:"
   kubectl get nodes --no-headers 2>/dev/null | awk '{print "  " $1, $2}'
   ```
