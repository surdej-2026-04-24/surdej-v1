import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../node_modules/.prisma/mental-klarhed-client/index.js';

const prisma = new PrismaClient();

export function registerMaterialRoutes(app: FastifyInstance) {
    // GET /client/materials/:sessionId
    app.get<{ Params: { sessionId: string } }>(
        '/client/materials/:sessionId',
        async (req, reply) => {
            let clientId: string;
            try {
                const payload = req.user as { clientId: string } | undefined;
                if (!payload?.clientId) throw new Error();
                clientId = payload.clientId;
            } catch {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const material = await prisma.preSessionMaterial.findFirst({
                where: {
                    sessionId: req.params.sessionId,
                    session: { programme: { clientId } },
                },
            });

            if (!material) return reply.status(404).send({ error: 'Not found' });

            return {
                id: material.id,
                sessionId: material.sessionId,
                pdfUrl: material.pdfUrl,
                generatedAt: material.generatedAt.toISOString(),
                sentAt: material.sentAt?.toISOString() ?? null,
            };
        }
    );
}
