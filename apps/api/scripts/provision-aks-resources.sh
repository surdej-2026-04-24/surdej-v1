#!/bin/bash
# provision-aks-resources.sh
# Provisions AKS resources (namespace, secrets, configmaps)
# Usage: ./provision-aks-resources.sh

set -e

# Required environment variables
required_vars=(
    "REPO_NAME"
    "ORG_NAME"
    "NAMESPACE"
    "DOMAIN"
    "KEY_VAULT"
    "TENANT_ID"
    "RESOURCE_GROUP"
    "CLUSTER_NAME"
    "GHCR_TOKEN"
)

# Optional: INGRESS_HOST

# Check required variables
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Environment variable $var is not set."
        exit 1
    fi
done

echo "Starting AKS provisioning for $REPO_NAME..."

# ==============================================================================
# 1. Ensure Namespace
# ==============================================================================
echo "→ Ensuring namespace: $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ==============================================================================
# 2. Create Image Pull Secret
# ==============================================================================
echo "→ Creating GHCR image pull secret..."
kubectl create secret docker-registry ghcr-secret \
    --docker-server=ghcr.io \
    --docker-username="github-actions" \
    --docker-password="$GHCR_TOKEN" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

# ==============================================================================
# 3. Create Application Secrets from Key Vault
# ==============================================================================
echo "→ Creating application secrets..."

# Function to get secret from KV
get_secret() {
    local name=$1
    az keyvault secret show --vault-name "$KEY_VAULT" --name "$name" --query value -o tsv
}

# Naming convention: {ORG_NAME}-{REPO_NAME}-{SECRET_NAME}
PREFIX="${ORG_NAME}-${REPO_NAME}"

# Fetch secrets
DB_URL=$(get_secret "${PREFIX}-DATABASE-URL")
SESSION_SECRET=$(get_secret "${PREFIX}-SESSION-SECRET")
jwt_secret=$(get_secret "${PREFIX}-JWT-SECRET") 
# Add more secrets as needed

# Create secret manifest
kubectl create secret generic "${REPO_NAME}-secrets" \
    --from-literal=DATABASE_URL="$DB_URL" \
    --from-literal=SESSION_SECRET="$SESSION_SECRET" \
    --from-literal=JWT_SECRET="$jwt_secret" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Created secret: ${REPO_NAME}-secrets"

# ==============================================================================
# 4. Create ConfigMap
# ==============================================================================
echo "→ Creating application config..."

# Determine Ingress Host
if [ -z "$INGRESS_HOST" ]; then
    # Default to {repo-name}.api.{domain}
    SANITIZED="${REPO_NAME#api-}" # Remove api- prefix if present
    SANITIZED="${SANITIZED%-api}" # Remove -api suffix if present
    INGRESS_HOST="${SANITIZED}.api.${DOMAIN}"
fi

kubectl create configmap "${REPO_NAME}-config" \
    --from-literal=NODE_ENV="production" \
    --from-literal=PORT="4000" \
    --from-literal=API_URL="https://${INGRESS_HOST}" \
    --from-literal=WEB_URL="https://${DOMAIN}" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Created configmap: ${REPO_NAME}-config"

echo "✅ AKS provisioning complete for namespace: $NAMESPACE"
