/**
 * AI Routes
 *
 * REST + SSE endpoints for AI chat:
 *   POST /api/ai/chat          — streaming chat (SSE)
 *   GET  /api/ai/conversations — list user conversations
 *   GET  /api/ai/conversations/:id — get conversation with messages
 *   DELETE /api/ai/conversations/:id — delete conversation
 *   GET  /api/ai/models        — available models
 *   GET  /api/ai/usage         — usage stats
 *
 * @module ai/routes
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
    streamChat,
    listConversations,
    getConversation,
    deleteConversation,
    generateConversationTitle,
} from './chat.js';
import { getAvailableModels, isAiConfigured, getProviderName } from './config.js';
import { ragRoutes } from './rag.js';
import { requirePermission } from '../middleware/acl.js';

const prisma = new PrismaClient();

/** Extract user ID from ACL context or Bearer token fallback */
async function getUserId(req: FastifyRequest): Promise<string | null> {
    // Prefer ACL context (set by global hook)
    if (req.acl) return req.acl.userId;

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const session = await prisma.session.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) return null;
    return session.userId;
}

export async function aiRoutes(app: FastifyInstance) {
    // Register RAG sub-routes
    await app.register(ragRoutes);
    /**
     * POST /api/ai/chat — streaming AI chat via SSE
     *
     * Body: { message, conversationId?, model?, systemPrompt? }
     * Response: Server-Sent Events stream
     */
    app.post('/chat', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        if (!isAiConfigured()) {
            return reply.status(503).send({
                error: 'AI is not configured. Set AI_PROVIDER and API key environment variables.',
            });
        }

        const body = req.body as {
            message?: string;
            conversationId?: string;
            model?: string;
            systemPrompt?: string;
            useCaseContext?: { id: string, promptTemplate?: string, domain?: string };
            tools?: string[];  // List of enabled tool IDs
            files?: string[];
        };

        if (!body.message?.trim() && (!body.files || body.files.length === 0)) {
            return reply.status(400).send({ error: 'Message or files are required' });
        }

        // Get user from session
        const userId = await getUserId(req);
        if (!userId) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }

        // Get tenant context if available
        const tenantId = req.acl?.tenantId ?? undefined;

        try {
            const { conversationId, textStream, toolEvents, usage, docRefs, systemPrompt } = await streamChat({
                message: body.message || '',
                conversationId: body.conversationId,
                model: body.model,
                userId,
                tenantId,
                systemPrompt: body.systemPrompt,
                useCaseContext: body.useCaseContext,
                enabledTools: body.tools,
                files: body.files,
            });

            // Set SSE headers (include CORS since reply.raw bypasses Fastify's CORS plugin)
            const origin = req.headers.origin;
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Conversation-Id': conversationId,
                ...(origin ? {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Credentials': 'true',
                } : {}),
            });

            // Send conversation ID as first event
            reply.raw.write(`data: ${JSON.stringify({ type: 'meta', conversationId, systemPrompt })}\n\n`);

            // Listen for tool call/result events (emitted by onStepFinish in chat.ts)
            toolEvents.on('status', (data: { message: string }) => {
                try {
                    reply.raw.write(`data: ${JSON.stringify({
                        type: 'status',
                        message: data.message,
                    })}\n\n`);
                } catch { /* stream may be closed */ }
            });

            toolEvents.on('tool_call', (data: { toolName: string; args: Record<string, unknown> }) => {
                try {
                    reply.raw.write(`data: ${JSON.stringify({
                        type: 'tool_call',
                        toolName: data.toolName,
                        args: data.args,
                    })}\n\n`);
                } catch { /* stream may be closed */ }
            });

            toolEvents.on('tool_result', (data: { toolName: string; summary: string }) => {
                try {
                    reply.raw.write(`data: ${JSON.stringify({
                        type: 'tool_result',
                        toolName: data.toolName,
                        summary: data.summary,
                    })}\n\n`);
                } catch { /* stream may be closed */ }
            });

            // Stream text chunks
            for await (const chunk of textStream) {
                reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
            }

            // Send document references (filename → blobId map)
            if (docRefs.size > 0) {
                const refs = Object.fromEntries(docRefs);
                reply.raw.write(`data: ${JSON.stringify({ type: 'refs', documents: refs })}\n\n`);
            }

            // Final event with usage info
            const finalUsage = await usage;
            reply.raw.write(`data: ${JSON.stringify({
                type: 'done',
                conversationId,
                usage: finalUsage ? {
                    inputTokens: finalUsage.inputTokens,
                    outputTokens: finalUsage.outputTokens,
                    totalTokens: finalUsage.totalTokens,
                } : null,
            })}\n\n`);

            reply.raw.end();
        } catch (err) {
            console.error('[AI] Chat stream error:', err);

            // Build a user-friendly error message
            let errorMsg = String(err);
            if (err instanceof Error && err.name === 'AI_NoOutputGeneratedError') {
                errorMsg = 'The AI model did not generate a response. This may be a temporary issue — please try again.';
                // Log the underlying cause for debugging
                const cause = (err as any).cause;
                if (cause) console.error('[AI] Underlying cause:', cause);
            }

            // If headers haven't been sent yet, send proper error
            if (!reply.raw.headersSent) {
                return reply.status(500).send({ error: 'AI chat failed: ' + errorMsg });
            }

            // If already streaming, send error event
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
            reply.raw.end();
        }
    });

    /**
     * POST /api/ai/conversations — create an empty conversation (e.g., when attaching files first)
     */
    app.post('/conversations', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
        const tenantId = req.acl?.tenantId ?? undefined;
        const body = req.body as { model?: string, metadata?: any };

        const conversation = await prisma.aiConversation.create({
            data: {
                userId,
                tenantId,
                model: body.model || 'gpt-4o',
                metadata: body.metadata || {},
                title: null,
            },
        });

        return reply.send(conversation);
    });

    /**
     * PUT /api/ai/conversations/:id — update conversation (e.g., file attachments metadata)
     */
    app.put<{ Params: { id: string } }>('/conversations/:id', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
        const body = req.body as { metadata?: any, title?: string };

        const existing = await prisma.aiConversation.findFirst({ where: { id: req.params.id, userId } });
        if (!existing) return reply.status(404).send({ error: 'Not found' });

        const updated = await prisma.aiConversation.update({
            where: { id: req.params.id },
            data: {
                ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
                ...(body.title !== undefined ? { title: body.title } : {}),
            }
        });

        return reply.send(updated);
    });

    /**
     * GET /api/ai/conversations — list conversations for current user
     */
    app.get('/conversations', { preHandler: [requirePermission('ai', 'read')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
        const limit = parseInt((req.query as any)?.limit ?? '50', 10);

        const conversations = await listConversations(userId, limit);

        return reply.send(
            conversations.map((c) => ({
                id: c.id,
                title: c.title,
                model: c.model,
                messageCount: c._count.messages,
                metadata: c.metadata,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            })),
        );
    });

    /**
     * GET /api/ai/conversations/:id — get conversation with messages
     */
    app.get<{ Params: { id: string } }>('/conversations/:id', { preHandler: [requirePermission('ai', 'read')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
        const conversation = await getConversation(req.params.id, userId);

        if (!conversation) {
            return reply.status(404).send({ error: 'Conversation not found' });
        }

        return reply.send(conversation);
    });

    /**
     * DELETE /api/ai/conversations/:id — delete conversation
     */
    app.delete<{ Params: { id: string } }>('/conversations/:id', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });
        const deleted = await deleteConversation(req.params.id, userId);

        if (!deleted) {
            return reply.status(404).send({ error: 'Conversation not found' });
        }

        return reply.send({ ok: true });
    });

    /**
     * GET /api/ai/models — available models and routing info
     */
    app.get('/models', async (_req, reply) => {
        return reply.send({
            configured: isAiConfigured(),
            provider: getProviderName(),
            models: getAvailableModels(),
        });
    });

    /**
     * GET /api/ai/usage — usage stats for current user
     */
    app.get('/usage', { preHandler: [requirePermission('ai', 'read')] }, async (req, reply) => {
        const userId = await getUserId(req);
        if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

        const stats = await prisma.aiUsageLog.groupBy({
            by: ['model'],
            where: { userId },
            _sum: {
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
                costUsd: true,
            },
            _count: true,
        });

        const recent = await prisma.aiUsageLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        return reply.send({
            byModel: stats.map((s) => ({
                model: s.model,
                requests: s._count,
                inputTokens: s._sum.inputTokens,
                outputTokens: s._sum.outputTokens,
                totalTokens: s._sum.totalTokens,
                totalCostUsd: s._sum.costUsd,
            })),
            recent,
        });
    });

    /**
     * GET /api/ai/debug — debug info (system prompt, tools, version)
     */
    app.get('/debug', { preHandler: [requirePermission('ai', 'read')] }, async (_req, reply) => {
        return reply.send({
            version: '0.1.0',
            systemPrompt: 'Start en chat for at se den dynamiske system prompt.',
            tools: [
                { id: 'rag_search', description: 'Semantic document search via pgvector' },
                { id: 'search_properties', description: 'Filter/list prospect properties' },
                { id: 'get_property', description: 'Full property details + analysis' },
                { id: 'compute_yield', description: 'Net yield calculator' },
                { id: 'list_documents', description: 'Document inventory with status' },
            ],
            transport: 'sse',
            model: getProviderName(),
            timestamp: new Date().toISOString(),
        });
    });

    /**
     * POST /api/ai/admin/generate-titles — bulk-generate titles for untitled conversations
     */
    app.post('/admin/generate-titles', { preHandler: [requirePermission('ai', 'write')] }, async (_req, reply) => {
        const untitled = await prisma.aiConversation.findMany({
            where: { title: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });

        const results: { id: string; title: string }[] = [];
        for (const conv of untitled) {
            try {
                const title = await generateConversationTitle(conv.id);
                results.push({ id: conv.id, title });
            } catch (err) {
                results.push({ id: conv.id, title: `ERROR: ${err}` });
            }
        }

        return reply.send({ total: untitled.length, results });
    });

    /**
     * GET /api/ai/admin/stats — Dashboard statistics for chat inspection
     */
    app.get('/admin/stats', { preHandler: [requirePermission('ai', 'write')] }, async (_req, reply) => {
        const [totalConversations, totalMessages, totalUsage, activeUsers, recentConversations] = await Promise.all([
            prisma.aiConversation.count(),
            prisma.aiMessage.count(),
            prisma.aiUsageLog.aggregate({
                _sum: { totalTokens: true, costUsd: true },
                _count: true,
            }),
            prisma.aiConversation.groupBy({
                by: ['userId'],
                _count: true,
            }),
            prisma.aiConversation.findMany({
                orderBy: { updatedAt: 'desc' },
                take: 10,
                include: {
                    _count: { select: { messages: true } },
                    messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { content: true, role: true } },
                },
            }),
        ]);

        // Messages per day (last 14 days)
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const messagesPerDay = await prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(`
            SELECT DATE("createdAt") as day, COUNT(*)::bigint as count
            FROM "AiMessage"
            WHERE "createdAt" >= $1
            GROUP BY DATE("createdAt")
            ORDER BY day DESC
        `, fourteenDaysAgo);

        // Model usage breakdown
        const modelBreakdown = await prisma.aiUsageLog.groupBy({
            by: ['model'],
            _sum: { totalTokens: true, costUsd: true },
            _count: true,
        });

        return reply.send({
            totalConversations,
            totalMessages,
            totalTokens: totalUsage._sum.totalTokens ?? 0,
            totalCostUsd: totalUsage._sum.costUsd ?? 0,
            totalRequests: totalUsage._count,
            activeUserCount: activeUsers.length,
            recentConversations: recentConversations.map(c => ({
                id: c.id,
                title: c.title,
                userId: c.userId,
                model: c.model,
                messageCount: c._count.messages,
                lastMessage: c.messages[0]?.content?.slice(0, 100) ?? null,
                updatedAt: c.updatedAt,
            })),
            messagesPerDay: messagesPerDay.map(d => ({
                day: d.day,
                count: Number(d.count),
            })),
            modelBreakdown: modelBreakdown.map(m => ({
                model: m.model,
                requests: m._count,
                totalTokens: m._sum.totalTokens ?? 0,
                costUsd: m._sum.costUsd ?? 0,
            })),
        });
    });

    /**
     * GET /api/ai/admin/users — List users with chat activity
     */
    app.get('/admin/users', { preHandler: [requirePermission('ai', 'write')] }, async (_req, reply) => {
        const userConversations = await prisma.aiConversation.groupBy({
            by: ['userId'],
            _count: true,
            orderBy: { _count: { userId: 'desc' } },
        });

        // Fetch user details
        const userIds = userConversations.map(u => u.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, displayName: true, avatarUrl: true },
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        // Get last activity per user
        const lastActivities = await Promise.all(
            userIds.map(async (userId) => {
                const last = await prisma.aiConversation.findFirst({
                    where: { userId },
                    orderBy: { updatedAt: 'desc' },
                    select: { updatedAt: true },
                });
                return { userId, lastActive: last?.updatedAt ?? null };
            })
        );
        const lastActivityMap = new Map(lastActivities.map(a => [a.userId, a.lastActive]));

        return reply.send(
            userConversations.map(uc => {
                const user = userMap.get(uc.userId);
                return {
                    userId: uc.userId,
                    name: user?.displayName || user?.name || user?.email || uc.userId,
                    email: user?.email ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                    conversationCount: uc._count,
                    lastActive: lastActivityMap.get(uc.userId) ?? null,
                };
            })
        );
    });

    /**
     * GET /api/ai/admin/users/:userId/conversations — Get conversations for a specific user
     */
    app.get<{ Params: { userId: string } }>('/admin/users/:userId/conversations', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        const conversations = await prisma.aiConversation.findMany({
            where: { userId: req.params.userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: { select: { messages: true } },
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        return reply.send(
            conversations.map(c => ({
                id: c.id,
                title: c.title,
                model: c.model,
                messageCount: c._count.messages,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                messages: c.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    model: m.model,
                    tokenCount: m.tokenCount,
                    createdAt: m.createdAt,
                })),
            }))
        );
    });

    /**
     * POST /api/ai/transcribe — Speech-to-text transcription
     * Accepts multipart FormData with a `file` field (audio/video).
     * Uses Azure OpenAI Whisper to transcribe.
     */
    app.post('/transcribe', { preHandler: [requirePermission('ai', 'write')] }, async (req, reply) => {
        const data = await req.file();
        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();

        // Use Azure OpenAI Whisper API
        const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
        const apiKey = process.env['AZURE_OPENAI_API_KEY'];
        const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-08-01-preview';
        const whisperModel = process.env['AZURE_OPENAI_WHISPER_MODEL'] || 'whisper';

        if (!endpoint || !apiKey) {
            return reply.status(503).send({ error: 'Azure OpenAI not configured' });
        }

        try {
            const formData = new FormData();
            formData.append('file', new Blob([new Uint8Array(buffer)], { type: data.mimetype }), data.filename);
            formData.append('response_format', 'text');
            formData.append('language', 'da');

            const url = `${endpoint}openai/deployments/${whisperModel}/audio/transcriptions?api-version=${apiVersion}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'api-key': apiKey },
                body: formData,
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('[AI] Whisper transcription failed:', res.status, errText);
                return reply.status(502).send({ error: `Transcription failed: ${res.status}` });
            }

            const text = await res.text();
            return reply.send({ text: text.trim() });
        } catch (err) {
            console.error('[AI] Transcription error:', err);
            return reply.status(500).send({ error: String(err) });
        }
    });
}
