import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { z } from 'zod';
import YAML from 'yaml';

// ── Zod Schemas ──

const createPageSchema = z.object({
    name: z.string().min(1).max(100),
    slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(80)
        .optional(),
    description: z.string().max(500).optional(),
    source: z.string().max(100_000),
});

const updatePageSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(80)
        .optional(),
    description: z.string().max(500).optional(),
    source: z.string().max(100_000).optional(),
    compiled: z.string().optional(),
    compiledAt: z.string().datetime().optional(),
});

// ── Helpers ──

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

// ── Routes ──

export async function virtualPagesRoutes(app: FastifyInstance) {
    // GET /api/skins/:skinId/pages — list all virtual pages for a skin
    app.get('/', async (request: FastifyRequest<{ Params: { skinId: string } }>, reply) => {
        const pages = await prisma.virtualPage.findMany({
            where: { skinId: request.params.skinId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                skinId: true,
                name: true,
                slug: true,
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return reply.send(pages);
    });

    // GET /api/skins/:skinId/pages/:pageId — get single page with source
    app.get(
        '/:pageId',
        async (request: FastifyRequest<{ Params: { skinId: string; pageId: string } }>, reply) => {
            const page = await prisma.virtualPage.findFirst({
                where: { id: request.params.pageId, skinId: request.params.skinId, deletedAt: null },
            });
            if (!page) return reply.status(404).send({ error: 'Virtual page not found' });
            return reply.send(page);
        },
    );

    // POST /api/skins/:skinId/pages — create new virtual page
    app.post('/', async (request: FastifyRequest<{ Params: { skinId: string } }>, reply) => {
        const skin = await prisma.skin.findUnique({ where: { id: request.params.skinId } });
        if (!skin) return reply.status(404).send({ error: 'Skin not found' });

        const body = createPageSchema.parse(request.body);
        const slug = body.slug || slugify(body.name);

        // Check slug uniqueness
        const existing = await prisma.virtualPage.findUnique({
            where: { skinId_slug: { skinId: request.params.skinId, slug } },
        });
        if (existing && !existing.deletedAt) {
            return reply.status(409).send({ error: `Slug "${slug}" already exists in this skin` });
        }

        // If a soft-deleted page exists with the same slug, reactivate it with new data
        if (existing && existing.deletedAt) {
            const page = await prisma.virtualPage.update({
                where: { id: existing.id },
                data: {
                    name: body.name,
                    description: body.description,
                    source: body.source,
                    deletedAt: null,
                },
            });
            return reply.status(200).send(page);
        }

        const page = await prisma.virtualPage.create({
            data: {
                skinId: request.params.skinId,
                tenantId: skin.tenantId,
                name: body.name,
                slug,
                description: body.description,
                source: body.source,
            },
        });
        return reply.status(201).send(page);
    });

    // PUT /api/skins/:skinId/pages/:pageId — update page
    app.put(
        '/:pageId',
        async (request: FastifyRequest<{ Params: { skinId: string; pageId: string } }>, reply) => {
            const page = await prisma.virtualPage.findFirst({
                where: { id: request.params.pageId, skinId: request.params.skinId, deletedAt: null },
            });
            if (!page) return reply.status(404).send({ error: 'Virtual page not found' });

            const body = updatePageSchema.parse(request.body);

            // If slug is changing, check uniqueness
            if (body.slug && body.slug !== page.slug) {
                const conflict = await prisma.virtualPage.findUnique({
                    where: { skinId_slug: { skinId: request.params.skinId, slug: body.slug } },
                });
                if (conflict && !conflict.deletedAt) {
                    return reply.status(409).send({ error: `Slug "${body.slug}" already exists` });
                }
            }

            const updated = await prisma.virtualPage.update({
                where: { id: request.params.pageId },
                data: {
                    ...(body.name !== undefined && { name: body.name }),
                    ...(body.slug !== undefined && { slug: body.slug }),
                    ...(body.description !== undefined && { description: body.description }),
                    ...(body.source !== undefined && { source: body.source }),
                    ...(body.compiled !== undefined && { compiled: body.compiled }),
                    ...(body.compiledAt !== undefined && { compiledAt: new Date(body.compiledAt) }),
                },
            });
            return reply.send(updated);
        },
    );

    // DELETE /api/skins/:skinId/pages/:pageId — soft-delete
    app.delete(
        '/:pageId',
        async (request: FastifyRequest<{ Params: { skinId: string; pageId: string } }>, reply) => {
            const page = await prisma.virtualPage.findFirst({
                where: { id: request.params.pageId, skinId: request.params.skinId, deletedAt: null },
            });
            if (!page) return reply.status(404).send({ error: 'Virtual page not found' });

            await prisma.virtualPage.update({
                where: { id: request.params.pageId },
                data: { deletedAt: new Date() },
            });
            return reply.send({ success: true });
        },
    );

    // ──────────────────────────────────────────────────
    // Export / Import — YAML
    // ──────────────────────────────────────────────────

    // GET /api/skins/:skinId/pages/:pageId/export — export single page as YAML
    app.get(
        '/:pageId/export',
        async (request: FastifyRequest<{ Params: { skinId: string; pageId: string } }>, reply) => {
            const page = await prisma.virtualPage.findFirst({
                where: { id: request.params.pageId, skinId: request.params.skinId, deletedAt: null },
            });
            if (!page) return reply.status(404).send({ error: 'Virtual page not found' });

            const doc = {
                kind: 'VirtualPage',
                version: 1,
                exportedAt: new Date().toISOString(),
                skinId: page.skinId,
                page: {
                    name: page.name,
                    slug: page.slug,
                    description: page.description || '',
                    source: page.source,
                },
            };

            const yaml = YAML.stringify(doc, { lineWidth: 0 });
            reply
                .header('Content-Type', 'text/yaml')
                .header(
                    'Content-Disposition',
                    `attachment; filename="${page.slug}.yaml"`,
                )
                .send(yaml);
        },
    );

    // POST /api/skins/:skinId/pages/import — import virtual pages from YAML
    app.post(
        '/import',
        async (
            request: FastifyRequest<{
                Params: { skinId: string };
                Querystring: { dryRun?: string };
            }>,
            reply,
        ) => {
            const skin = await prisma.skin.findUnique({ where: { id: request.params.skinId } });
            if (!skin) return reply.status(404).send({ error: 'Skin not found' });

            // Parse body as YAML string
            let yamlContent: string;
            if (typeof request.body === 'string') {
                yamlContent = request.body;
            } else if (
                request.body &&
                typeof request.body === 'object' &&
                'yaml' in request.body
            ) {
                yamlContent = (request.body as { yaml: string }).yaml;
            } else {
                return reply.status(400).send({ error: 'Expected YAML string in body or { yaml: string }' });
            }

            let doc: Record<string, unknown>;
            try {
                doc = YAML.parse(yamlContent);
            } catch {
                return reply.status(400).send({ error: 'Invalid YAML' });
            }

            // Determine pages to import
            let pagesToImport: Array<{ name: string; slug: string; description?: string; source: string }>;

            if (doc.kind === 'VirtualPage' && doc.page) {
                const p = doc.page as { name: string; slug: string; description?: string; source: string };
                pagesToImport = [p];
            } else if (doc.kind === 'Skin' && doc.skin) {
                const s = doc.skin as { virtualPages?: Array<{ name: string; slug: string; description?: string; source: string }> };
                pagesToImport = s.virtualPages || [];
            } else {
                return reply.status(400).send({ error: 'YAML must have kind "VirtualPage" or "Skin" with pages' });
            }

            if (pagesToImport.length === 0) {
                return reply.send({ imported: 0, conflicts: [], pages: [] });
            }

            // Conflict detection
            const existingSlugs = new Set(
                (
                    await prisma.virtualPage.findMany({
                        where: { skinId: request.params.skinId, deletedAt: null },
                        select: { slug: true },
                    })
                ).map((p) => p.slug),
            );

            const conflicts = pagesToImport
                .filter((p) => existingSlugs.has(p.slug))
                .map((p) => ({ slug: p.slug, name: p.name }));

            const isDryRun = request.query.dryRun === 'true';
            if (isDryRun) {
                return reply.send({
                    dryRun: true,
                    total: pagesToImport.length,
                    conflicts,
                    pages: pagesToImport.map((p) => ({
                        slug: p.slug,
                        name: p.name,
                        hasConflict: existingSlugs.has(p.slug),
                    })),
                });
            }

            // Parse resolution instructions from body
            const resolutions: Record<string, 'overwrite' | 'new' | 'skip'> =
                typeof request.body === 'object' && request.body !== null && 'resolutions' in request.body
                    ? ((request.body as { resolutions: Record<string, 'overwrite' | 'new' | 'skip'> }).resolutions || {})
                    : {};

            const results: Array<{ slug: string; action: string; id?: string }> = [];

            for (const p of pagesToImport) {
                const resolution = resolutions[p.slug] || (existingSlugs.has(p.slug) ? 'skip' : 'create');

                if (resolution === 'skip') {
                    results.push({ slug: p.slug, action: 'skipped' });
                    continue;
                }

                if (resolution === 'overwrite') {
                    const existing = await prisma.virtualPage.findUnique({
                        where: { skinId_slug: { skinId: request.params.skinId, slug: p.slug } },
                    });
                    if (existing) {
                        const updated = await prisma.virtualPage.update({
                            where: { id: existing.id },
                            data: {
                                name: p.name,
                                description: p.description || null,
                                source: p.source,
                                deletedAt: null, // un-delete if was soft-deleted
                            },
                        });
                        results.push({ slug: p.slug, action: 'overwritten', id: updated.id });
                        continue;
                    }
                }

                // Create new (possibly with modified slug if conflict + "new" resolution)
                let slug = p.slug;
                if (existingSlugs.has(slug) && resolution === 'new') {
                    let counter = 2;
                    while (existingSlugs.has(`${p.slug}-${counter}`)) counter++;
                    slug = `${p.slug}-${counter}`;
                }

                const created = await prisma.virtualPage.create({
                    data: {
                        skinId: request.params.skinId,
                        tenantId: skin.tenantId,
                        name: p.name,
                        slug,
                        description: p.description || null,
                        source: p.source,
                    },
                });
                existingSlugs.add(slug); // track for subsequent pages in the same batch
                results.push({ slug, action: 'created', id: created.id });
            }

            return reply.send({ imported: results.filter((r) => r.action !== 'skipped').length, results });
        },
    );
}
