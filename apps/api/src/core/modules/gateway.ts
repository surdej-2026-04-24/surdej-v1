/**
 * Module Gateway — NATS-driven reverse proxy for external modules.
 *
 * Subscribes to `module.register` and `module.deregister` on NATS.
 * When a module registers, its baseUrl is stored in the registry.
 * Incoming requests to `/api/module/<module-name>/*` are proxied
 * to the corresponding module worker's HTTP endpoint.
 *
 * This is separate from the existing `modules/routes.ts` which handles
 * GUID-based domain plugin routing. This gateway handles standalone
 * module workers that live in `/modules/<member-feature>/worker/`.
 *
 * @module core/modules/gateway
 */

import type { FastifyInstance } from 'fastify';
import { getNatsConnection, isNatsConnected } from '../nats/index.js';
import { JSONCodec, type Subscription } from 'nats';
import { logger } from '../logger/index.js';

const log = logger.child({ component: 'ModuleGateway' });

// ─── Types ─────────────────────────────────────────────────────

interface ModuleRegistration {
    moduleId: string;
    moduleName: string;
    version: string;
    baseUrl: string;
    routes: string[];
    timestamp: string;
}

interface RegisteredModule extends ModuleRegistration {
    lastHeartbeat: string;
    healthy: boolean;
}

// ─── Module Registry ───────────────────────────────────────────

/** Maps module name → registration info. */
const registry = new Map<string, RegisteredModule>();

const codec = JSONCodec();
let registerSub: Subscription | null = null;
let deregisterSub: Subscription | null = null;
let heartbeatSub: Subscription | null = null;

/** Get all registered modules. */
export function getRegisteredModules(): RegisteredModule[] {
    return Array.from(registry.values());
}

/** Get a single module by name. */
export function getModuleByName(name: string): RegisteredModule | undefined {
    return registry.get(name);
}

// ─── NATS Subscriptions ────────────────────────────────────────

export async function startModuleGateway(): Promise<void> {
    if (!isNatsConnected()) {
        log.warn('NATS not connected — gateway will not discover modules');
        return;
    }

    const nc = getNatsConnection();

    // Listen for module registrations
    registerSub = nc.subscribe('module.register');
    (async () => {
        for await (const msg of registerSub!) {
            try {
                const reg = codec.decode(msg.data) as ModuleRegistration;
                registry.set(reg.moduleName, {
                    ...reg,
                    lastHeartbeat: reg.timestamp,
                    healthy: true,
                });
                log.info(`Module registered: ${reg.moduleName} → ${reg.baseUrl}`);
            } catch (err) {
                log.error({ err }, 'Failed to process registration');
            }
        }
    })();

    // Listen for deregistrations
    deregisterSub = nc.subscribe('module.deregister');
    (async () => {
        for await (const msg of deregisterSub!) {
            try {
                const data = codec.decode(msg.data) as { moduleName: string };
                registry.delete(data.moduleName);
                log.info(`Module deregistered: ${data.moduleName}`);
            } catch (err) {
                log.error({ err }, 'Failed to process deregistration');
            }
        }
    })();

    // Listen for heartbeats
    heartbeatSub = nc.subscribe('module.heartbeat');
    (async () => {
        for await (const msg of heartbeatSub!) {
            try {
                const data = codec.decode(msg.data) as { moduleName: string; timestamp: string };
                const mod = registry.get(data.moduleName);
                if (mod) {
                    mod.lastHeartbeat = data.timestamp;
                    mod.healthy = true;
                }
            } catch (err) {
                // Heartbeat failures are not critical
            }
        }
    })();

    // Mark modules unhealthy if no heartbeat in 90s
    setInterval(() => {
        const now = Date.now();
        for (const [name, mod] of registry) {
            const elapsed = now - new Date(mod.lastHeartbeat).getTime();
            if (elapsed > 90_000) {
                mod.healthy = false;
                log.warn(`Module ${name} missed heartbeat (${Math.round(elapsed / 1000)}s ago`);
            }
        }
    }, 30_000);

    log.info('Listening for module registrations on NATS');
}

export async function stopModuleGateway(): Promise<void> {
    registerSub?.unsubscribe();
    deregisterSub?.unsubscribe();
    heartbeatSub?.unsubscribe();
    registerSub = null;
    deregisterSub = null;
    heartbeatSub = null;
    log.info('Stopped');
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Headers that must not be forwarded when proxying requests.
 * - Hop-by-hop headers (RFC 2616 §13.5.1): connection, keep-alive,
 *   transfer-encoding, upgrade, expect, proxy-authenticate,
 *   proxy-authorization, te, trailers.
 * - `content-length` because the body is re-serialized with
 *   JSON.stringify and the length may differ from the original.
 * - `host` must be set to the target, not the original.
 */
const EXCLUDED_PROXY_HEADERS = new Set([
    'host', 'connection', 'content-length', 'transfer-encoding',
    'keep-alive', 'upgrade', 'expect', 'te', 'trailers',
    'proxy-authenticate', 'proxy-authorization',
]);

/** Copy request headers, excluding hop-by-hop / content-length. */
function forwardHeaders(reqHeaders: Record<string, string | string[] | undefined>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(reqHeaders)) {
        if (!EXCLUDED_PROXY_HEADERS.has(key) && value) {
            out[key] = Array.isArray(value) ? value.join(', ') : value;
        }
    }
    return out;
}

// ─── HTTP Gateway Routes ───────────────────────────────────────

export async function moduleGatewayRoutes(app: FastifyInstance) {

    /**
     * GET /api/module — list all dynamically registered modules
     */
    app.get('/', async (_req, reply) => {
        const modules = getRegisteredModules().map(m => ({
            moduleName: m.moduleName,
            moduleId: m.moduleId,
            version: m.version,
            baseUrl: m.baseUrl,
            healthy: m.healthy,
            lastHeartbeat: m.lastHeartbeat,
            routes: m.routes,
            apiBase: `/api/module/${m.moduleName}`,
        }));
        return reply.send({ modules });
    });

    /**
     * ALL /api/module/:moduleName/* — reverse proxy to module worker
     *
     * The gateway looks up the module's baseUrl from the NATS-driven
     * registry and forwards the request to the module worker's HTTP
     * endpoint.
     */
    app.all<{ Params: { moduleName: string; '*': string } }>('/:moduleName/*', async (req, reply) => {
        const mod = registry.get(req.params.moduleName);

        if (!mod) {
            return reply.status(404).send({
                error: 'Module not found',
                moduleName: req.params.moduleName,
                hint: 'Ensure the module worker is running and has registered via NATS',
            });
        }

        if (!mod.healthy) {
            return reply.status(503).send({
                error: 'Module unhealthy',
                moduleName: req.params.moduleName,
                lastHeartbeat: mod.lastHeartbeat,
            });
        }

        // Proxy to module worker
        const subPath = req.params['*'] || '';
        const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        const targetUrl = `${mod.baseUrl}/${subPath}${qs}`;

        app.log.debug(`[ModuleGateway] Proxying ${req.method} /api/module/${req.params.moduleName}/${subPath} → ${targetUrl}`);

        try {
            const headers = forwardHeaders(req.headers as Record<string, string | string[] | undefined>);

            const proxyRes = await fetch(targetUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD'
                    ? JSON.stringify(req.body)
                    : undefined,
            });

            const responseBody = proxyRes.status === 204 ? null : await proxyRes.text();

            // Forward status and body
            reply.status(proxyRes.status);

            // Forward relevant headers
            const contentType = proxyRes.headers.get('content-type');
            if (contentType) reply.header('content-type', contentType);

            return reply.send(responseBody);
        } catch (err) {
            app.log.error(`[ModuleGateway] Proxy failed for ${req.params.moduleName}: ${String(err)}`);
            return reply.status(502).send({
                error: 'Module proxy failed',
                moduleName: req.params.moduleName,
                baseUrl: mod.baseUrl,
            });
        }
    });

    /**
     * ALL /api/module/:moduleName — root route (no wildcard path)
     */
    app.all<{ Params: { moduleName: string } }>('/:moduleName', async (req, reply) => {
        const mod = registry.get(req.params.moduleName);

        if (!mod) {
            return reply.status(404).send({
                error: 'Module not found',
                moduleName: req.params.moduleName,
            });
        }

        if (!mod.healthy) {
            return reply.status(503).send({
                error: 'Module unhealthy',
                moduleName: req.params.moduleName,
            });
        }

        const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        const targetUrl = `${mod.baseUrl}/${qs}`;

        try {
            const headers = forwardHeaders(req.headers as Record<string, string | string[] | undefined>);

            const proxyRes = await fetch(targetUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD'
                    ? JSON.stringify(req.body)
                    : undefined,
            });

            const responseBody = proxyRes.status === 204 ? null : await proxyRes.text();
            reply.status(proxyRes.status);
            const contentType = proxyRes.headers.get('content-type');
            if (contentType) reply.header('content-type', contentType);
            return reply.send(responseBody);
        } catch (err) {
            return reply.status(502).send({
                error: 'Module proxy failed',
                moduleName: req.params.moduleName,
            });
        }
    });
}
