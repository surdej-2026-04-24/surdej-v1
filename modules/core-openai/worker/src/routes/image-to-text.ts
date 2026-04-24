import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import {
    ImageToTextRequestSchema,
    type AiJob,
} from '@surdej/module-core-openai-shared';

const store = new Map<string, AiJob>();
export { store as imageToTextStore };

export function registerImageToTextRoutes(app: FastifyInstance) {
    app.post('/image-to-text', async (req, reply) => {
        const result = ImageToTextRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { imageUrl, imageBase64, imageMimeType, prompt, model, maxTokens } = result.data;
        const jobId = crypto.randomUUID();
        const now = new Date().toISOString();

        const job: AiJob = {
            id: jobId,
            type: 'image-to-text',
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

            const imageContent: { type: 'image_url'; image_url: { url: string; detail: 'auto' } } = {
                type: 'image_url',
                image_url: {
                    url: imageUrl ?? `data:${imageMimeType ?? 'image/jpeg'};base64,${imageBase64}`,
                    detail: 'auto',
                },
            };

            const response = await openai.chat.completions.create({
                model,
                max_tokens: maxTokens,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            imageContent,
                        ],
                    },
                ],
            });

            const description = response.choices[0]?.message?.content ?? '';
            const usage = response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            } : undefined;

            job.status = 'completed';
            job.result = description;
            job.updatedAt = new Date().toISOString();

            return reply.status(201).send({
                jobId,
                description,
                model: response.model,
                usage,
            });
        } catch (err) {
            job.status = 'failed';
            job.error = err instanceof Error ? err.message : 'Unknown error';
            job.updatedAt = new Date().toISOString();
            return reply.status(500).send({ error: job.error, jobId });
        }
    });
}
