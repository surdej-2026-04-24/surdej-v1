# Tenant Isolation Report

> Generated: 2026-02-22  
> Database: `surdej` on `localhost:5432`  
> Total tables: 36 (excluding `_prisma_migrations`)

---

## Summary

| Category | Count | Tables |
|----------|-------|--------|
| ✅ **Directly isolated** (has `tenantId`, NOT NULL) | 6 | AccessPolicy, AuthProvider, FieldMaskRule, TableAccessRule, Team, UserTenant |
| ⚠️ **Partially isolated** (has `tenantId`, NULLABLE) | 18 | AiConversation, AiUsageLog, ApiRequestLog, Article, AuditLog, Blob, FeedbackEntry, Job, McpServerConfig, RolePermission, Skin, Template, TenantDomain, TenantRole, TrainingModule, User, VirtualPage, WorkerRegistration |
| ❌ **Not isolated** (no `tenantId`) | 12 | AiMessage, ArticleVersion, DocumentChunk, FeatureFlag, LearnerProgress, McpToolInvocation, Permission, Session, TeamMember, UserSkinPreference, WorkerHeartbeat, Tenant |

---

## Detailed Analysis

### ✅ Directly Isolated (tenantId NOT NULL)

These tables enforce tenant isolation at the DB level — every row must belong to a tenant.

| Table | tenantId | Nullable | Indexed | FK → Tenant | Rows |
|-------|----------|----------|---------|-------------|------|
| **AccessPolicy** | ✅ | NOT NULL | ✅ | ✅ | 0 |
| **AuthProvider** | ✅ | NOT NULL | ✅ | ✅ | 0 |
| **FieldMaskRule** | ✅ | NOT NULL | ✅ | ✅ | 0 |
| **TableAccessRule** | ✅ | NOT NULL | ✅ | ✅ | 40 |
| **Team** | ✅ | NOT NULL | ✅ | ✅ | 0 |
| **UserTenant** | ✅ | NOT NULL | ✅ | ✅ | 55 |

**Assessment:** ✅ These are properly isolated. No data leakage possible.

---

### ⚠️ Partially Isolated (tenantId NULLABLE)

These tables have a `tenantId` column but it can be NULL, meaning rows can exist without tenant association. This is the **biggest risk area**.

| Table | tenantId | Nullable | Indexed | FK → Tenant | Rows | Risk |
|-------|----------|----------|---------|-------------|------|------|
| **Blob** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 126 | 🔴 **HIGH** — Documents without tenant = data leakage |
| **User** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🔴 **HIGH** — Users without tenant can see all data |
| **Article** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟡 MEDIUM |
| **AiConversation** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 1 | 🟡 MEDIUM — AI conversations visible cross-tenant |
| **AiUsageLog** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 3 | 🟢 LOW — Usage metrics only |
| **ApiRequestLog** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 9,535 | 🟡 MEDIUM — Request logs visible cross-tenant |
| **AuditLog** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 0 | 🟡 MEDIUM |
| **FeedbackEntry** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟢 LOW |
| **Job** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 0 | 🟡 MEDIUM — Job results visible cross-tenant |
| **McpServerConfig** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟡 MEDIUM — MCP configs shared |
| **RolePermission** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 117 | 🟡 MEDIUM — Built-in vs tenant perms |
| **Skin** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟢 LOW — Built-in skins |
| **Template** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟢 LOW — Built-in templates |
| **TenantDomain** | ✅ | NOT NULL | ❌ | ✅ | 0 | ✅ OK |
| **TenantRole** | ✅ | NULLABLE ⚠️ | ✅ | ✅ | 5 | 🟡 MEDIUM — Built-in vs tenant roles |
| **TrainingModule** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟢 LOW |
| **VirtualPage** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 0 | 🟢 LOW |
| **WorkerRegistration** | ✅ | NULLABLE ⚠️ | ❌ | ✅ | 44 | 🟢 LOW — Infrastructure |

---

### ❌ Not Isolated (no tenantId)

These tables have no `tenantId` column. Some are isolated through parent FK chains, others are system-global.

| Table | Isolation Strategy | FK Chain to Tenant | Rows | Risk |
|-------|-------------------|-------------------|------|------|
| **DocumentChunk** | Via `Blob.tenantId` | `DocumentChunk.blobId → Blob.tenantId` | 0 | 🔴 **HIGH** — Blob.tenantId is nullable, so chunks inherit the gap |
| **AiMessage** | Via `AiConversation.tenantId` | `AiMessage.conversationId → AiConversation.tenantId` | 6 | 🟡 MEDIUM — Conversation tenantId is nullable |
| **ArticleVersion** | Via `Article.tenantId` | `ArticleVersion.articleId → Article.tenantId` | 0 | 🟡 MEDIUM |
| **McpToolInvocation** | Via `McpServerConfig.tenantId` | `McpToolInvocation.serverId → McpServerConfig.tenantId` | 0 | 🟡 MEDIUM |
| **LearnerProgress** | Via `User.tenantId + TrainingModule.tenantId` | Both parents nullable | 0 | 🟡 MEDIUM |
| **TeamMember** | Via `Team.tenantId` | `TeamMember.teamId → Team.tenantId` ✅ NOT NULL | 0 | ✅ OK — Team is properly isolated |
| **UserSkinPreference** | Via `User + Skin` | Both parents nullable | 0 | 🟢 LOW |
| **Session** | Via `User.tenantId` | `Session.userId → User.tenantId` | 10 | 🟡 MEDIUM — Session has no tenant context |
| **WorkerHeartbeat** | Infrastructure | Via `WorkerRegistration` | 2,085 | ✅ OK — System-level |
| **Permission** | System-global | Built-in permission definitions | 38 | ✅ OK — Shared across all tenants |
| **FeatureFlag** | System-global | Feature flag definitions | 0 | ✅ OK — Shared across all tenants |
| **Tenant** | Self | Is the tenant table itself | 0 | ✅ OK |

---

## 🔴 Critical Issues

### 1. `Blob` — No tenant enforcement, no index
- **126 rows** with nullable tenantId and **no index on tenantId**
- Documents (PDFs, analyses) are stored without guaranteed tenant association
- **Impact:** Any API query without explicit tenant filtering returns all documents across tenants
- **Fix:** Make `tenantId` NOT NULL, add index, backfill existing rows

### 2. `DocumentChunk` — Inherits Blob's gap
- Chunks reference `Blob` which has nullable tenantId
- Vector search / semantic queries could return cross-tenant results
- **Fix:** Either add `tenantId` to DocumentChunk directly, or fix Blob first

### 3. `User` — Nullable tenantId
- The primary `tenantId` on User is nullable
- Users are multi-tenant via `UserTenant` junction, but the primary tenant field is not enforced
- **Fix:** Consider making `tenantId` the default/primary tenant, always set

---

## ⚠️ Missing Indexes

Tables with `tenantId` but **no index** on it (will cause slow queries at scale):

| Table | Rows | Needs Index |
|-------|------|-------------|
| Blob | 126 | 🔴 YES — frequently queried |
| AiConversation | 1 | 🟡 Eventually |
| Article | 0 | 🟡 Eventually |
| FeedbackEntry | 0 | 🟢 Low priority |
| McpServerConfig | 0 | 🟢 Low priority |
| Skin | 0 | 🟢 Low priority |
| Template | 0 | 🟢 Low priority |
| TenantDomain | 0 | 🟡 Eventually |
| TrainingModule | 0 | 🟢 Low priority |
| User | 0 | 🟡 Eventually |
| VirtualPage | 0 | 🟢 Low priority |
| WorkerRegistration | 44 | 🟢 Low priority |

---

## Recommended Actions

### Priority 1 — Immediate (Data Safety)
1. **Blob:** Make `tenantId` NOT NULL, add index, backfill existing 126 rows with correct tenant
2. **DocumentChunk:** Add `tenantId` column (NOT NULL) or ensure all Blob queries filter by tenant
3. **API middleware:** Add tenant-scoping middleware that automatically filters by `tenantId` on all queries

### Priority 2 — Short-term (Hardening)
4. **User:** Ensure `tenantId` is always set (primary tenant)
5. **Session:** Add `tenantId` to track which tenant context a session is operating in
6. **Add indexes** on `tenantId` for Blob, User, Article, AiConversation

### Priority 3 — Long-term (Architecture)
7. **Row-Level Security (RLS):** Consider PostgreSQL RLS policies for automatic tenant filtering
8. **Prisma middleware:** Add global `where` filter that injects `tenantId` into every query
9. **Audit:** Add tenant-aware audit logging to track cross-tenant access attempts

---

## Table Count Summary

```
┌─────────────────────────┬───────┐
│ Category                │ Count │
├─────────────────────────┼───────┤
│ ✅ Properly isolated    │     6 │
│ ⚠️ Nullable tenantId   │    18 │
│ ❌ No tenantId          │    12 │
│   ├─ OK (system/global) │     5 │
│   ├─ OK (FK chain)      │     2 │
│   └─ Needs attention    │     5 │
├─────────────────────────┼───────┤
│ Total                   │    36 │
└─────────────────────────┴───────┘
```
