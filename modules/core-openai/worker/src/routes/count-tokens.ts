import type { FastifyInstance } from 'fastify';
import { TokenCountRequestSchema } from '@surdej/module-core-openai-shared';

// Rough cost estimates per 1k tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4.1': { input: 0.002, output: 0.008 },
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
    'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
    'o3': { input: 0.01, output: 0.04 },
    'o4-mini': { input: 0.0011, output: 0.0044 },
    'dall-e-3': { input: 0.04, output: 0 },
    'whisper-1': { input: 0.006, output: 0 },
    'tts-1': { input: 0.015, output: 0 },
    'tts-1-hd': { input: 0.03, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
};

// Simple token estimator (~4 chars per token for English)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function registerTokenCountRoutes(app: FastifyInstance) {
    app.post('/count-tokens', async (req, reply) => {
        const result = TokenCountRequestSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const { text, model } = result.data;
        const tokenCount = estimateTokens(text);
        const pricing = MODEL_PRICING[model] ?? { input: 0, output: 0 };

        return reply.send({
            tokenCount,
            model,
            estimatedCost: {
                inputCostPer1k: pricing.input,
                outputCostPer1k: pricing.output,
                estimatedInputCost: (tokenCount / 1000) * pricing.input,
            },
        });
    });
}
