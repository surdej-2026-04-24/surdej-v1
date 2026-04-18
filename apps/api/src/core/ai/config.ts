/**
 * AI Configuration Service
 *
 * Manages provider setup and model routing:
 *   - Azure OpenAI (primary, via @ai-sdk/azure)
 *   - OpenAI (fallback, via @ai-sdk/openai)
 *
 * Model tiers:
 *   - low:       gpt-4o-mini    (fast, cheap — summaries, classification)
 *   - medium:    gpt-5.2-chat   (default — chat, analysis, document processing)
 *   - high:      gpt-5.4-pro    (premium — complex analysis, long-form writing)
 *   - reasoning: o3             (complex tasks, planning, multi-step reasoning)
 *
 * @module ai/config
 */

import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

// ─── Types ─────────────────────────────────────────────────────

export type ModelTier = 'low' | 'medium' | 'high' | 'reasoning';

export interface AiProviderConfig {
    provider: 'azure' | 'openai';
    models: Record<ModelTier, string>;
    apiKey?: string;
    endpoint?: string;
    apiVersion?: string;
}

export interface ModelInfo {
    id: string;
    tier: ModelTier;
    provider: string;
    maxTokens: number;
    supportsStreaming: boolean;
    supportsTools: boolean;
}

// ─── Configuration ─────────────────────────────────────────────

function getConfig(): AiProviderConfig {
    const provider = (process.env['AI_PROVIDER'] ?? 'azure') as 'azure' | 'openai';

    if (provider === 'azure') {
        return {
            provider: 'azure',
            models: {
                low: process.env['AZURE_OPENAI_MODEL_LOW'] ?? 'gpt-4o',
                medium: process.env['AZURE_OPENAI_MODEL_MEDIUM'] ?? 'gpt-5.2-chat',
                high: process.env['AZURE_OPENAI_MODEL_HIGH'] ?? 'gpt-5.4-pro',
                reasoning: process.env['AZURE_OPENAI_MODEL_REASONING'] ?? 'o3',
            },
            apiKey: process.env['AZURE_OPENAI_API_KEY'],
            endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
            apiVersion: process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-08-01-preview',
        };
    }

    return {
        provider: 'openai',
        models: {
            low: process.env['OPENAI_MODEL_LOW'] ?? 'gpt-4o-mini',
            medium: process.env['OPENAI_MODEL_MEDIUM'] ?? 'gpt-5.2-chat',
            high: process.env['OPENAI_MODEL_HIGH'] ?? 'gpt-5.4-pro',
            reasoning: process.env['OPENAI_MODEL_REASONING'] ?? 'o3',
        },
        apiKey: process.env['OPENAI_API_KEY'],
    };
}

// ─── Provider Factory ──────────────────────────────────────────

let _azureProvider: ReturnType<typeof createAzure> | null = null;
let _azureResponsesProvider: ReturnType<typeof createAzure> | null = null;
let _openaiProvider: ReturnType<typeof createOpenAI> | null = null;

// Models that only support the Responses API (not Chat Completions)
const RESPONSES_API_MODELS = new Set(
    (process.env['AZURE_OPENAI_RESPONSES_API_MODELS'] ?? 'gpt-5.4-pro').split(',').map(s => s.trim()),
);

/**
 * Get the language model for a given tier.
 *
 * @param tier - Model tier (low, medium, high, reasoning)
 * @returns The configured language model
 */
export function getModel(tier: ModelTier = 'medium'): LanguageModel {
    const config = getConfig();
    const modelId = config.models[tier];

    if (config.provider === 'azure') {
        const resourceName = config.endpoint
            ?.replace('https://', '')
            .replace('.openai.azure.com/', '')
            .replace('.openai.azure.com', '');

        // Some newer models (e.g. gpt-5.4-pro) only support the Responses API.
        // Do NOT set apiVersion — the SDK default works; Azure rejects explicit versions on /v1/responses.
        if (RESPONSES_API_MODELS.has(modelId)) {
            if (!_azureResponsesProvider) {
                _azureResponsesProvider = createAzure({
                    resourceName,
                    apiKey: config.apiKey,
                });
            }
            return _azureResponsesProvider.responses(modelId) as LanguageModel;
        }

        if (!_azureProvider) {
            _azureProvider = createAzure({
                resourceName,
                apiKey: config.apiKey,
                apiVersion: config.apiVersion,
                // Use deployment-based URLs (/deployments/{model}/chat/completions)
                // instead of the new /v1/ path which is not yet supported on all Azure resources
                useDeploymentBasedUrls: true,
            });
        }
        return _azureProvider.chat(modelId) as LanguageModel;
    }

    if (!_openaiProvider) {
        _openaiProvider = createOpenAI({
            apiKey: config.apiKey,
        });
    }

    return _openaiProvider(modelId) as LanguageModel;
}

/**
 * Resolve a model ID string to a tier.
 * Accepts both tier names and explicit model IDs.
 */
export function resolveModelTier(modelIdOrTier: string): ModelTier {
    if (['low', 'medium', 'high', 'reasoning'].includes(modelIdOrTier)) {
        return modelIdOrTier as ModelTier;
    }

    // Map common model names to tiers
    if (modelIdOrTier.includes('mini') || modelIdOrTier.includes('nano')) return 'low';
    if (modelIdOrTier.includes('5.4') || modelIdOrTier.includes('pro')) return 'high';
    if (modelIdOrTier.includes('o3') || modelIdOrTier.includes('o1')) return 'reasoning';
    if (modelIdOrTier.includes('codex')) return 'reasoning';
    if (modelIdOrTier.includes('pro') || modelIdOrTier.includes('5.4')) return 'high';
    return 'medium';
}

/**
 * Get available model information.
 */
export function getAvailableModels(): ModelInfo[] {
    const config = getConfig();

    return [
        {
            id: config.models.low,
            tier: 'low',
            provider: config.provider,
            maxTokens: 16384,
            supportsStreaming: true,
            supportsTools: true,
        },
        {
            id: config.models.medium,
            tier: 'medium',
            provider: config.provider,
            maxTokens: 128000,
            supportsStreaming: true,
            supportsTools: true,
        },
        {
            id: config.models.high,
            tier: 'high',
            provider: config.provider,
            maxTokens: 128000,
            supportsStreaming: true,
            supportsTools: true,
        },
        {
            id: config.models.reasoning,
            tier: 'reasoning',
            provider: config.provider,
            maxTokens: 128000,
            supportsStreaming: false,
            supportsTools: false,
        },
    ];
}

/**
 * Check if AI is configured (has API key).
 */
export function isAiConfigured(): boolean {
    const config = getConfig();
    return !!config.apiKey;
}

/**
 * Get the current provider name.
 */
export function getProviderName(): string {
    return getConfig().provider;
}
