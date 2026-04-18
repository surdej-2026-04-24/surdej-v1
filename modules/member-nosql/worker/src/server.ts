import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-member-nosql-shared';
import { registerCollectionRoutes } from './routes/collection-routes.js';
import { registerDocumentRoutes } from './routes/document-routes.js';
import { registerVersionRoutes } from './routes/version-routes.js';
import { registerAdminRoutes } from './routes/admin-routes.js';
import { registerMcpRoutes } from './routes/mcp-routes.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '7006', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();
const MODULE_BASE_URL = process.env.MODULE_BASE_URL ?? `http://localhost:${PORT}`;

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// ─── Register all route groups ───────────────────────────────
registerCollectionRoutes(app);
registerDocumentRoutes(app);
registerVersionRoutes(app);
registerAdminRoutes(app);
registerMcpRoutes(app);

// ─── NATS Self-Registration ───────────────────────────────────
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();

const registration = {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    version: '0.1.0',
    baseUrl: MODULE_BASE_URL,
    routes: [
        'GET /collections',
        'GET /collections/tree',
        'GET /collections/:id',
        'POST /collections',
        'PUT /collections/:id',
        'DELETE /collections/:id',
        'GET /collections/:collectionId/documents',
        'POST /collections/:collectionId/documents',
        'GET /documents/:id',
        'PUT /documents/:id',
        'DELETE /documents/:id',
        'POST /documents/:id/restore',
        'GET /documents/:id/versions',
        'GET /documents/:id/versions/:version',
        'POST /documents/:id/versions/:version/restore',
        'GET /admin/stats',
        'GET /admin/collections',
        'GET /admin/documents',
        'POST /mcp',
        'GET /mcp/tools',
    ],
    timestamp: new Date().toISOString(),
};

nc.publish(NATS_SUBJECTS.register, codec.encode(registration));

const heartbeat = setInterval(() => {
    // Re-publish full registration so late-starting gateways discover us
    nc.publish(NATS_SUBJECTS.register, codec.encode({
        ...registration,
        timestamp: new Date().toISOString(),
    }));
    nc.publish(NATS_SUBJECTS.heartbeat, codec.encode({
        moduleName: MODULE_NAME,
        moduleId: MODULE_ID,
        timestamp: new Date().toISOString(),
    }));
}, 30_000);

// ─── Graceful Shutdown ────────────────────────────────────────
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
