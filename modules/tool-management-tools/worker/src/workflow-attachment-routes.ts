import type { FastifyInstance } from 'fastify';
import { getPrisma } from './db.js';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export function registerWorkflowAttachmentRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── GET /use-cases/:ucId/attachments — List workflow attachments ───

    app.get<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/attachments',
        async (req, reply) => {
            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const attachments = await prisma.workflowAttachment.findMany({
                where: { useCaseId: req.params.ucId },
                select: { id: true, taskId: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            });

            return attachments;
        },
    );

    // ─── POST /use-cases/:ucId/attachments — Upload to workflow ─────────

    app.post<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/attachments',
        async (req, reply) => {
            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const file = await req.file();
            if (!file) return reply.status(400).send({ error: 'No file uploaded' });

            const chunks: Buffer[] = [];
            for await (const chunk of file.file) {
                chunks.push(chunk);
            }
            const data = Buffer.concat(chunks);

            if (data.length > MAX_ATTACHMENT_SIZE) {
                return reply.status(413).send({ error: `File too large. Maximum size is ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB` });
            }

            const attachment = await prisma.workflowAttachment.create({
                data: {
                    useCaseId: req.params.ucId,
                    filename: file.filename,
                    mimeType: file.mimetype,
                    sizeBytes: data.length,
                    data,
                },
            });

            return reply.status(201).send({
                id: attachment.id,
                useCaseId: attachment.useCaseId,
                taskId: attachment.taskId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                createdAt: attachment.createdAt,
            });
        },
    );

    // ─── POST /use-cases/:ucId/tasks/:taskId/attachments — Upload to step 

    app.post<{ Params: { ucId: string; taskId: string } }>(
        '/use-cases/:ucId/tasks/:taskId/attachments',
        async (req, reply) => {
            const task = await prisma.workflowTask.findFirst({
                where: { id: req.params.taskId, useCaseId: req.params.ucId },
            });
            if (!task) return reply.status(404).send({ error: 'Task not found' });

            const file = await req.file();
            if (!file) return reply.status(400).send({ error: 'No file uploaded' });

            const chunks: Buffer[] = [];
            for await (const chunk of file.file) {
                chunks.push(chunk);
            }
            const data = Buffer.concat(chunks);

            if (data.length > MAX_ATTACHMENT_SIZE) {
                return reply.status(413).send({ error: `File too large` });
            }

            const attachment = await prisma.workflowAttachment.create({
                data: {
                    useCaseId: req.params.ucId,
                    taskId: req.params.taskId,
                    filename: file.filename,
                    mimeType: file.mimetype,
                    sizeBytes: data.length,
                    data,
                },
            });

            return reply.status(201).send({
                id: attachment.id,
                useCaseId: attachment.useCaseId,
                taskId: attachment.taskId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                createdAt: attachment.createdAt,
            });
        },
    );

    // ─── GET /workflow-attachments/:attId — Download attachment ──────────

    app.get<{ Params: { attId: string } }>(
        '/workflow-attachments/:attId',
        async (req, reply) => {
            const attachment = await prisma.workflowAttachment.findUnique({
                where: { id: req.params.attId },
            });
            if (!attachment) return reply.status(404).send({ error: 'Attachment not found' });

            return reply
                .header('Content-Type', attachment.mimeType)
                .header('Content-Disposition', `attachment; filename="${attachment.filename}"`)
                .header('Content-Length', attachment.sizeBytes)
                .send(attachment.data);
        },
    );

    // ─── DELETE /workflow-attachments/:attId — Remove attachment ─────────

    app.delete<{ Params: { attId: string } }>(
        '/workflow-attachments/:attId',
        async (req, reply) => {
            const existing = await prisma.workflowAttachment.findUnique({
                where: { id: req.params.attId },
            });
            if (!existing) return reply.status(404).send({ error: 'Attachment not found' });

            await prisma.workflowAttachment.delete({ where: { id: req.params.attId } });
            return { success: true };
        },
    );
}
