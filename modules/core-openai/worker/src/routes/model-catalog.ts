import type { FastifyInstance } from 'fastify';
import type { ModelInfo } from '@surdej/module-core-openai-shared';

const MODEL_CATALOG: ModelInfo[] = [
    // Chat models
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', category: 'chat', capabilities: ['text', 'vision', 'function-calling', 'json-mode'], maxTokens: 128000, inputCostPer1k: 0.0025, outputCostPer1k: 0.01, deprecated: false },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', category: 'chat', capabilities: ['text', 'vision', 'function-calling', 'json-mode'], maxTokens: 128000, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, deprecated: false },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', category: 'chat', capabilities: ['text', 'vision', 'function-calling', 'json-mode', 'long-context'], maxTokens: 1048576, inputCostPer1k: 0.002, outputCostPer1k: 0.008, deprecated: false },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', category: 'chat', capabilities: ['text', 'vision', 'function-calling', 'json-mode', 'long-context'], maxTokens: 1048576, inputCostPer1k: 0.0004, outputCostPer1k: 0.0016, deprecated: false },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', category: 'chat', capabilities: ['text', 'function-calling', 'json-mode'], maxTokens: 1048576, inputCostPer1k: 0.0001, outputCostPer1k: 0.0004, deprecated: false },

    // Reasoning models
    { id: 'o3', name: 'o3', provider: 'openai', category: 'reasoning', capabilities: ['text', 'vision', 'function-calling', 'reasoning'], maxTokens: 200000, inputCostPer1k: 0.01, outputCostPer1k: 0.04, deprecated: false },
    { id: 'o4-mini', name: 'o4 Mini', provider: 'openai', category: 'reasoning', capabilities: ['text', 'vision', 'function-calling', 'reasoning'], maxTokens: 200000, inputCostPer1k: 0.0011, outputCostPer1k: 0.0044, deprecated: false },

    // Image models
    { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', category: 'image', capabilities: ['text-to-image'], inputCostPer1k: 0.04, outputCostPer1k: 0, deprecated: false },
    { id: 'dall-e-2', name: 'DALL-E 2', provider: 'openai', category: 'image', capabilities: ['text-to-image', 'image-edit'], inputCostPer1k: 0.02, outputCostPer1k: 0, deprecated: false },
    { id: 'gpt-image-1', name: 'GPT Image 1', provider: 'openai', category: 'image', capabilities: ['text-to-image', 'image-edit'], deprecated: false },

    // Audio models
    { id: 'whisper-1', name: 'Whisper', provider: 'openai', category: 'audio', capabilities: ['speech-to-text', 'translation'], inputCostPer1k: 0.006, outputCostPer1k: 0, deprecated: false },
    { id: 'tts-1', name: 'TTS-1', provider: 'openai', category: 'audio', capabilities: ['text-to-speech'], inputCostPer1k: 0.015, outputCostPer1k: 0, deprecated: false },
    { id: 'tts-1-hd', name: 'TTS-1 HD', provider: 'openai', category: 'audio', capabilities: ['text-to-speech', 'high-quality'], inputCostPer1k: 0.03, outputCostPer1k: 0, deprecated: false },

    // Embedding models
    { id: 'text-embedding-3-small', name: 'Embedding 3 Small', provider: 'openai', category: 'embedding', capabilities: ['embeddings'], maxTokens: 8191, inputCostPer1k: 0.00002, outputCostPer1k: 0, deprecated: false },
    { id: 'text-embedding-3-large', name: 'Embedding 3 Large', provider: 'openai', category: 'embedding', capabilities: ['embeddings', 'high-dimensions'], maxTokens: 8191, inputCostPer1k: 0.00013, outputCostPer1k: 0, deprecated: false },
    { id: 'text-embedding-ada-002', name: 'Ada 002 (Legacy)', provider: 'openai', category: 'embedding', capabilities: ['embeddings'], maxTokens: 8191, inputCostPer1k: 0.0001, outputCostPer1k: 0, deprecated: true },

    // Moderation models
    { id: 'omni-moderation-latest', name: 'Omni Moderation', provider: 'openai', category: 'moderation', capabilities: ['text-moderation', 'image-moderation'], deprecated: false },
    { id: 'text-moderation-latest', name: 'Text Moderation', provider: 'openai', category: 'moderation', capabilities: ['text-moderation'], deprecated: false },
];

export function registerModelCatalogRoutes(app: FastifyInstance) {
    app.get('/models', async () => {
        return {
            models: MODEL_CATALOG,
            updatedAt: new Date().toISOString(),
        };
    });

    app.get<{ Params: { modelId: string } }>('/models/:modelId', async (req, reply) => {
        const model = MODEL_CATALOG.find(m => m.id === req.params.modelId);
        if (!model) return reply.status(404).send({ error: 'Model not found' });
        return model;
    });
}
