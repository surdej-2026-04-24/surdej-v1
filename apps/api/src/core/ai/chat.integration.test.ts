/**
 * AI Chat Integration Tests
 *
 * These tests hit the real Azure OpenAI API.
 * They require a valid AZURE_OPENAI_API_KEY in .env.
 *
 * Run with: pnpm --filter @surdej/api vitest run src/core/ai/chat.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from the API directory
config({ path: resolve(import.meta.dirname, '../../../.env') });

import {
    isAiConfigured,
    getAvailableModels,
    getProviderName,
    getModel,
} from './config.js';

describe('AI Config', () => {
    it('should detect AI is configured', () => {
        expect(isAiConfigured()).toBe(true);
    });

    it('should use azure provider', () => {
        expect(getProviderName()).toBe('azure');
    });

    it('should return available models', () => {
        const models = getAvailableModels();
        expect(models).toHaveLength(3);
        expect(models[0]!.tier).toBe('low');
        expect(models[1]!.tier).toBe('medium');
        expect(models[2]!.tier).toBe('reasoning');
        expect(models.every((m) => m.provider === 'azure')).toBe(true);
    });

    it('should create a language model', () => {
        const model = getModel('medium');
        expect(model).toBeDefined();
        // The LanguageModel type is a union — check it was created, not the specific shape
        expect(typeof model === 'string' || typeof model === 'object').toBe(true);
    });
});

describe('AI Chat — Live Streaming', () => {
    beforeAll(() => {
        if (!isAiConfigured()) {
            throw new Error(
                'AI is not configured. Set AZURE_OPENAI_API_KEY in apps/api/.env to run integration tests.',
            );
        }
    });

    it(
        'should stream a response from Azure OpenAI',
        async () => {
            const { generateText } = await import('ai');
            const model = getModel('medium');

            const { text, usage } = await generateText({
                model,
                system: 'You are a test assistant. Be very brief.',
                prompt: 'Say hello in exactly 3 words.',
            });

            console.log('[AI Test] Response:', text);
            console.log('[AI Test] Usage:', usage);

            expect(text).toBeTruthy();
            expect(text.length).toBeGreaterThan(0);
            expect(text.split(/\s+/).length).toBeLessThanOrEqual(10); // Should be ~3 words

            // Usage tracking
            expect(usage).toBeDefined();
            expect(usage.inputTokens).toBeGreaterThan(0);
            expect(usage.outputTokens).toBeGreaterThan(0);
        },
        { timeout: 30_000 },
    );

    it(
        'should stream text in chunks',
        async () => {
            const { streamText } = await import('ai');
            const model = getModel('low');

            const result = streamText({
                model,
                system: 'You are a test assistant. Be very brief.',
                prompt: 'Count from 1 to 5, one number per line.',
            });

            const chunks: string[] = [];
            for await (const chunk of result.textStream) {
                chunks.push(chunk);
            }

            const fullText = chunks.join('');
            console.log('[AI Test] Streamed chunks:', chunks.length);
            console.log('[AI Test] Full text:', fullText);

            expect(chunks.length).toBeGreaterThan(0);
            expect(fullText).toContain('1');
            expect(fullText).toContain('5');

            // Usage is available after streaming completes
            const usage = await result.usage;
            expect(usage.inputTokens).toBeGreaterThan(0);
            expect(usage.outputTokens).toBeGreaterThan(0);
        },
        { timeout: 30_000 },
    );
});
