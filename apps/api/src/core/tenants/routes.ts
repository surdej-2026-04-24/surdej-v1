/**
 * Tenant CRUD routes.
 *
 * Prefix: /api/tenants
 *
 * Endpoints:
 *   GET    /              — list all tenants (including soft-deleted)
 *   GET    /me            — current user's active tenant
 *   PUT    /me            — switch active tenant
 *   GET    /:id           — single tenant by ID
 *   POST   /              — create a new tenant
 *   PUT    /:id           — update tenant
 *   DELETE /:id           — soft-delete (set deletedAt)
 *   PUT    /:id/restore   — restore soft-deleted tenant
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { z } from 'zod';
import { requirePermission, requireAuth } from '../middleware/acl.js';

const createTenantSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    backgroundUrl: z.string().optional(),
    metadata: z.any().optional(),
});

const updateTenantSchema = createTenantSchema.partial();

export async function tenantsRoutes(app: FastifyInstance) {
    // ─── GET /api/tenants — list all (including soft-deleted) ─────
    app.get('/', { preHandler: [requirePermission('tenants', 'read')] }, async (_request, reply) => {
        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'asc' },
        });
        return reply.send(tenants);
    });

    // ─── GET /api/tenants/me — current user's active tenant ──────
    app.get('/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: { include: { tenant: true } } },
        });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        if (session.user.tenant) {
            return reply.send(session.user.tenant);
        }

        // Fall back to demo tenant
        const demo = await prisma.tenant.findFirst({ where: { isDemo: true } });
        return reply.send(demo);
    });

    // ─── PUT /api/tenants/me — switch active tenant ──────────────
    app.put('/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({ where: { token } });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        const { tenantId } = z.object({ tenantId: z.string().min(1) }).parse(request.body);

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

        await prisma.user.update({
            where: { id: session.userId },
            data: { tenantId },
        });

        return reply.send(tenant);
    });

    // ─── GET /api/tenants/:id — single tenant ────────────────────
    app.get<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('tenants', 'read')] }, async (request, reply) => {
        const tenant = await prisma.tenant.findUnique({ where: { id: request.params.id } });
        if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
        return reply.send(tenant);
    });

    // ─── POST /api/tenants — create ──────────────────────────────
    app.post('/', { preHandler: [requirePermission('tenants', 'manage')] }, async (request: FastifyRequest, reply) => {
        const body = createTenantSchema.parse(request.body);
        const tenant = await prisma.tenant.create({
            data: {
                name: body.name,
                slug: body.slug,
                description: body.description,
                logoUrl: body.logoUrl,
                backgroundUrl: body.backgroundUrl,
                metadata: body.metadata as Prisma.InputJsonValue | undefined,
                isDemo: false,
            },
        });
        return reply.status(201).send(tenant);
    });

    // ─── PUT /api/tenants/:id — update ───────────────────────────
    app.put<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('tenants', 'manage')] }, async (request, reply) => {
        const tenant = await prisma.tenant.findUnique({ where: { id: request.params.id } });
        if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

        const body = updateTenantSchema.parse(request.body);
        const updated = await prisma.tenant.update({
            where: { id: request.params.id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.slug !== undefined && { slug: body.slug }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
                ...(body.backgroundUrl !== undefined && { backgroundUrl: body.backgroundUrl }),
                ...(body.metadata !== undefined && { metadata: body.metadata as Prisma.InputJsonValue }),
            },
        });
        return reply.send(updated);
    });

    // ─── DELETE /api/tenants/:id — soft-delete ───────────────────
    app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('tenants', 'manage')] }, async (request, reply) => {
        const tenant = await prisma.tenant.findUnique({ where: { id: request.params.id } });
        if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
        if (tenant.isDemo) return reply.status(403).send({ error: 'Demo tenant cannot be deleted' });

        await prisma.tenant.update({
            where: { id: request.params.id },
            data: { deletedAt: new Date() },
        });
        return reply.send({ success: true });
    });

    // ─── PUT /api/tenants/:id/restore — restore soft-deleted ─────
    app.put<{ Params: { id: string } }>('/:id/restore', { preHandler: [requirePermission('tenants', 'manage')] }, async (request, reply) => {
        const tenant = await prisma.tenant.findUnique({ where: { id: request.params.id } });
        if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
        if (!tenant.deletedAt) return reply.status(400).send({ error: 'Tenant is not archived' });

        const restored = await prisma.tenant.update({
            where: { id: request.params.id },
            data: { deletedAt: null },
        });
        return reply.send(restored);
    });
}
