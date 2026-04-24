import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { JETSTREAM_CONFIG } from '@surdej/module-core-comms-shared';
import { registerRoutes, setJetStream } from './routes.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '7008', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// ─── NATS + JetStream ────────────────────────────────────────
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();
const jsm = await nc.jetstreamManager();

// Ensure the JetStream stream exists (idempotent)
try {
    await jsm.streams.add({
        name: JETSTREAM_CONFIG.streamName,
        subjects: [...JETSTREAM_CONFIG.subjects],
    });
    app.log.info(`JetStream stream ${JETSTREAM_CONFIG.streamName} ready`);
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('already in use') && !message.includes('subjects overlap')) {
        app.log.error({ err }, 'Failed to create JetStream stream');
    } else {
        app.log.info(`JetStream stream ${JETSTREAM_CONFIG.streamName} already exists`);
    }
}

const js = nc.jetstream();
setJetStream(js, codec);

registerRoutes(app);

// ─── Graceful Shutdown ───────────────────────────────────────
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        await nc.drain();
        await app.close();
    });
}

await app.listen({ port: PORT, host: HOST });
app.log.info(`Webhook receiver running on http://${HOST}:${PORT}`);
app.log.info('Inbound webhooks: POST /webhook/:channelId');
