---
name: surdej-whatsup
description: Check the status of the local development environment and production (via GitHub/Kubernetes)
---

## Steps

> **Configuration is read from `surdej.yaml`** in the repo root.
> Key values: `infrastructure.kubernetes.namespace`, port allocation in the `derived` block and comments.

1. **Read surdej.yaml for infrastructure details**
   - Extract the Kubernetes namespace and port allocation.
   // turbo
   ```bash
   echo "--- Surdej Configuration ---"
   grep -A2 'kubernetes:' surdej.yaml | grep 'namespace:' | awk '{print "K8s Namespace:", $2}'
   grep 'version:' surdej.yaml | head -1 | awk '{print "Version:", $2}'
   echo ""
   echo "--- Port Allocation ---"
   grep -A3 'ports:' surdej.yaml
   ```

2. **Check Local Docker Infrastructure**
   - Verify that essential containers (postgres, redis) are running.
   // turbo
   ```bash
   docker compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"
   ```

3. **Check Local Application Health**
   - Check API and Frontend. Ports depend on the project instance (see surdej.yaml):
     - **Core (surdej-v1):** API=5001, Frontend=4001
     - **pdf-refinery derived:** API=5003, Frontend=4003
     - **nexi derived:** API=5002, Frontend=4002
   // turbo
   ```bash
   echo "--- API Health ---"
   for port in 5001 5002 5003; do
     status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api/health" 2>/dev/null || echo "000")
     [ "$status" = "200" ] && echo "  :$port  UP (HTTP $status)" || echo "  :$port  DOWN"
   done

   echo ""
   echo "--- Frontend Health ---"
   for port in 4001 4002 4003; do
     status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null || echo "000")
     [ "$status" = "200" ] && echo "  :$port  UP (HTTP $status)" || echo "  :$port  DOWN"
   done
   ```

4. **Fetch Production Configuration**
   - Retrieve repository variables to identify production context.
   ```bash
   gh variable list
   ```

5. **Check Production Cluster (Kubernetes)**
   - Read the namespace from `surdej.yaml` → `infrastructure.kubernetes.namespace` (default: `surdej-v1`).
   - Check nodes and pods in that namespace.
   > *Note: Requires `kubectl` configured for the AKS cluster defined in `surdej.yaml` → `infrastructure.kubernetes.cluster_name`.*
   ```bash
   NAMESPACE=$(grep -A2 'kubernetes:' surdej.yaml | grep 'namespace:' | awk '{print $2}' | tr -d '"')
   NAMESPACE=${NAMESPACE:-surdej-v1}

   echo "--- Kubernetes Context ---"
   kubectl config current-context 2>/dev/null || echo "(no context set)"

   echo "\n--- Kubernetes Nodes ---"
   kubectl get nodes

   echo "\n--- Kubernetes Pods (namespace: $NAMESPACE) ---"
   kubectl get pods -n "$NAMESPACE"
   ```

6. **Generate Health Report**
   - Review the output from the previous steps and compile a brief summary table.
   - **Format:**
     | Environment | Service | Status | Notes |
     | :--- | :--- | :--- | :--- |
     | Local | Docker (DBs) | [UP/DOWN] | ... |
     | Local | API (:port) | [UP/DOWN] | ... |
     | Local | Frontend (:port) | [UP/DOWN] | ... |
     | Prod | K8s Cluster | [UP/DOWN] | [Node status] |
     | Prod | Workloads (ns) | [Healthy/Degraded] | [Pod status summary] |

