import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { EmbeddingsRequestSchema } from '@surdej/module-core-openai-shared';

export function registerEmbeddingsRoutes(app: FastifyInstance) {
    app.post('/embeddings', async (req, reply) => {
        const result = EmbeddingsRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { input, model, dimensions } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        try {
            const params: Parameters<typeof openai.embeddings.create>[0] = {
                model,
                input,
            };
            if (dimensions && model !== 'text-embedding-ada-002') {
                params.dimensions = dimensions;
            }

            const response = await openai.embeddings.create(params);

            return reply.status(201).send({
                jobId,
                embeddings: response.data.map(e => ({
                    index: e.index,
                    values: e.embedding,
                })),
                model: response.model,
                usage: {
                    promptTokens: response.usage.prompt_tokens,
                    totalTokens: response.usage.total_tokens,
                },
            });
        } catch (err) {
            return reply.status(500).send({
                error: err instanceof Error ? err.message : 'Unknown error',
                jobId,
            });
        }
    });
}
