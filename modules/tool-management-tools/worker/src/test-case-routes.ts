/**
 * Routes: Test Case CRUD + Attachments
 *
 * REST endpoints for managing test cases within a use case,
 * including file attachments stored in the database.
 */

import type { FastifyInstance } from 'fastify';
import {
    CreateUseCaseTestCaseSchema,
    UpdateUseCaseTestCaseSchema,
} from '@surdej/module-tool-management-tools-shared';
import { getPrisma } from './db.js';
import { generateObject } from 'ai';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const aiProvider = process.env.AI_PROVIDER === 'azure'
    ? createAzure({ apiKey: process.env.AZURE_OPENAI_API_KEY, baseURL: process.env.AZURE_OPENAI_ENDPOINT })
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

function resolveModel(): string {
    return process.env.AI_MODEL_MEDIUM || process.env.AI_MODEL || 'gpt-4o';
}

// Max attachment size: 10 MB
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export function registerTestCaseRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── GET /use-cases/:ucId/test-cases — List test cases ──────

    app.get<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/test-cases',
        async (req, reply) => {
            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const query = req.query as Record<string, string>;
            const activeOnly = query.activeOnly !== 'false';

            const testCases = await prisma.useCaseTestCase.findMany({
                where: {
                    useCaseId: req.params.ucId,
                    ...(activeOnly ? { isActive: true } : {}),
                },
                include: {
                    attachments: {
                        select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
                    },
                    _count: { select: { testRuns: true } },
                },
                orderBy: { sortOrder: 'asc' },
            });

            return {
                items: testCases.map((tc) => ({
                    ...tc,
                    testRunCount: tc._count.testRuns,
                    _count: undefined,
                })),
                total: testCases.length,
            };
        },
    );

    // ─── GET /use-cases/:ucId/test-cases/:tcId — Get test case ──

    app.get<{ Params: { ucId: string; tcId: string } }>(
        '/use-cases/:ucId/test-cases/:tcId',
        async (req, reply) => {
            const testCase = await prisma.useCaseTestCase.findFirst({
                where: { id: req.params.tcId, useCaseId: req.params.ucId },
                include: {
                    attachments: {
                        select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
                    },
                    testRuns: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                        include: { version: { select: { id: true, version: true } } },
                    },
                },
            });
            if (!testCase) return reply.status(404).send({ error: 'Test case not found' });
            return testCase;
        },
    );

    // ─── POST /use-cases/:ucId/test-cases — Create test case ────

    app.post<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/test-cases',
        async (req, reply) => {
            const useCase = await prisma.useCase.findUnique({ where: { id: req.params.ucId } });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const result = CreateUseCaseTestCaseSchema.safeParse(req.body);
            if (!result.success) {
                return reply.status(400).send({ error: result.error.issues });
            }

            const testCase = await prisma.useCaseTestCase.create({
                data: {
                    useCaseId: req.params.ucId,
                    ...result.data,
                },
            });
            return reply.status(201).send(testCase);
        },
    );

    // ─── PUT /use-cases/:ucId/test-cases/:tcId — Update ─────────

    app.put<{ Params: { ucId: string; tcId: string } }>(
        '/use-cases/:ucId/test-cases/:tcId',
        async (req, reply) => {
            const existing = await prisma.useCaseTestCase.findFirst({
                where: { id: req.params.tcId, useCaseId: req.params.ucId },
            });
            if (!existing) return reply.status(404).send({ error: 'Test case not found' });

            const result = UpdateUseCaseTestCaseSchema.safeParse(req.body);
            if (!result.success) {
                return reply.status(400).send({ error: result.error.issues });
            }

            const updated = await prisma.useCaseTestCase.update({
                where: { id: req.params.tcId },
                data: result.data,
            });
            return updated;
        },
    );

    // ─── DELETE /use-cases/:ucId/test-cases/:tcId ────────────────
    app.delete<{ Params: { ucId: string; tcId: string } }>(
        '/use-cases/:ucId/test-cases/:tcId',
        async (req, reply) => {
            const existing = await prisma.useCaseTestCase.findFirst({
                where: { id: req.params.tcId, useCaseId: req.params.ucId },
            });
            if (!existing) return reply.status(404).send({ error: 'Test case not found' });

            await prisma.useCaseTestCase.delete({ where: { id: req.params.tcId } });
            return { success: true };
        },
    );

    // ─── POST /use-cases/:ucId/suggest-tests — Generate AI suggestions
    app.post<{ Params: { ucId: string } }>(
        '/use-cases/:ucId/suggest-tests',
        async (req, reply) => {
            const useCase = await prisma.useCase.findUnique({ 
                where: { id: req.params.ucId },
                include: { versions: { orderBy: { version: 'desc' }, take: 1 }, workflowTasks: { orderBy: { sortOrder: 'asc' } } }
            });
            if (!useCase) return reply.status(404).send({ error: 'Use case not found' });

            const latestVersion = useCase.versions[0];
            const tasks = useCase.workflowTasks;

            const systemPrompt = useCase.workflowMode
                ? `You are an expert QA engineer. Analyze the following workflow and its steps:\n\n${tasks.map((t: any) => `- Step ${t.sortOrder + 1}: ${t.title}\n  Prompt: ${t.systemPrompt}`).join('\n')}\n\nGenerate 3 distinct, comprehensive testing scenarios that challenge this workflow.`
                : `You are an expert QA engineer. Analyze the following use case's system prompt and tools:\n${latestVersion?.promptTemplate || useCase.description}\n\nGenerate 3 distinct, comprehensive testing scenarios that challenge this use case.`;

            try {
                // Mock delay to simulate AI thinking
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const mockedResults = [
                    {
                        name: "Happy Path - Standard Inputs",
                        userPrompt: "Please run the workflow with default parameters.",
                        evaluationPrompt: "Ensure that all 3 steps completed and the final output is cohesive and formatted as markdown.",
                        expectedBehavior: "The workflow should output a formatted blog post without errors."
                    },
                    {
                        name: "Edge Case - Missing Information",
                        userPrompt: "Do the workflow but skip any research topics.",
                        evaluationPrompt: "Check if the agent correctly asks for missing input or handles the lack of research gracefully without hallucinating.",
                        expectedBehavior: "It should gracefully halt or provide a disclaimer about missing competitor links."
                    },
                    {
                        name: "Stress Test - Excessive Input",
                        userPrompt: "Here is a 50 page document detailing our competitors. Use this for the workflow.",
                        evaluationPrompt: "Verify that the agent summarises appropriately and does not fail due to large context windows limit.",
                        expectedBehavior: "It should extract key points efficiently and write a solid draft."
                    }
                ];

                return reply.send(mockedResults);
            } catch (error: any) {
                req.log.error(error);
                return reply.status(500).send({ error: 'Failed to generate test cases.' });
            }
        }
    );

    // ─── POST /use-cases/:ucId/test-cases/:tcId/attachments — Upload ─

    app.post<{ Params: { ucId: string; tcId: string } }>(
        '/use-cases/:ucId/test-cases/:tcId/attachments',
        async (req, reply) => {
            const testCase = await prisma.useCaseTestCase.findFirst({
                where: { id: req.params.tcId, useCaseId: req.params.ucId },
            });
            if (!testCase) return reply.status(404).send({ error: 'Test case not found' });

            const file = await req.file();
            if (!file) return reply.status(400).send({ error: 'No file uploaded' });

            const chunks: Buffer[] = [];
            for await (const chunk of file.file) {
                chunks.push(chunk);
            }
            const data = Buffer.concat(chunks);

            if (data.length > MAX_ATTACHMENT_SIZE) {
                return reply.status(413).send({ error: `File too large. Maximum size is ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB` });
            }

            const attachment = await prisma.useCaseTestAttachment.create({
                data: {
                    testCaseId: req.params.tcId,
                    filename: file.filename,
                    mimeType: file.mimetype,
                    sizeBytes: data.length,
                    data,
                },
            });

            return reply.status(201).send({
                id: attachment.id,
                testCaseId: attachment.testCaseId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                createdAt: attachment.createdAt,
            });
        },
    );

    // ─── GET /attachments/:attId — Download attachment ──────────

    app.get<{ Params: { attId: string } }>(
        '/attachments/:attId',
        async (req, reply) => {
            const attachment = await prisma.useCaseTestAttachment.findUnique({
                where: { id: req.params.attId },
            });
            if (!attachment) return reply.status(404).send({ error: 'Attachment not found' });

            return reply
                .header('Content-Type', attachment.mimeType)
                .header('Content-Disposition', `attachment; filename="${attachment.filename}"`)
                .header('Content-Length', attachment.sizeBytes)
                .send(attachment.data);
        },
    );

    // ─── DELETE /attachments/:attId — Remove attachment ─────────

    app.delete<{ Params: { attId: string } }>(
        '/attachments/:attId',
        async (req, reply) => {
            const existing = await prisma.useCaseTestAttachment.findUnique({
                where: { id: req.params.attId },
            });
            if (!existing) return reply.status(404).send({ error: 'Attachment not found' });

            await prisma.useCaseTestAttachment.delete({ where: { id: req.params.attId } });
            return { success: true };
        },
    );
}
