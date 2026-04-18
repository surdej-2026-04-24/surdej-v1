/**
 * Module Routes: member-runbook
 *
 * CRUD for runbooks and flyer layouts, plus flyer HTML generation.
 * Core API gateway proxies `/api/module/member-runbook/*` → here.
 *
 * Image uploads stored in blob storage with purpose tags.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
    MODULE_NAME,
    CreateRunbookSchema,
    UpdateRunbookSchema,
    CreateFlyerLayoutSchema,
    type Runbook,
    type RunbookListResponse,
    type FlyerLayout,
    type FlyerLayoutListResponse,
} from '@surdej/module-member-runbook-shared';
import { renderFlyerHtml, DEFAULT_LAYOUTS } from './flyer-renderer.js';

// ─── In-Memory Store (replace with Prisma after db:push) ──────

const runbookStore = new Map<string, Runbook>();
const layoutStore = new Map<string, FlyerLayout>();

// Pre-seed default layouts
(() => {
    for (const [slug, layout] of Object.entries(DEFAULT_LAYOUTS)) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        layoutStore.set(id, {
            id,
            tenantId: null,
            name: layout.name,
            slug: layout.slug,
            description: `Default layout for ${layout.businessUnit}`,
            scope: layout.scope,
            businessUnit: layout.businessUnit,
            backCoverConfig: layout.backCoverConfig as any,
            frontCoverConfig: layout.frontCoverConfig as any,
            insideConfig: layout.insideConfig as any,
            colorPalette: layout.colorPalette,
            isDefault: layout.slug === 'happy-mates-nordic',
            createdAt: now,
            updatedAt: now,
        });
    }
})();

// ─── Runbook Routes ────────────────────────────────────────────

export function registerRoutes(app: FastifyInstance): void {

    // ── Runbooks CRUD ──────────────────────────────────────────

    // List runbooks
    app.get('/runbooks', async (request: FastifyRequest<{
        Querystring: { page?: string; pageSize?: string; prefix?: string; status?: string; tag?: string; search?: string }
    }>) => {
        const page = parseInt(request.query.page || '1', 10);
        const pageSize = parseInt(request.query.pageSize || '20', 10);
        let items = Array.from(runbookStore.values()).filter(r => !r.deletedAt);

        // Filters
        if (request.query.prefix) {
            items = items.filter(r => r.prefix === request.query.prefix);
        }
        if (request.query.status) {
            items = items.filter(r => r.status === request.query.status);
        }
        if (request.query.tag) {
            items = items.filter(r => r.tags.includes(request.query.tag!));
        }
        if (request.query.search) {
            const q = request.query.search.toLowerCase();
            items = items.filter(r =>
                r.title.toLowerCase().includes(q) ||
                r.slug.toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q)
            );
        }

        // Sort by updatedAt descending
        items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        const start = (page - 1) * pageSize;
        const paged = items.slice(start, start + pageSize);

        const response: RunbookListResponse = {
            items: paged,
            total: items.length,
            page,
            pageSize,
        };
        return response;
    });

    // Get runbook by ID
    app.get('/runbooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const item = runbookStore.get(request.params.id);
        if (!item || item.deletedAt) return reply.status(404).send({ error: 'Not found' });

        // Attach layout if present
        if (item.flyerLayoutId) {
            const layout = layoutStore.get(item.flyerLayoutId);
            if (layout) (item as any).flyerLayout = layout;
        }

        return item;
    });

    // Get runbook by slug
    app.get('/runbooks/slug/:slug', async (request: FastifyRequest<{ Params: { slug: string } }>, reply) => {
        const items = Array.from(runbookStore.values());
        const item = items.find(r => r.slug === request.params.slug && !r.deletedAt);
        if (!item) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // Create runbook
    app.post('/runbooks', async (request, reply) => {
        const parsed = CreateRunbookSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
        }

        // Check slug uniqueness
        const existing = Array.from(runbookStore.values()).find(r => r.slug === parsed.data.slug);
        if (existing) {
            return reply.status(409).send({ error: `Slug "${parsed.data.slug}" already exists` });
        }

        const now = new Date().toISOString();
        const item: Runbook = {
            id: crypto.randomUUID(),
            tenantId: null,
            ...parsed.data,
            heroImagePath: null,
            insideImagePath: null,
            authorId: null,
            createdAt: now,
            updatedAt: now,
        };

        runbookStore.set(item.id, item);
        return reply.status(201).send(item);
    });

    // Update runbook
    app.put('/runbooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const existing = runbookStore.get(request.params.id);
        if (!existing || existing.deletedAt) return reply.status(404).send({ error: 'Not found' });

        const parsed = UpdateRunbookSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
        }

        const updated: Runbook = {
            ...existing,
            ...parsed.data,
            updatedAt: new Date().toISOString(),
        };
        runbookStore.set(updated.id, updated);
        return updated;
    });

    // Delete runbook (soft delete)
    app.delete('/runbooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const existing = runbookStore.get(request.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        existing.deletedAt = new Date().toISOString() as any;
        runbookStore.set(existing.id, existing);
        return reply.status(204).send();
    });

    // ── Flyer Generation ───────────────────────────────────────

    // Generate flyer HTML for a runbook
    app.get('/runbooks/:id/flyer', async (request: FastifyRequest<{
        Params: { id: string };
        Querystring: { layoutId?: string }
    }>, reply) => {
        const runbook = runbookStore.get(request.params.id);
        if (!runbook || runbook.deletedAt) return reply.status(404).send({ error: 'Runbook not found' });

        // Resolve layout: query param > runbook default > system default
        let layout: FlyerLayout | undefined;
        const layoutId = request.query.layoutId || runbook.flyerLayoutId;
        if (layoutId) {
            layout = layoutStore.get(layoutId);
        }
        if (!layout) {
            layout = Array.from(layoutStore.values()).find(l => l.isDefault);
        }
        if (!layout) {
            return reply.status(400).send({ error: 'No flyer layout available' });
        }

        // Build the layout config (merge FlyerLayout DB schema → renderer format)
        const layoutConfig = {
            name: layout.name,
            slug: layout.slug,
            scope: layout.scope as 'common' | 'business-unit',
            businessUnit: layout.businessUnit || undefined,
            backCoverConfig: layout.backCoverConfig as any,
            frontCoverConfig: layout.frontCoverConfig as any,
            insideConfig: layout.insideConfig as any,
            colorPalette: layout.colorPalette as any,
        };

        const html = renderFlyerHtml({
            runbook,
            layout: layoutConfig,
            heroImageUrl: runbook.heroImagePath || undefined,
            insideImageUrl: runbook.insideImagePath || undefined,
        });

        reply.type('text/html').send(html);
    });

    // ── Flyer Layout CRUD ──────────────────────────────────────

    // List layouts
    app.get('/layouts', async () => {
        const items = Array.from(layoutStore.values()).filter(l => !l.deletedAt);
        const response: FlyerLayoutListResponse = {
            items,
            total: items.length,
        };
        return response;
    });

    // Get layout
    app.get('/layouts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const item = layoutStore.get(request.params.id);
        if (!item || item.deletedAt) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // Create layout
    app.post('/layouts', async (request, reply) => {
        const parsed = CreateFlyerLayoutSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
        }

        const now = new Date().toISOString();
        const item: FlyerLayout = {
            id: crypto.randomUUID(),
            ...parsed.data,
            createdAt: now,
            updatedAt: now,
        };

        layoutStore.set(item.id, item);
        return reply.status(201).send(item);
    });

    // Update layout
    app.put('/layouts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const existing = layoutStore.get(request.params.id);
        if (!existing || existing.deletedAt) return reply.status(404).send({ error: 'Not found' });

        const body = request.body as any;
        const updated: FlyerLayout = {
            ...existing,
            ...body,
            id: existing.id,
            updatedAt: new Date().toISOString(),
        };
        layoutStore.set(updated.id, updated);
        return updated;
    });

    // Delete layout
    app.delete('/layouts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const existing = layoutStore.get(request.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        existing.deletedAt = new Date().toISOString() as any;
        layoutStore.set(existing.id, existing);
        return reply.status(204).send();
    });

    // ── Import from .surdej/agents ─────────────────────────────

    app.post('/runbooks/import-from-agents', async (request, reply) => {
        const fs = await import('fs/promises');
        const path = await import('path');

        const workflowDir = path.resolve(process.cwd(), '.surdej/agents/workflows');
        let files: string[];

        try {
            files = await fs.readdir(workflowDir);
        } catch {
            return reply.status(404).send({ error: `Workflow directory not found: ${workflowDir}` });
        }

        const mdFiles = files.filter(f => f.endsWith('.md'));
        const imported: string[] = [];
        const skipped: string[] = [];

        for (const file of mdFiles) {
            const slug = file.replace(/\.md$/, '');
            const existing = Array.from(runbookStore.values()).find(r => r.slug === slug);
            if (existing) {
                skipped.push(slug);
                continue;
            }

            const raw = await fs.readFile(path.join(workflowDir, file), 'utf-8');

            // Parse YAML frontmatter
            let title = slug;
            let description = '';
            let content = raw;
            const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (fmMatch) {
                const fm = fmMatch[1];
                content = fmMatch[2].trim();
                const nameMatch = fm.match(/name:\s*(.+)/);
                const descMatch = fm.match(/description:\s*(.+)/);
                if (nameMatch) title = nameMatch[1].trim();
                if (descMatch) description = descMatch[1].trim();
            }

            // Determine prefix
            const prefix = slug.startsWith('surdej-') ? 'surdej' :
                slug.startsWith('red-') ? 'red' : 'custom';

            const now = new Date().toISOString();
            const item: Runbook = {
                id: crypto.randomUUID(),
                tenantId: null,
                slug,
                prefix,
                title: title || slug,
                subtitle: undefined,
                description: description || undefined,
                content,
                heroImagePath: null,
                insideImagePath: null,
                category: 'workflow',
                tags: [prefix === 'surdej' ? 'platform' : 'customer'],
                status: 'published',
                version: '1.0.0',
                authorId: null,
                flyerLayoutId: null,
                metadata: undefined,
                createdAt: now,
                updatedAt: now,
            };

            runbookStore.set(item.id, item);
            imported.push(slug);
        }

        return { imported, skipped, total: imported.length + skipped.length };
    });

    app.log.info(`[${MODULE_NAME}] Routes registered: runbooks CRUD, layouts CRUD, flyer generation, agent import`);
}
