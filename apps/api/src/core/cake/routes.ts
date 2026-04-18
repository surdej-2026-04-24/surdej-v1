/**
 * CAKE API Routes
 *
 * Registers Fastify routes for CAKE token exchange, knowledge sync,
 * and webhook management.
 *
 * @module core/cake/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCakeClient, isCakeEnabled } from './index.js';
import type {
    CakeTokenExchangeRequest,
    CakeKnowledgePushPayload,
    CakeKnowledgePullRequest,
} from './index.js';

export async function registerCakeRoutes(app: FastifyInstance) {
    // ── Guard: skip if CAKE is not enabled ──────────────────────
    app.addHook('preHandler', async (_request: FastifyRequest, reply: FastifyReply) => {
        if (!isCakeEnabled()) {
            reply.code(503).send({
                error: 'CAKE integration is not enabled',
                hint: 'Set CAKE_ENABLED=true and CAKE_API_KEY in environment',
            });
        }
    });

    // ── Token Exchange ──────────────────────────────────────────

    app.post<{ Body: CakeTokenExchangeRequest }>(
        '/cake/token/exchange',
        async (request, reply) => {
            const { externalToken, provider, tenantSlug } = request.body;

            if (!externalToken || !provider || !tenantSlug) {
                return reply.code(400).send({ error: 'externalToken, provider, and tenantSlug are required' });
            }

            try {
                const result = await getCakeClient().exchangeToken({
                    externalToken,
                    provider,
                    tenantSlug,
                });
                return reply.send(result);
            } catch (e) {
                request.log.error(e, 'CAKE token exchange failed');
                return reply.code(502).send({ error: (e as Error).message });
            }
        }
    );

    app.post<{ Body: { token: string } }>(
        '/cake/token/validate',
        async (request, reply) => {
            const { token } = request.body;
            if (!token) {
                return reply.code(400).send({ error: 'token is required' });
            }

            const result = await getCakeClient().validateToken(token);
            return reply.send(result);
        }
    );

    // ── Knowledge Sync ──────────────────────────────────────────

    app.post<{ Body: CakeKnowledgePushPayload }>(
        '/cake/knowledge/push',
        async (request, reply) => {
            try {
                const result = await getCakeClient().pushKnowledge(request.body);
                return reply.send(result);
            } catch (e) {
                request.log.error(e, 'CAKE knowledge push failed');
                return reply.code(502).send({ error: (e as Error).message });
            }
        }
    );

    app.post<{ Body: CakeKnowledgePullRequest }>(
        '/cake/knowledge/pull',
        async (request, reply) => {
            try {
                const result = await getCakeClient().pullKnowledge(request.body);
                return reply.send(result);
            } catch (e) {
                request.log.error(e, 'CAKE knowledge pull failed');
                return reply.code(502).send({ error: (e as Error).message });
            }
        }
    );

    // ── Webhooks ────────────────────────────────────────────────

    app.post<{
        Body: {
            tenantSlug: string;
            webhookUrl: string;
            events: string[];
        };
    }>('/cake/webhooks', async (request, reply) => {
        const { tenantSlug, webhookUrl, events } = request.body;

        if (!tenantSlug || !webhookUrl || !events?.length) {
            return reply.code(400).send({ error: 'tenantSlug, webhookUrl, and events are required' });
        }

        try {
            const result = await getCakeClient().registerWebhook(
                tenantSlug,
                webhookUrl,
                events as Array<'article.created' | 'article.updated' | 'article.deleted' | 'tenant.provisioned' | 'sync.completed'>
            );
            return reply.send(result);
        } catch (e) {
            request.log.error(e, 'CAKE webhook registration failed');
            return reply.code(502).send({ error: (e as Error).message });
        }
    });

    app.post<{ Body: { payload: string; signature: string } }>(
        '/cake/webhooks/verify',
        async (request, reply) => {
            const { payload, signature } = request.body;
            const valid = await getCakeClient().verifyWebhookSignature(payload, signature);
            return reply.send({ valid });
        }
    );

    // ── Health ──────────────────────────────────────────────────

    app.get('/cake/health', async (_request, reply) => {
        const result = await getCakeClient().healthCheck();
        const status = result.reachable ? 200 : 503;
        return reply.code(status).send(result);
    });
}
