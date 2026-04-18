/**
 * ACL Middleware
 *
 * Provides permission checking and route guards for the Surdej API.
 *
 * Usage:
 *   app.get('/articles', { preHandler: [requirePermission('articles', 'read')] }, handler)
 *
 * The middleware resolves the user from the session token, determines their
 * active tenant, and checks if their role has the required permission.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { prisma } from '../../db.js';
import { permissionCache } from './cache.js';

// ─── Types ───

export interface RequestContext {
    userId: string;
    tenantId: string | null;
    roleSlug: string;
    roleId: string;
    rolePriority: number;
    impersonating: boolean;
}

// Augment Fastify request with ACL context
declare module 'fastify' {
    interface FastifyRequest {
        acl?: RequestContext;
    }
}

// ─── Resolve user context ───

/**
 * Resolves the ACL context from the request.
 *
 * Checks for:
 * 1. Bearer token → Session → User
 * 2. X-Tenant-Id header or query param to determine active tenant
 * 3. UserTenant → TenantRole to determine permissions
 */
export async function resolveContext(request: FastifyRequest): Promise<RequestContext | null> {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    // Look up session
    const session = await prisma.session.findUnique({
        where: { token },
        include: {
            user: {
                include: {
                    userTenants: {
                        where: { removedAt: null },
                        include: { role: true },
                    },
                },
            },
        },
    });

    if (!session || session.expiresAt < new Date()) return null;

    const user = session.user;

    // Determine active tenant from header, query param, or default
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
    const queryTenantId = (request.query as Record<string, string | undefined>)?.tenantId;
    const requestedTenantId = headerTenantId || queryTenantId;

    // Super-admin detection
    const isSuperAdmin = user.role === 'SUPER_ADMIN'; // legacy field check
    const superAdminMembership = user.userTenants.find(ut => ut.role.slug === 'super-admin');
    const hasSuperAdminAccess = isSuperAdmin || !!superAdminMembership;

    // Find matching UserTenant membership for the requested tenant
    const matchingMembership = requestedTenantId
        ? user.userTenants.find(ut => ut.tenantId === requestedTenantId)
        : null;

    // Case 1: User has a direct membership for the requested tenant
    if (matchingMembership) {
        return {
            userId: user.id,
            tenantId: matchingMembership.tenantId,
            roleSlug: matchingMembership.role.slug,
            roleId: matchingMembership.roleId,
            rolePriority: matchingMembership.role.priority,
            impersonating: false,
        };
    }

    // Case 2: Super-admin requesting a tenant they don't have membership in → impersonate
    if (requestedTenantId && hasSuperAdminAccess) {
        return {
            userId: user.id,
            tenantId: requestedTenantId,
            roleSlug: 'super-admin',
            roleId: superAdminMembership?.roleId ?? '',
            rolePriority: 100,
            impersonating: true,
        };
    }

    // Case 3: No specific tenant requested — fall back to default membership
    const defaultMembership = user.userTenants.find(ut => ut.isDefault) ?? user.userTenants[0];

    if (defaultMembership) {
        return {
            userId: user.id,
            tenantId: defaultMembership.tenantId,
            roleSlug: defaultMembership.role.slug,
            roleId: defaultMembership.roleId,
            rolePriority: defaultMembership.role.priority,
            impersonating: false,
        };
    }

    // Case 4: Super-admin with no memberships at all
    if (hasSuperAdminAccess) {
        return {
            userId: user.id,
            tenantId: null,
            roleSlug: 'super-admin',
            roleId: superAdminMembership?.roleId ?? '',
            rolePriority: 100,
            impersonating: false,
        };
    }

    return null;
}

// ─── Permission check ───

/**
 * Check if a role has a specific permission.
 *
 * Resolution order:
 * 1. Tenant-specific RolePermission (if tenantId set)
 * 2. Global RolePermission (tenantId = null)
 * 3. Default: deny
 */
export async function checkPermission(
    roleId: string,
    resource: string,
    action: string,
    tenantId?: string | null,
): Promise<boolean> {
    // Cache key: perm:<tenantId>:<roleId>:<resource>:<action>
    const cacheKey = `perm:${tenantId ?? 'global'}:${roleId}:${resource}:${action}`;

    return permissionCache.getOrSet(cacheKey, async () => {
        // Find the permission
        const permission = await prisma.permission.findUnique({
            where: { resource_action: { resource, action } },
        });

        if (!permission) return false;

        // Check for tenant-specific override first
        if (tenantId) {
            const tenantGrant = await prisma.rolePermission.findUnique({
                where: {
                    roleId_permissionId_tenantId: {
                        roleId,
                        permissionId: permission.id,
                        tenantId,
                    },
                },
            });
            if (tenantGrant) return tenantGrant.granted;
        }

        // Check global grant (tenantId = null)
        const globalGrant = await prisma.rolePermission.findFirst({
            where: {
                roleId,
                permissionId: permission.id,
                tenantId: null,
            },
        });

        return globalGrant?.granted ?? false;
    });
}

// ─── Route guards ───

/**
 * Fastify preHandler that requires authentication and sets request.acl
 */
export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) {
    resolveContext(request)
        .then(ctx => {
            if (!ctx) {
                reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
                return;
            }
            request.acl = ctx;
            done();
        })
        .catch(err => {
            request.log.error(err, 'ACL context resolution failed');
            reply.status(500).send({ error: 'Internal Server Error' });
        });
}

/**
 * Fastify preHandler factory that checks a specific permission.
 *
 * Usage:
 *   app.get('/articles', { preHandler: [requirePermission('articles', 'read')] }, handler)
 *
 * Automatically resolves auth context if not already set.
 * Super-admins (priority >= 100) bypass all permission checks.
 */
export function requirePermission(resource: string, action: string) {
    return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
        const check = async () => {
            // Resolve context if not already set
            if (!request.acl) {
                const ctx = await resolveContext(request);
                if (!ctx) {
                    return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
                }
                request.acl = ctx;
            }

            const ctx = request.acl;

            // Super-admin bypasses all permission checks
            if (ctx.rolePriority >= 100) {
                return done();
            }

            // Check permission
            const allowed = await checkPermission(ctx.roleId, resource, action, ctx.tenantId);

            if (!allowed) {
                return reply.status(403).send({
                    error: 'Forbidden',
                    message: `Missing permission: ${resource}:${action}`,
                });
            }

            done();
        };

        check().catch(err => {
            request.log.error(err, 'Permission check failed');
            reply.status(500).send({ error: 'Internal Server Error' });
        });
    };
}

// ─── Audit logging helper ───

export async function auditLog(params: {
    tenantId?: string | null;
    actorId: string;
    actorType?: 'USER' | 'SERVICE_ACCOUNT' | 'API_KEY' | 'SYSTEM';
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    request?: FastifyRequest;
}) {
    await prisma.auditLog.create({
        data: {
            tenantId: params.tenantId ?? null,
            actorId: params.actorId,
            actorType: params.actorType ?? 'USER',
            action: params.action,
            resource: params.resource,
            resourceId: params.resourceId,
            details: params.details as any,
            ipAddress: params.request?.ip,
            userAgent: params.request?.headers['user-agent'],
        },
    });
}
