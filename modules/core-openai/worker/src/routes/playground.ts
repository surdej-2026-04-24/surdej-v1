import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { PlaygroundRequestSchema } from '@surdej/module-core-openai-shared';

export function registerPlaygroundRoutes(app: FastifyInstance) {
    app.post('/playground', async (req, reply) => {
        const result = PlaygroundRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { prompt, systemPrompt, model, maxTokens, temperature, topP, frequencyPenalty, presencePenalty, stop } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        const startTime = performance.now();

        try {
            const messages: { role: 'system' | 'user'; content: string }[] = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            messages.push({ role: 'user', content: prompt });

            const response = await openai.chat.completions.create({
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                frequency_penalty: frequencyPenalty,
                presence_penalty: presencePenalty,
                stop: stop?.length ? stop : undefined,
            });

            const latencyMs = Math.round(performance.now() - startTime);
            const content = response.choices[0]?.message?.content ?? '';
            const usage = response.usage;

            return reply.status(201).send({
                jobId,
                response: content,
                model: response.model,
                latencyMs,
                usage: usage ? {
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                } : undefined,
                finishReason: response.choices[0]?.finish_reason,
            });
        } catch (err) {
            return reply.status(500).send({
                error: err instanceof Error ? err.message : 'Unknown error',
                jobId,
            });
        }
    });
}
