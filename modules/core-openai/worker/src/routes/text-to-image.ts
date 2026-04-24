import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import {
    TextToImageRequestSchema,
    type AiJob,
} from '@surdej/module-core-openai-shared';

const store = new Map<string, AiJob>();
export { store as textToImageStore };

export function registerTextToImageRoutes(app: FastifyInstance) {
    app.post('/text-to-image', async (req, reply) => {
        const result = TextToImageRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { prompt, model, size, quality, n } = result.data;
        const jobId = crypto.randomUUID();
        const now = new Date().toISOString();

        const job: AiJob = {
            id: jobId,
            type: 'text-to-image',
            status: 'processing',
            prompt,
            model,
            createdAt: now,
            updatedAt: now,
        };
        store.set(jobId, job);

        try {
            const openai = getOpenAIClient();
            const response = await openai.images.generate({
                model,
                prompt,
                size: size as 'auto' | '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024',
                quality: quality as 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd',
                n,
            });

            const images = response.data.map(img => ({
                url: img.url,
                b64_json: img.b64_json,
                revised_prompt: img.revised_prompt,
            }));

            job.status = 'completed';
            job.resultUrl = images[0]?.url;
            job.result = JSON.stringify(images);
            job.updatedAt = new Date().toISOString();

            return reply.status(201).send({ jobId, images });
        } catch (err) {
            job.status = 'failed';
            job.error = err instanceof Error ? err.message : 'Unknown error';
            job.updatedAt = new Date().toISOString();
            return reply.status(500).send({ error: job.error, jobId });
        }
    });
}
