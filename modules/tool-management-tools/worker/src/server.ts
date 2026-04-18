/**
 * Module Worker: tool-management-tools
 *
 * Standalone Fastify HTTP server for managing tool definitions,
 * categories, enablement, and routing for portal/extension use cases.
 *
 * Follows the Surdej module pattern:
 *   1. Starts HTTP API on its own port (default: 7005)
 *   2. Connects to NATS and publishes `module.register`
 *   3. Sends periodic heartbeats via `module.heartbeat`
 *   4. Deregisters on shutdown via `module.deregister`
 *
 * The core API gateway discovers this module via NATS and proxies
 * requests from `/api/module/tool-management-tools/*` to this worker.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { connect, JSONCodec, type NatsConnection } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-tool-management-tools-shared';
import { registerRoutes } from './routes.js';
import { registerMcpServerRoutes } from './mcp-server-routes.js';
import { registerUseCaseRoutes } from './use-case-routes.js';
import { registerTestCaseRoutes } from './test-case-routes.js';
import { registerTestRunnerRoutes } from './test-runner-routes.js';
import { registerWorkflowTaskRoutes } from './workflow-task-routes.js';
import { registerWorkflowAttachmentRoutes } from './workflow-attachment-routes.js';
import { registerSessionRoutes } from './session-routes.js';
import { registerSessionChatRoutes } from './session-chat-routes.js';
import { registerWizardRoutes } from './wizard-routes.js';
import { registerWorkflowTagRoutes } from './workflow-tag-routes.js';
import { disconnectPrisma } from './db.js';

// ─── Configuration ─────────────────────────────────────────────

const PORT = parseInt(process.env.MODULE_PORT || '7005', 10);
const HOST = process.env.MODULE_HOST || '0.0.0.0';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID || `${MODULE_NAME}-${crypto.randomUUID().slice(0, 8)}`;
const MODULE_BASE_URL = process.env.MODULE_BASE_URL || `http://localhost:${PORT}`;

// ─── Fastify Server ────────────────────────────────────────────

const app = Fastify({ logger: true });

await app.register(cors, {
    origin: true,
    credentials: true,
});

await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

registerRoutes(app);
registerMcpServerRoutes(app);
registerUseCaseRoutes(app);
registerTestCaseRoutes(app);
registerTestRunnerRoutes(app);
registerWorkflowTaskRoutes(app);
registerWorkflowAttachmentRoutes(app);
registerSessionRoutes(app);
registerSessionChatRoutes(app);
registerWizardRoutes(app);
registerWorkflowTagRoutes(app);

app.get('/health', async () => ({
    status: 'ok',
    module: MODULE_NAME,
    moduleId: MODULE_ID,
    uptime: Math.floor(process.uptime()),
}));

// ─── NATS Registration ─────────────────────────────────────────

let nc: NatsConnection | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const codec = JSONCodec();

async function connectAndRegister(): Promise<void> {
    try {
        nc = await connect({ servers: NATS_URL });
        console.log(`[${MODULE_NAME}] Connected to NATS at ${NATS_URL}`);

        const registration = {
            moduleId: MODULE_ID,
            moduleName: MODULE_NAME,
            version: '0.1.0',
            baseUrl: MODULE_BASE_URL,
            routes: [
                'GET /',
                'POST /',
                'GET /:id',
                'PUT /:id',
                'DELETE /:id',
                'PATCH /:id/toggle',
                'GET /mcp-servers',
                'POST /mcp-servers',
                'GET /mcp-servers/:id',
                'PUT /mcp-servers/:id',
                'DELETE /mcp-servers/:id',
                'PATCH /mcp-servers/:id/toggle',
                'POST /mcp-servers/:id/health-check',
                'POST /mcp-servers/:id/discover',
                'GET /mcp-servers/:id/tools',
                'POST /mcp-servers/:id/tools',
                'PUT /mcp-servers/:serverId/tools/:toolId',
                'PATCH /mcp-servers/:serverId/tools/:toolId/toggle',
                'DELETE /mcp-servers/:serverId/tools/:toolId',
                'GET /use-cases',
                'GET /use-cases/active',
                'POST /use-cases',
                'POST /use-cases/wizard/chat',
                'GET /use-cases/:id',
                'PUT /use-cases/:id',
                'DELETE /use-cases/:id',
                'GET /use-cases/:id/versions',
                'POST /use-cases/:id/versions',
                'GET /use-cases/:ucId/test-cases',
                'POST /use-cases/:ucId/test-cases',
                'PUT /use-cases/:ucId/test-cases/:tcId',
                'DELETE /use-cases/:ucId/test-cases/:tcId',
                'POST /use-cases/:ucId/test-cases/:tcId/attachments',
                'GET /attachments/:attId',
                'DELETE /attachments/:attId',
                'POST /use-cases/:ucId/run-tests',
                'GET /use-cases/:ucId/test-runs',
                'GET /use-cases/:ucId/test-runs/:runId',
                'GET /use-cases/:ucId/tasks',
                'POST /use-cases/:ucId/tasks',
                'PUT /use-cases/:ucId/tasks/:taskId',
                'DELETE /use-cases/:ucId/tasks/:taskId',
                'PATCH /use-cases/:ucId/tasks/reorder',
                'POST /workflows/:ucId/sessions/start',
                'POST /workflows/ensure-builtin',
                'GET /sessions/:sessionId',
                'POST /sessions/:sessionId/advance',
                'POST /sessions/:sessionId/revert',
                'POST /sessions/:sessionId/update-form',
                'POST /sessions/:sessionId/chat',
                'GET /workflows/sessions/:id/messages',
                'GET /use-cases/:id/attachments',
                'POST /use-cases/:id/attachments',
                'POST /use-cases/:id/tasks/:taskId/attachments',
                'GET /workflow-attachments/:attId',
                'DELETE /workflow-attachments/:attId',
                'GET /workflows/:ucId/sessions',
                'GET /sessions',
            ],
            timestamp: new Date().toISOString(),
        };

        nc.publish(NATS_SUBJECTS.REGISTER, codec.encode(registration));
        console.log(`[${MODULE_NAME}] Published module.register`);

        // Re-publish registration on every heartbeat interval so the gateway
        // discovers this worker even if it started after the initial register.
        heartbeatInterval = setInterval(() => {
            nc?.publish(NATS_SUBJECTS.REGISTER, codec.encode({
                ...registration,
                timestamp: new Date().toISOString(),
            }));
            nc?.publish(NATS_SUBJECTS.HEARTBEAT, codec.encode({
                moduleName: MODULE_NAME,
                moduleId: MODULE_ID,
                timestamp: new Date().toISOString(),
            }));
        }, 30_000);
    } catch (err) {
        console.warn(`[${MODULE_NAME}] NATS unavailable — running without registration:`, err);
    }
}

// ─── Graceful Shutdown ─────────────────────────────────────────

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (nc) {
            nc.publish(NATS_SUBJECTS.DEREGISTER, codec.encode({ moduleName: MODULE_NAME }));
            await nc.drain();
        }
        await disconnectPrisma();
        await app.close();
        process.exit(0);
    });
}

// ─── Start ─────────────────────────────────────────────────────

await app.listen({ port: PORT, host: HOST });
app.log.info(`Module ${MODULE_NAME} running on http://${HOST}:${PORT}`);

connectAndRegister().catch((err) => {
    console.warn(`[${MODULE_NAME}] NATS connection failed:`, err);
});
