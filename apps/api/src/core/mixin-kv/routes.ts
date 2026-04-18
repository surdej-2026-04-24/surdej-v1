import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth } from '../middleware/acl.js';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────

const UpsertSchema = z.object({
    key: z.string().min(1).max(512),
    value: z.any(),
});

const ListSchema = z.object({
    prefix: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

// ─── Routes ─────────────────────────────────────────────────────

export async function mixinKvRoutes(app: FastifyInstance) {

    // ── GET /:mixinId/keys ── List keys for a mixin
    app.get<{ Params: { mixinId: string }; Querystring: z.infer<typeof ListSchema> }>('/:mixinId/keys', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const { mixinId } = request.params;
        const q = ListSchema.parse(request.query);

        const where: Record<string, unknown> = { tenantId, userId, mixinId };
        if (q.prefix) where.key = { startsWith: q.prefix };

        const [entries, total] = await Promise.all([
            prisma.mixinKeyValue.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: q.limit,
                skip: q.offset,
            }),
            prisma.mixinKeyValue.count({ where }),
        ]);

        return reply.send({ entries, total, limit: q.limit, offset: q.offset });
    });

    // ── GET /:mixinId/keys/:key ── Get single value
    app.get<{ Params: { mixinId: string; key: string } }>('/:mixinId/keys/*', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const { mixinId } = request.params;
        const key = decodeURIComponent((request.params as Record<string, string>)['*']);

        const entry = await prisma.mixinKeyValue.findUnique({
            where: { tenantId_userId_mixinId_key: { tenantId, userId, mixinId, key } },
        });

        if (!entry) return reply.status(404).send({ error: 'Key not found' });
        return reply.send(entry);
    });

    // ── PUT /:mixinId/keys/:key ── Upsert value
    app.put<{ Params: { mixinId: string; key: string } }>('/:mixinId/keys/*', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const { mixinId } = request.params;
        const key = decodeURIComponent((request.params as Record<string, string>)['*']);
        const body = UpsertSchema.parse({ ...(request.body as object), key });

        const entry = await prisma.mixinKeyValue.upsert({
            where: { tenantId_userId_mixinId_key: { tenantId, userId, mixinId, key } },
            create: { tenantId, userId, mixinId, key, value: body.value },
            update: { value: body.value },
        });

        return reply.status(200).send(entry);
    });

    // ── DELETE /:mixinId/keys/:key ── Delete a key
    app.delete<{ Params: { mixinId: string; key: string } }>('/:mixinId/keys/*', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const { mixinId } = request.params;
        const key = decodeURIComponent((request.params as Record<string, string>)['*']);

        const result = await prisma.mixinKeyValue.deleteMany({
            where: { tenantId, userId, mixinId, key },
        });

        if (result.count === 0) return reply.status(404).send({ error: 'Key not found' });
        return reply.status(204).send();
    });
}
