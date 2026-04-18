import type { FastifyInstance } from 'fastify';
import {
    CreateDocumentSchema,
    UpdateDocumentSchema,
} from '@surdej/module-member-nosql-shared';
import { prisma } from '../db.js';

export function registerDocumentRoutes(app: FastifyInstance) {

    // GET /collections/:collectionId/documents — query documents
    app.get<{ Params: { collectionId: string } }>(
        '/collections/:collectionId/documents',
        async (req, reply) => {
            const { collectionId } = req.params;
            const query = req.query as Record<string, string>;
            const tenantId = query.tenantId ?? 'default';
            const includeDeleted = query.includeDeleted === 'true';
            const limit = Math.min(parseInt(query.limit ?? '50', 10), 1000);
            const offset = parseInt(query.offset ?? '0', 10);

            const collection = await prisma.nosqlCollection.findUnique({
                where: { id: collectionId },
            });
            if (!collection) return reply.status(404).send({ error: 'Collection not found' });

            const where = {
                collectionId,
                tenantId,
                ...(includeDeleted ? {} : { deletedAt: null }),
            };

            const [items, total] = await Promise.all([
                prisma.nosqlDocument.findMany({
                    where,
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
                prisma.nosqlDocument.count({ where }),
            ]);

            return { items, total, limit, offset };
        }
    );

    // GET /documents/:id — get single document
    app.get<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
        const doc = await prisma.nosqlDocument.findUnique({
            where: { id: req.params.id },
            include: {
                collection: { select: { id: true, name: true, slug: true } },
            },
        });
        if (!doc) return reply.status(404).send({ error: 'Document not found' });
        return doc;
    });

    // POST /collections/:collectionId/documents — create document
    app.post<{ Params: { collectionId: string } }>(
        '/collections/:collectionId/documents',
        async (req, reply) => {
            const { collectionId } = req.params;
            const query = req.query as Record<string, string>;
            const tenantId = query.tenantId ?? 'default';
            const userId = query.userId;

            const collection = await prisma.nosqlCollection.findUnique({
                where: { id: collectionId },
            });
            if (!collection) return reply.status(404).send({ error: 'Collection not found' });

            const result = CreateDocumentSchema.safeParse(req.body);
            if (!result.success) return reply.status(400).send({ error: result.error.issues });

            const doc = await prisma.nosqlDocument.create({
                data: {
                    tenantId,
                    collectionId,
                    data: result.data.data as any,
                    version: 1,
                    createdBy: userId,
                    updatedBy: userId,
                },
            });

            return reply.status(201).send(doc);
        }
    );

    // PUT /documents/:id — update document (saves version snapshot first)
    app.put<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
        const query = req.query as Record<string, string>;
        const userId = query.userId;

        const existing = await prisma.nosqlDocument.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) return reply.status(404).send({ error: 'Document not found' });
        if (existing.deletedAt) return reply.status(410).send({ error: 'Document has been deleted' });

        const result = UpdateDocumentSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        // Save a version snapshot of the current state before updating
        await prisma.nosqlDocumentVersion.create({
            data: {
                documentId: existing.id,
                version: existing.version,
                data: existing.data as any,
                createdBy: existing.updatedBy,
            },
        });

        const updated = await prisma.nosqlDocument.update({
            where: { id: req.params.id },
            data: {
                data: result.data.data as any,
                version: { increment: 1 },
                updatedBy: userId,
            },
        });

        return updated;
    });

    // DELETE /documents/:id — soft delete
    app.delete<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
        const query = req.query as Record<string, string>;
        const userId = query.userId;

        const existing = await prisma.nosqlDocument.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) return reply.status(404).send({ error: 'Document not found' });

        await prisma.nosqlDocument.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });
        return reply.status(204).send();
    });

    // POST /documents/:id/restore — restore soft-deleted document
    app.post<{ Params: { id: string } }>('/documents/:id/restore', async (req, reply) => {
        const query = req.query as Record<string, string>;
        const userId = query.userId;

        const existing = await prisma.nosqlDocument.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) return reply.status(404).send({ error: 'Document not found' });
        if (!existing.deletedAt) return reply.status(400).send({ error: 'Document is not deleted' });

        const doc = await prisma.nosqlDocument.update({
            where: { id: req.params.id },
            data: { deletedAt: null, updatedBy: userId },
        });
        return doc;
    });
}
