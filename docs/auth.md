# Authentication Process

Surdej uses a robust, tenant-aware authentication system that supports multiple identity providers (IdPs) such as Microsoft Entra ID (formerly Azure AD). The system is designed to automatically route users to their correct organization's login flow based on their email domain.

## Overview

The authentication flow consists of three main steps:
1.  **Discovery**: Identifying the user's tenant and authentication provider.
2.  **Authentication**: Redirecting the user to the IdP for login.
3.  **Session Creation**: Exchanging the IdP's token for a secure application session.

---

## 1. Discovery (Tenant Resolution)

Users start by entering their email address. The system uses the domain part of the email (e.g., `@nexi.com` or `@happymates.dk`) to look up the corresponding **Tenant**.

*   **Endpoint**: `POST /api/auth/lookup`
*   **Input**: `{ "email": "user@example.com" }`
*   **Process**:
    1.  The backend checks the `TenantDomain` table for a match.
    2.  If a tenant is found, the system retrieves its configured **Auth Providers** (e.g., Microsoft Entra ID).
*   **Outcome**: The frontend receives the tenant details and the specific Auth Provider configuration (Client ID, Tenant ID) required to initiate the login.

This ensures that users are always directed to the correct corporate login page with their organization's branding and policies.

## 2. Authentication (IdP Redirect)

Once the provider is identified, the frontend initiates the OAuth 2.0 / OpenID Connect flow.

*   **Library**: The frontend uses standard libraries (e.g., `@azure/msal-browser`) to handle the protocol details.
*   **Redirect**: The user is redirected to the IdP's login page (e.g., `login.microsoftonline.com`).
*   **User Action**: The user enters their credentials and consents to the application's permissions (scopes typically include `openid`, `profile`, `email`, `User.Read`).
*   **Callback**: Upon successful login, the IdP redirects the user back to the application with an authorization code or ID token.

## 3. Session Creation (Token Exchange)

The final step securely establishes the user's session within the Surdej application.

*   **Endpoint**: `POST /api/auth/callback/microsoft-spa` (or provider-specific equivalent)
*   **Input**: The ID Token and Access Token received from the IdP.
*   **Verification**:
    1.  The backend verifies the token's signature and claims (issuer, audience, expiration).
    2.  It extracts the user's email and unique identifier (OID).
*   **User Provisioning (JIT)**:
    *   If the user does not exist in the local database, a new User record is created (Just-In-Time provisioning).
    *   The user is automatically added to the resolved Tenant with a default role (e.g., `Member`).
*   **Session Token**:
    *   The backend creates a **Session** record in the database.
    *   It returns a long-lived, secure session token to the frontend.
*   **Persistence**: The frontend stores this token (e.g., in `localStorage`) and attaches it to the `Authorization` header of subsequent API requests.

---

## Configuration Requirements

For authentication to work, the following must be defined in the database:

1.  **Tenant**: The organization entity (e.g., "Nexi Group").
2.  **Tenant Domain**: The verified email domain associated with the tenant (e.g., `nexi.com`).
3.  **Auth Provider**: The specific IdP configuration linked to the tenant.
    *   **Type**: `microsoft`, `google`, etc.
    *   **Client ID**: The application ID from the IdP registration.
    *   **Tenant ID**: The directory ID (for Microsoft Entra).
    *   **Metadata**: Additional IdP-specific settings.

Ensure these records are correctly seeded or provisioned before attempting to log in.
