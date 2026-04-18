#!/bin/bash
# provision-db-resources.sh
# Provisions database resources (schema, role, extensions)
# Usage: ./provision-db-resources.sh

set -e

# Required environment variables
required_vars=(
    "REPO_NAME"
    "ORG_NAME"
    "KEY_VAULT"
    "NAMESPACE" # Used for some naming conventions if needed
    "DB_NAME"
)

# Check required variables
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Environment variable $var is not set."
        exit 1
    fi
done

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed."
    exit 1
fi

# Check if ADMIN_CONN_STR is set (from workflow)
if [ -z "$ADMIN_CONN_STR" ]; then
    echo "❌ Error: ADMIN_CONN_STR is not set."
    exit 1
fi

echo "Starting Database provisioning for $REPO_NAME..."

# ==============================================================================
# 1. Define Names
# ==============================================================================
# Schema name: sanitize repo name (replace - with _)
SCHEMA_NAME=$(echo "$REPO_NAME" | tr '-' '_')
ROLE_NAME="${SCHEMA_NAME}_user"

# Key Vault Secret Names
KV_DB_URL="${ORG_NAME}-${REPO_NAME}-DATABASE-URL"
KV_PG_USER="${ORG_NAME}-${REPO_NAME}-POSTGRES-USER"
KV_PG_PASS="${ORG_NAME}-${REPO_NAME}-POSTGRES-PASSWORD"

echo "Schema: $SCHEMA_NAME"
echo "Role:   $ROLE_NAME"

# ==============================================================================
# 2. Generate Password
# ==============================================================================
# Check if password already exists in Key Vault to avoid resetting it
EXISTING_PASS=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "$KV_PG_PASS" --query value -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_PASS" ]; then
    echo "ℹ️  Using existing password from Key Vault"
    PASSWORD="$EXISTING_PASS"
else
    echo "→ Generating new password..."
    PASSWORD=$(openssl rand -base64 24)
    
    # Store in Key Vault
    az keyvault secret set --vault-name "$KEY_VAULT" --name "$KV_PG_PASS" --value "$PASSWORD" >/dev/null
    echo "✅ Password stored in Key Vault: $KV_PG_PASS"
fi

# Store Username in Key Vault
az keyvault secret set --vault-name "$KEY_VAULT" --name "$KV_PG_USER" --value "$ROLE_NAME" >/dev/null
echo "✅ Username stored in Key Vault: $KV_PG_USER"

# ==============================================================================
# 3. Create Role and Schema
# ==============================================================================
echo "→ Connecting to database..."

# Provide password to psql via environment variable is not safe for logs, 
# but handled by GitHub Secrets/Env in workflow. 
# Here we assume ADMIN_CONN_STR contains the password or PGPASSWORD is set.
# The workflow sets ADMIN_CONN_STR.

# Extract host from ADMIN_CONN_STR for constructing the app connection string
# Format: postgres://user:pass@host:port/db
DB_HOST=$(echo "$ADMIN_CONN_STR" | sed -e 's|^.*@||' -e 's|:.*$||')

# Construct PSQL command
PSQL="psql $ADMIN_CONN_STR -v ON_ERROR_STOP=1"

# Create Role
$PSQL -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$ROLE_NAME') THEN
    CREATE ROLE \"$ROLE_NAME\" WITH LOGIN PASSWORD '$PASSWORD';
  ELSE
    ALTER ROLE \"$ROLE_NAME\" WITH PASSWORD '$PASSWORD';
  END IF;
END
\$\$;"
echo "✅ Role configured: $ROLE_NAME"

# Grant Connect
$PSQL -c "GRANT CONNECT ON DATABASE \"$DB_NAME\" TO \"$ROLE_NAME\";"

# Create Schema
$PSQL -c "CREATE SCHEMA IF NOT EXISTS \"$SCHEMA_NAME\";"
$PSQL -c "ALTER SCHEMA \"$SCHEMA_NAME\" OWNER TO \"$ROLE_NAME\";"
echo "✅ Schema configured: $SCHEMA_NAME"

# Grant Usage on Schema (for future objects)
$PSQL -c "GRANT USAGE ON SCHEMA \"$SCHEMA_NAME\" TO \"$ROLE_NAME\";"
$PSQL -c "GRANT CREATE ON SCHEMA \"$SCHEMA_NAME\" TO \"$ROLE_NAME\";"

# Default Privileges
$PSQL -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA_NAME\" GRANT ALL ON TABLES TO \"$ROLE_NAME\";"
$PSQL -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA_NAME\" GRANT ALL ON SEQUENCES TO \"$ROLE_NAME\";"
$PSQL -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA_NAME\" GRANT ALL ON FUNCTIONS TO \"$ROLE_NAME\";"

# Install Extensions (if needed)
$PSQL -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA \"$SCHEMA_NAME\";"
$PSQL -c "CREATE EXTENSION IF NOT EXISTS \"vector\" SCHEMA \"$SCHEMA_NAME\";" # For AI features
echo "✅ Extensions installed"

# ==============================================================================
# 4. Construct and Store Connection String
# ==============================================================================
# App connection string
APP_CONN_STR="postgresql://${ROLE_NAME}:${PASSWORD}@${DB_HOST}:5432/${DB_NAME}?schema=${SCHEMA_NAME}&sslmode=require"

az keyvault secret set --vault-name "$KEY_VAULT" --name "$KV_DB_URL" --value "$APP_CONN_STR" >/dev/null
echo "✅ Connection string stored in Key Vault: $KV_DB_URL"

echo "✅ Database provisioning complete!"
