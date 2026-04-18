/**
 * Module Routes: member-example
 *
 * All routes are relative — the module worker serves them at its root.
 * The core API gateway proxies `/api/module/member-example/*` → here.
 *
 * Validation uses Zod schemas from the shared package, ensuring the
 * same DTOs are used by both the worker and the frontend UI.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
    MODULE_NAME,
    CreateExampleItemSchema,
    UpdateExampleItemSchema,
    type ExampleItem,
    type ExampleItemListResponse,
} from '@surdej/module-member-example-shared';

// ─── In-Memory Store (replace with Prisma/DB in production) ───

const store = new Map<string, ExampleItem>();

// ─── Routes ────────────────────────────────────────────────────

export function registerRoutes(app: FastifyInstance): void {
    // List items
    app.get('/', async (request: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>) => {
        const page = parseInt(request.query.page || '1', 10);
        const pageSize = parseInt(request.query.pageSize || '20', 10);
        const items = Array.from(store.values());
        const start = (page - 1) * pageSize;
        const paged = items.slice(start, start + pageSize);

        const response: ExampleItemListResponse = {
            items: paged,
            total: items.length,
            page,
            pageSize,
        };
        return response;
    });

    // Get single item
    app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const item = store.get(request.params.id);
        if (!item) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // Create item
    app.post('/', async (request, reply) => {
        const parsed = CreateExampleItemSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: parsed.error.flatten(),
            });
        }

        const now = new Date().toISOString();
        const item: ExampleItem = {
            id: crypto.randomUUID(),
            ...parsed.data,
            status: parsed.data.status ?? 'draft',
            description: parsed.data.description ?? undefined,
            createdAt: now,
            updatedAt: now,
        };

        store.set(item.id, item);
        return reply.status(201).send(item);
    });

    // Update item
    app.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const existing = store.get(request.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });

        const parsed = UpdateExampleItemSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: parsed.error.flatten(),
            });
        }

        const updated: ExampleItem = {
            ...existing,
            ...parsed.data,
            updatedAt: new Date().toISOString(),
        };
        store.set(updated.id, updated);
        return updated;
    });

    // Delete item
    app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        if (!store.has(request.params.id)) {
            return reply.status(404).send({ error: 'Not found' });
        }
        store.delete(request.params.id);
        return reply.status(204).send();
    });

    app.log.info(`[${MODULE_NAME}] Routes registered: GET / | GET /:id | POST / | PUT /:id | DELETE /:id`);
}
