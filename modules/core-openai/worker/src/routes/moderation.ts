import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { ModerationRequestSchema } from '@surdej/module-core-openai-shared';

export function registerModerationRoutes(app: FastifyInstance) {
    app.post('/moderation', async (req, reply) => {
        const result = ModerationRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { input, model } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        try {
            const response = await openai.moderations.create({
                model,
                input,
            });

            return reply.status(201).send({
                jobId,
                results: response.results.map(r => ({
                    flagged: r.flagged,
                    categories: r.categories as unknown as Record<string, boolean>,
                    categoryScores: r.category_scores as unknown as Record<string, number>,
                })),
            });
        } catch (err) {
            return reply.status(500).send({
                error: err instanceof Error ? err.message : 'Unknown error',
                jobId,
            });
        }
    });
}
