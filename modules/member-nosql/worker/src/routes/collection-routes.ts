import type { FastifyInstance } from 'fastify';
import {
    CreateCollectionSchema,
    UpdateCollectionSchema,
} from '@surdej/module-member-nosql-shared';
import { prisma } from '../db.js';

export function registerCollectionRoutes(app: FastifyInstance) {

    // GET /collections — list root collections (or children of a parent)
    app.get('/collections', async (req) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';
        const parentId = query.parentId ?? null;

        const collections = await prisma.nosqlCollection.findMany({
            where: {
                tenantId,
                parentId: parentId ?? null,
                deletedAt: null,
            },
            include: {
                _count: { select: { documents: true, children: true } },
            },
            orderBy: { name: 'asc' },
        });

        return { items: collections, total: collections.length };
    });

    // GET /collections/tree — full nested tree for a tenant
    app.get('/collections/tree', async (req) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';

        const all = await prisma.nosqlCollection.findMany({
            where: { tenantId, deletedAt: null },
            include: { _count: { select: { documents: true, children: true } } },
            orderBy: { name: 'asc' },
        });

        // Build tree in-memory
        type Node = typeof all[0] & { children: Node[] };
        const map = new Map<string, Node>();
        for (const c of all) map.set(c.id, { ...c, children: [] });
        const roots: Node[] = [];
        for (const c of map.values()) {
            if (c.parentId) {
                map.get(c.parentId)?.children.push(c);
            } else {
                roots.push(c);
            }
        }
        return roots;
    });

    // GET /collections/:id — get single collection
    app.get<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
        const collection = await prisma.nosqlCollection.findUnique({
            where: { id: req.params.id },
            include: {
                parent: { select: { id: true, name: true, slug: true } },
                _count: { select: { documents: true, children: true } },
            },
        });
        if (!collection) return reply.status(404).send({ error: 'Collection not found' });
        return collection;
    });

    // POST /collections — create collection
    app.post('/collections', async (req, reply) => {
        const query = req.query as Record<string, string>;
        const tenantId = query.tenantId ?? 'default';
        const userId = query.userId;

        const result = CreateCollectionSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        // Check parent exists if provided
        if (result.data.parentId) {
            const parent = await prisma.nosqlCollection.findUnique({
                where: { id: result.data.parentId },
            });
            if (!parent) return reply.status(400).send({ error: 'Parent collection not found' });
        }

        const collection = await prisma.nosqlCollection.create({
            data: {
                tenantId,
                name: result.data.name,
                slug: result.data.slug,
                description: result.data.description,
                parentId: result.data.parentId ?? null,
                schema: (result.data.schema ?? undefined) as any,
                createdBy: userId,
                updatedBy: userId,
            },
        });

        return reply.status(201).send(collection);
    });

    // PUT /collections/:id — update collection metadata
    app.put<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
        const query = req.query as Record<string, string>;
        const userId = query.userId;

        const existing = await prisma.nosqlCollection.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Collection not found' });

        const result = UpdateCollectionSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const collection = await prisma.nosqlCollection.update({
            where: { id: req.params.id },
            data: {
                ...result.data as any,
                updatedBy: userId,
            },
        });
        return collection;
    });

    // DELETE /collections/:id — soft delete
    app.delete<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
        const existing = await prisma.nosqlCollection.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Collection not found' });

        await prisma.nosqlCollection.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });
        return reply.status(204).send();
    });
}
