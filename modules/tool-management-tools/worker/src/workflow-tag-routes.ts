/**
 * Routes: Workflow Tag CRUD + Use Case ↔ Tag association
 */

import type { FastifyInstance } from 'fastify';
import { getPrisma } from './db.js';

export function registerWorkflowTagRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── GET /workflow-tags — List all tags ─────────────────────

    app.get('/workflow-tags', async () => {
        const tags = await prisma.workflowTag.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: { select: { useCases: true } },
            },
        });

        return {
            items: tags.map((t) => ({
                ...t,
                useCaseCount: t._count.useCases,
                _count: undefined,
            })),
        };
    });

    // ─── POST /workflow-tags — Create tag ───────────────────────

    app.post('/workflow-tags', async (req, reply) => {
        const body = req.body as { name: string; label: string; color?: string; description?: string; sortOrder?: number };

        if (!body.name || !body.label) {
            return reply.status(400).send({ error: 'name and label are required' });
        }

        const existing = await prisma.workflowTag.findUnique({ where: { name: body.name } });
        if (existing) {
            return reply.status(409).send({ error: `Tag with name "${body.name}" already exists` });
        }

        const tag = await prisma.workflowTag.create({
            data: {
                name: body.name,
                label: body.label,
                color: body.color ?? '#6b7280',
                description: body.description ?? null,
                sortOrder: body.sortOrder ?? 0,
            },
        });
        return reply.status(201).send(tag);
    });

    // ─── PUT /workflow-tags/:id — Update tag ────────────────────

    app.put<{ Params: { id: string } }>('/workflow-tags/:id', async (req, reply) => {
        const existing = await prisma.workflowTag.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Tag not found' });

        const body = req.body as { name?: string; label?: string; color?: string; description?: string; sortOrder?: number };

        const tag = await prisma.workflowTag.update({
            where: { id: req.params.id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.label !== undefined && { label: body.label }),
                ...(body.color !== undefined && { color: body.color }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
            },
        });
        return tag;
    });

    // ─── DELETE /workflow-tags/:id — Delete tag ─────────────────

    app.delete<{ Params: { id: string } }>('/workflow-tags/:id', async (req, reply) => {
        const existing = await prisma.workflowTag.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Tag not found' });

        await prisma.workflowTag.delete({ where: { id: req.params.id } });
        return { success: true };
    });

    // ─── GET /use-cases/:id/tags — Get tags for a use case ──────

    app.get<{ Params: { id: string } }>('/use-cases/:id/tags', async (req, reply) => {
        const useCase = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

        const useCaseTags = await prisma.useCaseTag.findMany({
            where: { useCaseId: req.params.id },
            include: { tag: true },
        });

        return { items: useCaseTags.map((ut) => ut.tag) };
    });

    // ─── PUT /use-cases/:id/tags — Set tags for a use case ──────

    app.put<{ Params: { id: string } }>('/use-cases/:id/tags', async (req, reply) => {
        const useCase = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

        const body = req.body as { tagIds: string[] };
        if (!Array.isArray(body.tagIds)) {
            return reply.status(400).send({ error: 'tagIds must be an array' });
        }

        // Replace all associations in a transaction
        await prisma.$transaction([
            prisma.useCaseTag.deleteMany({ where: { useCaseId: req.params.id } }),
            ...body.tagIds.map((tagId) =>
                prisma.useCaseTag.create({
                    data: { useCaseId: req.params.id, tagId },
                }),
            ),
        ]);

        // Return the updated tags
        const useCaseTags = await prisma.useCaseTag.findMany({
            where: { useCaseId: req.params.id },
            include: { tag: true },
        });

        return { items: useCaseTags.map((ut) => ut.tag) };
    });
}
