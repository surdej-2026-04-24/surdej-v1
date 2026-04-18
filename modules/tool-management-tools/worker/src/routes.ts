/**
 * Routes: tool-management-tools
 *
 * REST endpoints for CRUD operations on tool definitions.
 * Uses an in-memory store for Phase 1; replace with Prisma in Phase 2.
 */

import type { FastifyInstance } from 'fastify';
import {
    CreateToolSchema,
    UpdateToolSchema,
    BUILT_IN_USE_CASES,
    type Tool,
} from '@surdej/module-tool-management-tools-shared';

// ─── In-memory store (Phase 1) ─────────────────────────────────

const store = new Map<string, Tool>();

// Seed built-in tools on startup
const BUILT_IN_TOOLS: Tool[] = [
    {
        id: crypto.randomUUID(),
        name: 'web_search',
        label: 'Web Search',
        description: 'Search the web for current information',
        category: 'search',
        icon: 'Globe',
        isEnabled: true,
        isBuiltIn: true,
        useCases: ['quick-research', 'general'],
        promptTemplate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: crypto.randomUUID(),
        name: 'rag_search',
        label: 'Document Search',
        description: 'Search the knowledge base and uploaded documents',
        category: 'search',
        icon: 'BookOpen',
        isEnabled: true,
        isBuiltIn: true,
        useCases: ['analyze-document', 'quick-research', 'general'],
        promptTemplate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: crypto.randomUUID(),
        name: 'search_properties',
        label: 'Property Data',
        description: 'Query the property database',
        category: 'search',
        icon: 'Database',
        isEnabled: true,
        isBuiltIn: true,
        useCases: ['prospect-lookup', 'general'],
        promptTemplate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: crypto.randomUUID(),
        name: 'page_context',
        label: 'Page Context',
        description: 'Read content from the current browser tab',
        category: 'context',
        icon: 'FileSearch',
        isEnabled: true,
        isBuiltIn: true,
        useCases: ['improve-text', 'generate-marketing', 'analyze-document'],
        promptTemplate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

for (const tool of BUILT_IN_TOOLS) {
    store.set(tool.id, tool);
}

// ─── Route Registration ────────────────────────────────────────

export function registerRoutes(app: FastifyInstance) {
    // GET / — List all tools
    app.get('/', async (req) => {
        const query = (req.query as Record<string, string>);
        // Note: deletedAt check is preparation for Phase 2 Prisma integration.
        // In the in-memory store all tools pass since the Tool type has no deletedAt field.
        let items = Array.from(store.values()).filter(t => !('deletedAt' in t && t.deletedAt));

        if (query.category) {
            items = items.filter(t => t.category === query.category);
        }
        if (query.useCase) {
            items = items.filter(t => t.useCases.includes(query.useCase));
        }
        if (query.enabled !== undefined) {
            const enabled = query.enabled === 'true';
            items = items.filter(t => t.isEnabled === enabled);
        }

        return { items, total: items.length };
    });

    // NOTE: GET /use-cases is now handled by use-case-routes.ts (DB-backed)
    // GET /:id — Get by ID
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const item = store.get(req.params.id);
        if (!item) return reply.status(404).send({ error: 'Tool not found' });
        return item;
    });

    // POST / — Create
    app.post('/', async (req, reply) => {
        const result = CreateToolSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }
        // Check for duplicate name (Phase 1: linear scan; Phase 2: enforced by DB unique constraint)
        const existing = Array.from(store.values()).find(t => t.name === result.data.name);
        if (existing) {
            return reply.status(409).send({ error: `A tool with name "${result.data.name}" already exists` });
        }
        const item: Tool = {
            id: crypto.randomUUID(),
            ...result.data,
            useCases: result.data.useCases ?? [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        store.set(item.id, item);
        return reply.status(201).send(item);
    });

    // PUT /:id — Update
    app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const existing = store.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Tool not found' });

        const result = UpdateToolSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }
        const updated: Tool = {
            ...existing,
            ...result.data,
            useCases: result.data.useCases ?? existing.useCases,
            id: existing.id,
            updatedAt: new Date().toISOString(),
        };
        store.set(updated.id, updated);
        return updated;
    });

    // PATCH /:id/toggle — Toggle enabled/disabled
    app.patch<{ Params: { id: string } }>('/:id/toggle', async (req, reply) => {
        const existing = store.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Tool not found' });

        const updated: Tool = {
            ...existing,
            isEnabled: !existing.isEnabled,
            updatedAt: new Date().toISOString(),
        };
        store.set(updated.id, updated);
        return updated;
    });

    // DELETE /:id — Remove
    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
        if (!store.has(req.params.id)) {
            return reply.status(404).send({ error: 'Tool not found' });
        }
        store.delete(req.params.id);
        return { success: true };
    });
}
