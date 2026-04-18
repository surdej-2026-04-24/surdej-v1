# 08 — Authentication & Identity

## Overview

Multi-provider authentication supporting enterprise (Entra ID), demo, and planned Firebase auth. Role-based access control with tenant isolation.

## Auth Providers

| Provider | Flow | Status |
|----------|------|--------|
| **Entra ID (MSAL)** | Authorization Code + PKCE (browser) | ✅ Production |
| **Entra ID (CLI)** | Browser flow (localhost:3847) or device code flow | 📋 Specified |
| **Demo Mode** | Simulated auth, seeded user database | ✅ Implemented |
| **Firebase** | Google, Microsoft, Email, Anonymous | 📋 Planned |
| **None** | No auth (local dev) | ✅ Available |

Configuration via environment variables: `VITE_AUTH_PROVIDER` (entra / firebase / none).

## Entra ID (Enterprise)

### Browser Flow
- Authorization Code Flow with PKCE
- App Registration: SPA redirect
- Permissions: `User.Read`, `Sites.Read.All`, `Sites.Manage.All`

### Token Types
| Token | Lifetime |
|-------|----------|
| Access Token | 60–90 minutes |
| Refresh Token | 90 days |
| ID Token | Session-based |

### CLI Flow
- Browser-based: Opens browser, local HTTP server on port 3847 for callback
- Device Code: For headless environments
- Tokens encrypted (AES-256) at `~/.happymates/tokens-{PROJECT_CODE}.json`
- Commands: `cli:login`, `cli:logout`, `cli:whoami`
- Dependencies: commander, chalk, keytar (optional), open

## Demo Mode (Always Active in Dev)

- `isDemoMode: true` — simulates full auth without real identity provider
- Seeded user database with versioned schema
- Login screen: fullscreen toggle, language selector, video background
- Role Selector Overlay: search, role filter pills, responsive grid of member cards
- Session persisted in `localStorage`, auto-restored on reload
- Guest access option available

### Performance Targets
- Overlay render: < 200ms
- User seeding: < 2 seconds
- Session restore: < 50ms

## Roles

| Role | Description |
|------|-------------|
| `admin` | Full administrative access |
| `super_admin` | Platform-level administration |
| `session_master` | Session management |
| `member` | Standard user |
| `book_keeper` | Financial/reporting access |

## Data Providers (Pluggable)

Controlled by `VITE_DATA_PROVIDER` environment variable:

| Provider | Use Case |
|----------|----------|
| `indexeddb` | Local development, offline-first |
| `sharepoint` | Enterprise M365 integration |
| `api` | Backend API (Fastify + PostgreSQL) |
| `firebase` | Firebase Firestore (planned) |

### Deployment Scenarios

1. **Local Dev:** indexeddb + no auth
2. **Enterprise:** SharePoint + Entra ID
3. **Firebase Full:** Firestore + Firebase Auth
4. **Hybrid:** Firestore data + Entra ID auth

## CAKE API (Key Exchange)

Secure runtime API key retrieval — no keys stored in client code.

- Endpoint: `https://cake.happymates.dk`
- Flow: Exchange Entra token → CAKE session token → retrieve API keys by ID
- Fallback: environment variable → CAKE API
- Key IDs: `github-models`, `openai`, `anthropic`

## Tenant Isolation

- All data stays within the M365 tenant
- SharePoint lists namespaced: `mate_config_{CODE}`, `hm_projects_{CODE}`, `hm_tasks_{CODE}`
- Client-side processing only (browser)
- Separate SharePoint sites per tenant

---

*Consolidated from: `docs/security/auth.md`, `docs/use/cake-api.md`, `docs/compliance/data-handling.md`, `ideas/demouser.md`, `ideas/data.md`, `ideas/cli.md`, `.agent/instructions.md`.*
