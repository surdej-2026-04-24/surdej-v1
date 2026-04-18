/**
 * ACL Foundation Seed
 *
 * Creates built-in roles, permissions, role→permission mappings,
 * and migrates existing User.tenantId/role into UserTenant rows.
 *
 * Safe to run multiple times (idempotent via upserts).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Built-in Roles ───

const BUILT_IN_ROLES = [
    { slug: 'super-admin', name: 'Super Admin', description: 'Platform-level administration — full access across all tenants', priority: 100 },
    { slug: 'admin', name: 'Admin', description: 'Full tenant administration — users, roles, settings, database', priority: 80 },
    { slug: 'session-master', name: 'Session Master', description: 'Session and training management with limited user management', priority: 60 },
    { slug: 'book-keeper', name: 'Book Keeper', description: 'Financial reports, export capabilities, read-only articles', priority: 40 },
    { slug: 'member', name: 'Member', description: 'Standard user — read articles, own profile, basic features', priority: 20 },
] as const;

// ─── Permissions ───

const PERMISSIONS = [
    // Tenants
    { resource: 'tenants', action: 'read', description: 'View tenant details' },
    { resource: 'tenants', action: 'manage', description: 'Edit tenant settings and metadata' },
    // Users
    { resource: 'users', action: 'read', description: 'View user list and profiles' },
    { resource: 'users', action: 'write', description: 'Create and edit users' },
    { resource: 'users', action: 'delete', description: 'Remove users from tenant' },
    { resource: 'users', action: 'manage', description: 'Assign roles, manage permissions' },
    // Roles
    { resource: 'roles', action: 'read', description: 'View roles and permissions' },
    { resource: 'roles', action: 'manage', description: 'Create/edit roles and permission mappings' },
    // Articles
    { resource: 'articles', action: 'read', description: 'View articles' },
    { resource: 'articles', action: 'write', description: 'Create and edit articles' },
    { resource: 'articles', action: 'delete', description: 'Delete articles' },
    { resource: 'articles', action: 'export', description: 'Export articles' },
    // Skins
    { resource: 'skins', action: 'read', description: 'View skins' },
    { resource: 'skins', action: 'write', description: 'Create and edit skins' },
    { resource: 'skins', action: 'manage', description: 'Clone, import/export skins' },
    // Templates
    { resource: 'templates', action: 'read', description: 'View templates' },
    { resource: 'templates', action: 'write', description: 'Create and edit templates' },
    // Training
    { resource: 'training', action: 'read', description: 'View training modules and progress' },
    { resource: 'training', action: 'write', description: 'Create and edit training modules' },
    // Knowledge
    { resource: 'knowledge', action: 'read', description: 'View documents and knowledge base' },
    { resource: 'knowledge', action: 'write', description: 'Upload and manage documents' },
    { resource: 'knowledge', action: 'manage', description: 'Run jobs, manage pipelines' },
    // Database
    { resource: 'database', action: 'read', description: 'Browse tables and view data' },
    { resource: 'database', action: 'write', description: 'Edit records (future)' },
    { resource: 'database', action: 'manage', description: 'Schema operations (future)' },
    // Feedback
    { resource: 'feedback', action: 'read', description: 'View feedback entries' },
    { resource: 'feedback', action: 'write', description: 'Submit feedback' },
    // AI
    { resource: 'ai', action: 'read', description: 'View AI conversations' },
    { resource: 'ai', action: 'write', description: 'Create AI conversations' },
    { resource: 'ai', action: 'manage', description: 'Configure AI settings' },
    // MCP
    { resource: 'mcp', action: 'read', description: 'View MCP server configs' },
    { resource: 'mcp', action: 'manage', description: 'Add/remove MCP servers' },
    // Blobs
    { resource: 'blobs', action: 'read', description: 'View and download blobs' },
    { resource: 'blobs', action: 'write', description: 'Upload blobs' },
    { resource: 'blobs', action: 'delete', description: 'Delete blobs' },
    // Settings
    { resource: 'settings', action: 'read', description: 'View system settings' },
    { resource: 'settings', action: 'manage', description: 'Modify system settings' },
    // Audit
    { resource: 'audit', action: 'read', description: 'View audit logs' },
] as const;

// ─── Role → Permission Mapping ───
// Which permissions each built-in role gets by default.

type PermKey = `${string}:${string}`;

const ROLE_PERMISSIONS: Record<string, PermKey[]> = {
    'super-admin': PERMISSIONS.map(p => `${p.resource}:${p.action}` as PermKey), // all
    'admin': [
        'tenants:read', 'tenants:manage',
        'users:read', 'users:write', 'users:delete', 'users:manage',
        'roles:read', 'roles:manage',
        'articles:read', 'articles:write', 'articles:delete', 'articles:export',
        'skins:read', 'skins:write', 'skins:manage',
        'templates:read', 'templates:write',
        'training:read', 'training:write',
        'knowledge:read', 'knowledge:write', 'knowledge:manage',
        'database:read', 'database:write', 'database:manage',
        'feedback:read', 'feedback:write',
        'ai:read', 'ai:write', 'ai:manage',
        'mcp:read', 'mcp:manage',
        'blobs:read', 'blobs:write', 'blobs:delete',
        'settings:read', 'settings:manage',
        'audit:read',
    ],
    'session-master': [
        'tenants:read',
        'users:read', 'users:write',
        'roles:read',
        'articles:read', 'articles:write',
        'skins:read',
        'templates:read',
        'training:read', 'training:write',
        'knowledge:read', 'knowledge:write',
        'feedback:read', 'feedback:write',
        'ai:read', 'ai:write',
        'blobs:read', 'blobs:write',
    ],
    'book-keeper': [
        'tenants:read',
        'users:read',
        'articles:read', 'articles:export',
        'skins:read',
        'templates:read',
        'training:read',
        'knowledge:read',
        'feedback:read',
        'ai:read', 'ai:write',
        'blobs:read',
    ],
    'member': [
        'tenants:read',
        'articles:read',
        'skins:read',
        'templates:read',
        'training:read',
        'knowledge:read',
        'feedback:read', 'feedback:write',
        'ai:read', 'ai:write',
        'blobs:read',
    ],
};

// Map old Role enum → new slug
const LEGACY_ROLE_MAP: Record<string, string> = {
    'SUPER_ADMIN': 'super-admin',
    'ADMIN': 'admin',
    'SESSION_MASTER': 'session-master',
    'BOOK_KEEPER': 'book-keeper',
    'MEMBER': 'member',
};

async function seedAcl() {
    console.log('🔐 Seeding ACL foundation...\n');

    // ── 1. Create built-in roles ──
    // Note: Can't use upsert on @@unique with nullable tenantId, so use findFirst + create/update
    const roleMap = new Map<string, string>(); // slug → id
    for (const role of BUILT_IN_ROLES) {
        const existing = await prisma.tenantRole.findFirst({
            where: { tenantId: null, slug: role.slug },
        });

        let r;
        if (existing) {
            r = await prisma.tenantRole.update({
                where: { id: existing.id },
                data: { name: role.name, description: role.description, priority: role.priority },
            });
        } else {
            r = await prisma.tenantRole.create({
                data: { name: role.name, slug: role.slug, description: role.description, priority: role.priority, isBuiltIn: true },
            });
        }
        roleMap.set(role.slug, r.id);
        console.log(`  ✓ Role: ${r.name} (${r.slug}, priority=${r.priority})`);
    }

    // ── 2. Create permissions ──
    const permMap = new Map<string, string>(); // "resource:action" → id
    for (const perm of PERMISSIONS) {
        const p = await prisma.permission.upsert({
            where: { resource_action: { resource: perm.resource, action: perm.action } },
            update: { description: perm.description },
            create: { resource: perm.resource, action: perm.action, description: perm.description, isBuiltIn: true },
        });
        permMap.set(`${perm.resource}:${perm.action}`, p.id);
    }
    console.log(`  ✓ ${PERMISSIONS.length} permissions created/updated`);

    // ── 3. Map roles → permissions ──
    let mappingCount = 0;
    for (const [roleSlug, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
        const roleId = roleMap.get(roleSlug);
        if (!roleId) continue;

        for (const permKey of permKeys) {
            const permId = permMap.get(permKey);
            if (!permId) {
                console.warn(`  ⚠ Unknown permission: ${permKey}`);
                continue;
            }

            await prisma.rolePermission.upsert({
                where: { roleId_permissionId_tenantId: { roleId, permissionId: permId, tenantId: '' } },
                update: { granted: true },
                create: { roleId, permissionId: permId, granted: true },
            });
            mappingCount++;
        }
    }
    console.log(`  ✓ ${mappingCount} role→permission mappings`);

    // ── 4. Migrate existing User.tenantId + role → UserTenant ──
    const usersWithTenant = await prisma.user.findMany({
        where: { tenantId: { not: null } },
    });

    let migratedCount = 0;
    for (const user of usersWithTenant) {
        if (!user.tenantId) continue;

        const newRoleSlug = LEGACY_ROLE_MAP[user.role] ?? 'member';
        const roleId = roleMap.get(newRoleSlug);
        if (!roleId) {
            console.warn(`  ⚠ No role mapping for ${user.role} — skipping user ${user.email}`);
            continue;
        }

        await prisma.userTenant.upsert({
            where: { userId_tenantId: { userId: user.id, tenantId: user.tenantId } },
            update: { roleId },
            create: {
                userId: user.id,
                tenantId: user.tenantId,
                roleId,
                isDefault: true,
            },
        });
        migratedCount++;
    }
    console.log(`  ✓ ${migratedCount} users migrated to UserTenant`);

    // ── 5. Seed default TableAccessRule per tenant ──
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

    // Default table access rules per role
    const TABLE_ACCESS_DEFAULTS: Record<string, { tableName: string; canRead: boolean; canWrite: boolean; canDelete: boolean }[]> = {
        'super-admin': [{ tableName: '*', canRead: true, canWrite: true, canDelete: true }],
        'admin': [{ tableName: '*', canRead: true, canWrite: true, canDelete: true }],
        'session-master': [{ tableName: '*', canRead: true, canWrite: false, canDelete: false }],
        'book-keeper': [
            { tableName: 'Article', canRead: true, canWrite: false, canDelete: false },
            { tableName: 'Template', canRead: true, canWrite: false, canDelete: false },
        ],
        'member': [], // no database access
    };

    let tableRuleCount = 0;
    for (const tenant of tenants) {
        for (const [roleSlug, rules] of Object.entries(TABLE_ACCESS_DEFAULTS)) {
            const roleId = roleMap.get(roleSlug);
            if (!roleId) continue;

            for (const rule of rules) {
                await prisma.tableAccessRule.upsert({
                    where: {
                        tenantId_roleId_schema_tableName: {
                            tenantId: tenant.id,
                            roleId,
                            schema: 'public',
                            tableName: rule.tableName,
                        },
                    },
                    update: { canRead: rule.canRead, canWrite: rule.canWrite, canDelete: rule.canDelete },
                    create: {
                        tenantId: tenant.id,
                        roleId,
                        schema: 'public',
                        tableName: rule.tableName,
                        canRead: rule.canRead,
                        canWrite: rule.canWrite,
                        canDelete: rule.canDelete,
                    },
                });
                tableRuleCount++;
            }
        }
    }
    console.log(`  ✓ ${tableRuleCount} table access rules seeded across ${tenants.length} tenant(s)`);

    console.log('\n✅ ACL seed complete');
}

seedAcl()
    .catch((e) => {
        console.error('❌ ACL seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
