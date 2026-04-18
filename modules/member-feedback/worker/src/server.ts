import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-member-feedback-shared';
import { registerRoutes } from './routes.js';
import { registerAnalyzer } from './analyzer.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '7003', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();
const MODULE_BASE_URL = process.env.MODULE_BASE_URL ?? `http://localhost:${PORT}`;

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
registerRoutes(app);

// ─── NATS Self-Registration ───
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();

const registration = {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    version: '0.1.0',
    baseUrl: MODULE_BASE_URL,
    routes: [
        'GET /tickets',
        'GET /tickets/:id',
        'POST /tickets',
        'PUT /tickets/:id',
        'POST /tickets/:id/transition',
        'POST /tickets/:id/comments',
        'GET /tickets/:id/comments',
        'GET /tickets/:id/transitions',
        'GET /tickets/:id/customer',
        'GET /stats',
    ],
    timestamp: new Date().toISOString(),
};

nc.publish(NATS_SUBJECTS.register, codec.encode(registration));

// Register AI analyzer (listens for NATS events)
registerAnalyzer(nc, codec);

const heartbeat = setInterval(() => {
    nc.publish(NATS_SUBJECTS.heartbeat, codec.encode({
        moduleName: MODULE_NAME,
        timestamp: new Date().toISOString(),
    }));
}, 30_000);

// ─── Graceful Shutdown ───
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        clearInterval(heartbeat);
        nc.publish(NATS_SUBJECTS.deregister, codec.encode({ moduleName: MODULE_NAME }));
        await nc.drain();
        await app.close();
    });
}

await app.listen({ port: PORT, host: HOST });
app.log.info(`Module ${MODULE_NAME} running on http://${HOST}:${PORT}`);
