/**
 * Module Router
 *
 * Provides the /api/modules/:moduleId/* endpoint pattern.
 * Resolves module GUIDs to domain slugs and forwards to the
 * appropriate domain plugin routes.
 *
 * Examples:
 *   GET  /api/modules/<uuid>/stats      →  domain pdf → /stats
 *   POST /api/modules/<uuid>/documents/upload → domain pdf → /documents/upload
 *   GET  /api/modules/a7e4c9f1-.../queues     →  domain nexi → /queues
 */

import type { FastifyInstance } from 'fastify';

// ─── Module Registry (API-side) ────────────────────────────────
// Maps stable GUIDs to domain slugs and metadata.
// This mirrors the frontend moduleRegistry.ts and could eventually
// be loaded from the database.

interface ModuleEntry {
    id: string;
    slug: string;
    name: string;
    domain: string; // domain plugin key (matches domains/<domain>/plugin.ts)
}

const MODULE_MAP: Map<string, ModuleEntry> = new Map([
    // Add module entries here, e.g.:
    // ['<uuid>', { id: '<uuid>', slug: 'pdf', name: 'PDF Refinery', domain: 'pdf' }],
]);

// ─── Route Registration ────────────────────────────────────────

export async function modulesRoutes(app: FastifyInstance) {

    /**
     * GET /api/modules — list all registered modules
     */
    app.get('/', async (_req, reply) => {
        const modules = Array.from(MODULE_MAP.values()).map(m => ({
            id: m.id,
            slug: m.slug,
            name: m.name,
            domain: m.domain,
            apiBase: `/api/modules/${m.id}`,
        }));
        return reply.send({ modules });
    });

    /**
     * GET /api/modules/:moduleId — module detail
     */
    app.get<{ Params: { moduleId: string } }>('/:moduleId', async (req, reply) => {
        const mod = MODULE_MAP.get(req.params.moduleId);
        if (!mod) {
            return reply.status(404).send({ error: 'Module not found', moduleId: req.params.moduleId });
        }
        return reply.send({
            id: mod.id,
            slug: mod.slug,
            name: mod.name,
            domain: mod.domain,
            apiBase: `/api/modules/${mod.id}`,
            endpoints: {
                base: `/api/modules/${mod.id}`,
                domainFallback: `/api/${mod.domain}`,
            },
        });
    });

    /**
     * ALL /api/modules/:moduleId/* — proxy to domain plugin
     *
     * Rewrites the URL internally from:
     *   /api/modules/:moduleId/<path>
     * To:
     *   /api/<domain>/<path>
     *
     * This lets frontends use a consistent GUID-based API while
     * the backend routes through domain plugins.
     */
    app.all<{ Params: { moduleId: string; '*': string } }>('/:moduleId/*', async (req, reply) => {
        const mod = MODULE_MAP.get(req.params.moduleId);
        if (!mod) {
            return reply.status(404).send({
                error: 'Module not found',
                moduleId: req.params.moduleId,
            });
        }

        // Rewrite: /api/modules/:id/stats → /api/<domain>/stats
        const subPath = req.params['*'] || '';
        const targetUrl = `/api/${mod.domain}/${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

        app.log.debug(`[Modules] Proxying ${req.method} ${req.url} → ${targetUrl}`);

        // Internal redirect via inject — avoids external network hop
        const proxyResponse = await app.inject({
            method: req.method as any,
            url: targetUrl,
            headers: {
                ...req.headers,
                // Remove host header to avoid Fastify routing issues
                host: undefined,
            },
            payload: req.body as any,
        });

        // Forward response
        return reply
            .status(proxyResponse.statusCode)
            .headers(proxyResponse.headers)
            .send(proxyResponse.payload);
    });
}
