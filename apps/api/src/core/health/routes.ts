import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
    app.get('/', async (_request, reply) => {
        return reply.send({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
            uptime: process.uptime(),
        });
    });

    app.get('/ready', async (_request, reply) => {
        // TODO: Check database and NATS connectivity
        return reply.send({ ready: true });
    });

    app.get('/live', async (_request, reply) => {
        return reply.send({ live: true });
    });
}
