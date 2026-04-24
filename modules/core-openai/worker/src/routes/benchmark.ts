import type { FastifyInstance } from 'fastify';
import { getOpenAIClient } from '../openai-client.js';
import { BenchmarkRequestSchema, type BenchmarkResult } from '@surdej/module-core-openai-shared';

export function registerBenchmarkRoutes(app: FastifyInstance) {
    app.post('/benchmark', async (req, reply) => {
        const result = BenchmarkRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { prompt, models, maxTokens, temperature, runs } = result.data;
        const jobId = crypto.randomUUID();
        const openai = getOpenAIClient();

        const results: BenchmarkResult[] = [];

        for (const model of models) {
            const runResults: BenchmarkResult[] = [];

            for (let run = 0; run < runs; run++) {
                const startTime = performance.now();
                try {
                    const response = await openai.chat.completions.create({
                        model,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: maxTokens,
                        temperature,
                    });

                    const latencyMs = Math.round(performance.now() - startTime);
                    const content = response.choices[0]?.message?.content ?? '';
                    const usage = response.usage;

                    runResults.push({
                        model,
                        response: content,
                        latencyMs,
                        tokensUsed: usage ? {
                            promptTokens: usage.prompt_tokens,
                            completionTokens: usage.completion_tokens,
                            totalTokens: usage.total_tokens,
                        } : undefined,
                        estimatedCost: usage ? estimateCost(model, usage.prompt_tokens, usage.completion_tokens) : undefined,
                    });
                } catch (err) {
                    runResults.push({
                        model,
                        response: '',
                        latencyMs: Math.round(performance.now() - startTime),
                        error: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            }

            // Average latency across runs, keep last response
            if (runs > 1 && runResults.length > 0) {
                const avgLatency = Math.round(runResults.reduce((s, r) => s + r.latencyMs, 0) / runResults.length);
                const last = runResults[runResults.length - 1]!;
                results.push({ ...last, latencyMs: avgLatency });
            } else {
                results.push(...runResults);
            }
        }

        return reply.status(201).send({
            jobId,
            prompt,
            results,
            timestamp: new Date().toISOString(),
        });
    });
}

// Rough cost estimates per 1k tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4.1': { input: 0.002, output: 0.008 },
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
    'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
    'o3': { input: 0.01, output: 0.04 },
    'o4-mini': { input: 0.0011, output: 0.0044 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}
