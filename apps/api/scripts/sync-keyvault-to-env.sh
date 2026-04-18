#!/bin/bash
# sync-keyvault-to-env.sh
# Downloads secrets from Azure Key Vault to a local .env file
# Usage: ./sync-keyvault-to-env.sh <KEY_VAULT_NAME> <SECRET_PREFIX> [OUTPUT_FILE]

KEY_VAULT_NAME=$1
SECRET_PREFIX=$2
OUTPUT_FILE=${3:-.env}

if [ -z "$KEY_VAULT_NAME" ] || [ -z "$SECRET_PREFIX" ]; then
    echo "Usage: $0 <KEY_VAULT_NAME> <SECRET_PREFIX> [OUTPUT_FILE]"
    exit 1
fi

echo "Retrieving secrets from $KEY_VAULT_NAME with prefix $SECRET_PREFIX..."

# Ensure Azure login
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please login to Azure CLI first: az login"
    exit 1
fi

# List secrets matching prefix
SECRETS=$(az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[?starts_with(name, '$SECRET_PREFIX')].name" -o tsv)

if [ -z "$SECRETS" ]; then
    echo "No secrets found with prefix: $SECRET_PREFIX"
    exit 0
fi

# Create or clear output file
# echo "# Generated from Key Vault $KEY_VAULT_NAME" > "$OUTPUT_FILE"

echo "Found $(echo "$SECRETS" | wc -l | tr -d ' ') secrets."

for SECRET_NAME in $SECRETS; do
    # Extract env var name: remove prefix and convert to uppercase
    # SECRET_NAME format: {PREFIX}-{ENV_VAR_NAME}
    # We want ENV_VAR_NAME
    
    # Remove prefix (handling potential - separator)
    SUFFIX=${SECRET_NAME#$SECRET_PREFIX}
    SUFFIX=${SUFFIX#-} # Remove leading dash if present
    
    # Convert - to _ and uppercase
    ENV_VAR_NAME=$(echo "$SUFFIX" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
    
    echo "Fetching $SECRET_NAME -> $ENV_VAR_NAME"
    
    VALUE=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$SECRET_NAME" --query value -o tsv)
    
    # Append to .env file if not already present, or replace
    if grep -q "^$ENV_VAR_NAME=" "$OUTPUT_FILE" 2>/dev/null; then
        # Use sed to replace (macos compatible)
        sed -i '' "s|^$ENV_VAR_NAME=.*|$ENV_VAR_NAME=\"$VALUE\"|" "$OUTPUT_FILE"
    else
        echo "$ENV_VAR_NAME=\"$VALUE\"" >> "$OUTPUT_FILE"
    fi
done

echo "✅ Secrets synced to $OUTPUT_FILE"
