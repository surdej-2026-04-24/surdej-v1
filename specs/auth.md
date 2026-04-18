# Authentication Specification

This document describes the multi-stage authentication flow for the Surdej platform, supporting domain-based tenant discovery and multi-tenant user access.

## Overview

The authentication system is designed to handle users who may belong to multiple tenants or access the platform via specific domains associated with a tenant.

### Supported Providers

- **Microsoft Entra ID** (formerly Azure AD)
- **Google**
- **GitHub**

## Authentication Flow

### Stage 1: Email Entry & Tenant Discovery

1.  **User Interface**: The user is presented with a simple login screen asking for their **Email Address**.
2.  **Action**: User enters email (e.g., `alice@acme.com`) and clicks "Next".
3.  **Backend Process**:
    *   Extract the domain part of the email (`acme.com`).
    *   Query `TenantDomain` for any tenants associated with this domain.
    *   **Development Only**: If `NODE_ENV=development` and the domain is not found, check for "Demo Users" configuration to offer a quick login dropdown.

### Stage 2: Tenant Selection & Provider Resolution

Based on the lookup in Stage 1, the backend returns a response:

#### Scenario A: Domain matches exactly one Tenant
*   The system identifies the single tenant (e.g., `Acme Corp`).
*   The backend retrieves the configured `AuthProvider` list for this tenant (e.g., Entra ID).
*   **Result**: The user is immediately shown the login options for that tenant (e.g., "Sign in with Microsoft").

#### Scenario B: Domain matches multiple Tenants
*   This can happen if a domain is shared or aliased.
*   **Result**: The user is shown a list of matching tenants.
    *   User selects `Acme Sales` -> shown auth providers for `Acme Sales`.
    *   User selects `Acme Engineering` -> shown auth providers for `Acme Engineering`.

#### Scenario C: No Domain Match (Public/Generic)
*   The user is treated as a generic user or prompted to create a new trial account.
*   Alternatively, return global authentication providers (e.g., "Sign in with Google" for personal accounts).

### Stage 3: Authentication & Token Issuance

1.  User clicks a provider button.
2.  OAuth2 flow is initiated with the provider.
3.  Upon successful callback:
    *   System verifies the user exists in `User` table (or JIT provisions them).
    *   System checks `UserTenant` for membership in the target tenant.
    *   A session token is issued, scoped to the specific `tenantId`.

## API Interactions

### `POST /auth/lookup`

**Request:**
```json
{
  "email": "alice@acme.com"
}
```

**Response (Success - Single Tenant):**
```json
{
  "outcome": "found",
  "tenants": [
    {
      "id": "uuid-1",
      "name": "Acme Corp",
      "providers": [
        { "type": "entra", "name": "Microsoft Entra ID", "url": "/auth/entra/login?tenant=uuid-1" }
      ]
    }
  ]
}
```

**Response (Success - Multiple Tenants):**
```json
{
  "outcome": "multiple",
  "tenants": [
    {
      "id": "uuid-1",
      "name": "Acme Sales",
      "providers": [...]
    },
    {
      "id": "uuid-2",
      "name": "Acme Engineering",
      "providers": [...]
    }
  ]
}
```

**Response (Development - Demo Users):**
```json
{
  "outcome": "demo",
  "users": [
    { "id": "demo-1", "email": "admin@surdej.io", "name": "Admin User", "role": "SUPER_ADMIN" },
    { "id": "demo-2", "email": "member@surdej.io", "name": "Regular Member", "role": "MEMBER" }
  ]
}
```

## Data Model Changes

### TenantDomain
Maps a DNS domain to a tenant.
- `domain`: unique string (e.g. `acme.com`)
- `tenantId`: FK to Tenant

### AuthProvider
Configures an Identity Provider for a specific tenant.
- `type`: `google`, `github`, `entra`
- `clientId`: Provider Client ID
- `connectionId`: Optional specific connection ID (e.g. Auth0)
- `metadata`: specific endpoints or scopes
