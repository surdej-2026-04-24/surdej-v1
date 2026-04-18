# 18 — Access Control

## Overview

Surdej implements a **layered access control** system across four levels:

1. **Tenant-level** — who can access which tenant
2. **Table-level** — who can see/modify which database objects
3. **Record-level** — who can see/modify which rows (team-based + custom policies)
4. **Field-level** — which fields are visible or masked per role

The system uses **RBAC (Role-Based Access Control)** with **granular permissions** mapped to roles, configurable per tenant. It also supports **API keys and service accounts** for machine-to-machine access, and maintains a full **audit trail** of all access control changes.

---

## 1. Tenant Membership (Many-to-Many)

### Current → New

Replace the single `User.tenantId` FK with a **`UserTenant` join table**. A user can belong to multiple tenants with different roles in each.

### Data Model

```prisma
model UserTenant {
  id        String   @id @default(uuid())
  userId    String
  tenantId  String
  roleId    String               // FK → TenantRole
  isDefault Boolean  @default(false)  // user's default tenant on login
  joinedAt  DateTime @default(now())
  removedAt DateTime?            // soft-remove from tenant

  user   User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   TenantRole @relation(fields: [roleId], references: [id])

  @@unique([userId, tenantId])
}
```

### Behaviour

| Scenario | Rule |
|----------|------|
| User logs in | Redirected to their `isDefault=true` tenant |
| User switches tenant | Frontend sets active `tenantId` in session context |
| User removed from tenant | `removedAt` is set (soft-remove); user can no longer access |
| Super-admin | Exists in a special **platform context** (see §7) |

### Migration Path

1. Create `UserTenant` table
2. Migrate existing `User.tenantId` → `UserTenant` rows with role mapping
3. Deprecate `User.tenantId` (keep as nullable for backwards compat during transition)
4. Drop `User.tenantId` column in a later migration

---

## 2. Roles & Permissions (RBAC)

### Philosophy

- **Roles** define "who you are" (Admin, Member, etc.)
- **Permissions** define "what you can do" (e.g. `articles:write`)
- **RolePermission** connects them, configurable per tenant
- Roles can be **built-in** (shipped with Surdej) or **custom** (created per tenant)

### Data Model

```prisma
// ─── Roles ───

model TenantRole {
  id          String   @id @default(uuid())
  tenantId    String?              // null = built-in / global role
  name        String               // e.g. "Admin", "Editor", "Viewer"
  slug        String               // e.g. "admin", "editor", "viewer"
  description String?
  isBuiltIn   Boolean  @default(false)
  priority    Int      @default(0) // higher = more privileged (for conflict resolution)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  permissions RolePermission[]
  userTenants UserTenant[]
  apiKeys     ApiKey[]

  @@unique([tenantId, slug])
}

// ─── Permissions ───

model Permission {
  id          String   @id @default(uuid())
  resource    String               // e.g. "articles", "users", "database", "skins"
  action      String               // e.g. "read", "write", "delete", "manage", "export"
  description String?
  isBuiltIn   Boolean  @default(true)

  rolePermissions RolePermission[]

  @@unique([resource, action])
}

model RolePermission {
  id           String   @id @default(uuid())
  roleId       String
  permissionId String
  tenantId     String?              // null = global override; set = tenant-specific
  granted      Boolean  @default(true)  // false = explicitly denied
  conditions   Json?                // optional policy conditions (see §4)

  role       TenantRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  tenant     Tenant?    @relation(fields: [tenantId], references: [id])

  @@unique([roleId, permissionId, tenantId])
}
```

### Built-in Roles

| Role | Slug | Priority | Default Permissions |
|------|------|----------|-------------------|
| **Super Admin** | `super-admin` | 100 | All (platform-level, bypasses tenant) |
| **Admin** | `admin` | 80 | Full tenant access: users, roles, settings, database |
| **Session Master** | `session-master` | 60 | Sessions, training modules, limited user management |
| **Member** | `member` | 20 | Read articles, own profile, basic features |
| **Book Keeper** | `book-keeper` | 40 | Financial reports, export, read-only articles |

### Built-in Permissions (Seed Data)

```
resource         action      description
─────────────    ────────    ───────────────────────────────────────
tenants          read        View tenant details
tenants          manage      Edit tenant settings, metadata
users            read        View user list and profiles
users            write       Create and edit users
users            delete      Remove users from tenant
users            manage      Assign roles, manage permissions
roles            read        View roles and permissions
roles            manage      Create/edit roles and permission mappings
articles         read        View articles
articles         write       Create and edit articles
articles         delete      Delete articles
articles         export      Export articles
skins            read        View skins
skins            write       Create and edit skins
skins            manage      Clone, import/export skins
templates        read        View templates
templates        write       Create and edit templates
training         read        View training modules and progress
training         write       Create and edit training modules
knowledge        read        View documents and knowledge base
knowledge        write       Upload and manage documents
knowledge        manage      Run jobs, manage pipelines
database         read        Browse tables and view data
database         write       Edit records (future)
database         manage      Schema operations (future)
feedback         read        View feedback entries
feedback         write       Submit feedback
ai               read        View AI conversations
ai               write       Create AI conversations
ai               manage      Configure AI settings
mcp              read        View MCP server configs
mcp              manage      Add/remove MCP servers
blobs            read        View and download blobs
blobs            write       Upload blobs
blobs            delete      Delete blobs
settings         read        View system settings
settings         manage      Modify system settings
audit            read        View audit logs
```

### Permission Resolution

When checking if a user can perform an action:

```
1. Get user's role for the active tenant (from UserTenant)
2. Get all RolePermission entries for that role
3. Apply tenant-specific overrides (tenantId match)
4. If any entry has granted=false → DENY (explicit deny wins)
5. If any entry has granted=true  → check conditions (§4)
6. If no entry exists            → DENY (default deny)
```

**Priority rule**: If a user has multiple roles (future), the highest-priority role's explicit grant/deny takes precedence.

---

## 3. Table-Level Access Control

Controls which database tables are visible in the **Database Browser** (spec 18's main use case alongside the general permission system).

### Data Model

```prisma
model TableAccessRule {
  id         String   @id @default(uuid())
  tenantId   String
  roleId     String               // FK → TenantRole
  schema     String  @default("public")
  tableName  String               // "*" = all tables in schema
  canRead    Boolean @default(false)
  canWrite   Boolean @default(false)
  canDelete  Boolean @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   TenantRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([tenantId, roleId, schema, tableName])
}
```

### Resolution Logic

```
1. Check if user has `database:read` permission (from §2) — if no, deny all
2. Look up TableAccessRule for (tenantId, roleId, schema, tableName)
3. If exact match found → use that rule
4. If no exact match → look for wildcard rule (tableName = "*")
5. If no wildcard → admin gets all, others get nothing
```

### API Changes

The existing `GET /api/database/schemas/:schema/tables` endpoint will:
- Accept `tenantId` (already done) + use session user's role
- Filter the returned table list based on `TableAccessRule`
- Include `access: { canRead, canWrite, canDelete }` in each table's response

### Default Rules (Seeded)

| Role | Tables | Read | Write | Delete |
|------|--------|------|-------|--------|
| `admin` | `*` | ✅ | ✅ | ✅ |
| `member` | `*` | ❌ | ❌ | ❌ |
| `book-keeper` | `Article`, `Template` | ✅ | ❌ | ❌ |

---

## 4. Record-Level Security (RLS)

Two complementary mechanisms:

### 4A. Team/Group-Based Access

Users belong to **teams** within a tenant. Records can be tagged with a team, restricting visibility.

```prisma
model Team {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  slug        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant  Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members TeamMember[]

  @@unique([tenantId, slug])
}

model TeamMember {
  id       String   @id @default(uuid())
  teamId   String
  userId   String
  role     TeamRole @default(MEMBER)  // LEAD, MEMBER, VIEWER
  joinedAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
}

enum TeamRole {
  LEAD
  MEMBER
  VIEWER
}
```

**Record tagging**: Models that support team-based RLS gain an optional `teamId` FK:

```prisma
model Article {
  // ... existing fields ...
  teamId String?   // null = visible to all in tenant
  team   Team?     @relation(fields: [teamId], references: [id])
}
```

**Resolution**: If `teamId` is set on a record, only users who are members of that team (or have `admin` role) can see it. If `teamId` is null, normal tenant-level visibility applies.

### 4B. Custom Policies

For more complex rules (e.g. "book-keepers can see articles with category='finance'"), we use a **policy engine**.

```prisma
model AccessPolicy {
  id          String   @id @default(uuid())
  tenantId    String
  name        String               // human-readable name
  description String?
  resource    String               // "articles", "templates", etc.
  roleId      String?              // null = applies to all roles
  conditions  Json                 // policy conditions (see below)
  effect      PolicyEffect @default(ALLOW)
  priority    Int      @default(0) // higher priority evaluated first
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   TenantRole? @relation(fields: [roleId], references: [id])

  @@index([tenantId, resource])
}

enum PolicyEffect {
  ALLOW
  DENY
}
```

### Policy Conditions Format (JSON)

Conditions use a simple expression language evaluated at query time:

```jsonc
{
  // Simple field match
  "field": "category",
  "operator": "eq",
  "value": "finance"
}
```

**Supported operators**:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{ "field": "status", "op": "eq", "value": "published" }` |
| `neq` | Not equals | `{ "field": "status", "op": "neq", "value": "draft" }` |
| `in` | In list | `{ "field": "category", "op": "in", "value": ["finance","ops"] }` |
| `contains` | String contains | `{ "field": "title", "op": "contains", "value": "report" }` |
| `gt` / `gte` / `lt` / `lte` | Numeric/date comparisons | `{ "field": "createdAt", "op": "gte", "value": "$30daysAgo" }` |
| `isNull` / `isNotNull` | Null checks | `{ "field": "deletedAt", "op": "isNull" }` |
| `userField` | Match against current user | `{ "field": "createdById", "op": "userField", "value": "id" }` |

**Compound conditions** (AND/OR):

```jsonc
{
  "and": [
    { "field": "category", "op": "eq", "value": "finance" },
    { "field": "status", "op": "in", "value": ["published", "review"] }
  ]
}
```

```jsonc
{
  "or": [
    { "field": "createdById", "op": "userField", "value": "id" },
    { "field": "teamId", "op": "in", "value": "$userTeamIds" }
  ]
}
```

### Dynamic Variables

Prefixed with `$`, resolved at query time:

| Variable | Resolves to |
|----------|-------------|
| `$userId` | Current user's ID |
| `$tenantId` | Active tenant ID |
| `$userTeamIds` | Array of team IDs the user belongs to |
| `$userRole` | Current user's role slug |
| `$now` | Current timestamp |
| `$30daysAgo` | 30 days before now |

### Policy Evaluation Order

```
1. Gather all active policies for (tenantId, resource)
2. Filter to policies matching user's role (or roleId=null)
3. Sort by priority DESC
4. For each policy, evaluate conditions against the record
5. First matching DENY → reject
6. First matching ALLOW → permit
7. No match → default deny
```

### Implementation Strategy

Policies are converted to **Prisma `where` clauses** at query time, pushed down to the database for efficiency:

```typescript
// Pseudo-code
function applyPolicies(baseQuery, user, resource) {
  const policies = await getPolicies(user.tenantId, resource, user.roleId);
  const allowConditions = policies
    .filter(p => p.effect === 'ALLOW')
    .map(p => conditionToPrismaWhere(p.conditions, user));
  const denyConditions = policies
    .filter(p => p.effect === 'DENY')
    .map(p => conditionToPrismaWhere(p.conditions, user));

  return {
    ...baseQuery,
    where: {
      AND: [
        baseQuery.where,
        { OR: allowConditions },        // must match at least one allow
        { NOT: { OR: denyConditions } }  // must not match any deny
      ]
    }
  };
}
```

---

## 5. Field-Level Masking

Certain fields are hidden or masked based on the user's role and the acting tenant's configuration.

### Data Model

```prisma
model FieldMaskRule {
  id         String   @id @default(uuid())
  tenantId   String
  roleId     String?              // null = applies to all roles
  resource   String               // model name: "User", "Article", etc.
  fieldName  String               // e.g. "email", "externalId", "metadata"
  maskType   MaskType @default(HIDE)
  createdAt  DateTime @default(now())

  tenant Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   TenantRole? @relation(fields: [roleId], references: [id])

  @@unique([tenantId, roleId, resource, fieldName])
}

enum MaskType {
  HIDE        // field omitted from response entirely
  REDACT      // replaced with "••••••"
  PARTIAL     // partial reveal: "j***@example.com"
  HASH        // SHA-256 hash of value (for comparison without reveal)
}
```

### Default Masking Rules

| Resource | Field | Roles Masked | Mask Type |
|----------|-------|-------------|-----------|
| `User` | `email` | `member`, `book-keeper` | `PARTIAL` |
| `User` | `externalId` | All except `admin`, `super-admin` | `HIDE` |
| `User` | `lastLoginAt` | `member` | `HIDE` |
| `Session` | `token` | All | `REDACT` |
| `ApiKey` | `secretHash` | All | `HIDE` |

### Implementation

Applied as a **response transformer** in the API layer:

```typescript
function maskFields(data, user, resource) {
  const rules = await getMaskRules(user.tenantId, user.roleId, resource);
  for (const rule of rules) {
    if (rule.fieldName in data) {
      switch (rule.maskType) {
        case 'HIDE':    delete data[rule.fieldName]; break;
        case 'REDACT':  data[rule.fieldName] = '••••••'; break;
        case 'PARTIAL': data[rule.fieldName] = partialMask(data[rule.fieldName]); break;
        case 'HASH':    data[rule.fieldName] = sha256(data[rule.fieldName]); break;
      }
    }
  }
  return data;
}
```

---

## 6. Audit Trail

Every access control mutation is logged immutably.

### Data Model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String?              // null for platform-level actions
  actorId    String               // user or service account who performed action
  actorType  ActorType @default(USER)
  action     String               // e.g. "role.assign", "policy.create", "tenant.enter"
  resource   String               // e.g. "UserTenant", "AccessPolicy", "TableAccessRule"
  resourceId String?              // ID of affected resource
  details    Json?                // before/after snapshot, metadata
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime @default(now())

  @@index([tenantId, timestamp])
  @@index([actorId, timestamp])
  @@index([resource, resourceId])
}

enum ActorType {
  USER
  SERVICE_ACCOUNT
  API_KEY
  SYSTEM
}
```

### Audited Events

| Action | Resource | Trigger |
|--------|----------|---------|
| `user.join_tenant` | `UserTenant` | User added to tenant |
| `user.leave_tenant` | `UserTenant` | User removed from tenant |
| `role.assign` | `UserTenant` | Role changed for user in tenant |
| `role.create` / `role.update` / `role.delete` | `TenantRole` | Custom role management |
| `permission.grant` / `permission.revoke` | `RolePermission` | Permission mapping changed |
| `policy.create` / `policy.update` / `policy.delete` | `AccessPolicy` | Custom policy management |
| `table_access.grant` / `table_access.revoke` | `TableAccessRule` | Database access rule changed |
| `field_mask.create` / `field_mask.update` / `field_mask.delete` | `FieldMaskRule` | Field masking rule changed |
| `tenant.enter` | `Tenant` | Super-admin impersonates a tenant |
| `tenant.leave` | `Tenant` | Super-admin leaves impersonation |
| `apikey.create` / `apikey.revoke` | `ApiKey` | API key lifecycle |

### Retention

- Default: **90 days** (configurable per tenant)
- Super-admin and security-sensitive events: **365 days**
- Stored in the same database; archival to object storage is a future option

---

## 7. Super-Admin Impersonation

Super-admins do **not** automatically see all tenant data. They must explicitly **enter a tenant context**, which is audited.

### Flow

```
1. Super-admin logs in → lands on Platform Dashboard (tenant-less context)
2. Super-admin selects "Enter Tenant: Nexi MS Ops"
3. System creates AuditLog entry: { action: "tenant.enter", actorId, tenantId, details: { reason } }
4. Session is updated with impersonatedTenantId
5. All subsequent API calls resolve permissions as if user has the "admin" role in that tenant
6. Super-admin clicks "Exit Tenant" → AuditLog: "tenant.leave"
7. Session returns to platform context
```

### Session Model Extension

```prisma
model Session {
  // ... existing fields ...

  impersonatedTenantId String?     // set when super-admin enters a tenant
  impersonatedAt       DateTime?   // when impersonation started
}
```

### API Header

When impersonating, the frontend sends:

```
X-Impersonate-Tenant: <tenantId>
```

The API middleware:
1. Validates the user is `super-admin`
2. Sets the request context to the target tenant
3. Logs the action in `AuditLog`

---

## 8. API Keys & Service Accounts

For machine-to-machine access (CI/CD, integrations, CLI tools).

### Data Model

```prisma
model ServiceAccount {
  id          String   @id @default(uuid())
  tenantId    String
  name        String               // "CI Pipeline", "Import Worker", etc.
  description String?
  roleId      String               // FK → TenantRole (same permission model)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant  Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role    TenantRole @relation(fields: [roleId], references: [id])
  apiKeys ApiKey[]
}

model ApiKey {
  id              String   @id @default(uuid())
  tenantId        String
  serviceAccountId String?              // null = personal API key for a user
  userId          String?               // null = service account key
  name            String                // "Production Key", "Read-only Key"
  prefix          String   @unique      // first 8 chars, for identification: "sk_live_"
  secretHash      String                // bcrypt hash of the full key
  roleId          String?               // override role (null = inherit from service account / user)
  scopes          String[] @default([]) // optional scope restriction: ["articles:read", "database:read"]
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  revokedAt       DateTime?
  createdAt       DateTime @default(now())

  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  serviceAccount ServiceAccount? @relation(fields: [serviceAccountId], references: [id])
  user           User?           @relation(fields: [userId], references: [id])
  role           TenantRole?     @relation(fields: [roleId], references: [id])

  @@index([prefix])
}
```

### Key Format

```
sk_live_<random-32-chars>    # production key
sk_test_<random-32-chars>    # test/development key
```

Only the **prefix** is stored in plain text (for identification in logs/UI). The full secret is hashed with bcrypt and only shown once at creation time.

### Authentication Flow

```
1. Client sends: Authorization: Bearer sk_live_abc123...
2. API extracts prefix → looks up ApiKey record
3. Verifies bcrypt(secret) matches secretHash
4. Checks: not revoked, not expired, isActive
5. Resolves permissions from: key.scopes ∩ role.permissions
6. Sets request context with tenantId and resolved permissions
7. All actions are audit-logged with actorType=API_KEY
```

### Scope Restriction

An API key can optionally restrict its permissions to a subset:

```jsonc
{
  "scopes": ["articles:read", "articles:write", "database:read"]
}
```

The effective permissions are the **intersection** of the key's scopes and the role's permissions.

---

## 9. Middleware Architecture

### Request Flow

```
  Request
    │
    ▼
  ┌──────────────────┐
  │  Auth Middleware  │  Extracts user from JWT / API key
  └────────┬─────────┘
           │
    ▼
  ┌──────────────────────┐
  │  Tenant Middleware    │  Resolves active tenant (from session, header, or impersonation)
  └────────┬─────────────┘
           │
    ▼
  ┌──────────────────────┐
  │  Permission Guard    │  Checks route-level permissions (e.g. database:read)
  └────────┬─────────────┘
           │
    ▼
  ┌──────────────────────┐
  │  Route Handler       │  Business logic, queries database
  └────────┬─────────────┘
           │
    ▼
  ┌──────────────────────┐
  │  RLS Filter          │  Applies record-level policies to query results
  └────────┬─────────────┘
           │
    ▼
  ┌──────────────────────┐
  │  Field Masking       │  Strips/masks sensitive fields in response
  └────────┬─────────────┘
           │
    ▼
  Response
```

### Fastify Integration

```typescript
// Route-level permission guard (decorator)
app.get('/articles', {
  preHandler: [requirePermission('articles', 'read')],
  handler: async (request, reply) => {
    const query = applyRLS(baseQuery, request.user, 'articles');
    const articles = await prisma.article.findMany(query);
    const masked = articles.map(a => maskFields(a, request.user, 'Article'));
    return reply.send(masked);
  }
});

// Permission guard factory
function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const can = await checkPermission(request.user, request.tenantId, resource, action);
    if (!can) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Missing permission: ${resource}:${action}`
      });
    }
  };
}
```

---

## 10. API Endpoints

### Role Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/roles` | `roles:read` | List tenant roles |
| `POST` | `/api/tenants/:tenantId/roles` | `roles:manage` | Create custom role |
| `PUT` | `/api/tenants/:tenantId/roles/:roleId` | `roles:manage` | Update role |
| `DELETE` | `/api/tenants/:tenantId/roles/:roleId` | `roles:manage` | Delete custom role |
| `GET` | `/api/tenants/:tenantId/roles/:roleId/permissions` | `roles:read` | List role permissions |
| `PUT` | `/api/tenants/:tenantId/roles/:roleId/permissions` | `roles:manage` | Update role permissions |

### User Membership

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/members` | `users:read` | List tenant members |
| `POST` | `/api/tenants/:tenantId/members` | `users:manage` | Add user to tenant |
| `PUT` | `/api/tenants/:tenantId/members/:userId` | `users:manage` | Change user's role |
| `DELETE` | `/api/tenants/:tenantId/members/:userId` | `users:manage` | Remove user from tenant |

### Teams

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/teams` | `users:read` | List teams |
| `POST` | `/api/tenants/:tenantId/teams` | `users:manage` | Create team |
| `PUT` | `/api/tenants/:tenantId/teams/:teamId` | `users:manage` | Update team |
| `GET` | `/api/tenants/:tenantId/teams/:teamId/members` | `users:read` | List team members |
| `POST` | `/api/tenants/:tenantId/teams/:teamId/members` | `users:manage` | Add member to team |

### Policies

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/policies` | `roles:read` | List access policies |
| `POST` | `/api/tenants/:tenantId/policies` | `roles:manage` | Create policy |
| `PUT` | `/api/tenants/:tenantId/policies/:policyId` | `roles:manage` | Update policy |
| `DELETE` | `/api/tenants/:tenantId/policies/:policyId` | `roles:manage` | Delete policy |

### Table Access Rules

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/table-access` | `roles:read` | List table access rules |
| `PUT` | `/api/tenants/:tenantId/table-access` | `roles:manage` | Upsert table access rules |

### API Keys

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/api-keys` | `settings:read` | List API keys (prefix only) |
| `POST` | `/api/tenants/:tenantId/api-keys` | `settings:manage` | Create API key (returns secret once) |
| `DELETE` | `/api/tenants/:tenantId/api-keys/:keyId` | `settings:manage` | Revoke API key |

### Audit Log

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tenants/:tenantId/audit-log` | `audit:read` | Query audit log (paginated, filterable) |

### Impersonation

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/impersonate/:tenantId` | Super-admin only | Enter tenant context |
| `DELETE` | `/api/impersonate` | Super-admin only | Exit tenant context |

---

## 11. Implementation Phases

### Phase 1 — Foundation (Week 1–2)

- [ ] Create `UserTenant` join table + migration from `User.tenantId`
- [ ] Create `TenantRole`, `Permission`, `RolePermission` models
- [ ] Seed built-in roles and permissions
- [ ] Implement `requirePermission()` middleware
- [ ] Add `tenantId` resolution middleware (from session + header)
- [ ] Protect existing routes with permission guards

### Phase 2 — Table & Record Access (Week 3–4)

- [ ] Create `TableAccessRule` model + seed defaults
- [ ] Integrate table access filtering into database browser API
- [ ] Create `Team` and `TeamMember` models
- [ ] Add `teamId` FK to `Article` (and other relevant models)
- [ ] Implement RLS query filter (`applyRLS()`)
- [ ] Create `AccessPolicy` model + evaluation engine

### Phase 3 — Field Masking & Audit (Week 5)

- [ ] Create `FieldMaskRule` model + seed defaults
- [ ] Implement response transformer for field masking
- [ ] Create `AuditLog` model
- [ ] Add audit logging to all ACL mutation endpoints
- [ ] Build audit log viewer in frontend

### Phase 4 — API Keys & Impersonation (Week 6)

- [ ] Create `ServiceAccount` and `ApiKey` models
- [ ] Implement API key auth middleware
- [ ] Implement super-admin impersonation flow
- [ ] Build API key management UI in frontend
- [ ] Build impersonation UX (banner, enter/exit)

### Phase 5 — Admin UI (Week 7–8)

- [ ] Role management page (CRUD roles, assign permissions)
- [ ] User membership page (add/remove users, change roles)
- [ ] Team management page
- [ ] Policy builder UI (visual condition editor)
- [ ] Table access rule configuration
- [ ] Field masking configuration

---

## 12. Entity Relationship Diagram

```
                    ┌──────────────┐
                    │    Tenant    │
                    └──────┬───────┘
         ┌─────────────────┼─────────────────────────┐
         │                 │                          │
    ┌────┴─────┐    ┌──────┴───────┐          ┌──────┴────────┐
    │  Team    │    │  TenantRole  │          │  AccessPolicy │
    └────┬─────┘    └──────┬───────┘          └───────────────┘
         │                 │
    ┌────┴──────┐   ┌──────┴────────┐
    │TeamMember │   │RolePermission │
    └────┬──────┘   └──────┬────────┘
         │                 │
         │          ┌──────┴───────┐
         │          │  Permission  │
         │          └──────────────┘
         │
    ┌────┴─────┐    ┌────────────────┐    ┌───────────────┐
    │   User   ├────┤  UserTenant    ├────┤  TenantRole   │
    └────┬─────┘    └────────────────┘    └───────────────┘
         │
    ┌────┴──────────┐    ┌──────────────────┐
    │    ApiKey      │    │  ServiceAccount  │
    └───────────────┘    └──────────────────┘

    ┌─────────────────┐    ┌──────────────────┐
    │  TableAccessRule │    │  FieldMaskRule   │
    └─────────────────┘    └──────────────────┘

    ┌─────────────────┐
    │    AuditLog     │
    └─────────────────┘
```

---

*References: `specs/core/08-auth-and-identity.md`, Prisma schema, database introspection routes.*
