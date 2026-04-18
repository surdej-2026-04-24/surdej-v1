#!/bin/bash
set -e

# Configuration
ORG_NAME="${ORG_NAME:-happy-mates}"
REPO_NAME=$(basename -s .git $(git config --get remote.origin.url) 2>/dev/null || echo "surdej-v1")
OUTPUT_DIR="k8s/rendered"

# Sanitize repo name (stripping 'api-' and '-api' per old conventions)
SANITIZED_NAME="$REPO_NAME"
SANITIZED_NAME="${SANITIZED_NAME#api-}"
SANITIZED_NAME="${SANITIZED_NAME%-api}"
[ "$SANITIZED_NAME" = "api" ] && SANITIZED_NAME="app"
SANITIZED_NAME="${SANITIZED_NAME#-}"
SANITIZED_NAME="${SANITIZED_NAME%-}"

export APP_NAME="${APP_NAME:-$SANITIZED_NAME}"
export NAMESPACE="${NAMESPACE:-$APP_NAME}"
export IMAGE="${IMAGE:-ghcr.io/$ORG_NAME/$REPO_NAME/api:latest}"
export COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export ORG_REPO_PREFIX="${ORG_NAME}-${APP_NAME}"

echo "=================================================="
echo "Manifest Generation"
echo "=================================================="

# Check if gh CLI exists
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI ('gh') is not installed. Please install it to pull org variables."
    exit 1
fi

echo "Fetching organization variables from GitHub ($ORG_NAME)..."
export DOMAIN=$(gh variable get DOMAIN --org "$ORG_NAME")
export KEY_VAULT=$(gh variable get KEY_VAULT_NAME --org "$ORG_NAME")
export TENANT_ID=$(gh variable get AZURE_TENANT_ID --org "$ORG_NAME")

if [ -z "$DOMAIN" ] || [ -z "$KEY_VAULT" ] || [ -z "$TENANT_ID" ]; then
    echo "❌ Error: Could not fetch required organization variables via 'gh'. Are you authenticated?"
    echo "   Try running 'gh auth login' or checking if you are in the '$ORG_NAME' org."
    exit 1
fi

echo "  ✓ DOMAIN:       $DOMAIN"
echo "  ✓ KEY_VAULT:    $KEY_VAULT"
echo "  ✓ TENANT_ID:    $TENANT_ID"
echo "  ✓ NAMESPACE:    $NAMESPACE"
echo "  ✓ APP_NAME:     $APP_NAME"
echo ""

mkdir -p "$OUTPUT_DIR"
echo "Templating manifests into $OUTPUT_DIR/..."

for template in k8s/*.yaml; do
    if [ -f "$template" ]; then
        filename=$(basename "$template")
        # Template out strictly the variables we defined above
        envsubst < "$template" > "$OUTPUT_DIR/$filename"
        echo "  - Generated $OUTPUT_DIR/$filename"
    fi
done

echo ""
echo "✅ Done. You can deploy them via: kubectl apply -f $OUTPUT_DIR/"
echo "=================================================="
