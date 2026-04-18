import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export function registerAdminRoutes(app: FastifyInstance) {

    // GET /admin/stats — overview of all collections and document counts
    app.get('/admin/stats', async (req) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';

        const collections = await prisma.nosqlCollection.findMany({
            where: { tenantId, deletedAt: null },
            select: { id: true, name: true, slug: true, parentId: true },
        });

        const stats = await Promise.all(
            collections.map(async (col) => {
                const [total, active, deleted] = await Promise.all([
                    prisma.nosqlDocument.count({ where: { collectionId: col.id } }),
                    prisma.nosqlDocument.count({ where: { collectionId: col.id, deletedAt: null } }),
                    prisma.nosqlDocument.count({ where: { collectionId: col.id, deletedAt: { not: null } } }),
                ]);

                const latest = await prisma.nosqlDocument.findFirst({
                    where: { collectionId: col.id, deletedAt: null },
                    orderBy: { updatedAt: 'desc' },
                    select: { updatedAt: true },
                });

                return {
                    collectionId: col.id,
                    collectionName: col.name,
                    collectionSlug: col.slug,
                    parentId: col.parentId,
                    documentCount: total,
                    activeDocumentCount: active,
                    deletedDocumentCount: deleted,
                    latestUpdatedAt: latest?.updatedAt?.toISOString() ?? null,
                };
            })
        );

        return {
            tenantId,
            totalCollections: collections.length,
            stats,
            generatedAt: new Date().toISOString(),
        };
    });

    // GET /admin/collections — all collections including deleted, with full metadata
    app.get('/admin/collections', async (req) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';
        const includeDeleted = query.includeDeleted === 'true';

        const collections = await prisma.nosqlCollection.findMany({
            where: {
                tenantId,
                ...(includeDeleted ? {} : { deletedAt: null }),
            },
            include: {
                parent: { select: { id: true, name: true, slug: true } },
                _count: { select: { documents: true, children: true } },
            },
            orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
        });

        return { items: collections, total: collections.length };
    });

    // GET /admin/documents — search across all documents
    app.get('/admin/documents', async (req) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';
        const collectionId = query.collectionId;
        const includeDeleted = query.includeDeleted === 'true';
        const limit = Math.min(parseInt(query.limit ?? '50', 10), 500);
        const offset = parseInt(query.offset ?? '0', 10);

        const where = {
            tenantId,
            ...(collectionId ? { collectionId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
        };

        const [items, total] = await Promise.all([
            prisma.nosqlDocument.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    collection: { select: { id: true, name: true, slug: true } },
                },
            }),
            prisma.nosqlDocument.count({ where }),
        ]);

        return { items, total, limit, offset };
    });
}
