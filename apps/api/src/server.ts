// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import metricsPlugin from 'fastify-metrics';
import { healthRoutes } from './core/health/routes.js';
import { configRoutes } from './core/config/routes.js';
import { authRoutes } from './core/auth/routes.js';
import { usersRoutes } from './core/users/routes.js';
import { featuresRoutes } from './core/features/routes.js';
import { skinsRoutes } from './core/skins/routes.js';
import { virtualPagesRoutes } from './core/virtual-pages/routes.js';
import { tenantsRoutes } from './core/tenants/routes.js';
import { feedbackRoutes } from './core/feedback/routes.js';
import { workersRoutes } from './core/workers/routes.js';
import { aiRoutes } from './core/ai/index.js';
import { blobsRoutes } from './core/blobs/routes.js';
import { jobsRoutes } from './core/jobs/routes.js';
import { knowledgeRoutes } from './core/knowledge/routes.js';
import { mcpRoutes } from './core/mcp/server.js';
import { databaseRoutes } from './core/database/routes.js';
import { aclRoutes } from './core/acl/routes.js';
import { modulesRoutes } from './core/modules/routes.js';
import { moduleGatewayRoutes, startModuleGateway, stopModuleGateway } from './core/modules/gateway.js';
import { analyzeRoutes } from './core/analyze/routes.js';
import { platformRoutes } from './core/platform/routes.js';
import { bridgeConsentRoutes } from './core/bridge-consent/routes.js';
import { kvStoreRoutes } from './core/kv-store/routes.js';
import { iframeToolRoutes } from './core/iframe-tools/routes.js';
import { mixinKvRoutes } from './core/mixin-kv/routes.js';
import { scanDomainPlugins } from './core/middleware/plugin-scanner.js';
import { resolveContext } from './core/middleware/acl.js';
import { setTenantContext } from './core/middleware/tenant-context.js';
import { connectNats, disconnectNats, startWorkerRegistry, stopWorkerRegistry } from './core/nats/index.js';
import { closeCacheConnection } from './core/middleware/cache.js';
import { ZodError } from 'zod';

const port = parseInt(process.env['PORT'] ?? '5001', 10);
const host = process.env['HOST'] ?? '0.0.0.0';
// CORS is configured below with origin:true (reflect all origins)

const app = Fastify({
    disableRequestLogging: true,
    logger: {
        transport: {
            target: new URL('./core/logger/console-transport.mjs', import.meta.url).pathname,
        },
    },
});

// CORS — supports multiple origins for cross-domain frontend hosting
await app.register(cors, {
    origin: true, // Allow all origins (reflects request origin)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// ─── Prometheus Metrics ───
await app.register(metricsPlugin, {
    endpoint: '/api/metrics',
    defaultMetrics: { enabled: true },
    routeMetrics: { enabled: true },
});

// ─── Global Zod Error Handler ───
// Catches Zod validation errors and returns 400 with structured details.
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof ZodError) {
        return reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: error.issues,
        });
    }
    // Default Fastify error handling
    reply.status(error.statusCode ?? 500).send({
        statusCode: error.statusCode ?? 500,
        error: error.name ?? 'Internal Server Error',
        message: error.message,
    });
});

// ─── Global Authentication Hook ───
// Runs on every request; skips public paths.
// Sets request.acl for all authenticated requests.
const PUBLIC_PATHS = ['/api/health', '/api/config', '/api/auth/login', '/api/platform/health'];

app.addHook('onRequest', async (request, _reply) => {
    const url = request.url.split('?')[0]!;

    // Skip public paths
    if (PUBLIC_PATHS.some(p => url.startsWith(p))) return;

    // Skip OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') return;

    // Resolve ACL context
    const ctx = await resolveContext(request);
    if (ctx) {
        request.acl = ctx;
    }
    // Note: We don't reject unauthenticated requests here — that's done by
    // requireAuth / requirePermission on specific routes. This way, some
    // routes can remain open (e.g. GET /api/acl/roles for frontend hydration).
});

// ─── Tenant Context Hook ───
// Sets tenant context so the Prisma auto-injection middleware
// can read it and automatically scope queries by tenantId.

app.addHook('preHandler', async (request, _reply) => {
    const acl = request.acl;
    if (acl) {
        setTenantContext({
            tenantId: acl.tenantId,
            userId: acl.userId,
            roleSlug: acl.roleSlug,
            isSuperAdmin: acl.rolePriority >= 100,
        });
    } else {
        setTenantContext(undefined);
    }
});

// ─── Usage Tracking Hook ───
import { prisma } from './db.js';

app.addHook('onResponse', async (request, reply) => {
    // Skip noisy endpoints
    if (request.url.includes('/health') || request.url.includes('/metrics')) return;

    const duration = Math.round(reply.elapsedTime);
    const { method, url, ip } = request;
    const path = url.split('?')[0] ?? url;
    const status = reply.statusCode;
    const userAgent = request.headers['user-agent'];

    // Extract context from ACL if present
    const ctx = (request as any).acl;
    const userId = ctx?.user?.id ?? null;
    const tenantId = ctx?.tenantId ?? null;

    // ── Structured log: compact on console, rich to OpenTelemetry ──
    request.log.info({
        http: {
            method,
            url: path,
            route: request.routeOptions?.url,
            statusCode: status,
            duration,
            ip,
            userAgent,
        },
        ...(userId && {
            user: { id: userId, tenantId, role: ctx?.roleSlug },
        }),
    }, `${method} ${path} ${status} ${duration}ms`);

    try {
        // Fire-and-forget DB log
        await prisma.apiRequestLog.create({
            data: {
                method,
                path,
                status,
                duration,
                ip,
                userAgent,
                userId,
                tenantId
            }
        });
    } catch (err) {
        request.log.warn({ err }, 'Failed to log API request usage');
    }
});

// Core routes
await app.register(healthRoutes, { prefix: '/api/health' });
await app.register(configRoutes, { prefix: '/api/config' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(usersRoutes, { prefix: '/api/users' });
await app.register(featuresRoutes, { prefix: '/api/features' });
await app.register(skinsRoutes, { prefix: '/api/skins' });
await app.register(virtualPagesRoutes, { prefix: '/api/skins/:skinId/pages' });
await app.register(tenantsRoutes, { prefix: '/api/tenants' });
await app.register(feedbackRoutes, { prefix: '/api/feedback' });
await app.register(workersRoutes, { prefix: '/api/workers' });
await app.register(jobsRoutes, { prefix: '/api/jobs' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(blobsRoutes, { prefix: '/api/blobs' });
await app.register(knowledgeRoutes, { prefix: '/api/knowledge' });
await app.register(mcpRoutes, { prefix: '/api/mcp' });
await app.register(databaseRoutes, { prefix: '/api/database' });
await app.register(aclRoutes, { prefix: '/api/acl' });
await app.register(modulesRoutes, { prefix: '/api/modules' });
await app.register(moduleGatewayRoutes, { prefix: '/api/module' });
await app.register(analyzeRoutes, { prefix: '/api/analyze' });
await app.register(platformRoutes, { prefix: '/api/platform' });
await app.register(bridgeConsentRoutes, { prefix: '/api/bridge-consent' });
await app.register(kvStoreRoutes, { prefix: '/api/kv' });
await app.register(iframeToolRoutes, { prefix: '/api/iframe-tools' });
await app.register(mixinKvRoutes, { prefix: '/api/mixin-kv' });

// Domain plugins
await scanDomainPlugins(app);

// NATS + Worker Registry + Module Gateway
try {
    await connectNats();
    await startWorkerRegistry();
    await startModuleGateway();
    app.log.info('NATS connected, worker registry + module gateway started');
} catch (err) {
    app.log.warn('NATS not available — worker/module features disabled: ' + String(err));
}

// Graceful shutdown
const shutdown = async (signal: string) => {
    app.log.info(`${signal} received — shutting down...`);
    await stopModuleGateway();
    await stopWorkerRegistry();
    await disconnectNats();
    await closeCacheConnection();
    await app.close();
    process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start
try {
    await app.listen({ port, host });
    app.log.info(`Surdej API running on http://${host}:${port}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

export { app };
