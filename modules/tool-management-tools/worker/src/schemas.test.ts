/**
 * Tests: Shared Zod Schemas
 *
 * Validates all the Zod schemas used for DTOs across
 * the use case + test case + test runner feature.
 */

import { describe, it, expect } from 'vitest';
import {
    CreateDbUseCaseSchema,
    UpdateDbUseCaseSchema,
    CreateUseCaseVersionSchema,
    CreateUseCaseTestCaseSchema,
    UpdateUseCaseTestCaseSchema,
    RunTestsRequestSchema,
    EvaluationResultSchema,
    TokenUsageSchema,
    UseCaseTestRunSchema,
    MODEL_TIERS,
    BUILT_IN_USE_CASES,
    UseCaseSchema,
    DbUseCaseSchema,
    UseCaseVersionSchema,
    UseCaseTestCaseSchema,
    UseCaseTestAttachmentSchema,
} from '@surdej/module-tool-management-tools-shared';

// ─── Model Tiers ───────────────────────────────────────────────

describe('MODEL_TIERS', () => {
    it('should include low, medium, high, and reasoning', () => {
        expect(MODEL_TIERS).toEqual(['low', 'medium', 'high', 'reasoning']);
    });
});

// ─── Built-in Use Cases ────────────────────────────────────────

describe('BUILT_IN_USE_CASES', () => {
    it('should have 6 built-in use cases', () => {
        expect(BUILT_IN_USE_CASES).toHaveLength(6);
    });

    it('each built-in use case should match UseCaseSchema', () => {
        for (const uc of BUILT_IN_USE_CASES) {
            const result = UseCaseSchema.safeParse(uc);
            expect(result.success).toBe(true);
        }
    });

    it('should contain the expected IDs', () => {
        const ids = BUILT_IN_USE_CASES.map((uc) => uc.id);
        expect(ids).toContain('improve-text');
        expect(ids).toContain('generate-marketing');
        expect(ids).toContain('analyze-document');
        expect(ids).toContain('prospect-lookup');
        expect(ids).toContain('quick-research');
        expect(ids).toContain('general');
    });
});

// ─── CreateDbUseCaseSchema ─────────────────────────────────────

describe('CreateDbUseCaseSchema', () => {
    it('should accept a valid use case', () => {
        const result = CreateDbUseCaseSchema.safeParse({
            slug: 'my-use-case',
            label: 'My Use Case',
            description: 'A test use case',
            icon: 'Sparkles',
        });
        expect(result.success).toBe(true);
    });

    it('should require slug and label', () => {
        const result = CreateDbUseCaseSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('should reject invalid slug format', () => {
        const result = CreateDbUseCaseSchema.safeParse({
            slug: 'Invalid Slug!',
            label: 'Test',
        });
        expect(result.success).toBe(false);
    });

    it('should accept slug with hyphens and numbers', () => {
        const result = CreateDbUseCaseSchema.safeParse({
            slug: 'my-use-case-2',
            label: 'Test',
        });
        expect(result.success).toBe(true);
    });

    it('should reject empty slug', () => {
        const result = CreateDbUseCaseSchema.safeParse({
            slug: '',
            label: 'Test',
        });
        expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
        const result = CreateDbUseCaseSchema.safeParse({
            slug: 'test',
            label: 'Test',
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            isBuiltIn: true,
            isActive: false,
            metadata: { foo: 'bar' },
        });
        expect(result.success).toBe(true);
    });
});

// ─── UpdateDbUseCaseSchema ─────────────────────────────────────

describe('UpdateDbUseCaseSchema', () => {
    it('should accept partial updates', () => {
        const result = UpdateDbUseCaseSchema.safeParse({
            label: 'Updated Label',
        });
        expect(result.success).toBe(true);
    });

    it('should accept empty object (no changes)', () => {
        const result = UpdateDbUseCaseSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should not accept slug (omitted from update schema)', () => {
        const parsed = UpdateDbUseCaseSchema.safeParse({
            slug: 'new-slug',
            label: 'Test',
        });
        // slug should be stripped (omitted), not cause failure
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data).not.toHaveProperty('slug');
        }
    });
});

// ─── CreateUseCaseVersionSchema ────────────────────────────────

describe('CreateUseCaseVersionSchema', () => {
    it('should accept a valid version', () => {
        const result = CreateUseCaseVersionSchema.safeParse({
            promptTemplate: 'You are a helpful assistant.',
            tools: ['web_search'],
            modelTier: 'high',
        });
        expect(result.success).toBe(true);
    });

    it('should require promptTemplate', () => {
        const result = CreateUseCaseVersionSchema.safeParse({
            tools: [],
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty promptTemplate', () => {
        const result = CreateUseCaseVersionSchema.safeParse({
            promptTemplate: '',
        });
        expect(result.success).toBe(false);
    });

    it('should default modelTier to medium', () => {
        const result = CreateUseCaseVersionSchema.safeParse({
            promptTemplate: 'Test prompt',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.modelTier).toBe('medium');
        }
    });

    it('should accept all valid model tiers', () => {
        for (const tier of MODEL_TIERS) {
            const result = CreateUseCaseVersionSchema.safeParse({
                promptTemplate: 'Test',
                modelTier: tier,
            });
            expect(result.success).toBe(true);
        }
    });

    it('should reject invalid model tier', () => {
        const result = CreateUseCaseVersionSchema.safeParse({
            promptTemplate: 'Test',
            modelTier: 'ultra',
        });
        expect(result.success).toBe(false);
    });
});

// ─── CreateUseCaseTestCaseSchema ───────────────────────────────

describe('CreateUseCaseTestCaseSchema', () => {
    it('should accept a valid test case', () => {
        const result = CreateUseCaseTestCaseSchema.safeParse({
            name: 'Test basic response',
            userPrompt: 'What is the capital of Denmark?',
            evaluationPrompt: 'The response must mention Copenhagen.',
        });
        expect(result.success).toBe(true);
    });

    it('should require name, userPrompt, and evaluationPrompt', () => {
        expect(CreateUseCaseTestCaseSchema.safeParse({}).success).toBe(false);
        expect(
            CreateUseCaseTestCaseSchema.safeParse({
                name: 'Test',
            }).success,
        ).toBe(false);
        expect(
            CreateUseCaseTestCaseSchema.safeParse({
                name: 'Test',
                userPrompt: 'Hello',
            }).success,
        ).toBe(false);
    });

    it('should accept optional fields', () => {
        const result = CreateUseCaseTestCaseSchema.safeParse({
            name: 'Test',
            userPrompt: 'Hello',
            evaluationPrompt: 'Must respond',
            expectedBehavior: 'Responds with greeting',
            isActive: false,
            sortOrder: 5,
        });
        expect(result.success).toBe(true);
    });
});

// ─── UpdateUseCaseTestCaseSchema ───────────────────────────────

describe('UpdateUseCaseTestCaseSchema', () => {
    it('should accept partial updates', () => {
        const result = UpdateUseCaseTestCaseSchema.safeParse({
            name: 'Updated name',
        });
        expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
        const result = UpdateUseCaseTestCaseSchema.safeParse({});
        expect(result.success).toBe(true);
    });
});

// ─── EvaluationResultSchema ────────────────────────────────────

describe('EvaluationResultSchema', () => {
    it('should accept a passing result', () => {
        const result = EvaluationResultSchema.safeParse({
            passed: true,
            score: 0.95,
            reasoning: 'The response correctly identifies the capital.',
        });
        expect(result.success).toBe(true);
    });

    it('should accept a failing result', () => {
        const result = EvaluationResultSchema.safeParse({
            passed: false,
            score: 0.2,
            reasoning: 'The response was in the wrong language.',
        });
        expect(result.success).toBe(true);
    });

    it('should require passed and reasoning', () => {
        expect(EvaluationResultSchema.safeParse({}).success).toBe(false);
        expect(EvaluationResultSchema.safeParse({ passed: true }).success).toBe(false);
    });

    it('should accept result without score (optional)', () => {
        const result = EvaluationResultSchema.safeParse({
            passed: true,
            reasoning: 'Looks good',
        });
        expect(result.success).toBe(true);
    });

    it('should reject score outside 0-1 range', () => {
        expect(
            EvaluationResultSchema.safeParse({
                passed: true,
                score: 1.5,
                reasoning: 'test',
            }).success,
        ).toBe(false);
        expect(
            EvaluationResultSchema.safeParse({
                passed: true,
                score: -0.1,
                reasoning: 'test',
            }).success,
        ).toBe(false);
    });
});

// ─── TokenUsageSchema ──────────────────────────────────────────

describe('TokenUsageSchema', () => {
    it('should accept valid token usage', () => {
        const result = TokenUsageSchema.safeParse({
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
        });
        expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
        expect(
            TokenUsageSchema.safeParse({
                promptTokens: -1,
                completionTokens: 50,
                totalTokens: 50,
            }).success,
        ).toBe(false);
    });

    it('should require all three fields', () => {
        expect(TokenUsageSchema.safeParse({ promptTokens: 10 }).success).toBe(false);
    });
});

// ─── RunTestsRequestSchema ─────────────────────────────────────

describe('RunTestsRequestSchema', () => {
    it('should accept a valid run request', () => {
        const result = RunTestsRequestSchema.safeParse({
            versionId: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result.success).toBe(true);
    });

    it('should require versionId', () => {
        const result = RunTestsRequestSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('should accept optional testCaseIds', () => {
        const result = RunTestsRequestSchema.safeParse({
            versionId: '550e8400-e29b-41d4-a716-446655440000',
            testCaseIds: [
                '550e8400-e29b-41d4-a716-446655440001',
                '550e8400-e29b-41d4-a716-446655440002',
            ],
        });
        expect(result.success).toBe(true);
    });

    it('should accept optional modelTier override', () => {
        const result = RunTestsRequestSchema.safeParse({
            versionId: '550e8400-e29b-41d4-a716-446655440000',
            modelTier: 'high',
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid modelTier', () => {
        const result = RunTestsRequestSchema.safeParse({
            versionId: '550e8400-e29b-41d4-a716-446655440000',
            modelTier: 'super',
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-UUID versionId', () => {
        const result = RunTestsRequestSchema.safeParse({
            versionId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
    });
});

// ─── DbUseCaseSchema ──────────────────────────────────────────

describe('DbUseCaseSchema', () => {
    it('should accept a full DB use case record', () => {
        const result = DbUseCaseSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            tenantId: null,
            slug: 'test-case',
            label: 'Test Case',
            description: 'A test',
            icon: 'Sparkles',
            isBuiltIn: true,
            isActive: true,
            metadata: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            deletedAt: null,
        });
        expect(result.success).toBe(true);
    });
});

// ─── UseCaseVersionSchema ──────────────────────────────────────

describe('UseCaseVersionSchema', () => {
    it('should accept a valid version record', () => {
        const result = UseCaseVersionSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            useCaseId: '550e8400-e29b-41d4-a716-446655440001',
            version: 1,
            promptTemplate: 'You are a helpful assistant.',
            tools: ['web_search'],
            modelTier: 'high',
            changelog: 'Initial version',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('should reject version 0 or negative', () => {
        const result = UseCaseVersionSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            useCaseId: '550e8400-e29b-41d4-a716-446655440001',
            version: 0,
            promptTemplate: 'test',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(false);
    });
});

// ─── UseCaseTestCaseSchema ─────────────────────────────────────

describe('UseCaseTestCaseSchema', () => {
    it('should accept a valid test case record', () => {
        const result = UseCaseTestCaseSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            useCaseId: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Test basic',
            userPrompt: 'Hello',
            evaluationPrompt: 'Must greet back',
            expectedBehavior: null,
            isActive: true,
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });
});

// ─── UseCaseTestAttachmentSchema ───────────────────────────────

describe('UseCaseTestAttachmentSchema', () => {
    it('should accept a valid attachment metadata', () => {
        const result = UseCaseTestAttachmentSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            testCaseId: '550e8400-e29b-41d4-a716-446655440001',
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('should reject zero or negative sizeBytes', () => {
        const result = UseCaseTestAttachmentSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            testCaseId: '550e8400-e29b-41d4-a716-446655440001',
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(false);
    });
});

// ─── UseCaseTestRunSchema ──────────────────────────────────────

describe('UseCaseTestRunSchema', () => {
    it('should accept a passed test run', () => {
        const result = UseCaseTestRunSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            testCaseId: '550e8400-e29b-41d4-a716-446655440001',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            status: 'passed',
            modelTier: 'high',
            aiResponse: 'København is the capital.',
            evaluationResult: {
                passed: true,
                score: 1.0,
                reasoning: 'Correct answer.',
            },
            durationMs: 1200,
            tokenUsage: {
                promptTokens: 100,
                completionTokens: 20,
                totalTokens: 120,
            },
            error: null,
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('should accept an error test run', () => {
        const result = UseCaseTestRunSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            testCaseId: '550e8400-e29b-41d4-a716-446655440001',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            status: 'error',
            modelTier: 'medium',
            aiResponse: null,
            evaluationResult: null,
            durationMs: null,
            tokenUsage: null,
            error: 'API rate limit exceeded',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
        const result = UseCaseTestRunSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            testCaseId: '550e8400-e29b-41d4-a716-446655440001',
            versionId: '550e8400-e29b-41d4-a716-446655440002',
            status: 'unknown',
            modelTier: 'medium',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(false);
    });
});
