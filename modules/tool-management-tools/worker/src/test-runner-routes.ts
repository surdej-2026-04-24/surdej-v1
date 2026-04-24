/**
 * Routes: Test Runner
 *
 * Executes test cases against a use case version by calling the LLM,
 * then evaluates the response with an AI-powered evaluation prompt.
 */

import type { FastifyInstance } from 'fastify';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type LanguageModel } from 'ai';
import {
    RunTestsRequestSchema,
    type EvaluationResult,
    type TokenUsage,
    type ModelTier,
} from '@surdej/module-tool-management-tools-shared';
import { getPrisma } from './db.js';

// ─── Model Resolution ──────────────────────────────────────────

type ModelTierKey = 'low' | 'medium' | 'high' | 'reasoning';

function getModelForTier(tier: ModelTierKey): LanguageModel {
    const provider = (process.env['AI_PROVIDER'] ?? 'azure') as 'azure' | 'openai';

    const azureModels: Record<ModelTierKey, string> = {
        low: process.env['AZURE_OPENAI_MODEL_LOW'] ?? 'gpt-4o-mini',
        medium: process.env['AZURE_OPENAI_MODEL_MEDIUM'] ?? 'gpt-5.2-chat',
        high: process.env['AZURE_OPENAI_MODEL_HIGH'] ?? 'gpt-5.4-pro',
        reasoning: process.env['AZURE_OPENAI_MODEL_REASONING'] ?? 'o3',
    };

    const openaiModels: Record<ModelTierKey, string> = {
        low: process.env['OPENAI_MODEL_LOW'] ?? 'gpt-4o-mini',
        medium: process.env['OPENAI_MODEL_MEDIUM'] ?? 'gpt-5.2-chat',
        high: process.env['OPENAI_MODEL_HIGH'] ?? 'gpt-5.4-pro',
        reasoning: process.env['OPENAI_MODEL_REASONING'] ?? 'o3',
    };

    if (provider === 'azure') {
        const endpoint = process.env['AZURE_OPENAI_ENDPOINT'] ?? '';
        const isLegacy = endpoint.includes('.openai.azure.com');
        const resourceName = isLegacy
            ? endpoint.replace('https://', '').replace(/\.openai\.azure\.com\/?$/, '')
            : undefined;
        const baseURL = !isLegacy && endpoint
            ? `${endpoint.replace(/\/$/, '')}/openai/deployments`
            : undefined;

        const azure = createAzure({
            ...(resourceName ? { resourceName } : { baseURL }),
            apiKey: process.env['AZURE_OPENAI_API_KEY'],
            apiVersion: process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-08-01-preview',
        });
        return azure.chat(azureModels[tier]) as any;
    }

    const openai = createOpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
    return openai(openaiModels[tier]) as any;
}

// ─── Evaluate AI Response ──────────────────────────────────────

async function evaluateResponse(
    aiResponse: string,
    evaluationPrompt: string,
    userPrompt: string,
): Promise<EvaluationResult> {
    const model = getModelForTier('medium');

    const { text } = await generateText({
        model,
        messages: [
            {
                role: 'system',
                content: `You are a strict test evaluator. You will be given:
1. The original user prompt
2. The AI's response
3. Evaluation criteria

Evaluate whether the AI response meets the criteria.
Respond ONLY with valid JSON in this exact format:
{"passed": true/false, "score": 0.0-1.0, "reasoning": "your explanation"}

Be precise and objective.`,
            },
            {
                role: 'user',
                content: `## User Prompt
${userPrompt}

## AI Response
${aiResponse}

## Evaluation Criteria
${evaluationPrompt}`,
            },
        ],
    });

    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in evaluation response');
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            passed: !!parsed.passed,
            score: typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : undefined,
            reasoning: String(parsed.reasoning || 'No reasoning provided'),
        };
    } catch {
        return {
            passed: false,
            score: 0,
            reasoning: `Evaluation parsing failed. Raw evaluation: ${text.slice(0, 500)}`,
        };
    }
}

// ─── Route Registration ────────────────────────────────────────

export function registerTestRunnerRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── POST /use-cases/:ucId/run-tests — Run tests for a version ─

    app.post<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/run-tests',
        async (req, reply) => {
            const result = RunTestsRequestSchema.safeParse(req.body);
            if (!result.success) {
                return reply.status(400).send({ error: result.error.issues });
            }

            const { versionId, testCaseIds, modelTier: overrideTier } = result.data;

            // Validate use case exists
            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            // Validate version exists and belongs to this use case
            const version = await prisma.useCaseVersion.findFirst({
                where: { id: versionId, useCaseId: req.params.ucId },
            });
            if (!version) return reply.status(404).send({ error: 'Version not found for this use case' });

            // Get test cases
            const whereClause = {
                useCaseId: req.params.ucId,
                isActive: true,
                ...(testCaseIds?.length ? { id: { in: testCaseIds } } : {}),
            };
            const testCases = await prisma.useCaseTestCase.findMany({
                where: whereClause,
                include: {
                    attachments: {
                        select: { id: true, filename: true, mimeType: true, sizeBytes: true },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            });

            if (testCases.length === 0) {
                return reply.status(400).send({ error: 'No active test cases found' });
            }

            const tier = (overrideTier ?? version.modelTier ?? 'medium') as ModelTierKey;
            const model = getModelForTier(tier);

            // Run each test case sequentially
            const runs = [];
            let passed = 0;
            let failed = 0;
            let errors = 0;

            for (const tc of testCases) {
                // Create the run record as pending
                let run = await prisma.useCaseTestRun.create({
                    data: {
                        testCaseId: tc.id,
                        versionId: version.id,
                        status: 'running',
                        modelTier: tier,
                    },
                });

                try {
                    const startTime = Date.now();

                    // Build attachment context if any
                    let attachmentContext = '';
                    if (tc.attachments.length > 0) {
                        attachmentContext = `\n\n[Attached files: ${tc.attachments.map((a) => a.filename).join(', ')}]\n`;
                    }

                    // Call the LLM with the use case prompt + user prompt
                    const { text: aiResponse, usage } = await generateText({
                        model,
                        messages: [
                            {
                                role: 'system',
                                content: version.promptTemplate,
                            },
                            {
                                role: 'user',
                                content: `${tc.userPrompt}${attachmentContext}`,
                            },
                        ],
                    });

                    const durationMs = Date.now() - startTime;

                    // Evaluate the response
                    const evalResult = await evaluateResponse(
                        aiResponse,
                        tc.evaluationPrompt,
                        tc.userPrompt,
                    );

                    const tokenUsage: TokenUsage | undefined = usage
                        ? {
                              promptTokens: usage.promptTokens,
                              completionTokens: usage.completionTokens,
                              totalTokens: usage.totalTokens,
                          }
                        : undefined;

                    run = await prisma.useCaseTestRun.update({
                        where: { id: run.id },
                        data: {
                            status: evalResult.passed ? 'passed' : 'failed',
                            aiResponse,
                            evaluationResult: evalResult as object,
                            durationMs,
                            tokenUsage: tokenUsage as object | undefined,
                        },
                    });

                    if (evalResult.passed) passed++;
                    else failed++;
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    run = await prisma.useCaseTestRun.update({
                        where: { id: run.id },
                        data: {
                            status: 'error',
                            error: errorMessage,
                        },
                    });
                    errors++;
                }

                runs.push(run);
            }

            return {
                useCaseId: req.params.ucId,
                versionId: version.id,
                totalTests: testCases.length,
                passed,
                failed,
                errors,
                runs,
            };
        },
    );

    // ─── GET /use-cases/:ucId/test-runs — List recent test runs ─

    app.get<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/test-runs',
        async (req, reply) => {
            const query = req.query as Record<string, string>;
            const versionId = query.versionId;
            const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);

            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const runs = await prisma.useCaseTestRun.findMany({
                where: {
                    testCase: { useCaseId: req.params.ucId },
                    ...(versionId ? { versionId } : {}),
                },
                include: {
                    testCase: { select: { id: true, name: true } },
                    version: { select: { id: true, version: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });

            return { items: runs, total: runs.length };
        },
    );

    // ─── GET /use-cases/:ucId/test-runs/:runId — Single run detail ─

    app.get<{ Params: { ucId: string; runId: string } }>(
        '/use-cases/:ucId/test-runs/:runId',
        async (req, reply) => {
            const run = await prisma.useCaseTestRun.findFirst({
                where: {
                    id: req.params.runId,
                    testCase: { useCaseId: req.params.ucId },
                },
                include: {
                    testCase: true,
                    version: true,
                },
            });
            if (!run) return reply.status(404).send({ error: 'Test run not found' });
            return run;
        },
    );
}
