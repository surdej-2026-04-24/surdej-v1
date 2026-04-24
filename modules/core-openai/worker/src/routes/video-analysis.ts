import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import {
    VideoAnalysisRequestSchema,
    type AiJob,
} from '@surdej/module-core-openai-shared';

const store = new Map<string, AiJob>();
export { store as videoAnalysisStore };

export function registerVideoAnalysisRoutes(app: FastifyInstance) {
    app.post('/video-analysis', async (req, reply) => {
        const result = VideoAnalysisRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { videoUrl, frames, prompt, model, maxTokens } = result.data;
        const jobId = crypto.randomUUID();
        const now = new Date().toISOString();

        const job: AiJob = {
            id: jobId,
            type: 'video-analysis',
            status: 'processing',
            prompt,
            inputUrl: videoUrl,
            model,
            createdAt: now,
            updatedAt: now,
        };
        store.set(jobId, job);

        try {
            const openai = getOpenAIClient();

            // Build content parts: text prompt + frame images
            const contentParts: Array<
                | { type: 'text'; text: string }
                | { type: 'image_url'; image_url: { url: string; detail: 'auto' } }
            > = [
                { type: 'text', text: prompt },
            ];

            if (frames && frames.length > 0) {
                for (const frame of frames) {
                    const url = frame.imageUrl ?? `data:image/png;base64,${frame.imageBase64}`;
                    contentParts.push({
                        type: 'image_url',
                        image_url: { url, detail: 'auto' },
                    });
                    if (frame.timestamp) {
                        contentParts.push({
                            type: 'text',
                            text: `[Timestamp: ${frame.timestamp}]`,
                        });
                    }
                }
            } else if (videoUrl) {
                // If only a URL is given, instruct the model to analyze it
                contentParts.push({
                    type: 'text',
                    text: `Video URL for reference: ${videoUrl}`,
                });
            }

            const response = await openai.chat.completions.create({
                model,
                max_tokens: maxTokens,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a video analysis expert. Analyze the provided video frames and describe what is happening in detail.',
                    },
                    {
                        role: 'user',
                        content: contentParts,
                    },
                ],
            });

            const analysis = response.choices[0]?.message?.content ?? '';
            const usage = response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            } : undefined;

            job.status = 'completed';
            job.result = analysis;
            job.updatedAt = new Date().toISOString();

            return reply.status(201).send({
                jobId,
                analysis,
                model: response.model,
                frameCount: frames?.length,
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
