import type { FastifyInstance } from 'fastify';
import { getPrisma } from './db.js';
import { CreateWorkflowTaskSchema, UpdateWorkflowTaskSchema } from '@surdej/module-tool-management-tools-shared';

const prisma = getPrisma();

export function registerWorkflowTaskRoutes(app: FastifyInstance) {
    // List tasks
    app.get('/use-cases/:ucId/tasks', async (req, reply) => {
        const { ucId } = req.params as { ucId: string };
        const tasks = await prisma.workflowTask.findMany({
            where: { useCaseId: ucId },
            orderBy: { sortOrder: 'asc' },
        });
        return { items: tasks };
    });

    // Create task
    app.post('/use-cases/:ucId/tasks', async (req, reply) => {
        const { ucId } = req.params as { ucId: string };
        const parsed = CreateWorkflowTaskSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
        }
        
        let sortOrder = parsed.data.sortOrder;
        if (sortOrder === undefined) {
            const lastTask = await prisma.workflowTask.findFirst({
                where: { useCaseId: ucId },
                orderBy: { sortOrder: 'desc' },
            });
            sortOrder = lastTask ? lastTask.sortOrder + 1 : 0;
        }

        const task = await prisma.workflowTask.create({
            data: {
                useCaseId: ucId,
                taskId: parsed.data.taskId,
                title: parsed.data.title,
                sortOrder,
                systemPrompt: parsed.data.systemPrompt,
                allowedTools: parsed.data.allowedTools,
                dataSchema: parsed.data.dataSchema as any,
                seedData: parsed.data.seedData ? (parsed.data.seedData as any) : undefined,
                userHint: parsed.data.userHint,
                description: parsed.data.description,
            },
        });
        return task;
    });

    // Update task
    app.put('/use-cases/:ucId/tasks/:taskId', async (req, reply) => {
        const { ucId, taskId } = req.params as { ucId: string, taskId: string };
        const parsed = UpdateWorkflowTaskSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
        }

        const task = await prisma.workflowTask.update({
            where: { id: taskId, useCaseId: ucId },
            data: {
                ...parsed.data,
                dataSchema: parsed.data.dataSchema ? (parsed.data.dataSchema as any) : undefined,
                seedData: parsed.data.seedData ? (parsed.data.seedData as any) : undefined,
            },
        });
        return task;
    });

    // Delete task
    app.delete('/use-cases/:ucId/tasks/:taskId', async (req, reply) => {
        const { ucId, taskId } = req.params as { ucId: string, taskId: string };
        
        await prisma.workflowTask.delete({
            where: { id: taskId, useCaseId: ucId },
        });

        return { success: true };
    });

    // Reorder tasks
    app.patch('/use-cases/:ucId/tasks/reorder', async (req, reply) => {
        const { ucId } = req.params as { ucId: string };
        const { taskIds } = req.body as { taskIds: string[] };

        await prisma.$transaction(
            taskIds.map((id, index) =>
                prisma.workflowTask.update({
                    where: { id, useCaseId: ucId },
                    data: { sortOrder: index },
                })
            )
        );

        return { success: true };
    });
}
