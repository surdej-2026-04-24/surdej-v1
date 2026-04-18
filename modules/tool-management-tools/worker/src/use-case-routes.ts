/**
 * Routes: Use Case CRUD
 *
 * REST endpoints for managing persisted use cases and their versions.
 */

import type { FastifyInstance } from 'fastify';
import {
    CreateDbUseCaseSchema,
    UpdateDbUseCaseSchema,
    CreateUseCaseVersionSchema,
    BUILT_IN_USE_CASES,
    BUILT_IN_WORKFLOW_TASKS,
} from '@surdej/module-tool-management-tools-shared';
import { getPrisma } from './db.js';

export function registerUseCaseRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── GET /use-cases/active — Active use cases for toolbar/extension ─

    app.get('/use-cases/active', async () => {
        // Fetch active DB use cases with their latest version
        const dbUseCases = await prisma.useCase.findMany({
            where: { deletedAt: null, isActive: true },
            include: {
                versions: {
                    orderBy: { version: 'desc' },
                    take: 1,
                },
                workflowTasks: { orderBy: { sortOrder: 'asc' } },
                useCaseTags: { include: { tag: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Shape DB use cases into the format consumers expect
        const dbItems = dbUseCases
            .filter((uc) => uc.versions.length > 0) // Only include use cases with at least one version
            .map((uc) => ({
                id: uc.id,
                slug: uc.slug,
                label: uc.label,
                description: uc.description ?? '',
                icon: uc.icon ?? 'Bot',
                tags: (uc as any).tags ?? [],
                workflowTags: uc.useCaseTags.map((ut: any) => ut.tag),
                promptTemplate: uc.versions[0]!.promptTemplate,
                tools: uc.versions[0]!.tools as string[],
                modelTier: uc.versions[0]!.modelTier,
                source: 'db' as const,
                workflowMode: uc.workflowMode,
                tasks: uc.workflowMode ? uc.workflowTasks : undefined,
            }));

        // Collect slugs that already exist in DB — these override built-ins
        const dbSlugs = new Set(dbItems.map((uc) => uc.slug));

        // Merge: DB use cases first, then built-in fallbacks for missing slugs
        const builtInFallbacks = BUILT_IN_USE_CASES
            .filter((uc) => !dbSlugs.has(uc.id)) // built-in `id` acts as slug
            .map((uc) => {
                const tasks = BUILT_IN_WORKFLOW_TASKS[uc.id];
                return {
                    id: uc.id,
                    slug: uc.id,
                    label: uc.label,
                    description: uc.description,
                    icon: uc.icon,
                    tags: [],
                    promptTemplate: uc.promptTemplate,
                    tools: uc.tools,
                    modelTier: 'medium' as const,
                    source: 'built-in' as const,
                    workflowMode: uc.workflowMode ?? false,
                    tasks: tasks
                        ? tasks.map((t, idx) => ({
                              id: `builtin-${uc.id}-${t.taskId}`,
                              useCaseId: uc.id,
                              taskId: t.taskId,
                              title: t.title,
                              sortOrder: t.sortOrder,
                              systemPrompt: t.systemPrompt,
                              allowedTools: t.allowedTools,
                              dataSchema: t.dataSchema,
                              seedData: null,
                              userHint: t.userHint ?? null,
                              description: t.description ?? null,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                          }))
                        : undefined,
                };
            });

        return { items: [...dbItems, ...builtInFallbacks] };
    });

    // ─── GET /use-cases — List all use cases ────────────────────

    app.get('/use-cases', async (req) => {
        const query = req.query as Record<string, string>;
        const includeBuiltIn = query.includeBuiltIn !== 'false';

        const dbUseCases = await prisma.useCase.findMany({
            where: { deletedAt: null },
            include: {
                versions: {
                    orderBy: { version: 'desc' },
                    take: 1,
                },
                _count: { select: { testCases: true } },
                useCaseTags: { include: { tag: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        const items = dbUseCases.map((uc) => ({
            ...uc,
            latestVersion: uc.versions[0] ?? null,
            testCaseCount: uc._count.testCases,
            workflowTags: uc.useCaseTags.map((ut) => ut.tag),
            versions: undefined,
            _count: undefined,
            useCaseTags: undefined,
        }));

        // Optionally include the legacy built-in use cases for backward compat
        if (includeBuiltIn) {
            return {
                items,
                builtIn: BUILT_IN_USE_CASES,
                total: items.length,
            };
        }

        return { items, total: items.length };
    });

    // ─── GET /use-cases/:id — Get use case with versions ────────

    app.get<{ Params: { id: string } }>('/use-cases/:id', async (req, reply) => {
        const useCase = await prisma.useCase.findUnique({
            where: { id: req.params.id },
            include: {
                versions: { orderBy: { version: 'desc' } },
                testCases: {
                    where: { isActive: true },
                    include: {
                        attachments: {
                            select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                workflowTasks: { orderBy: { sortOrder: 'asc' } },
                useCaseTags: { include: { tag: true } },
            },
        });
        if (!useCase) return reply.status(404).send({ error: 'Use case not found' });
        return {
            ...useCase,
            tasks: useCase.workflowTasks,
            workflowTasks: undefined,
            workflowTags: useCase.useCaseTags.map((ut) => ut.tag),
            useCaseTags: undefined,
        };
    });

    // ─── POST /use-cases — Create use case ──────────────────────

    app.post('/use-cases', async (req, reply) => {
        const result = CreateDbUseCaseSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        // Check slug uniqueness
        const existing = await prisma.useCase.findUnique({ where: { slug: result.data.slug } });
        if (existing) {
            return reply.status(409).send({ error: `Use case with slug "${result.data.slug}" already exists` });
        }

        const useCase = await prisma.useCase.create({ data: { ...result.data, metadata: result.data.metadata as any } });
        return reply.status(201).send(useCase);
    });

    // ─── PUT /use-cases/:id — Update use case ───────────────────

    app.put<{ Params: { id: string } }>('/use-cases/:id', async (req, reply) => {
        const existing = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Use case not found' });

        const result = UpdateDbUseCaseSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const updated = await prisma.useCase.update({
            where: { id: req.params.id },
            data: { ...result.data, metadata: result.data.metadata as any },
        });
        return updated;
    });

    // ─── DELETE /use-cases/:id — Soft-delete ────────────────────

    app.delete<{ Params: { id: string } }>('/use-cases/:id', async (req, reply) => {
        const existing = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Use case not found' });

        await prisma.useCase.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date(), isActive: false },
        });
        return { success: true };
    });

    // ─── POST /use-cases/:id/versions — Create new version ─────

    app.post<{ Params: { id: string } }>('/use-cases/:id/versions', async (req, reply) => {
        const useCase = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

        const result = CreateUseCaseVersionSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        // Auto-increment version number
        const latestVersion = await prisma.useCaseVersion.findFirst({
            where: { useCaseId: req.params.id },
            orderBy: { version: 'desc' },
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;

        const version = await prisma.useCaseVersion.create({
            data: {
                useCaseId: req.params.id,
                version: nextVersion,
                ...result.data,
            },
        });
        return reply.status(201).send(version);
    });

    // ─── GET /use-cases/:id/versions — List versions ────────────

    app.get<{ Params: { id: string } }>('/use-cases/:id/versions', async (req, reply) => {
        const useCase = await prisma.useCase.findUnique({ where: { id: req.params.id } });
        if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

        const versions = await prisma.useCaseVersion.findMany({
            where: { useCaseId: req.params.id },
            orderBy: { version: 'desc' },
            include: {
                _count: { select: { testRuns: true } },
            },
        });

        return {
            items: versions.map((v) => ({
                ...v,
                testRunCount: v._count.testRuns,
                _count: undefined,
            })),
            total: versions.length,
        };
    });

    // ─── GET /use-cases/:ucId/versions/:vId — Get version detail ─

    app.get<{ Params: { ucId: string; vId: string } }>(
        '/use-cases/:ucId/versions/:vId',
        async (req, reply) => {
            const version = await prisma.useCaseVersion.findFirst({
                where: { id: req.params.vId, useCaseId: req.params.ucId },
                include: {
                    testRuns: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                    },
                },
            });
            if (!version) return reply.status(404).send({ error: 'Version not found' });
            return version;
        },
    );
}
