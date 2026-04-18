import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../middleware/acl.js';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────

const UpsertKvSchema = z.object({
    key: z.string().min(1).max(512),
    value: z.any(),                       // JSON value (stored as jsonb)
    tags: z.array(z.string().max(100)).max(20).optional().default([]),
    source: z.string().max(100).optional(),
    expiresAt: z.string().datetime().optional().nullable(),
});

const BulkUpsertSchema = z.object({
    entries: z.array(UpsertKvSchema).min(1).max(100),
});

const SearchSchema = z.object({
    tags: z.array(z.string()).optional(),    // match ALL tags
    source: z.string().optional(),
    prefix: z.string().optional(),           // key prefix search
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

// ─── Routes ─────────────────────────────────────────────────────

export async function kvStoreRoutes(app: FastifyInstance) {

    // ── GET /keys?prefix=&tags=&source=&limit=&offset= ──────────
    // List/search keys
    app.get<{ Querystring: z.infer<typeof SearchSchema> }>('/keys', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const q = SearchSchema.parse(request.query);

        const where: any = { tenantId };
        if (q.prefix) where.key = { startsWith: q.prefix };
        if (q.source) where.source = q.source;
        if (q.tags && q.tags.length > 0) where.tags = { hasEvery: q.tags };

        const [entries, total] = await Promise.all([
            prisma.keyValueStore.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: q.limit,
                skip: q.offset,
            }),
            prisma.keyValueStore.count({ where }),
        ]);

        return reply.send({ entries, total, limit: q.limit, offset: q.offset });
    });

    // ── GET /:key ───────────────────────────────────────────────
    // Get single value by key
    app.get<{ Params: { key: string } }>('/:key', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { key } = request.params;

        const entry = await prisma.keyValueStore.findUnique({
            where: { tenantId_key: { tenantId, key: decodeURIComponent(key) } },
        });

        if (!entry) return reply.status(404).send({ error: 'Key not found' });

        // Check TTL
        if (entry.expiresAt && entry.expiresAt < new Date()) {
            await prisma.keyValueStore.delete({ where: { id: entry.id } });
            return reply.status(404).send({ error: 'Key expired' });
        }

        return reply.send(entry);
    });

    // ── PUT /:key ───────────────────────────────────────────────
    // Upsert single key
    app.put<{ Params: { key: string } }>('/:key', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const key = decodeURIComponent(request.params.key);
        const body = UpsertKvSchema.parse({ ...(request.body as object), key });

        const entry = await prisma.keyValueStore.upsert({
            where: { tenantId_key: { tenantId, key } },
            create: {
                tenantId,
                key,
                value: body.value,
                tags: body.tags,
                source: body.source ?? undefined,
                createdBy: userId,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
            },
            update: {
                value: body.value,
                tags: body.tags,
                source: body.source ?? undefined,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
            },
        });

        return reply.status(200).send(entry);
    });

    // ── POST /bulk ──────────────────────────────────────────────
    // Bulk upsert (up to 100 entries)
    app.post('/bulk', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const { entries } = BulkUpsertSchema.parse(request.body);

        const results = await prisma.$transaction(
            entries.map(entry =>
                prisma.keyValueStore.upsert({
                    where: { tenantId_key: { tenantId, key: entry.key } },
                    create: {
                        tenantId,
                        key: entry.key,
                        value: entry.value,
                        tags: entry.tags ?? [],
                        source: entry.source ?? undefined,
                        createdBy: userId,
                        expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
                    },
                    update: {
                        value: entry.value,
                        tags: entry.tags ?? [],
                        source: entry.source ?? undefined,
                        expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
                    },
                }),
            ),
        );

        return reply.status(200).send({ upserted: results.length, entries: results });
    });

    // ── DELETE /:key ────────────────────────────────────────────
    // Delete single key
    app.delete<{ Params: { key: string } }>('/:key', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const key = decodeURIComponent(request.params.key);

        const result = await prisma.keyValueStore.deleteMany({
            where: { tenantId, key } as any,
        });

        if (result.count === 0) return reply.status(404).send({ error: 'Key not found' });
        return reply.status(204).send();
    });

    // ── DELETE /by-tag/:tag ─────────────────────────────────────
    // Delete all entries with a specific tag (admin only)
    app.delete<{ Params: { tag: string } }>('/by-tag/:tag', {
        preHandler: [requirePermission('kv-store', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const tag = decodeURIComponent(request.params.tag);

        const result = await prisma.keyValueStore.deleteMany({
            where: { tenantId, tags: { has: tag } },
        });

        return reply.send({ deleted: result.count });
    });

    // ── GET /tags ───────────────────────────────────────────────
    // List all unique tags for this tenant
    app.get('/tags', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;

        // Use raw query to get distinct tags from the array column
        const result = await prisma.$queryRaw<{ tag: string }[]>`
            SELECT DISTINCT unnest(tags) AS tag
            FROM "KeyValueStore"
            WHERE "tenantId" = ${tenantId}
            ORDER BY tag
        `;

        return reply.send(result.map(r => r.tag));
    });
}
