import type { FastifyInstance } from 'fastify';
import { getPrisma } from './db.js';
import { BUILT_IN_USE_CASES, BUILT_IN_WORKFLOW_TASKS } from '@surdej/module-tool-management-tools-shared';

const prisma = getPrisma();

/**
 * Auto-provision a built-in workflow use case + tasks in the DB if missing.
 * Returns the DB use case ID (which may differ from the slug for auto-provisioned ones).
 */
async function ensureBuiltInWorkflow(slug: string): Promise<string | null> {
    // Check if it already exists
    const existing = await prisma.useCase.findUnique({ where: { slug } });
    if (existing) return existing.id;

    // Look up in built-in definitions
    const builtIn = BUILT_IN_USE_CASES.find((uc) => uc.id === slug);
    const tasks = BUILT_IN_WORKFLOW_TASKS[slug];
    if (!builtIn || !builtIn.workflowMode || !tasks) return null;

    // Auto-provision: create use case + version + tasks
    const uc = await prisma.useCase.create({
        data: {
            slug: builtIn.id,
            label: builtIn.label,
            description: builtIn.description,
            icon: builtIn.icon,
            isBuiltIn: true,
            isActive: true,
            workflowMode: true,
            versions: {
                create: {
                    version: 1,
                    promptTemplate: builtIn.promptTemplate || 'Built-in workflow',
                    tools: builtIn.tools,
                    modelTier: 'medium',
                },
            },
            workflowTasks: {
                create: tasks.map((t) => ({
                    taskId: t.taskId,
                    title: t.title,
                    sortOrder: t.sortOrder,
                    systemPrompt: t.systemPrompt,
                    allowedTools: t.allowedTools,
                    dataSchema: t.dataSchema as any,
                    userHint: t.userHint ?? null,
                    description: t.description ?? null,
                })),
            },
        },
    });

    return uc.id;
}

export function registerSessionRoutes(app: FastifyInstance) {
    // ─── Ensure built-in workflow is provisioned in DB ──────────
    app.post('/workflows/ensure-builtin', async (req, reply) => {
        const { slug } = req.body as { slug: string };
        if (!slug) return reply.status(400).send({ error: 'slug is required' });

        const id = await ensureBuiltInWorkflow(slug);
        if (!id) return reply.status(404).send({ error: 'Unknown built-in workflow' });

        const uc = await prisma.useCase.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true, label: true } });
        return uc;
    });

    // Start a new session
    app.post('/workflows/:ucId/sessions/start', async (req, reply) => {
        let ucId = (req.params as { ucId: string }).ucId;
        
        // Use a generic user ID for now
        const userId = (req.headers['x-user-id'] as string) || 'anonymous';
        const tenantId = (req.headers['x-tenant-id'] as string) || null;

        // Auto-provision built-in workflow if needed (slug-based lookup)
        const resolved = await ensureBuiltInWorkflow(ucId);
        if (resolved) ucId = resolved;

        const session = await prisma.workflowSession.create({
            data: {
                useCaseId: ucId,
                userId,
                tenantId,
                currentStepIdx: 0,
                status: 'active',
                formData: {},
            },
            include: {
                useCase: {
                    include: {
                        workflowTasks: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            }
        });

        const state = {
            id: session.id,
            useCaseId: session.useCaseId,
            currentStepIdx: session.currentStepIdx,
            status: session.status,
            formData: session.formData,
            tasks: session.useCase.workflowTasks,
            messages: []
        };
        return state;
    });

    // Get session
    app.get('/sessions/:sessionId', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        
        const session = await prisma.workflowSession.findUniqueOrThrow({
            where: { id: sessionId },
            include: {
                useCase: {
                    include: {
                        workflowTasks: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            }
        });
        
        const currentMessages = await prisma.sessionMessage.findMany({
            where: { sessionId, stepIndex: session.currentStepIdx },
            orderBy: { createdAt: 'asc' }
        });

        return {
            id: session.id,
            useCaseId: session.useCaseId,
            currentStepIdx: session.currentStepIdx,
            status: session.status,
            formData: session.formData,
            tasks: session.useCase.workflowTasks,
            messages: currentMessages,
        };
    });

    // Advance session
    app.post('/sessions/:sessionId/advance', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };

        const session = await prisma.workflowSession.findUniqueOrThrow({
            where: { id: sessionId },
            include: { useCase: { include: { workflowTasks: { orderBy: { sortOrder: 'asc' } } } } },
        });

        const tasks = session.useCase.workflowTasks;
        const currentTask = tasks[session.currentStepIdx];
        
        if (!currentTask) {
            return reply.status(400).send({ error: 'No current task found' });
        }

        // Validate formData against currentTask.dataSchema
        const dataSchema: any = currentTask.dataSchema;
        const requiredFields: string[] = dataSchema.required ?? [];
        
        const formData: any = session.formData;
        for (const field of requiredFields) {
            const val = formData[field];
            if (val === undefined || val === null || val === '') {
                return reply.status(400).send({ error: `Missing required field: ${field}` });
            }
        }

        // Snapshot current state
        await prisma.sessionContextVersion.create({
            data: {
                sessionId,
                stepIndex: session.currentStepIdx,
                formData: session.formData as any,
            },
        });

        // Advance or complete
        const nextIdx = session.currentStepIdx + 1;
        const isLast = nextIdx >= tasks.length;

        await prisma.workflowSession.update({
            where: { id: sessionId },
            data: {
                currentStepIdx: isLast ? session.currentStepIdx : nextIdx,
                status: isLast ? 'completed' : 'active',
            },
        });

        return { nextStepIdx: nextIdx, completed: isLast };
    });

    // Revert session
    app.post('/sessions/:sessionId/revert', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        const body = req.body as { targetStepIndex: number };
        const targetStepIndex = body.targetStepIndex;

        const snapshot = await prisma.sessionContextVersion.findUnique({
            where: { sessionId_stepIndex: { sessionId, stepIndex: targetStepIndex } },
        });
        
        let formDataToRestore: any = {};
        if (snapshot) {
            formDataToRestore = snapshot.formData || {};
        } else if (targetStepIndex === 0) {
            formDataToRestore = {};
        } else {
            return reply.status(400).send({ error: 'No snapshot found for this step' });
        }

        // Delete all snapshots AFTER the target
        await prisma.sessionContextVersion.deleteMany({
            where: { sessionId, stepIndex: { gt: targetStepIndex } },
        });

        // Delete all messages AFTER the target step
        await prisma.sessionMessage.deleteMany({
            where: { sessionId, stepIndex: { gt: targetStepIndex } },
        });

        // Restore session state
        await prisma.workflowSession.update({
            where: { id: sessionId },
            data: {
                currentStepIdx: targetStepIndex,
                formData: formDataToRestore as any,
                status: 'active',
            },
        });

        return { success: true };
    });

    // Update form data (partial merge)
    app.post('/sessions/:sessionId/update-form', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        const fields = req.body as Record<string, unknown>;

        const session = await prisma.workflowSession.findUniqueOrThrow({
            where: { id: sessionId },
        });

        const currentData = session.formData as Record<string, unknown>;
        const mergedData = { ...currentData, ...fields };

        await prisma.workflowSession.update({
            where: { id: sessionId },
            data: { formData: mergedData as any },
        });

        return { success: true, formData: mergedData };
    });

    // Complete session explicitly
    app.post('/sessions/:sessionId/complete', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        await prisma.workflowSession.update({
            where: { id: sessionId },
            data: { status: 'completed' }
        });
        return { success: true };
    });

    // Abort session explicitly
    app.post('/sessions/:sessionId/abort', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        await prisma.workflowSession.update({
            where: { id: sessionId },
            data: { status: 'aborted' }
        });
        return { success: true };
    });

    // List sessions for a workflow
    app.get('/workflows/:ucId/sessions', async (req, reply) => {
        const { ucId } = req.params as { ucId: string };
        const userId = (req.headers['x-user-id'] as string) || 'anonymous';
        
        const sessions = await prisma.workflowSession.findMany({
            where: { useCaseId: ucId, userId },
            orderBy: { updatedAt: 'desc' }
        });

        return { items: sessions };
    });

    // List all sessions for the current user
    app.get('/sessions', async (req, reply) => {
        const userId = (req.headers['x-user-id'] as string) || 'anonymous';
        
        const sessions = await prisma.workflowSession.findMany({
            where: { userId },
            include: { useCase: { select: { label: true, icon: true } } },
            orderBy: { updatedAt: 'desc' }
        });

        return { items: sessions };
    });

    // Debug endpoint — returns full session detail with ALL messages and snapshots
    app.get('/sessions/:sessionId/debug', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };

        const session = await prisma.workflowSession.findUniqueOrThrow({
            where: { id: sessionId },
            include: {
                useCase: {
                    include: {
                        workflowTasks: { orderBy: { sortOrder: 'asc' } },
                        versions: { orderBy: { version: 'desc' }, take: 1 },
                    },
                },
            },
        });

        const [allMessages, allSnapshots] = await Promise.all([
            prisma.sessionMessage.findMany({
                where: { sessionId },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.sessionContextVersion.findMany({
                where: { sessionId },
                orderBy: { stepIndex: 'asc' },
            }),
        ]);

        return {
            id: session.id,
            useCaseId: session.useCaseId,
            userId: session.userId,
            tenantId: session.tenantId,
            currentStepIdx: session.currentStepIdx,
            status: session.status,
            formData: session.formData,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            useCase: {
                label: session.useCase.label,
                slug: session.useCase.slug,
                icon: session.useCase.icon,
                description: session.useCase.description,
                workflowMode: session.useCase.workflowMode,
                latestVersion: session.useCase.versions[0] ?? null,
            },
            tasks: session.useCase.workflowTasks,
            messages: allMessages,
            snapshots: allSnapshots,
        };
    });

    // Admin endpoint to list all sessions globally
    app.get('/admin/sessions', async (req, reply) => {
        const sessions = await prisma.workflowSession.findMany({
            include: { useCase: { select: { label: true, icon: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 100, // Limit for safety
        });

        return { items: sessions };
    });
}
