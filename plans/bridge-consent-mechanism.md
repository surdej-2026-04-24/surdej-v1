# Bridge Domain Consent Mechanism

> **Goal:** Require explicit user consent before the Surdej extension bridge can extract data from a website. Consent is managed at two levels: **per-tenant** (system-wide defaults set by admins) and **per-user** (individual overrides). Each consent has a **level**: READ (passive data) or READ_WRITE (can also interact).

---

## 1. Overview

```
┌────────────────────────────────┐
│        Tenant Consent          │  Admin sets which domains are
│  (system-wide allow-list)      │  pre-approved for all users
└──────────┬─────────────────────┘
           │ inherits
           ▼
┌────────────────────────────────┐
│        User Consent            │  User can add personal domains
│  (personal allow-list)         │  and revoke tenant-level ones
└──────────┬─────────────────────┘
           │ checked on every
           ▼  bridge request
┌────────────────────────────────┐
│     Bridge Gate (frontend)     │  Blocks data extraction until
│   Prompt ↔ Allow ↔ Deny       │  the domain is consented
└────────────────────────────────┘
```

### Key Principles

- **Opt-in:** No data leaves a page unless the domain is explicitly consented.
- **Two-tier:** Tenant admins pre-approve business-critical domains (e.g., `pdf-refinery.dk`). Users can add personal domains.
- **Revocable:** Users can revoke even tenant-level consent for themselves (with audit trail).
- **Audit:** Every consent grant/revoke is logged.
- **Minimal friction:** A one-time consent prompt per domain, not per page.

---

## 2. Data Model

### 2.1 Prisma Schema Additions

```prisma
// ─── Bridge Consent ─────────────────────────────────────────────

/// Tenant-wide bridge consent. Domains approved here are
/// pre-consented for all users in the tenant.
model BridgeConsentTenant {
  id          String   @id @default(uuid())
  tenantId    String
  domain      String   // e.g. "pdf-refinery.dk", "*.pdf-refinery.dk", "dr.dk"
  pattern     String   // glob pattern: "*.pdf-refinery.dk" or exact "dr.dk"
  description String?  // "PDF Refinery housing platform"
  isEnabled   Boolean  @default(true)
  grantedBy   String?  // userId of admin who approved
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, domain])
  @@index([tenantId])
}

/// Per-user bridge consent. Allows users to add personal domains
/// or revoke tenant-level consent for themselves.
model BridgeConsentUser {
  id          String   @id @default(uuid())
  userId      String
  tenantId    String   // scope to tenant context
  domain      String   // e.g. "example.com"
  pattern     String   // glob pattern for matching
  status      BridgeConsentStatus @default(ALLOWED)
  grantedAt   DateTime @default(now())
  revokedAt   DateTime?
  updatedAt   DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId, domain])
  @@index([userId, tenantId])
}

enum BridgeConsentStatus {
  ALLOWED   // user explicitly allowed
  DENIED    // user explicitly denied (overrides tenant consent)
  REVOKED   // was allowed, then revoked
}
```

### 2.2 Relations to Add

```prisma
// In model Tenant:
  bridgeConsents    BridgeConsentTenant[]

// In model User:
  bridgeConsents    BridgeConsentUser[]
```

---

## 3. Consent Resolution Logic

The bridge checks consent **before** any data-extracting request (`GET_PAGE_INFO`, `GET_PAGE_TEXT`, `GET_PAGE_SNAPSHOT`, `GET_FORM_FIELDS`, `FETCH_PAGE`, etc.). `PING` is always allowed.

```
function isConsentedDomain(hostname, userId, tenantId):
    1. Check user-level consent for (userId, tenantId, hostname)
       → If DENIED or REVOKED → BLOCK
       → If ALLOWED → ALLOW

    2. Check tenant-level consent for (tenantId, hostname)
       → If enabled and pattern matches → ALLOW

    3. No match → PROMPT user for consent
```

### Pattern Matching

| Pattern           | Matches                                |
|--------------------|----------------------------------------|
| `pdf-refinery.dk`       | `pdf-refinery.dk` only                       |
| `*.pdf-refinery.dk`     | `app.pdf-refinery.dk`, `api.pdf-refinery.dk`, etc. |
| `*.dk`            | All `.dk` domains                      |
| `*`               | Everything (admin-only)                |

---

## 4. API Endpoints

### 4.1 Tenant Consent (Admin)

| Method | Path                                         | Description                    |
|--------|----------------------------------------------|--------------------------------|
| GET    | `/api/bridge-consent/tenant`                 | List all tenant consents       |
| POST   | `/api/bridge-consent/tenant`                 | Add domain consent             |
| PATCH  | `/api/bridge-consent/tenant/:id`             | Toggle enable/disable          |
| DELETE | `/api/bridge-consent/tenant/:id`             | Remove consent                 |

**Auth:** Requires `ADMIN` or `SUPER_ADMIN` role.

#### POST body:
```json
{
  "domain": "pdf-refinery.dk",
  "pattern": "*.pdf-refinery.dk",
  "description": "PDF Refinery housing platform"
}
```

### 4.2 User Consent

| Method | Path                                         | Description                    |
|--------|----------------------------------------------|--------------------------------|
| GET    | `/api/bridge-consent/user`                   | List user's consents + merged  |
| POST   | `/api/bridge-consent/user`                   | Grant consent for a domain     |
| PATCH  | `/api/bridge-consent/user/:id`               | Update status (allow/deny)     |
| DELETE | `/api/bridge-consent/user/:id`               | Remove consent override        |

**Auth:** Authenticated user (scoped to their own data).

### 4.3 Consent Check (Bridge Runtime)

| Method | Path                                         | Description                    |
|--------|----------------------------------------------|--------------------------------|
| GET    | `/api/bridge-consent/check?domain=pdf-refinery.dk` | Returns `{ consented: bool }`  |

**Auth:** Authenticated user. Used by the frontend bridge at runtime.

#### Response:
```json
{
  "consented": true,
  "source": "tenant",        // "tenant" | "user" | "none"
  "domain": "pdf-refinery.dk",
  "pattern": "*.pdf-refinery.dk"
}
```

---

## 5. API Implementation

### 5.1 New Domain Module

```
apps/api/src/core/bridge-consent/
├── bridge-consent.routes.ts    // Hono router
├── bridge-consent.service.ts   // Business logic
├── bridge-consent.types.ts     // Zod schemas
└── bridge-consent.test.ts      // Tests
```

### 5.2 Service Methods

```typescript
class BridgeConsentService {
  // ── Tenant-level ──
  listTenantConsents(tenantId: string): Promise<BridgeConsentTenant[]>
  addTenantConsent(tenantId: string, data: CreateTenantConsent): Promise<BridgeConsentTenant>
  toggleTenantConsent(id: string, enabled: boolean): Promise<BridgeConsentTenant>
  removeTenantConsent(id: string): Promise<void>

  // ── User-level ──
  listUserConsents(userId: string, tenantId: string): Promise<MergedConsent[]>
  grantUserConsent(userId: string, tenantId: string, domain: string): Promise<BridgeConsentUser>
  denyUserConsent(userId: string, tenantId: string, domain: string): Promise<BridgeConsentUser>
  removeUserConsent(id: string): Promise<void>

  // ── Runtime check ──
  checkConsent(userId: string, tenantId: string, domain: string): Promise<ConsentCheckResult>

  // ── Helpers ──
  matchesDomainPattern(hostname: string, pattern: string): boolean
}
```

---

## 6. Frontend: Bridge Gate

### 6.1 Consent Cache

The frontend caches consent decisions in memory (Map<string, boolean>) to avoid API calls on every bridge request. Cache is invalidated when:
- User navigates to a new domain
- Consent is granted/revoked in settings
- Tab changes

### 6.2 Consent Prompt

When a bridge request targets an unconsented domain, the UI shows an inline prompt:

```
┌─────────────────────────────────────────┐
│ 🔒 Allow Surdej to read data from      │
│    dr.dk?                               │
│                                         │
│ Surdej needs permission to access page  │
│ content on this domain.                 │
│                                         │
│  [Always Allow]  [Allow Once]  [Deny]   │
└─────────────────────────────────────────┘
```

- **Always Allow** → POST to `/api/bridge-consent/user` + cache
- **Allow Once** → Cache only (for this session)
- **Deny** → POST with status `DENIED` + cache

### 6.3 Implementation in `useBridge.ts`

```typescript
// Add to useBridge hook
const [consentCache] = useState(new Map<string, boolean>());
const [pendingConsent, setPendingConsent] = useState<string | null>(null);

async function checkDomainConsent(hostname: string): Promise<boolean> {
  if (consentCache.has(hostname)) return consentCache.get(hostname)!;

  const res = await api.get(`/bridge-consent/check?domain=${hostname}`);
  const consented = res.data.consented;
  consentCache.set(hostname, consented);

  if (!consented) {
    setPendingConsent(hostname);  // triggers UI prompt
  }
  return consented;
}
```

### 6.4 Gate in Bridge Requests

Modify `sendRequest` in `bridge.ts` to check consent before non-PING requests:

```typescript
async function sendRequest<T>(type: string, payload?: any, timeout?: number): Promise<T> {
  // PING and TAB_CHANGED are always allowed
  if (type !== 'PING') {
    const hostname = getCurrentHostname();
    const consented = await checkDomainConsent(hostname);
    if (!consented) throw new Error('Domain not consented');
  }
  // ... existing logic
}
```

---

## 7. Frontend: User Profile — Consented Domains

### 7.1 Location

Add a **"Bridge Permissions"** section to `/profile` (ProfilePage.tsx), below the existing "Session" section.

### 7.2 UI

```
┌─────────────────────────────────────────┐
│ 🔗 Bridge Permissions                  │
│                                         │
│ Domains you've allowed data access:     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🟢 *.pdf-refinery.dk    (from tenant)    │ │
│ │    PDF Refinery housing platform         │ │
│ │                          [Revoke]  │ │
│ ├─────────────────────────────────────┤ │
│ │ 🟢 dr.dk           (personal)     │ │
│ │    Allowed 2 hours ago             │ │
│ │                          [Remove]  │ │
│ ├─────────────────────────────────────┤ │
│ │ 🔴 facebook.com     (denied)      │ │
│ │    Denied 1 day ago                │ │
│ │                      [Allow again] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Add Domain]                          │
└─────────────────────────────────────────┘
```

### 7.3 Features

- List all merged consents (tenant + user)
- Badge showing source: `tenant` or `personal`
- Revoke tenant consent (creates user-level DENIED override)
- Remove personal consent
- Manually add a domain

---

## 8. Frontend: Admin Hub — Consent Management

### 8.1 Location

Add a new admin tool card to `AdminPage.tsx`:

```typescript
{
  titleKey: 'admin.bridgeConsent',
  descKey: 'admin.bridgeConsentDesc',
  icon: Shield,
  path: '/admin/bridge-consent',
}
```

### 8.2 Route

New page: `/admin/bridge-consent` → `BridgeConsentAdminPage.tsx`

### 8.3 UI

```
┌──────────────────────────────────────────────────┐
│ Bridge Domain Consent                    [Admin] │
│ Manage which domains the extension can access    │
│ for all users in this tenant.                    │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │  Domain           Pattern         Status     │ │
│ │  pdf-refinery.dk        *.pdf-refinery.dk     ✅ Active  │ │
│ │  boligsiden.dk    boligsiden.dk   ✅ Active  │ │
│ │  ois.dk           *.ois.dk        ⏸ Disabled │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [+ Add Domain]                                   │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Add Domain Consent                           │ │
│ │                                              │ │
│ │ Domain:      [pdf-refinery.dk          ]           │ │
│ │ Pattern:     [*.pdf-refinery.dk        ]  (auto)   │ │
│ │ Description: [Optional note      ]           │ │
│ │                                              │ │
│ │                           [Cancel]  [Add]    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ── User Overrides ───────────────────────────    │
│ Shows users who have revoked tenant consents:    │
│                                                  │
│  Admin User        pdf-refinery.dk    DENIED           │
│  (for awareness only — admins cannot override    │
│   user revocations)                              │
└──────────────────────────────────────────────────┘
```

---

## 9. Extension Content Script Gate

The content script should **not** gate requests — it always responds. The gate sits in the **frontend bridge client** where the user context exists. This keeps the content script stateless and simple.

However, the content script should include the `hostname` in every response so the frontend can verify it matches the consented domain.

---

## 10. Implementation Status

### Phase 1 – Data Model & API ✅

| # | Task | Files |
|---|------|-------|
| 1 | Add Prisma models | `schema.prisma` |
| 2 | Run migration | `prisma migrate dev` |
| 3 | Create `bridge-consent/` module | `apps/api/src/core/bridge-consent/` |
| 4 | Implement service + routes | `.service.ts`, `.routes.ts`, `.types.ts` |
| 5 | Register routes in app | `apps/api/src/app.ts` |
| 6 | Add audit logging | Integrate with existing `AuditLog` |

### Phase 2 – Frontend Bridge Gate

| # | Task | Files |
|---|------|-------|
| 7 | Add consent check to `bridge.ts` | `apps/frontend/src/core/extension/bridge.ts` |
| 8 | Add consent state to `useBridge.ts` | `apps/frontend/src/core/extension/useBridge.ts` |
| 9 | Create consent prompt component | `apps/frontend/src/core/extension/ConsentPrompt.tsx` |
| 10 | Add prompt to `ExtensionPage.tsx` | Above the chat area, inline |

### Phase 3 – User Profile

| # | Task | Files |
|---|------|-------|
| 11 | Add "Bridge Permissions" section | `apps/frontend/src/routes/profile/ProfilePage.tsx` |
| 12 | Create `BridgePermissionsCard.tsx` | `apps/frontend/src/routes/profile/BridgePermissionsCard.tsx` |

### Phase 4 – Admin Hub

| # | Task | Files |
|---|------|-------|
| 13 | Add admin card to AdminPage | `apps/frontend/src/routes/admin/AdminPage.tsx` |
| 14 | Create admin consent page | `apps/frontend/src/routes/admin/BridgeConsentAdminPage.tsx` |
| 15 | Add route to router | `apps/frontend/src/router.tsx` |

### Phase 5 – Testing & Polish

| # | Task |
|---|------|
| 16 | Unit tests for `BridgeConsentService` |
| 17 | Integration test for consent check flow |
| 18 | Manual test: fresh user → prompt → allow → data loads |
| 19 | Manual test: admin adds tenant consent → users see it pre-approved |
| 20 | Manual test: user revokes tenant consent → data blocked |

---

## 11. Security Considerations

- **Consent is server-authoritative:** The frontend cache is a UX optimization; the API always validates.
- **Pattern validation:** Reject overly broad patterns (`*`) unless the user is `SUPER_ADMIN`.
- **Rate limiting:** Consent check endpoint should be fast (indexed query, cached).
- **Audit trail:** All grant/revoke actions logged to `AuditLog`.
- **GDPR alignment:** User can see and revoke all their consents. Deletion cascades on user delete.
- **Tenant isolation:** All queries scoped to tenant context via middleware.
