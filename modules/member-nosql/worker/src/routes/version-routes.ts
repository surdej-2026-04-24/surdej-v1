import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export function registerVersionRoutes(app: FastifyInstance) {

    // GET /documents/:id/versions — list all versions for a document
    app.get<{ Params: { id: string } }>('/documents/:id/versions', async (req, reply) => {
        const doc = await prisma.nosqlDocument.findUnique({
            where: { id: req.params.id },
            select: { id: true, version: true },
        });
        if (!doc) return reply.status(404).send({ error: 'Document not found' });

        const versions = await prisma.nosqlDocumentVersion.findMany({
            where: { documentId: req.params.id },
            orderBy: { version: 'desc' },
        });

        return {
            documentId: req.params.id,
            currentVersion: doc.version,
            versions,
        };
    });

    // GET /documents/:id/versions/:version — get a specific version snapshot
    app.get<{ Params: { id: string; version: string } }>(
        '/documents/:id/versions/:version',
        async (req, reply) => {
            const versionNum = parseInt(req.params.version, 10);
            if (isNaN(versionNum)) return reply.status(400).send({ error: 'Invalid version number' });

            // If requesting the current version, return the live document
            const doc = await prisma.nosqlDocument.findUnique({
                where: { id: req.params.id },
            });
            if (!doc) return reply.status(404).send({ error: 'Document not found' });

            if (versionNum === doc.version) {
                return {
                    id: `${doc.id}-v${doc.version}`,
                    documentId: doc.id,
                    version: doc.version,
                    data: doc.data,
                    createdAt: doc.updatedAt,
                    createdBy: doc.updatedBy,
                    isCurrent: true,
                };
            }

            const snapshot = await prisma.nosqlDocumentVersion.findUnique({
                where: { documentId_version: { documentId: req.params.id, version: versionNum } },
            });
            if (!snapshot) return reply.status(404).send({ error: 'Version not found' });

            return { ...snapshot, isCurrent: false };
        }
    );

    // POST /documents/:id/versions/:version/restore — restore a document to a previous version
    app.post<{ Params: { id: string; version: string } }>(
        '/documents/:id/versions/:version/restore',
        async (req, reply) => {
            const query = req.query as Record<string, string>;
            const userId = query.userId;
            const versionNum = parseInt(req.params.version, 10);
            if (isNaN(versionNum)) return reply.status(400).send({ error: 'Invalid version number' });

            const doc = await prisma.nosqlDocument.findUnique({
                where: { id: req.params.id },
            });
            if (!doc) return reply.status(404).send({ error: 'Document not found' });

            const snapshot = await prisma.nosqlDocumentVersion.findUnique({
                where: { documentId_version: { documentId: req.params.id, version: versionNum } },
            });
            if (!snapshot) return reply.status(404).send({ error: 'Version snapshot not found' });

            // Save current state as a version before restoring
            await prisma.nosqlDocumentVersion.create({
                data: {
                    documentId: doc.id,
                    version: doc.version,
                    data: doc.data as any,
                    createdBy: doc.updatedBy,
                },
            });

            const restored = await prisma.nosqlDocument.update({
                where: { id: req.params.id },
                data: {
                    data: snapshot.data as any,
                    version: { increment: 1 },
                    updatedBy: userId,
                },
            });

            return restored;
        }
    );
}
