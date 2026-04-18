/**
 * Config Module (Phase 2.11)
 *
 * GET /api/config — runtime configuration (non-sensitive).
 * Returns auth provider, enabled feature areas, version info,
 * environment label, and build metadata.
 */

import type { FastifyInstance } from 'fastify';

const startedAt = new Date().toISOString();

export async function configRoutes(app: FastifyInstance) {
    app.get('/', async (_request, reply) => {
        return reply.send({
            // Auth
            authProvider: process.env['AUTH_PROVIDER'] ?? 'demo',

            // Feature areas
            features: {
                commandPalette: true,
                topologyViewer: true,
                wireframeMode: true,
                devInspector: process.env['NODE_ENV'] === 'development',
                aiChat: true,
                feedback: true,
                blobStorage: true,
                skinEditor: true,
                workerDashboard: true,
                knowledgeManagement: false, // Phase 6
                mcpServer: false, // Phase 5C
            },

            // Version
            version: process.env['APP_VERSION'] ?? '0.1.0',
            environment: process.env['NODE_ENV'] ?? 'development',

            // Runtime info
            startedAt,
            uptime: process.uptime(),
            nodeVersion: process.version,

            // Limits
            limits: {
                maxUploadSizeMb: 50,
                aiMaxTokensPerRequest: 4096,
                aiModelsAvailable: ['low', 'medium', 'reasoning'],
            },

            // External services (non-sensitive status)
            services: {
                nats: process.env['NATS_URL'] ? 'configured' : 'not-configured',
                database: 'connected', // if we got here, DB is up
                azure: process.env['AZURE_OPENAI_ENDPOINT'] ? 'configured' : 'not-configured',
            },
        });
    });
}
