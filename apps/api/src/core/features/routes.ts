import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { z } from 'zod';

const updateFeatureSchema = z.object({
    ring: z.number().min(1).max(4).optional(),
    enabledByDefault: z.boolean().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    documentationUrl: z.string().url().optional().nullable(),
});

const assignUserSchema = z.object({
    userId: z.string().uuid(),
    enabled: z.boolean().optional().default(true),
    ringOverride: z.number().min(1).max(4).optional(),
    reason: z.string().optional(),
});

const bulkAssignSchema = z.object({
    userIds: z.array(z.string().uuid()),
    enabled: z.boolean().optional().default(true),
    ringOverride: z.number().min(1).max(4).optional(),
    reason: z.string().optional(),
});

const assignRoleSchema = z.object({
    role: z.string().min(1),
    enabled: z.boolean().optional().default(true),
    ringOverride: z.number().min(1).max(4).optional(),
    reason: z.string().optional(),
});

const bulkAssignRolesSchema = z.object({
    roles: z.array(z.string().min(1)),
    enabled: z.boolean().optional().default(true),
    ringOverride: z.number().min(1).max(4).optional(),
    reason: z.string().optional(),
});

export async function featuresRoutes(app: FastifyInstance) {
    // GET /api/features — list all features with override counts
    app.get('/', async (_request, reply) => {
        const features = await prisma.featureFlag.findMany({
            orderBy: [{ category: 'asc' }, { title: 'asc' }],
            include: {
                userOverrides: {
                    select: { userId: true, enabled: true, ringOverride: true },
                },
                roleOverrides: {
                    select: { role: true, enabled: true, ringOverride: true },
                },
                _count: { select: { userOverrides: true, roleOverrides: true } },
            },
        });
        return reply.send(features);
    });

    // GET /api/features/matrix — full matrix view: features × ring × users + roles
    app.get('/matrix', async (_request, reply) => {
        const [features, users, tenantRoles] = await Promise.all([
            prisma.featureFlag.findMany({
                orderBy: [{ ring: 'asc' }, { category: 'asc' }, { title: 'asc' }],
                include: {
                    userOverrides: {
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, displayName: true, avatarUrl: true },
                            },
                        },
                    },
                    roleOverrides: true,
                },
            }),
            prisma.user.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, email: true, displayName: true, avatarUrl: true, role: true },
                orderBy: { name: 'asc' },
            }),
            prisma.tenantRole.findMany({
                select: { id: true, name: true, slug: true, description: true, priority: true, isBuiltIn: true },
                orderBy: { priority: 'desc' },
            }),
        ]);

        // Combine legacy enum roles with tenant roles
        const roles = [
            { slug: 'SUPER_ADMIN', name: 'Super Admin', priority: 100, isBuiltIn: true },
            { slug: 'ADMIN', name: 'Admin', priority: 80, isBuiltIn: true },
            { slug: 'SESSION_MASTER', name: 'Session Master', priority: 60, isBuiltIn: true },
            { slug: 'MEMBER', name: 'Member', priority: 40, isBuiltIn: true },
            { slug: 'BOOK_KEEPER', name: 'Book Keeper', priority: 20, isBuiltIn: true },
            ...tenantRoles.filter(r => !['SUPER_ADMIN', 'ADMIN', 'SESSION_MASTER', 'MEMBER', 'BOOK_KEEPER'].includes(r.slug)),
        ];

        return reply.send({ features, users, roles });
    });

    // GET /api/features/:id
    app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const feature = await prisma.featureFlag.findUnique({
            where: { featureId: request.params.id },
            include: {
                userOverrides: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, displayName: true, avatarUrl: true },
                        },
                    },
                },
                roleOverrides: true,
            },
        });

        if (!feature) {
            return reply.status(404).send({ error: 'Feature not found' });
        }

        return reply.send(feature);
    });

    // PUT /api/features/:id
    app.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const body = updateFeatureSchema.parse(request.body);
        const feature = await prisma.featureFlag.update({
            where: { featureId: request.params.id },
            data: body,
        });
        return reply.send(feature);
    });

    // ─── User Overrides ──────────────────────────────────────────

    // POST /api/features/:id/users — assign a user to a feature
    app.post<{ Params: { id: string } }>('/:id/users', async (request, reply) => {
        const body = assignUserSchema.parse(request.body);
        const acl = (request as any).acl;

        const override = await prisma.featureUserOverride.upsert({
            where: {
                featureId_userId: {
                    featureId: request.params.id,
                    userId: body.userId,
                },
            },
            create: {
                featureId: request.params.id,
                userId: body.userId,
                enabled: body.enabled,
                ringOverride: body.ringOverride,
                grantedBy: acl?.userId,
                reason: body.reason,
            },
            update: {
                enabled: body.enabled,
                ringOverride: body.ringOverride,
                grantedBy: acl?.userId,
                reason: body.reason,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, displayName: true, avatarUrl: true },
                },
            },
        });

        return reply.status(201).send(override);
    });

    // POST /api/features/:id/users/bulk — assign multiple users at once
    app.post<{ Params: { id: string } }>('/:id/users/bulk', async (request, reply) => {
        const body = bulkAssignSchema.parse(request.body);
        const acl = (request as any).acl;

        const results = await Promise.all(
            body.userIds.map(userId =>
                prisma.featureUserOverride.upsert({
                    where: {
                        featureId_userId: {
                            featureId: request.params.id,
                            userId,
                        },
                    },
                    create: {
                        featureId: request.params.id,
                        userId,
                        enabled: body.enabled,
                        ringOverride: body.ringOverride,
                        grantedBy: acl?.userId,
                        reason: body.reason,
                    },
                    update: {
                        enabled: body.enabled,
                        ringOverride: body.ringOverride,
                        grantedBy: acl?.userId,
                        reason: body.reason,
                    },
                })
            )
        );

        return reply.send({ assigned: results.length });
    });

    // DELETE /api/features/:id/users/:userId — remove user override
    app.delete<{ Params: { id: string; userId: string } }>('/:id/users/:userId', async (request, reply) => {
        await prisma.featureUserOverride.deleteMany({
            where: {
                featureId: request.params.id,
                userId: request.params.userId,
            },
        });
        return reply.status(204).send();
    });

    // ─── Role Overrides ──────────────────────────────────────────

    // POST /api/features/:id/roles — assign a role to a feature
    app.post<{ Params: { id: string } }>('/:id/roles', async (request, reply) => {
        const body = assignRoleSchema.parse(request.body);
        const acl = (request as any).acl;

        const override = await prisma.featureRoleOverride.upsert({
            where: {
                featureId_role: {
                    featureId: request.params.id,
                    role: body.role,
                },
            },
            create: {
                featureId: request.params.id,
                role: body.role,
                enabled: body.enabled,
                ringOverride: body.ringOverride,
                grantedBy: acl?.userId,
                reason: body.reason,
            },
            update: {
                enabled: body.enabled,
                ringOverride: body.ringOverride,
                grantedBy: acl?.userId,
                reason: body.reason,
            },
        });

        return reply.status(201).send(override);
    });

    // POST /api/features/:id/roles/bulk — assign multiple roles at once
    app.post<{ Params: { id: string } }>('/:id/roles/bulk', async (request, reply) => {
        const body = bulkAssignRolesSchema.parse(request.body);
        const acl = (request as any).acl;

        const results = await Promise.all(
            body.roles.map(role =>
                prisma.featureRoleOverride.upsert({
                    where: {
                        featureId_role: {
                            featureId: request.params.id,
                            role,
                        },
                    },
                    create: {
                        featureId: request.params.id,
                        role,
                        enabled: body.enabled,
                        ringOverride: body.ringOverride,
                        grantedBy: acl?.userId,
                        reason: body.reason,
                    },
                    update: {
                        enabled: body.enabled,
                        ringOverride: body.ringOverride,
                        grantedBy: acl?.userId,
                        reason: body.reason,
                    },
                })
            )
        );

        return reply.send({ assigned: results.length });
    });

    // DELETE /api/features/:id/roles/:role — remove role override
    app.delete<{ Params: { id: string; role: string } }>('/:id/roles/:role', async (request, reply) => {
        await prisma.featureRoleOverride.deleteMany({
            where: {
                featureId: request.params.id,
                role: request.params.role,
            },
        });
        return reply.status(204).send();
    });

    // ─── Resolved per-user view ──────────────────────────────────

    // GET /api/features/user/:userId — get all features for a specific user (resolved)
    app.get<{ Params: { userId: string } }>('/user/:userId', async (request, reply) => {
        const user = await prisma.user.findUnique({
            where: { id: request.params.userId },
            select: { id: true, role: true },
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        const [features, userOverrides, roleOverrides] = await Promise.all([
            prisma.featureFlag.findMany({
                orderBy: [{ ring: 'asc' }, { title: 'asc' }],
            }),
            prisma.featureUserOverride.findMany({
                where: { userId: request.params.userId },
            }),
            prisma.featureRoleOverride.findMany({
                where: { role: user.role },
            }),
        ]);

        const userOverrideMap = new Map(userOverrides.map(o => [o.featureId, o]));
        const roleOverrideMap = new Map(roleOverrides.map(o => [o.featureId, o]));

        const resolved = features.map(f => {
            // User overrides take precedence over role overrides
            const userOv = userOverrideMap.get(f.featureId);
            const roleOv = roleOverrideMap.get(f.featureId);
            const override = userOv ?? roleOv;

            return {
                ...f,
                effectiveRing: override?.ringOverride ?? f.ring,
                effectiveEnabled: override?.enabled ?? f.enabledByDefault,
                hasUserOverride: !!userOv,
                hasRoleOverride: !!roleOv,
                override: override ?? null,
            };
        });

        return reply.send(resolved);
    });
}
