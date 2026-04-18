import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../middleware/acl.js';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────

const VALID_PERMISSIONS = [
    'bridge:read', 'bridge:readwrite',
    'nosql:read', 'nosql:readwrite',
    'kv:read', 'kv:readwrite',
] as const;

const CreateIframeToolSchema = z.object({
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    url: z.string().url().max(2000),
    icon: z.string().max(50).optional().default('AppWindow'),
    permissions: z.array(z.enum(VALID_PERMISSIONS)).default([]),
    enabled: z.boolean().optional().default(true),
});

const UpdateIframeToolSchema = CreateIframeToolSchema.partial().omit({ slug: true });

// ─── Routes ─────────────────────────────────────────────────────

export async function iframeToolRoutes(app: FastifyInstance) {

    // ── GET / ── List all iframe tools for this tenant
    app.get('/', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;

        const tools = await prisma.iframeTool.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });

        return reply.send(tools);
    });

    // ── GET /enabled ── List only enabled iframe tools (for extension)
    app.get('/enabled', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;

        const tools = await prisma.iframeTool.findMany({
            where: { tenantId, enabled: true },
            orderBy: { name: 'asc' },
        });

        return reply.send(tools);
    });

    // ── GET /:slug ── Get single iframe tool
    app.get<{ Params: { slug: string } }>('/:slug', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { slug } = request.params;

        const tool = await prisma.iframeTool.findUnique({
            where: { tenantId_slug: { tenantId, slug } },
        });

        if (!tool) return reply.status(404).send({ error: 'Iframe tool not found' });
        return reply.send(tool);
    });

    // ── POST / ── Create new iframe tool (admin only)
    app.post('/', {
        preHandler: [requirePermission('iframe-tools', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const body = CreateIframeToolSchema.parse(request.body);

        const existing = await prisma.iframeTool.findUnique({
            where: { tenantId_slug: { tenantId, slug: body.slug } },
        });
        if (existing) {
            return reply.status(409).send({ error: `Iframe tool with slug "${body.slug}" already exists` });
        }

        const tool = await prisma.iframeTool.create({
            data: { tenantId, ...body },
        });

        return reply.status(201).send(tool);
    });

    // ── PUT /:slug ── Update iframe tool (admin only)
    app.put<{ Params: { slug: string } }>('/:slug', {
        preHandler: [requirePermission('iframe-tools', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { slug } = request.params;
        const body = UpdateIframeToolSchema.parse(request.body);

        const tool = await prisma.iframeTool.findUnique({
            where: { tenantId_slug: { tenantId, slug } },
        });
        if (!tool) return reply.status(404).send({ error: 'Iframe tool not found' });

        const updated = await prisma.iframeTool.update({
            where: { id: tool.id },
            data: body,
        });

        return reply.send(updated);
    });

    // ── PATCH /:slug/toggle ── Enable/disable iframe tool
    app.patch<{ Params: { slug: string } }>('/:slug/toggle', {
        preHandler: [requirePermission('iframe-tools', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { slug } = request.params;

        const tool = await prisma.iframeTool.findUnique({
            where: { tenantId_slug: { tenantId, slug } },
        });
        if (!tool) return reply.status(404).send({ error: 'Iframe tool not found' });

        const updated = await prisma.iframeTool.update({
            where: { id: tool.id },
            data: { enabled: !tool.enabled },
        });

        return reply.send(updated);
    });

    // ── DELETE /:slug ── Delete iframe tool (admin only)
    app.delete<{ Params: { slug: string } }>('/:slug', {
        preHandler: [requirePermission('iframe-tools', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { slug } = request.params;

        const result = await prisma.iframeTool.deleteMany({
            where: { tenantId, slug },
        });

        if (result.count === 0) return reply.status(404).send({ error: 'Iframe tool not found' });
        return reply.status(204).send();
    });
}
