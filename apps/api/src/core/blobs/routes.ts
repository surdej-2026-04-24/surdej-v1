import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { uploadBlob, getBlob, getBlobByKey } from './service.js';
import { prisma } from '../../db.js';

export async function blobsRoutes(app: FastifyInstance) {
    // Register multipart support
    app.register(multipart, {
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB
        },
    });

    /**
     * GET /lookup?filename=...
     * Look up a blob by filename (for resolving chat references).
     */
    app.get('/lookup', async (req, reply) => {
        const { filename } = req.query as { filename?: string };
        if (!filename) return reply.status(400).send({ error: 'filename required' });

        const tenantId = req.acl?.tenantId;
        const blob = await prisma.blob.findFirst({
            where: {
                filename: { equals: filename, mode: 'insensitive' },
                ...(tenantId ? { tenantId } : {}),
                deletedAt: null,
            },
            select: { id: true, filename: true, mimeType: true },
            orderBy: { createdAt: 'desc' },
        });

        if (!blob) return reply.status(404).send({ error: 'Not found' });
        return reply.send(blob);
    });


    /**
     * POST /
     * Upload a file.
     */
    app.post('/', async (req, reply) => {
        const file = await req.file();
        if (!file) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        try {
            const buf = await file.toBuffer();
            // Get user context
            const userId = req.acl?.userId;
            const tenantId = req.acl?.tenantId;

            console.log('[Blob Upload] ACL Context:', req.acl);

            if (!tenantId) {
                return reply.status(400).send({ error: 'Upload failed: Missing tenant context (req.acl.tenantId is null or undefined).' });
            }

            const blob = await uploadBlob(buf, {
                filename: file.filename,
                mimeType: file.mimetype,
                sizeBytes: buf.length,
                tenantId,
                userId,
            });

            return reply.send(blob);
        } catch (err) {
            console.error('Blob upload failed:', err);
            return reply.status(500).send({ error: 'Upload failed' });
        }
    });

    /**
     * GET /:id
     * Stream a blob.
     */
    app.get('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const query = req.query as { download?: string };

        const result = await getBlob(id);

        if (!result) {
            return reply.status(404).send({ error: 'Not found' });
        }

        reply.type(result.contentType || 'application/octet-stream');
        if (result.contentLength) {
            reply.header('Content-Length', result.contentLength);
        }

        if (query.download === '1' || query.download === 'true') {
            reply.header('Content-Disposition', `attachment; filename="${result.blob.filename}"`);
        }

        // Cache control
        reply.header('Cache-Control', 'public, max-age=31536000'); // 1 year cache

        return reply.send(result.stream);
    });

    /**
     * GET /:id/status
     * Get blob processing status from BlobActionLog + metadata.
     */
    app.get('/:id/status', async (req, reply) => {
        const { id } = req.params as { id: string };
        const blob = await prisma.blob.findUnique({
            where: { id },
            select: { metadata: true, mimeType: true }
        });
        if (!blob) return reply.status(404).send({ error: 'Not found' });

        // Types that don't need async processing are always 'completed'
        const needsProcessing = blob.mimeType === 'application/pdf'
            || blob.mimeType.includes('msword')
            || blob.mimeType.includes('officedocument')
            || blob.mimeType.includes('excel')
            || blob.mimeType.includes('powerpoint');

        if (!needsProcessing) {
            return reply.send({ status: 'completed' });
        }

        // Check BlobActionLog for the latest terminal action
        const latestAction = await prisma.blobActionLog.findFirst({
            where: {
                blobId: id,
                action: { in: ['extract-done', 'extract-failed', 'analyze-done', 'analyze-failed'] },
            },
            orderBy: { createdAt: 'desc' },
            select: { action: true, status: true },
        });

        if (latestAction) {
            const failed = latestAction.action.endsWith('-failed') || latestAction.status === 'error';
            return reply.send({ status: failed ? 'failed' : 'completed' });
        }

        // Fall back to metadata.status (set by workers before BlobActionLog is written)
        const meta = blob.metadata as any;
        if (meta?.status === 'completed' || meta?.status === 'failed') {
            return reply.send({ status: meta.status });
        }

        return reply.send({ status: 'processing' });
    });

    /**
     * GET /storage/*
     * Stream a blob by its storage key (path-based, no DB lookup).
     * Used for serving avatars and other known-path objects.
     * Example: GET /api/blobs/storage/avatars/partners/nicholas-thuroe.jpg
     */
    app.get('/storage/*', async (req, reply) => {
        const key = (req.params as Record<string, string>)['*'];
        if (!key) return reply.status(400).send({ error: 'Missing key' });

        const result = await getBlobByKey(key);
        if (!result) return reply.status(404).send({ error: 'Not found' });

        reply.type(result.contentType || 'application/octet-stream');
        if (result.contentLength) {
            reply.header('Content-Length', result.contentLength);
        }
        reply.header('Cache-Control', 'public, max-age=31536000');
        return reply.send(result.stream);
    });
}
