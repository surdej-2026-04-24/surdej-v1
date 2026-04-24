import type { FastifyInstance } from 'fastify';
import type { NatsConnection, Codec, JetStreamClient } from 'nats';
import { NATS_SUBJECTS, JETSTREAM_CONFIG } from '@surdej/module-core-comms-shared';

let js: JetStreamClient;
let codec: Codec<unknown>;

export function setJetStream(jetstream: JetStreamClient, c: Codec<unknown>) {
    js = jetstream;
    codec = c;
}

export function registerRoutes(app: FastifyInstance) {
    // ─── Health check ──────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', service: 'core-comms-webhook-receiver' }));

    // ─── Receive inbound webhook ───────────────────────────────
    // POST /webhook/:channelId — public endpoint for external systems
    app.post<{ Params: { channelId: string } }>('/webhook/:channelId', async (req, reply) => {
        const { channelId } = req.params;

        const event = {
            channelId,
            receivedAt: new Date().toISOString(),
            headers: req.headers as Record<string, string>,
            body: req.body,
            sourceIp: req.ip,
            method: req.method,
            path: req.url,
        };

        // Publish to NATS JetStream for durable buffering
        // This ensures events survive API downtime
        try {
            await js.publish(
                NATS_SUBJECTS.webhookInbound,
                codec.encode(event),
            );
        } catch (err) {
            app.log.error({ err, channelId }, 'Failed to publish webhook event to NATS');
            return reply.status(503).send({ error: 'Service temporarily unavailable' });
        }

        // Always acknowledge receipt to the external sender immediately
        return reply.status(202).send({ received: true, channelId });
    });

    // Support PUT and PATCH as well for flexible webhook integrations
    app.put<{ Params: { channelId: string } }>('/webhook/:channelId', async (req, reply) => {
        const { channelId } = req.params;

        const event = {
            channelId,
            receivedAt: new Date().toISOString(),
            headers: req.headers as Record<string, string>,
            body: req.body,
            sourceIp: req.ip,
            method: req.method,
            path: req.url,
        };

        try {
            await js.publish(NATS_SUBJECTS.webhookInbound, codec.encode(event));
        } catch (err) {
            app.log.error({ err, channelId }, 'Failed to publish webhook event to NATS');
            return reply.status(503).send({ error: 'Service temporarily unavailable' });
        }

        return reply.status(202).send({ received: true, channelId });
    });
}
