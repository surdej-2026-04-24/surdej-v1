/**
 * Knowledge Management API (Phase 6.3)
 *
 * Routes:
 *   GET    /api/knowledge/articles          — list articles (with filters)
 *   GET    /api/knowledge/articles/:id      — article detail + versions
 *   POST   /api/knowledge/articles          — create article
 *   PUT    /api/knowledge/articles/:id      — update article
 *   POST   /api/knowledge/articles/:id/status — transition article status
 *   DELETE /api/knowledge/articles/:id      — delete article
 *
 *   GET    /api/knowledge/templates         — list templates
 *   GET    /api/knowledge/templates/:id     — template detail
 *   POST   /api/knowledge/templates         — create template
 *   PUT    /api/knowledge/templates/:id     — update template
 *   DELETE /api/knowledge/templates/:id     — delete template
 *
 *   GET    /api/knowledge/training          — list training modules
 *   GET    /api/knowledge/training/:id      — training detail + progress
 *   POST   /api/knowledge/training          — create training
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { requirePermission } from '../middleware/acl.js';
import { applyRLS, maskFields } from '../middleware/rls.js';

const prisma = new PrismaClient();

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}

function contentHash(text: string): string {
    return createHash('sha256')
        .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
}

const VALID_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'];
const STATUS_TRANSITIONS: Record<string, string[]> = {
    draft: ['review', 'archived'],
    review: ['draft', 'approved', 'archived'],
    approved: ['published', 'draft'],
    published: ['archived'],
    archived: ['draft'],
};

export async function knowledgeRoutes(app: FastifyInstance) {

    // ─── Articles ──────────────────────────────────────────────

    /**
     * GET /api/knowledge/articles — list with filtering
     */
    app.get('/articles', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const query = req.query as Record<string, string>;
        const status = query['status'];
        const tag = query['tag'];
        const search = query['search'];
        const limit = Math.min(parseInt(query['limit'] ?? '50', 10), 200);
        const offset = parseInt(query['offset'] ?? '0', 10);

        const where: Record<string, unknown> = {};
        if (status && VALID_STATUSES.includes(status)) where['status'] = status;
        if (tag) where['tags'] = { has: tag };
        if (search) {
            where['OR'] = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Apply RLS (team + policies)
        const rlsWhere = await applyRLS('articles', where, req.acl, {
            hasTeamId: true,
            hasTenantId: true,
        });
        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where: rlsWhere,
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    tags: true,
                    authorId: true,
                    templateId: true,
                    createdAt: true,
                    updatedAt: true,
                    publishedAt: true,
                    author: { select: { id: true, displayName: true, email: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.article.count({ where: rlsWhere }),
        ]);

        const masked = await maskFields(articles, 'Article', req.acl) as typeof articles;
        return reply.send({ articles: masked, total, limit, offset });
    });

    /**
     * GET /api/knowledge/articles/:id — detail with versions
     */
    app.get<{ Params: { id: string } }>('/articles/:id', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const article = await prisma.article.findUnique({
            where: { id: req.params.id },
            include: {
                author: { select: { id: true, displayName: true, email: true } },
                template: { select: { id: true, name: true } },
                versions: {
                    orderBy: { version: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        version: true,
                        changeSummary: true,
                        authorId: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!article) return reply.status(404).send({ error: 'Article not found' });
        return reply.send(article);
    });

    /**
     * POST /api/knowledge/articles — create new article
     */
    app.post('/articles', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as {
            title: string;
            content: string;
            authorId: string;
            templateId?: string;
            teamId?: string;
            tags?: string[];
        };

        if (!body.title?.trim()) return reply.status(400).send({ error: 'Title is required' });
        if (!body.authorId) return reply.status(400).send({ error: 'Author ID is required' });

        // Generate unique slug
        let slug = slugify(body.title);
        const existing = await prisma.article.findUnique({ where: { slug } });
        if (existing) slug = `${slug}-${Date.now().toString(36)}`;

        const article = await prisma.article.create({
            data: {
                title: body.title.trim(),
                slug,
                content: body.content ?? '',
                contentHash: body.content ? contentHash(body.content) : null,
                authorId: body.authorId,
                templateId: body.templateId || null,
                tags: body.tags ?? [],
                teamId: body.teamId ?? null,
                status: 'draft',
            },
            include: {
                author: { select: { id: true, displayName: true, email: true } },
            },
        });

        // Create initial version
        await prisma.articleVersion.create({
            data: {
                articleId: article.id,
                version: 1,
                content: body.content ?? '',
                changeSummary: 'Initial creation',
                authorId: body.authorId,
            },
        });

        return reply.status(201).send(article);
    });

    /**
     * PUT /api/knowledge/articles/:id — update content
     */
    app.put<{ Params: { id: string } }>('/articles/:id', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as {
            title?: string;
            content?: string;
            tags?: string[];
            changeSummary?: string;
            authorId: string;
        };

        const existing = await prisma.article.findUnique({
            where: { id: req.params.id },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!existing) return reply.status(404).send({ error: 'Article not found' });
        if (existing.status === 'published') {
            return reply.status(400).send({ error: 'Cannot edit published articles. Archive first.' });
        }

        const updatedData: Record<string, unknown> = { updatedAt: new Date() };
        if (body.title) updatedData['title'] = body.title.trim();
        if (body.content !== undefined) {
            updatedData['content'] = body.content;
            updatedData['contentHash'] = contentHash(body.content);
        }
        if (body.tags) updatedData['tags'] = body.tags;

        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: updatedData,
            include: {
                author: { select: { id: true, displayName: true, email: true } },
            },
        });

        // Create version snapshot
        if (body.content !== undefined) {
            const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
            await prisma.articleVersion.create({
                data: {
                    articleId: article.id,
                    version: nextVersion,
                    content: body.content,
                    changeSummary: body.changeSummary ?? `Version ${nextVersion}`,
                    authorId: body.authorId,
                },
            });
        }

        return reply.send(article);
    });

    /**
     * POST /api/knowledge/articles/:id/status — transition status
     */
    app.post<{ Params: { id: string } }>('/articles/:id/status', { preHandler: [requirePermission('knowledge', 'manage')] }, async (req, reply) => {
        const { status } = req.body as { status: string };

        const article = await prisma.article.findUnique({ where: { id: req.params.id } });
        if (!article) return reply.status(404).send({ error: 'Article not found' });

        const allowed = STATUS_TRANSITIONS[article.status];
        if (!allowed?.includes(status)) {
            return reply.status(400).send({
                error: `Cannot transition from "${article.status}" to "${status}". Allowed: ${allowed?.join(', ') ?? 'none'}.`,
            });
        }

        const updateData: Record<string, unknown> = { status };
        if (status === 'published') updateData['publishedAt'] = new Date();

        const updated = await prisma.article.update({
            where: { id: req.params.id },
            data: updateData,
        });

        return reply.send(updated);
    });

    /**
     * DELETE /api/knowledge/articles/:id
     */
    app.delete<{ Params: { id: string } }>('/articles/:id', { preHandler: [requirePermission('knowledge', 'manage')] }, async (req, reply) => {
        const article = await prisma.article.findUnique({ where: { id: req.params.id } });
        if (!article) return reply.status(404).send({ error: 'Article not found' });
        if (article.status === 'published') {
            return reply.status(400).send({ error: 'Cannot delete published articles. Archive first.' });
        }

        await prisma.article.delete({ where: { id: req.params.id } });
        return reply.send({ success: true });
    });

    // ─── Templates ──────────────────────────────────────────────

    /**
     * GET /api/knowledge/templates
     */
    app.get('/templates', { preHandler: [requirePermission('knowledge', 'read')] }, async (_req, reply) => {
        const templates = await prisma.template.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
        return reply.send(templates);
    });

    /**
     * GET /api/knowledge/templates/:id
     */
    app.get<{ Params: { id: string } }>('/templates/:id', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const template = await prisma.template.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { articles: true } } },
        });
        if (!template) return reply.status(404).send({ error: 'Template not found' });
        return reply.send(template);
    });

    /**
     * POST /api/knowledge/templates
     */
    app.post('/templates', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as { name: string; description?: string; sections: unknown[] };
        if (!body.name?.trim()) return reply.status(400).send({ error: 'Name is required' });
        if (!body.sections?.length) return reply.status(400).send({ error: 'At least one section is required' });

        const template = await prisma.template.create({
            data: {
                name: body.name.trim(),
                description: body.description ?? null,
                sections: body.sections as any,
            },
        });

        return reply.status(201).send(template);
    });

    /**
     * PUT /api/knowledge/templates/:id
     */
    app.put<{ Params: { id: string } }>('/templates/:id', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as { name?: string; description?: string; sections?: unknown[] };

        const template = await prisma.template.findUnique({ where: { id: req.params.id } });
        if (!template) return reply.status(404).send({ error: 'Template not found' });

        const updated = await prisma.template.update({
            where: { id: req.params.id },
            data: {
                ...(body.name ? { name: body.name.trim() } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.sections ? { sections: body.sections as any } : {}),
            },
        });

        return reply.send(updated);
    });

    /**
     * DELETE /api/knowledge/templates/:id
     */
    app.delete<{ Params: { id: string } }>('/templates/:id', { preHandler: [requirePermission('knowledge', 'manage')] }, async (req, reply) => {
        const template = await prisma.template.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { articles: true } } },
        });
        if (!template) return reply.status(404).send({ error: 'Template not found' });
        if (template._count.articles > 0) {
            return reply.status(400).send({ error: `Template is used by ${template._count.articles} articles` });
        }

        await prisma.template.delete({ where: { id: req.params.id } });
        return reply.send({ success: true });
    });

    // ─── Training ──────────────────────────────────────────────

    /**
     * GET /api/knowledge/training
     */
    app.get('/training', { preHandler: [requirePermission('knowledge', 'read')] }, async (_req, reply) => {
        const modules = await prisma.trainingModule.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { progress: true } } },
        });
        return reply.send(modules);
    });

    /**
     * GET /api/knowledge/training/:id
     */
    app.get<{ Params: { id: string } }>('/training/:id', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const module = await prisma.trainingModule.findUnique({
            where: { id: req.params.id },
            include: {
                progress: {
                    include: { user: { select: { id: true, displayName: true, email: true } } },
                    orderBy: { updatedAt: 'desc' },
                },
            },
        });
        if (!module) return reply.status(404).send({ error: 'Training module not found' });
        return reply.send(module);
    });

    /**
     * POST /api/knowledge/training
     */
    app.post('/training', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as {
            title: string;
            description?: string;
            articleId?: string;
            difficulty?: string;
            durationMinutes?: number;
            modules: unknown[];
        };

        if (!body.title?.trim()) return reply.status(400).send({ error: 'Title is required' });
        if (!body.modules?.length) return reply.status(400).send({ error: 'At least one module is required' });

        const module = await prisma.trainingModule.create({
            data: {
                title: body.title.trim(),
                description: body.description ?? null,
                articleId: body.articleId ?? null,
                difficulty: body.difficulty ?? 'beginner',
                durationMinutes: body.durationMinutes ?? 30,
                modules: body.modules as any,
            },
        });

        return reply.status(201).send(module);
    });

    /**
     * PUT /api/knowledge/training/:id — update training module
     */
    app.put<{ Params: { id: string } }>('/training/:id', { preHandler: [requirePermission('knowledge', 'write')] }, async (req, reply) => {
        const body = req.body as {
            title?: string;
            description?: string;
            difficulty?: string;
            durationMinutes?: number;
            modules?: unknown[];
            isPublished?: boolean;
        };

        const existing = await prisma.trainingModule.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Training module not found' });

        const updated = await prisma.trainingModule.update({
            where: { id: req.params.id },
            data: {
                ...(body.title ? { title: body.title.trim() } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.difficulty ? { difficulty: body.difficulty } : {}),
                ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
                ...(body.modules ? { modules: body.modules as any } : {}),
                ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
            },
        });

        return reply.send(updated);
    });

    /**
     * POST /api/knowledge/training/:id/enroll — enroll current user
     */
    app.post<{ Params: { id: string } }>('/training/:id/enroll', async (req, reply) => {
        const module = await prisma.trainingModule.findUnique({ where: { id: req.params.id } });
        if (!module) return reply.status(404).send({ error: 'Training module not found' });

        // Get user from session or use body
        const body = req.body as { userId?: string };
        let userId = body?.userId;

        if (!userId) {
            // Try to get from auth session
            const sessionToken = req.headers.authorization?.replace('Bearer ', '');
            if (sessionToken) {
                const session = await prisma.session.findUnique({
                    where: { token: sessionToken },
                    include: { user: true },
                });
                userId = session?.userId;
            }
        }

        if (!userId) return reply.status(400).send({ error: 'User ID is required' });

        // Upsert — if already enrolled, just return existing
        const progress = await prisma.learnerProgress.upsert({
            where: {
                userId_trainingId: { userId, trainingId: req.params.id },
            },
            create: {
                userId,
                trainingId: req.params.id,
                completedItems: [],
                completionPct: 0,
            },
            update: {},
            include: { user: { select: { id: true, displayName: true, email: true } } },
        });

        return reply.status(201).send(progress);
    });

    /**
     * PUT /api/knowledge/training/:id/progress — update learner progress
     */
    app.put<{ Params: { id: string } }>('/training/:id/progress', async (req, reply) => {
        const body = req.body as {
            userId: string;
            completedItems: string[];
        };

        if (!body.userId) return reply.status(400).send({ error: 'User ID is required' });

        const module = await prisma.trainingModule.findUnique({ where: { id: req.params.id } });
        if (!module) return reply.status(404).send({ error: 'Training module not found' });

        const totalLessons = ((module.modules as unknown[]) ?? []).length;
        const completedCount = (body.completedItems ?? []).length;
        const completionPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
        const isComplete = completionPct >= 100;

        const progress = await prisma.learnerProgress.upsert({
            where: {
                userId_trainingId: { userId: body.userId, trainingId: req.params.id },
            },
            create: {
                userId: body.userId,
                trainingId: req.params.id,
                completedItems: body.completedItems as any,
                completionPct,
                completedAt: isComplete ? new Date() : null,
            },
            update: {
                completedItems: body.completedItems as any,
                completionPct,
                completedAt: isComplete ? new Date() : null,
            },
            include: { user: { select: { id: true, displayName: true, email: true } } },
        });

        return reply.send(progress);
    });

    /**
     * DELETE /api/knowledge/training/:id — delete training module
     */
    app.delete<{ Params: { id: string } }>('/training/:id', { preHandler: [requirePermission('knowledge', 'manage')] }, async (req, reply) => {
        const module = await prisma.trainingModule.findUnique({ where: { id: req.params.id } });
        if (!module) return reply.status(404).send({ error: 'Training module not found' });

        await prisma.trainingModule.delete({ where: { id: req.params.id } });
        return reply.send({ success: true });
    });

    // ═══════════════════════════════════════════════════════════════
    // Documents (Prisma Blob records)
    // ═══════════════════════════════════════════════════════════════

    /**
     * GET /api/knowledge/documents — list all document uploads
     */
    app.get('/documents', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const { category, search } = req.query as { category?: string; search?: string };

        const where: any = {};
        if (search) {
            where.filename = { contains: search, mode: 'insensitive' };
        }
        if (category) {
            where.metadata = { path: ['category'], equals: category };
        }

        const documents = await prisma.blob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return reply.send(documents);
    });

    /**
     * GET /api/knowledge/documents/:id — get a single document
     */
    app.get<{ Params: { id: string } }>('/documents/:id', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const doc = await prisma.blob.findUnique({ where: { id: req.params.id } });
        if (!doc) return reply.status(404).send({ error: 'Document not found' });
        return reply.send(doc);
    });

    /**
     * GET /api/knowledge/documents/:id/content — serve document content
     *
     * If the actual file exists on disk it is streamed back.
     * Otherwise a lightweight preview PDF is generated on-the-fly
     * from the Blob metadata so that seeded documents are viewable.
     */
    app.get<{ Params: { id: string } }>('/documents/:id/content', { preHandler: [requirePermission('knowledge', 'read')] }, async (req, reply) => {
        const doc = await prisma.blob.findUnique({ where: { id: req.params.id } });
        if (!doc) return reply.status(404).send({ error: 'Document not found' });

        // Try to serve the real file first
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
        const fullPath = path.join(DATA_DIR, doc.storagePath);

        try {
            await fs.access(fullPath);
            const content = await fs.readFile(fullPath);
            reply.header('Content-Type', doc.mimeType);
            reply.header('Content-Disposition', `inline; filename="${doc.filename}"`);
            return reply.send(content);
        } catch {
            // File does not exist on disk — generate preview PDF
        }

        // ── Generate a preview PDF from metadata ──────────────
        const meta = (doc.metadata ?? {}) as Record<string, unknown>;
        const pdfBytes = generatePreviewPdf(doc.filename, doc.mimeType, doc.sizeBytes, meta, doc.createdAt);

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${doc.filename}"`);
        return reply.send(Buffer.from(pdfBytes));
    });

    /**
     * DELETE /api/knowledge/documents/:id — delete a document record
     */
    app.delete<{ Params: { id: string } }>('/documents/:id', { preHandler: [requirePermission('knowledge', 'manage')] }, async (req, reply) => {
        const doc = await prisma.blob.findUnique({ where: { id: req.params.id } });
        if (!doc) return reply.status(404).send({ error: 'Document not found' });

        await prisma.blob.delete({ where: { id: req.params.id } });
        return reply.send({ success: true });
    });
}

// ─── Minimal PDF generator (no dependencies) ──────────────────

function generatePreviewPdf(
    filename: string,
    mimeType: string,
    sizeBytes: number,
    metadata: Record<string, unknown>,
    createdAt: Date,
): Uint8Array {
    const formatBytes = (b: number) => {
        if (b === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return `${(b / k ** i).toFixed(1)} ${sizes[i]}`;
    };

    const title = filename.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
    const lines: string[] = [
        title,
        '',
        `Filename:   ${filename}`,
        `Type:       ${mimeType}`,
        `Size:       ${formatBytes(sizeBytes)}`,
        `Created:    ${new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    ];

    if (Object.keys(metadata).length > 0) {
        lines.push('', '--- Metadata ---');
        for (const [k, v] of Object.entries(metadata)) {
            lines.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
        }
    }

    lines.push(
        '',
        '',
        'This is a preview placeholder.',
        'The original file has not been uploaded yet.',
    );

    // Build raw PDF
    const textLines = lines;
    const pageW = 612; // US Letter
    const pageH = 792;
    const margin = 72;
    const lineHeight = 16;

    // Stream operations on text
    let streamContent = '';
    streamContent += 'BT\n';
    streamContent += `/F1 20 Tf\n`;
    streamContent += `${margin} ${pageH - margin} Td\n`;
    // Title line
    streamContent += `(${pdfEscape(textLines[0] ?? '')}) Tj\n`;
    streamContent += `0 -${lineHeight * 2} Td\n`;
    streamContent += `/F1 11 Tf\n`;
    for (let i = 1; i < textLines.length; i++) {
        streamContent += `(${pdfEscape(textLines[i]!)}) Tj\n`;
        streamContent += `0 -${lineHeight} Td\n`;
    }
    streamContent += 'ET\n';

    const objects: string[] = [];
    let objNum = 0;

    const addObj = (content: string) => {
        objNum++;
        objects.push(`${objNum} 0 obj\n${content}\nendobj\n`);
        return objNum;
    };

    // 1. Catalog
    addObj('<< /Type /Catalog /Pages 2 0 R >>');
    // 2. Pages
    addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
    // 3. Page
    addObj(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    );
    // 4. Stream
    const streamBytes = Buffer.from(streamContent, 'latin1');
    addObj(
        `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}endstream`,
    );
    // 5. Font
    addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    // Assemble PDF
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += obj;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objNum + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const off of offsets) {
        pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objNum + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
}

function pdfEscape(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
