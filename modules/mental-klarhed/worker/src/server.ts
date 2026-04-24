import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-mental-klarhed-shared';
import { registerAdminRoutes } from './routes/programmes.js';
import { registerAssessmentRoutes } from './routes/assessments.js';
import { registerMaterialRoutes } from './routes/materials.js';
import { registerAuthRoutes } from './routes/auth.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '7010', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const MODULE_BASE_URL = process.env.MODULE_BASE_URL ?? `http://localhost:${PORT}`;
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);
await app.register(jwt, { secret: JWT_SECRET });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// ─── Routes ────────────────────────────────────────────────────
registerAuthRoutes(app);
registerAdminRoutes(app);
registerAssessmentRoutes(app);
registerMaterialRoutes(app);

// ─── Health ────────────────────────────────────────────────────
app.get('/health', async () => ({ ok: true, module: MODULE_NAME }));

// ─── NATS Self-Registration ────────────────────────────────────
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();

nc.publish(NATS_SUBJECTS.register, codec.encode({
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    version: '0.1.0',
    baseUrl: MODULE_BASE_URL,
    routes: [
        'GET /health',
        'GET /k/:token',
        'GET /admin/programmes',
        'POST /admin/programmes',
        'GET /admin/programmes/:id',
        'POST /admin/programmes/:id/sessions/:sn/send-assessment',
        'GET /admin/programmes/:id/sessions/:sn/material',
        'POST /admin/programmes/:id/sessions/:sn/send-material',
        'GET /client/me',
        'POST /client/assessments',
        'GET /client/materials/:sessionId',
        'GET /client/evaluation',
        'DELETE /client/me',
        'GET /client/me/export',
    ],
    timestamp: new Date().toISOString(),
}));

const heartbeat = setInterval(() => {
    nc.publish(NATS_SUBJECTS.heartbeat, codec.encode({
        moduleName: MODULE_NAME,
        timestamp: new Date().toISOString(),
    }));
}, 30_000);

// ─── Graceful Shutdown ─────────────────────────────────────────
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
