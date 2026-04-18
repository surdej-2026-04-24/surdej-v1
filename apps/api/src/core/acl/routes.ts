/**
 * ACL Routes — Role & Permission Management
 *
 * Prefix: /api/acl
 *
 * Endpoints:
 *   GET  /roles                         — list all built-in roles
 *   GET  /permissions                   — list all permissions
 *   GET  /tenants/:tenantId/members     — list tenant members with roles
 *   POST /tenants/:tenantId/members     — add user to tenant
 *   PUT  /tenants/:tenantId/members/:userId — update user's role in tenant
 *   DELETE /tenants/:tenantId/members/:userId — remove user from tenant
 *   GET  /tenants/:tenantId/roles       — list roles (built-in + tenant-custom)
 *   GET  /users/:userId/tenants         — list tenants a user belongs to
 *   GET  /my-context                    — returns the current user's ACL context
 *   GET  /audit-log                     — query audit log (paginated)
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission, auditLog } from '../middleware/acl.js';
import { invalidateTenantCaches, getCacheStats } from '../middleware/cache.js';

export async function aclRoutes(app: FastifyInstance) {
    // ─── GET /roles — list all built-in roles ──────────────
    app.get('/roles', async (_request, reply) => {
        const roles = await prisma.tenantRole.findMany({
            where: { isBuiltIn: true },
            orderBy: { priority: 'desc' },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        return reply.send(
            roles.map(r => ({
                id: r.id,
                name: r.name,
                slug: r.slug,
                description: r.description,
                priority: r.priority,
                isBuiltIn: r.isBuiltIn,
                permissions: r.permissions
                    .filter(rp => rp.granted)
                    .map(rp => ({
                        resource: rp.permission.resource,
                        action: rp.permission.action,
                        description: rp.permission.description,
                    })),
            })),
        );
    });

    // ─── GET /matrix — permissions × roles matrix ──────────────
    app.get('/matrix', async (_request, reply) => {
        const [roles, permissions, grants] = await Promise.all([
            prisma.tenantRole.findMany({
                where: { isBuiltIn: true },
                orderBy: { priority: 'desc' },
                select: { id: true, name: true, slug: true, description: true, priority: true, isBuiltIn: true },
            }),
            prisma.permission.findMany({
                orderBy: [{ resource: 'asc' }, { action: 'asc' }],
                select: { id: true, resource: true, action: true, description: true },
            }),
            prisma.rolePermission.findMany({
                where: { granted: true },
                select: { roleId: true, permissionId: true, tenantId: true },
            }),
        ]);

        // Build a lookup: roleId → Set<permissionId>
        const grantMap = new Map<string, Set<string>>();
        for (const g of grants) {
            if (!grantMap.has(g.roleId)) grantMap.set(g.roleId, new Set());
            grantMap.get(g.roleId)!.add(g.permissionId);
        }

        // Group permissions by resource
        const resources = [...new Set(permissions.map(p => p.resource))];

        return reply.send({
            roles,
            permissions,
            resources,
            grants: grants.map(g => ({ roleId: g.roleId, permissionId: g.permissionId })),
            matrix: roles.map(role => ({
                roleId: role.id,
                roleSlug: role.slug,
                roleName: role.name,
                permissions: permissions.map(perm => ({
                    permissionId: perm.id,
                    resource: perm.resource,
                    action: perm.action,
                    granted: grantMap.get(role.id)?.has(perm.id) ?? false,
                })),
            })),
        });
    });

    // ─── POST /grant — grant a permission to a role ──────────────
    app.post('/grant', { preHandler: [requirePermission('users', 'manage')] }, async (request, reply) => {
        const { roleId, permissionId } = request.body as { roleId: string; permissionId: string };

        if (!roleId || !permissionId) {
            return reply.status(400).send({ error: 'roleId and permissionId are required' });
        }

        const grant = await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId_tenantId: { roleId, permissionId, tenantId: null as any },
            },
            create: { roleId, permissionId, granted: true },
            update: { granted: true },
        });

        await auditLog({
            actorId: request.acl!.userId,
            action: 'permission.grant',
            resource: 'RolePermission',
            resourceId: grant.id,
            details: { roleId, permissionId },
            request,
        });

        return reply.status(201).send(grant);
    });

    // ─── POST /revoke — revoke a permission from a role ──────────────
    app.post('/revoke', { preHandler: [requirePermission('users', 'manage')] }, async (request, reply) => {
        const { roleId, permissionId } = request.body as { roleId: string; permissionId: string };

        if (!roleId || !permissionId) {
            return reply.status(400).send({ error: 'roleId and permissionId are required' });
        }

        // Delete the grant entirely
        await prisma.rolePermission.deleteMany({
            where: { roleId, permissionId, tenantId: null },
        });

        await auditLog({
            actorId: request.acl!.userId,
            action: 'permission.revoke',
            resource: 'RolePermission',
            details: { roleId, permissionId },
            request,
        });

        return reply.send({ success: true });
    });

    // ─── GET /permissions — list all permissions ──────────────
    app.get('/permissions', async (_request, reply) => {
        const permissions = await prisma.permission.findMany({
            orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        });

        return reply.send(
            permissions.map(p => ({
                id: p.id,
                resource: p.resource,
                action: p.action,
                description: p.description,
            })),
        );
    });

    // ─── GET /my-context — current user's ACL context ──────────────
    app.get('/my-context', { preHandler: [requireAuth] }, async (request, reply) => {
        const acl = request.acl!;

        // Get all tenants the user belongs to
        const memberships = await prisma.userTenant.findMany({
            where: { userId: acl.userId, removedAt: null },
            include: {
                tenant: { select: { id: true, name: true, slug: true, logoUrl: true } },
                role: { select: { id: true, name: true, slug: true, priority: true } },
            },
            orderBy: { joinedAt: 'asc' },
        });

        // Get permissions for active role (deduplicated)
        let permissions: { resource: string; action: string }[] = [];
        if (acl.roleId) {
            const rolePerms = await prisma.rolePermission.findMany({
                where: { roleId: acl.roleId, granted: true },
                include: { permission: true },
            });
            const seen = new Set<string>();
            permissions = rolePerms
                .filter(rp => {
                    const key = `${rp.permission.resource}:${rp.permission.action}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                })
                .map(rp => ({
                    resource: rp.permission.resource,
                    action: rp.permission.action,
                }));
        }

        return reply.send({
            userId: acl.userId,
            activeTenantId: acl.tenantId,
            roleSlug: acl.roleSlug,
            rolePriority: acl.rolePriority,
            impersonating: acl.impersonating,
            permissions,
            tenants: memberships.map(m => ({
                id: m.tenant.id,
                name: m.tenant.name,
                slug: m.tenant.slug,
                logoUrl: m.tenant.logoUrl,
                role: m.role,
                isDefault: m.isDefault,
            })),
        });
    });

    // ─── GET /tenants/:tenantId/members — list tenant members ──────────────
    app.get<{ Params: { tenantId: string } }>(
        '/tenants/:tenantId/members',
        {
            preHandler: [requirePermission('users', 'read')],
        },
        async (request, reply) => {
            const { tenantId } = request.params;

            const members = await prisma.userTenant.findMany({
                where: { tenantId, removedAt: null },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            displayName: true,
                            avatarUrl: true,
                            lastLoginAt: true,
                        },
                    },
                    role: {
                        select: { id: true, name: true, slug: true, priority: true },
                    },
                },
                orderBy: { joinedAt: 'asc' },
            });

            return reply.send(
                members.map(m => ({
                    userId: m.user.id,
                    email: m.user.email,
                    name: m.user.name,
                    displayName: m.user.displayName,
                    avatarUrl: m.user.avatarUrl,
                    lastLoginAt: m.user.lastLoginAt,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    isDefault: m.isDefault,
                })),
            );
        },
    );

    // ─── POST /tenants/:tenantId/members — add user to tenant ──────────────
    app.post<{
        Params: { tenantId: string };
        Body: { userId: string; roleId: string; isDefault?: boolean };
    }>(
        '/tenants/:tenantId/members',
        {
            preHandler: [requirePermission('users', 'manage')],
        },
        async (
            request,
            reply,
        ) => {
            const { tenantId } = request.params;
            const { userId, roleId, isDefault } = request.body as any;

            // Verify user and role exist
            const [user, role] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId } }),
                prisma.tenantRole.findUnique({ where: { id: roleId } }),
            ]);

            if (!user) return reply.status(404).send({ error: 'User not found' });
            if (!role) return reply.status(404).send({ error: 'Role not found' });

            const membership = await prisma.userTenant.upsert({
                where: { userId_tenantId: { userId, tenantId } },
                update: { roleId, removedAt: null },
                create: { userId, tenantId, roleId, isDefault: isDefault ?? false },
            });

            await auditLog({
                tenantId,
                actorId: request.acl!.userId,
                action: 'user.join_tenant',
                resource: 'UserTenant',
                resourceId: membership.id,
                details: { userId, roleId, roleName: role.name },
                request,
            });

            // Invalidate caches for the affected tenant
            await invalidateTenantCaches(tenantId);

            return reply.status(201).send(membership);
        },
    );

    // ─── PUT /tenants/:tenantId/members/:userId — change role ──────────────
    app.put<{
        Params: { tenantId: string; userId: string };
        Body: { roleId: string };
    }>(
        '/tenants/:tenantId/members/:userId',
        {
            preHandler: [requirePermission('users', 'manage')],
        },
        async (
            request,
            reply,
        ) => {
            const { tenantId, userId } = request.params;
            const { roleId } = request.body as any;

            const existing = await prisma.userTenant.findUnique({
                where: { userId_tenantId: { userId, tenantId } },
                include: { role: true },
            });

            if (!existing || existing.removedAt) {
                return reply.status(404).send({ error: 'User not a member of this tenant' });
            }

            const newRole = await prisma.tenantRole.findUnique({ where: { id: roleId } });
            if (!newRole) return reply.status(404).send({ error: 'Role not found' });

            const updated = await prisma.userTenant.update({
                where: { userId_tenantId: { userId, tenantId } },
                data: { roleId },
            });

            await auditLog({
                tenantId,
                actorId: request.acl!.userId,
                action: 'role.assign',
                resource: 'UserTenant',
                resourceId: updated.id,
                details: {
                    userId,
                    previousRole: { id: existing.role.id, name: existing.role.name },
                    newRole: { id: newRole.id, name: newRole.name },
                },
                request,
            });

            // Invalidate caches — role changed
            await invalidateTenantCaches(tenantId);

            return reply.send(updated);
        },
    );

    // ─── DELETE /tenants/:tenantId/members/:userId — remove ──────────────
    app.delete<{ Params: { tenantId: string; userId: string } }>(
        '/tenants/:tenantId/members/:userId',
        {
            preHandler: [requirePermission('users', 'manage')],
        },
        async (request, reply) => {
            const { tenantId, userId } = request.params;

            const existing = await prisma.userTenant.findUnique({
                where: { userId_tenantId: { userId, tenantId } },
            });

            if (!existing || existing.removedAt) {
                return reply.status(404).send({ error: 'User not a member of this tenant' });
            }

            // Soft-remove
            await prisma.userTenant.update({
                where: { userId_tenantId: { userId, tenantId } },
                data: { removedAt: new Date() },
            });

            await auditLog({
                tenantId,
                actorId: request.acl!.userId,
                action: 'user.leave_tenant',
                resource: 'UserTenant',
                resourceId: existing.id,
                details: { userId },
                request,
            });

            // Invalidate caches — member removed
            await invalidateTenantCaches(tenantId);

            return reply.send({ success: true });
        },
    );

    // ─── GET /tenants/:tenantId/roles — list roles ──────────────
    app.get(
        '/tenants/:tenantId/roles',
        async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply) => {
            const { tenantId } = request.params;

            // Get built-in roles + tenant-specific custom roles
            const roles = await prisma.tenantRole.findMany({
                where: {
                    OR: [{ tenantId: null }, { tenantId }],
                },
                orderBy: { priority: 'desc' },
            });

            return reply.send(
                roles.map(r => ({
                    id: r.id,
                    name: r.name,
                    slug: r.slug,
                    description: r.description,
                    priority: r.priority,
                    isBuiltIn: r.isBuiltIn,
                    isGlobal: r.tenantId === null,
                })),
            );
        },
    );

    // ─── GET /users/:userId/tenants — list user's tenants ──────────────
    app.get<{ Params: { userId: string } }>(
        '/users/:userId/tenants',
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const { userId } = request.params;

            // Users can only see their own tenants, admins can see anyone's
            if (request.acl!.userId !== userId && request.acl!.rolePriority < 80) {
                return reply.status(403).send({ error: 'Forbidden' });
            }

            const memberships = await prisma.userTenant.findMany({
                where: { userId, removedAt: null },
                include: {
                    tenant: { select: { id: true, name: true, slug: true, logoUrl: true, isDemo: true } },
                    role: { select: { id: true, name: true, slug: true, priority: true } },
                },
                orderBy: { joinedAt: 'asc' },
            });

            return reply.send(
                memberships.map(m => ({
                    tenantId: m.tenant.id,
                    name: m.tenant.name,
                    slug: m.tenant.slug,
                    logoUrl: m.tenant.logoUrl,
                    isDemo: m.tenant.isDemo,
                    role: m.role,
                    isDefault: m.isDefault,
                    joinedAt: m.joinedAt,
                })),
            );
        },
    );

    // ─── GET /audit-log — query audit log ──────────────
    app.get<{
        Querystring: {
            tenantId?: string;
            resource?: string;
            action?: string;
            actorId?: string;
            limit?: string;
            offset?: string;
        };
    }>(
        '/audit-log',
        {
            preHandler: [requirePermission('audit', 'read')],
        },
        async (
            request,
            reply,
        ) => {
            const { tenantId, resource, action, actorId } = request.query;
            const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
            const offset = parseInt(request.query.offset ?? '0', 10);

            const where: any = {};
            if (tenantId) where.tenantId = tenantId;
            if (resource) where.resource = resource;
            if (action) where.action = action;
            if (actorId) where.actorId = actorId;

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where,
                    orderBy: { timestamp: 'desc' },
                    take: limit,
                    skip: offset,
                    include: {
                        actor: { select: { id: true, email: true, name: true, displayName: true } },
                        tenant: { select: { id: true, name: true, slug: true } },
                    },
                }),
                prisma.auditLog.count({ where }),
            ]);

            return reply.send({
                logs: logs.map(l => ({
                    id: l.id,
                    action: l.action,
                    resource: l.resource,
                    resourceId: l.resourceId,
                    actorType: l.actorType,
                    actor: l.actor,
                    tenant: l.tenant,
                    details: l.details,
                    ipAddress: l.ipAddress,
                    timestamp: l.timestamp,
                })),
                total,
                limit,
                offset,
            });
        },
    );

    // ─── GET /cache-stats — diagnostic endpoint ──────────────
    app.get(
        '/cache-stats',
        { preHandler: [requirePermission('audit', 'read')] },
        async (_request, reply) => {
            return reply.send(getCacheStats());
        },
    );

    // ─── POST /impersonate — super-admin enters tenant context ──────────────
    app.post<{ Body: { tenantId: string } }>(
        '/impersonate',
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const acl = request.acl!;

            // Only super-admins (priority >= 100) can impersonate
            if (acl.rolePriority < 100) {
                return reply.status(403).send({ error: 'Only super-admins can impersonate' });
            }

            const { tenantId } = request.body as { tenantId: string };
            if (!tenantId) {
                return reply.status(400).send({ error: 'tenantId is required' });
            }

            // Verify tenant exists
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { id: true, name: true, slug: true },
            });
            if (!tenant) {
                return reply.status(404).send({ error: 'Tenant not found' });
            }

            // Update the session with impersonation info
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) return reply.status(401).send({ error: 'No token' });

            await prisma.session.update({
                where: { token },
                data: {
                    impersonatedTenantId: tenantId,
                    impersonatedAt: new Date(),
                },
            });

            await auditLog({
                tenantId,
                actorId: acl.userId,
                action: 'impersonate.start',
                resource: 'Session',
                resourceId: token.slice(0, 8) + '...',
                details: { targetTenant: tenant.name, targetTenantId: tenantId },
                request,
            });

            // Invalidate caches so next request picks up new context
            await invalidateTenantCaches(tenantId);

            return reply.send({
                impersonating: true,
                tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
            });
        },
    );

    // ─── DELETE /impersonate — exit impersonation mode ──────────────
    app.delete(
        '/impersonate',
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const acl = request.acl!;
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) return reply.status(401).send({ error: 'No token' });

            // Get current impersonation state
            const session = await prisma.session.findUnique({
                where: { token },
                select: { impersonatedTenantId: true },
            });

            if (!session?.impersonatedTenantId) {
                return reply.send({ impersonating: false, message: 'Not impersonating' });
            }

            const previousTenantId = session.impersonatedTenantId;

            // Clear impersonation
            await prisma.session.update({
                where: { token },
                data: {
                    impersonatedTenantId: null,
                    impersonatedAt: null,
                },
            });

            await auditLog({
                tenantId: previousTenantId,
                actorId: acl.userId,
                action: 'impersonate.stop',
                resource: 'Session',
                resourceId: token.slice(0, 8) + '...',
                details: { previousTenantId },
                request,
            });

            return reply.send({ impersonating: false });
        },
    );
}
