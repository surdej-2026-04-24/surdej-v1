import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../node_modules/.prisma/mental-klarhed-client/index.js';

const prisma = new PrismaClient();

export function registerAuthRoutes(app: FastifyInstance) {
    // GET /k/:token — magic-link entry point
    // Rate-limited to prevent brute-force
    app.get<{ Params: { token: string } }>(
        '/k/:token',
        {
            config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
        },
        async (req, reply) => {
            const link = await prisma.magicLink.findUnique({
                where: { token: req.params.token },
                include: { client: true },
            });

            if (!link) return reply.status(404).send({ error: 'Link not found' });
            if (link.usedAt) return reply.status(410).send({ error: 'Link already used' });
            if (link.expiresAt < new Date()) return reply.status(410).send({ error: 'Link expired' });
            if (link.client.deletedAt) return reply.status(410).send({ error: 'Account deleted' });

            // Mark as used
            await prisma.magicLink.update({
                where: { id: link.id },
                data: { usedAt: new Date() },
            });

            // Issue signed JWT cookie (24h)
            const token = await reply.jwtSign(
                { clientId: link.clientId, purpose: link.purpose, sessionId: link.sessionId },
                { expiresIn: '24h' }
            );

            reply.setCookie('mk_session', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/',
                maxAge: 86_400, // 24 hours
            });

            // Redirect to client portal
            const redirectPath = link.purpose === 'assessment' && link.sessionId
                ? `/mental-klarhed/assessment/${link.sessionId}`
                : '/mental-klarhed/portal';

            return reply.redirect(redirectPath, 302);
        }
    );
}
