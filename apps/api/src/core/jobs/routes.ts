import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { requirePermission } from '../middleware/acl.js';

// Simulation delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock job processor (in a real app, this would be a separate worker)
async function processJob(jobId: string) {
    // 1. Mark running
    await prisma.job.update({
        where: { id: jobId },
        data: { status: 'running', progress: 0 },
    });

    try {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return;

        // Simulate work
        for (let i = 10; i <= 100; i += 10) {
            await delay(1000); // 1 sec per step
            await prisma.job.update({
                where: { id: jobId },
                data: { progress: i },
            });
        }

        // Complete
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'completed',
                progress: 100,
                result: {
                    message: `Job ${job.type} finished successfully`,
                    timestamp: new Date().toISOString(),
                    dataSize: Math.floor(Math.random() * 5000) + 'KB',
                },
            },
        });
    } catch (err) {
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'failed',
                error: String(err),
            },
        });
    }
}

export async function jobsRoutes(app: FastifyInstance) {
    // GET /api/jobs — list jobs for current user
    app.get('/', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({ where: { token } });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        const jobs = await prisma.job.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return reply.send(jobs);
    });

    // POST /api/jobs/export-tenant
    app.post<{ Body: { tenantId: string } }>(
        '/export-tenant',
        { preHandler: [requirePermission('tenants', 'manage')] },
        async (request, reply) => {
            const { tenantId } = request.body;
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) return reply.status(401).send({ error: 'Not authenticated' });
            const session = await prisma.session.findUnique({ where: { token } });
            if (!session) return reply.status(401).send({ error: 'Invalid session' });

            const job = await prisma.job.create({
                data: {
                    type: 'export_tenant',
                    status: 'pending',
                    progress: 0,
                    userId: session.userId,
                    tenantId,
                },
            });

            // Fire and forget processor
            processJob(job.id);

            return reply.send(job);
        },
    );

    // POST /api/jobs/copy-tenant
    app.post<{ Body: { sourceTenantId: string; newName: string; newSlug: string } }>(
        '/copy-tenant',
        { preHandler: [requirePermission('tenants', 'manage')] },
        async (request, reply) => {
            const { sourceTenantId, newName, newSlug } = request.body;
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) return reply.status(401).send({ error: 'Not authenticated' });
            const session = await prisma.session.findUnique({ where: { token } });
            if (!session) return reply.status(401).send({ error: 'Invalid session' });

            const job = await prisma.job.create({
                data: {
                    type: 'copy_tenant',
                    status: 'pending',
                    progress: 0,
                    userId: session.userId,
                    tenantId: sourceTenantId, // Linked to source for now
                    result: { targetName: newName, targetSlug: newSlug },
                },
            });

            processJob(job.id);
            return reply.send(job);
        },
    );

    // POST /api/jobs/import-tenant
    app.post(
        '/import-tenant',
        { preHandler: [requirePermission('tenants', 'manage')] },
        async (request, reply) => {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) return reply.status(401).send({ error: 'Not authenticated' });
            const session = await prisma.session.findUnique({ where: { token } });
            if (!session) return reply.status(401).send({ error: 'Invalid session' });

            // In a real app, this would handle file upload
            const job = await prisma.job.create({
                data: {
                    type: 'import_tenant',
                    status: 'pending',
                    progress: 0,
                    userId: session.userId,
                },
            });

            processJob(job.id);
            return reply.send(job);
        }
    )
}
