import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import {
    ChatRequestSchema,
    type AiJob,
} from '@surdej/module-core-openai-shared';

const store = new Map<string, AiJob>();
export { store as chatStore };

export function registerChatRoutes(app: FastifyInstance) {
    app.post('/chat', async (req, reply) => {
        const result = ChatRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { messages, model, maxTokens, temperature, stream } = result.data;
        const jobId = crypto.randomUUID();
        const now = new Date().toISOString();

        const job: AiJob = {
            id: jobId,
            type: 'chat',
            status: 'processing',
            prompt: typeof messages[messages.length - 1]?.content === 'string'
                ? messages[messages.length - 1].content as string
                : undefined,
            model,
            createdAt: now,
            updatedAt: now,
        };
        store.set(jobId, job);

        try {
            const openai = getOpenAIClient();

            if (stream) {
                reply.raw.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });

                const streamResponse = await openai.chat.completions.create({
                    model,
                    messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
                    max_tokens: maxTokens,
                    temperature,
                    stream: true,
                });

                let fullContent = '';
                for await (const chunk of streamResponse) {
                    const delta = chunk.choices[0]?.delta?.content ?? '';
                    fullContent += delta;
                    reply.raw.write(`data: ${JSON.stringify({ content: delta, jobId })}\n\n`);
                }

                job.status = 'completed';
                job.result = fullContent;
                job.updatedAt = new Date().toISOString();

                reply.raw.write(`data: ${JSON.stringify({ done: true, jobId })}\n\n`);
                reply.raw.end();
                return;
            }

            const response = await openai.chat.completions.create({
                model,
                messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
                max_tokens: maxTokens,
                temperature,
            });

            const content = response.choices[0]?.message?.content ?? '';
            const usage = response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            } : undefined;

            job.status = 'completed';
            job.result = content;
            job.updatedAt = new Date().toISOString();

            return reply.status(201).send({
                jobId,
                message: {
                    role: 'assistant' as const,
                    content,
                },
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
