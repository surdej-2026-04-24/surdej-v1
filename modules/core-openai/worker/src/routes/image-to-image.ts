import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import {
    ImageToImageRequestSchema,
    type AiJob,
} from '@surdej/module-core-openai-shared';

const store = new Map<string, AiJob>();
export { store as imageToImageStore };

export function registerImageToImageRoutes(app: FastifyInstance) {
    app.post('/image-to-image', async (req, reply) => {
        const result = ImageToImageRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { imageUrl, imageBase64, prompt, model, size, n } = result.data;
        const jobId = crypto.randomUUID();
        const now = new Date().toISOString();

        const job: AiJob = {
            id: jobId,
            type: 'image-to-image',
            status: 'processing',
            prompt,
            inputUrl: imageUrl,
            model,
            createdAt: now,
            updatedAt: now,
        };
        store.set(jobId, job);

        try {
            const openai = getOpenAIClient();

            // Fetch image as file-like for the edit API
            let imageInput: string;
            if (imageUrl) {
                imageInput = imageUrl;
            } else {
                imageInput = `data:image/png;base64,${imageBase64}`;
            }

            const response = await openai.images.edit({
                model,
                image: imageInput,
                prompt,
                size: size as '256x256' | '512x512' | '1024x1024',
                n,
            });

            const images = response.data.map(img => ({
                url: img.url,
                b64_json: img.b64_json,
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
