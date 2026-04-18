import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requirePermission } from '../middleware/acl.js';

export async function usersRoutes(app: FastifyInstance) {
    // GET /api/users
    app.get('/', { preHandler: [requirePermission('users', 'read')] }, async (_request, reply) => {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                displayName: true,
                role: true,
                avatarUrl: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        return reply.send(users);
    });

    // GET /api/users/:id
    app.get<{ Params: { id: string } }>('/:id', { preHandler: [requirePermission('users', 'read')] }, async (request, reply) => {
        const { id } = request.params;
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                displayName: true,
                role: true,
                avatarUrl: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        return reply.send(user);
    });
}
