import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { z } from 'zod';
import { requirePermission } from '../middleware/acl.js';
import multipart from '@fastify/multipart';
import { uploadDirect, getBlobByKey } from '../blobs/service.js';
import { randomUUID } from 'crypto';

// ─── Validation Schemas ──────────────────────────────────────

const createSessionSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    startUrl: z.string().min(1),
});

const updateSessionSchema = z.object({
    status: z.enum(['active', 'paused', 'completed']).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
});

const addNavigationSchema = z.object({
    url: z.string().min(1),
    title: z.string().min(1),
    duration: z.number().optional(),
});

const addChatTranscriptSchema = z.object({
    conversationId: z.string().min(1),
    conversationTitle: z.string().nullable(),
    model: z.string().min(1),
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        createdAt: z.string().optional(),
    })),
    messageCount: z.number().int(),
    url: z.string().min(1),
});

// ─── Session Include (full children) ─────────────────────────

const SESSION_INCLUDE = {
    navigationEntries: { orderBy: { createdAt: 'asc' as const } },
    screenshots: { orderBy: { createdAt: 'asc' as const } },
    recordings: { orderBy: { createdAt: 'asc' as const } },
    chatTranscripts: { orderBy: { createdAt: 'asc' as const } },
    user: { select: { id: true, name: true, email: true, displayName: true, avatarUrl: true } },
};

// ─── Routes ──────────────────────────────────────────────────

export async function feedbackRoutes(app: FastifyInstance) {
    // Register multipart support for file uploads
    app.register(multipart, {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    });

    // ── POST /api/feedback/sessions ─────────────────────────
    app.post('/sessions', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request: FastifyRequest, reply) => {
        const body = createSessionSchema.parse(request.body);
        const userId = request.acl?.userId;
        const tenantId = request.acl?.tenantId ?? undefined;

        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        const session = await prisma.feedbackSession.create({
            data: {
                title: body.title,
                description: body.description,
                startUrl: body.startUrl,
                userId,
                tenantId,
            },
            include: SESSION_INCLUDE,
        });

        return reply.status(201).send(session);
    });

    // ── GET /api/feedback/sessions ──────────────────────────
    app.get('/sessions', {
        preHandler: [requirePermission('feedback', 'read')],
    }, async (request, reply) => {
        const userId = request.acl?.userId;
        const sessions = await prisma.feedbackSession.findMany({
            where: userId ? { userId } : {},
            orderBy: { createdAt: 'desc' },
            include: SESSION_INCLUDE,
        });
        return reply.send(sessions);
    });

    // ── GET /api/feedback/sessions/:id ──────────────────────
    app.get<{ Params: { id: string } }>('/sessions/:id', {
        preHandler: [requirePermission('feedback', 'read')],
    }, async (request, reply) => {
        const session = await prisma.feedbackSession.findUnique({
            where: { id: request.params.id },
            include: SESSION_INCLUDE,
        });
        if (!session) return reply.status(404).send({ error: 'Session not found' });
        return reply.send(session);
    });

    // ── PATCH /api/feedback/sessions/:id ────────────────────
    app.patch<{ Params: { id: string } }>('/sessions/:id', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        const body = updateSessionSchema.parse(request.body);

        const data: Record<string, unknown> = {};
        if (body.status) data.status = body.status;
        if (body.title) data.title = body.title;
        if (body.description !== undefined) data.description = body.description;
        if (body.status === 'completed') data.completedAt = new Date();

        const session = await prisma.feedbackSession.update({
            where: { id: request.params.id },
            data,
            include: SESSION_INCLUDE,
        });

        return reply.send(session);
    });

    // ── DELETE /api/feedback/sessions/:id ────────────────────
    app.delete<{ Params: { id: string } }>('/sessions/:id', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        // Cascade delete handles children, but we'd also want to remove blobs from storage
        // TODO: Delete blob files from MinIO
        await prisma.feedbackSession.delete({
            where: { id: request.params.id },
        });
        return reply.status(204).send();
    });

    // ── POST /api/feedback/sessions/:id/navigation ──────────
    app.post<{ Params: { id: string } }>('/sessions/:id/navigation', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        const body = addNavigationSchema.parse(request.body);

        const entry = await prisma.feedbackNavigation.create({
            data: {
                sessionId: request.params.id,
                url: body.url,
                title: body.title,
                duration: body.duration,
            },
        });

        return reply.status(201).send(entry);
    });

    // ── POST /api/feedback/sessions/:id/screenshots ─────────
    app.post<{ Params: { id: string } }>('/sessions/:id/screenshots', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        const file = await request.file();
        if (!file) return reply.status(400).send({ error: 'No file uploaded' });

        const sessionId = request.params.id;
        const tenantId = request.acl?.tenantId ?? 'public';
        const screenshotId = randomUUID();
        const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
        const blobPath = `feedback/${tenantId}/${sessionId}/screenshot-${screenshotId}.${ext}`;

        const buf = await file.toBuffer();
        await uploadDirect(blobPath, buf, file.mimetype);

        // Read the page URL from the fields (set before the file in the multipart form)
        const url = (file.fields?.url as any)?.value ?? '';

        const screenshot = await prisma.feedbackScreenshot.create({
            data: {
                sessionId,
                url: typeof url === 'string' ? url : '',
                blobPath,
            },
        });

        return reply.status(201).send(screenshot);
    });

    // ── POST /api/feedback/sessions/:id/recordings ──────────
    app.post<{ Params: { id: string } }>('/sessions/:id/recordings', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        const file = await request.file();
        if (!file) return reply.status(400).send({ error: 'No file uploaded' });

        const sessionId = request.params.id;
        const tenantId = request.acl?.tenantId ?? 'public';
        const recordingId = randomUUID();

        // Determine type from field or mimetype
        const typeField = (file.fields?.type as any)?.value;
        const type = typeField === 'video' ? 'video' : 'voice';
        const ext = type === 'video' ? 'webm' : 'webm';
        const blobPath = `feedback/${tenantId}/${sessionId}/${type}-${recordingId}.${ext}`;

        const durationField = (file.fields?.duration as any)?.value;
        const duration = parseFloat(durationField) || 0;

        const buf = await file.toBuffer();
        await uploadDirect(blobPath, buf, file.mimetype);

        const recording = await prisma.feedbackRecording.create({
            data: {
                sessionId,
                type,
                blobPath,
                duration,
            },
        });

        return reply.status(201).send(recording);
    });

    // ── POST /api/feedback/sessions/:id/chats ───────────────
    app.post<{ Params: { id: string } }>('/sessions/:id/chats', {
        preHandler: [requirePermission('feedback', 'write')],
    }, async (request, reply) => {
        const body = addChatTranscriptSchema.parse(request.body);

        const transcript = await prisma.feedbackChatTranscript.create({
            data: {
                sessionId: request.params.id,
                conversationId: body.conversationId,
                conversationTitle: body.conversationTitle,
                model: body.model,
                messages: body.messages,
                messageCount: body.messageCount,
                url: body.url,
            },
        });

        return reply.status(201).send(transcript);
    });

    // ── GET /api/feedback/blobs/* ────────────────────────────
    // Serve screenshot/recording blobs
    app.get('/blobs/*', {
        preHandler: [requirePermission('feedback', 'read')],
    }, async (request, reply) => {
        const key = (request.params as Record<string, string>)['*'];
        if (!key) return reply.status(400).send({ error: 'Missing key' });

        const result = await getBlobByKey(`feedback/${key}`);
        if (!result) return reply.status(404).send({ error: 'Not found' });

        reply.type(result.contentType || 'application/octet-stream');
        if (result.contentLength) reply.header('Content-Length', result.contentLength);
        reply.header('Cache-Control', 'public, max-age=31536000');
        return reply.send(result.stream);
    });
}
