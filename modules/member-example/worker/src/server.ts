/**
 * Module Worker: member-example
 *
 * Standalone Fastify HTTP server that:
 *   1. Starts an HTTP API on its own port
 *   2. Connects to NATS and publishes `module.register`
 *   3. Sends periodic heartbeats via `module.heartbeat`
 *   4. Deregisters on shutdown via `module.deregister`
 *
 * The core API gateway discovers this module via NATS and proxies
 * requests from `/api/module/member-example/*` to this worker.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec, type NatsConnection } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-member-example-shared';
import { registerRoutes } from './routes.js';

// ─── Configuration ─────────────────────────────────────────────

const PORT = parseInt(process.env.MODULE_PORT || '7001', 10);
const HOST = process.env.MODULE_HOST || '0.0.0.0';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID || `${MODULE_NAME}-${crypto.randomUUID().slice(0, 8)}`;

// ─── Fastify Server ────────────────────────────────────────────

const app = Fastify({ logger: true });

await app.register(cors, {
    origin: true,
    credentials: true,
});

// Register module routes
registerRoutes(app);

// Health endpoint
app.get('/health', async () => ({
    status: 'ok',
    module: MODULE_NAME,
    moduleId: MODULE_ID,
    uptime: Math.floor(process.uptime()),
}));

// ─── NATS Registration ────────────────────────────────────────

let nc: NatsConnection | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const codec = JSONCodec();

async function connectAndRegister(): Promise<void> {
    try {
        nc = await connect({ servers: NATS_URL });
        console.log(`[${MODULE_NAME}] Connected to NATS at ${NATS_URL}`);

        // Publish registration
        const registration = {
            moduleId: MODULE_ID,
            moduleName: MODULE_NAME,
            version: '0.1.0',
            baseUrl: `http://localhost:${PORT}`,
            routes: [
                'GET  /',
                'GET  /:id',
                'POST /',
                'PUT  /:id',
                'DELETE /:id',
            ],
            timestamp: new Date().toISOString(),
        };

        nc.publish(NATS_SUBJECTS.REGISTER, codec.encode(registration));
        console.log(`[${MODULE_NAME}] Published registration to ${NATS_SUBJECTS.REGISTER}`);

        // Heartbeat every 30s
        heartbeatInterval = setInterval(() => {
            if (nc && !nc.isClosed()) {
                nc.publish(NATS_SUBJECTS.HEARTBEAT, codec.encode({
                    moduleId: MODULE_ID,
                    moduleName: MODULE_NAME,
                    timestamp: new Date().toISOString(),
                }));
            }
        }, 30_000);
    } catch (err) {
        console.warn(`[${MODULE_NAME}] NATS unavailable — running standalone`, err);
    }
}

async function deregisterAndDisconnect(): Promise<void> {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    if (nc && !nc.isClosed()) {
        nc.publish(NATS_SUBJECTS.DEREGISTER, codec.encode({
            moduleId: MODULE_ID,
            moduleName: MODULE_NAME,
            timestamp: new Date().toISOString(),
        }));
        await nc.flush();
        await nc.close();
        console.log(`[${MODULE_NAME}] Deregistered and disconnected from NATS`);
    }
}

// ─── Start ─────────────────────────────────────────────────────

try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[${MODULE_NAME}] HTTP server listening on http://${HOST}:${PORT}`);
    await connectAndRegister();
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

// ─── Graceful Shutdown ─────────────────────────────────────────

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
        console.log(`[${MODULE_NAME}] Received ${signal}, shutting down...`);
        await deregisterAndDisconnect();
        await app.close();
        process.exit(0);
    });
}
