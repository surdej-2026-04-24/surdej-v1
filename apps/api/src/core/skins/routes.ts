import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { z } from 'zod';
import YAML from 'yaml';
import { requirePermission } from '../middleware/acl.js';

// Use z.any() for JSON fields to avoid Prisma InputJsonValue incompatibility
const createSkinSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    branding: z.any(),
    sidebar: z.any(),
    activityBar: z.any().optional(),
    theme: z.any().optional(),
    homepageConfig: z.any().optional(),
});

const updateSkinSchema = createSkinSchema.partial();

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

export async function skinsRoutes(app: FastifyInstance) {
    // GET /api/skins
    app.get('/', { preHandler: [requirePermission('skins', 'read')] }, async (_request, reply) => {
        const skins = await prisma.skin.findMany({
            orderBy: { createdAt: 'asc' },
        });
        return reply.send(skins);
    });

    // GET /api/skins/:id
    app.get<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('skins', 'read')] }, async (request, reply) => {
        const skin = await prisma.skin.findUnique({ where: { id: request.params.id } });
        if (!skin) return reply.status(404).send({ error: 'Skin not found' });
        return reply.send(skin);
    });

    // POST /api/skins
    app.post('/', { preHandler: [requirePermission('skins', 'write')] }, async (request: FastifyRequest, reply) => {
        const body = createSkinSchema.parse(request.body);
        const skin = await prisma.skin.create({
            data: {
                name: body.name as string,
                description: body.description as string | undefined,
                branding: body.branding as Prisma.InputJsonValue,
                sidebar: body.sidebar as Prisma.InputJsonValue,
                activityBar: body.activityBar as Prisma.InputJsonValue | undefined,
                theme: body.theme as Prisma.InputJsonValue | undefined,
                homepageConfig: body.homepageConfig as Prisma.InputJsonValue | undefined,
                isBuiltIn: false,
            },
        });
        return reply.status(201).send(skin);
    });

    // PUT /api/skins/:id
    app.put<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('skins', 'write')] }, async (request, reply) => {
        const skin = await prisma.skin.findUnique({ where: { id: request.params.id } });
        if (!skin) return reply.status(404).send({ error: 'Skin not found' });
        if (skin.isBuiltIn) return reply.status(403).send({ error: 'Built-in skins cannot be modified' });

        const body = updateSkinSchema.parse(request.body);
        const updated = await prisma.skin.update({
            where: { id: request.params.id },
            data: {
                ...(body.name !== undefined && { name: body.name as string }),
                ...(body.description !== undefined && { description: body.description as string }),
                ...(body.branding !== undefined && { branding: body.branding as Prisma.InputJsonValue }),
                ...(body.sidebar !== undefined && { sidebar: body.sidebar as Prisma.InputJsonValue }),
                ...(body.activityBar !== undefined && { activityBar: body.activityBar as Prisma.InputJsonValue }),
                ...(body.theme !== undefined && { theme: body.theme as Prisma.InputJsonValue }),
                ...(body.homepageConfig !== undefined && { homepageConfig: body.homepageConfig as Prisma.InputJsonValue }),
            },
        });
        return reply.send(updated);
    });

    // DELETE /api/skins/:id
    app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('skins', 'manage')] }, async (request, reply) => {
        const skin = await prisma.skin.findUnique({ where: { id: request.params.id } });
        if (!skin) return reply.status(404).send({ error: 'Skin not found' });
        if (skin.isBuiltIn) return reply.status(403).send({ error: 'Built-in skins cannot be deleted' });

        await prisma.skin.delete({ where: { id: request.params.id } });
        return reply.send({ success: true });
    });

    // POST /api/skins/:id/clone
    app.post<{ Params: { id: string } }>('/:id/clone', { preHandler: [requirePermission('skins', 'manage')] }, async (request, reply) => {
        const source = await prisma.skin.findUnique({ where: { id: request.params.id } });
        if (!source) return reply.status(404).send({ error: 'Skin not found' });

        const clone = await prisma.skin.create({
            data: {
                name: source.name + ' (Copy)',
                description: source.description,
                branding: source.branding as Prisma.InputJsonValue,
                sidebar: source.sidebar as Prisma.InputJsonValue,
                activityBar: source.activityBar === null ? undefined : source.activityBar as Prisma.InputJsonValue,
                theme: source.theme === null ? undefined : source.theme as Prisma.InputJsonValue,
                homepageConfig: source.homepageConfig === null ? undefined : source.homepageConfig as Prisma.InputJsonValue,
                isBuiltIn: false,
            },
        });

        // Also clone virtual pages
        const pages = await prisma.virtualPage.findMany({
            where: { skinId: source.id, deletedAt: null },
        });
        for (const page of pages) {
            await prisma.virtualPage.create({
                data: {
                    skinId: clone.id,
                    tenantId: page.tenantId,
                    name: page.name,
                    slug: page.slug,
                    description: page.description,
                    source: page.source,
                },
            });
        }

        return reply.status(201).send(clone);
    });

    // GET /api/skins/me — current user's active skin
    app.get('/me', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        // Find active skin preference
        const pref = await prisma.userSkinPreference.findFirst({
            where: { userId: session.userId, isActive: true },
            include: { skin: true },
        });

        if (pref) return reply.send(pref.skin);

        // Fall back to default
        const defaultPref = await prisma.userSkinPreference.findFirst({
            where: { userId: session.userId, isDefault: true },
            include: { skin: true },
        });

        if (defaultPref) return reply.send(defaultPref.skin);

        // Fall back to platform default
        const defaultSkin = await prisma.skin.findFirst({ where: { name: 'Default', isBuiltIn: true } });
        return reply.send(defaultSkin);
    });

    // PUT /api/skins/me — set active skin
    app.put('/me', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({ where: { token } });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        const { skinId } = z.object({ skinId: z.string().min(1) }).parse(request.body);

        // Deactivate all current active skins
        await prisma.userSkinPreference.updateMany({
            where: { userId: session.userId, isActive: true },
            data: { isActive: false },
        });

        // Upsert the preference
        await prisma.userSkinPreference.upsert({
            where: { userId_skinId: { userId: session.userId, skinId } },
            update: { isActive: true },
            create: { userId: session.userId, skinId, isActive: true },
        });

        const skin = await prisma.skin.findUnique({ where: { id: skinId } });
        return reply.send(skin);
    });

    // PUT /api/skins/me/default — set default skin
    app.put('/me/default', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({ where: { token } });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        const { skinId } = z.object({ skinId: z.string().min(1) }).parse(request.body);

        // Remove default from all
        await prisma.userSkinPreference.updateMany({
            where: { userId: session.userId, isDefault: true },
            data: { isDefault: false },
        });

        // Upsert the preference
        await prisma.userSkinPreference.upsert({
            where: { userId_skinId: { userId: session.userId, skinId } },
            update: { isDefault: true },
            create: { userId: session.userId, skinId, isDefault: true },
        });

        return reply.send({ success: true });
    });

    // PUT /api/skins/me/order — save custom sidebar order
    app.put('/me/order', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'Not authenticated' });

        const session = await prisma.session.findUnique({ where: { token } });
        if (!session) return reply.status(401).send({ error: 'Invalid session' });

        const { skinId, order } = z
            .object({
                skinId: z.string().min(1),
                order: z.any(),
            })
            .parse(request.body);

        await prisma.userSkinPreference.upsert({
            where: { userId_skinId: { userId: session.userId, skinId } },
            update: { customOrder: order as Prisma.InputJsonValue },
            create: { userId: session.userId, skinId, customOrder: order as Prisma.InputJsonValue },
        });

        return reply.send({ success: true });
    });

    // ──────────────────────────────────────────────────
    // Skin Export / Import — YAML
    // ──────────────────────────────────────────────────

    // GET /api/skins/:id/export — export full skin as YAML (including virtual pages)
    app.get('/:id/export', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const skin = await prisma.skin.findUnique({ where: { id: request.params.id } });
        if (!skin) return reply.status(404).send({ error: 'Skin not found' });

        const pages = await prisma.virtualPage.findMany({
            where: { skinId: skin.id, deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });

        const doc = {
            kind: 'Skin',
            version: 1,
            exportedAt: new Date().toISOString(),
            skin: {
                name: skin.name,
                description: skin.description || '',
                branding: skin.branding,
                sidebar: skin.sidebar,
                activityBar: skin.activityBar || [],
                theme: skin.theme || {},
                homepageConfig: skin.homepageConfig || {},
                virtualPages: pages.map((p) => ({
                    name: p.name,
                    slug: p.slug,
                    description: p.description || '',
                    source: p.source,
                })),
            },
        };

        const yaml = YAML.stringify(doc, { lineWidth: 0 });
        const filename = slugify(skin.name) || 'skin';
        reply
            .header('Content-Type', 'text/yaml')
            .header('Content-Disposition', `attachment; filename="${filename}.yaml"`)
            .send(yaml);
    });

    // POST /api/skins/import — import a skin from YAML
    app.post(
        '/import',
        async (request: FastifyRequest<{ Querystring: { dryRun?: string } }>, reply) => {
            let yamlContent: string;
            if (typeof request.body === 'string') {
                yamlContent = request.body;
            } else if (request.body && typeof request.body === 'object' && 'yaml' in request.body) {
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

            if (doc.kind !== 'Skin' || !doc.skin) {
                return reply.status(400).send({ error: 'YAML must have kind "Skin"' });
            }

            const skinData = doc.skin as {
                name: string;
                description?: string;
                branding: Prisma.InputJsonValue;
                sidebar: Prisma.InputJsonValue;
                activityBar?: Prisma.InputJsonValue;
                theme?: Prisma.InputJsonValue;
                homepageConfig?: Prisma.InputJsonValue;
                virtualPages?: Array<{ name: string; slug: string; description?: string; source: string }>;
            };

            // Conflict detection
            const existingSkin = await prisma.skin.findFirst({
                where: { name: skinData.name, deletedAt: null },
            });

            const isDryRun = request.query.dryRun === 'true';

            // Check page conflicts if skin exists
            let pageConflicts: Array<{ slug: string; name: string }> = [];
            if (existingSkin && skinData.virtualPages?.length) {
                const existingSlugs = new Set(
                    (
                        await prisma.virtualPage.findMany({
                            where: { skinId: existingSkin.id, deletedAt: null },
                            select: { slug: true },
                        })
                    ).map((p) => p.slug),
                );
                pageConflicts = (skinData.virtualPages || [])
                    .filter((p) => existingSlugs.has(p.slug))
                    .map((p) => ({ slug: p.slug, name: p.name }));
            }

            if (isDryRun) {
                return reply.send({
                    dryRun: true,
                    skinConflict: existingSkin ? { id: existingSkin.id, name: existingSkin.name } : null,
                    pageConflicts,
                    totalPages: skinData.virtualPages?.length || 0,
                });
            }

            // Parse resolutions
            const bodyObj = request.body as {
                yaml: string;
                skinResolution?: 'overwrite' | 'new' | 'skip';
                pageResolutions?: Record<string, 'overwrite' | 'new' | 'skip'>;
            };
            const skinResolution = bodyObj.skinResolution || (existingSkin ? 'new' : 'create');
            const pageResolutions = bodyObj.pageResolutions || {};

            let targetSkinId: string;

            if (skinResolution === 'skip') {
                return reply.send({ action: 'skipped' });
            } else if (skinResolution === 'overwrite' && existingSkin) {
                await prisma.skin.update({
                    where: { id: existingSkin.id },
                    data: {
                        description: skinData.description,
                        branding: skinData.branding,
                        sidebar: skinData.sidebar,
                        activityBar: skinData.activityBar,
                        theme: skinData.theme,
                        homepageConfig: skinData.homepageConfig,
                    },
                });
                targetSkinId = existingSkin.id;
            } else {
                const name = existingSkin ? `${skinData.name} (imported)` : skinData.name;
                const created = await prisma.skin.create({
                    data: {
                        name,
                        description: skinData.description,
                        branding: skinData.branding,
                        sidebar: skinData.sidebar,
                        activityBar: skinData.activityBar,
                        theme: skinData.theme,
                        homepageConfig: skinData.homepageConfig,
                        isBuiltIn: false,
                    },
                });
                targetSkinId = created.id;
            }

            // Import virtual pages
            const existingSlugs = new Set(
                (
                    await prisma.virtualPage.findMany({
                        where: { skinId: targetSkinId, deletedAt: null },
                        select: { slug: true },
                    })
                ).map((p) => p.slug),
            );

            const pageResults: Array<{ slug: string; action: string; id?: string }> = [];

            for (const p of skinData.virtualPages || []) {
                const resolution = pageResolutions[p.slug] || (existingSlugs.has(p.slug) ? 'skip' : 'create');

                if (resolution === 'skip') {
                    pageResults.push({ slug: p.slug, action: 'skipped' });
                    continue;
                }

                if (resolution === 'overwrite') {
                    const existing = await prisma.virtualPage.findUnique({
                        where: { skinId_slug: { skinId: targetSkinId, slug: p.slug } },
                    });
                    if (existing) {
                        const updated = await prisma.virtualPage.update({
                            where: { id: existing.id },
                            data: { name: p.name, description: p.description || null, source: p.source, deletedAt: null },
                        });
                        pageResults.push({ slug: p.slug, action: 'overwritten', id: updated.id });
                        continue;
                    }
                }

                let finalSlug = p.slug;
                if (existingSlugs.has(finalSlug) && resolution === 'new') {
                    let counter = 2;
                    while (existingSlugs.has(`${p.slug}-${counter}`)) counter++;
                    finalSlug = `${p.slug}-${counter}`;
                }

                const created = await prisma.virtualPage.create({
                    data: {
                        skinId: targetSkinId,
                        name: p.name,
                        slug: finalSlug,
                        description: p.description || null,
                        source: p.source,
                    },
                });
                existingSlugs.add(finalSlug);
                pageResults.push({ slug: finalSlug, action: 'created', id: created.id });
            }

            return reply.send({ skinId: targetSkinId, skinAction: skinResolution, pages: pageResults });
        },
    );
}
