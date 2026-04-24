import type { FastifyInstance } from 'fastify';
import { getPrisma } from './db.js';
import { streamText, stepCountIs, type CoreMessage } from 'ai';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { buildSessionTools } from './session-tools.js';

const prisma = getPrisma();

function getModel(modelId: string): LanguageModelV1 {
    if (process.env.AI_PROVIDER !== 'azure') {
        return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    }
    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? '').replace(/\/$/, '');
    const apiKey = process.env.AZURE_OPENAI_API_KEY ?? '';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    const isLegacy = endpoint.includes('.openai.azure.com');

    if (isLegacy) {
        const resourceName = endpoint.replace('https://', '').replace(/\.openai\.azure\.com\/?$/, '');
        return createAzure({ resourceName, apiKey, apiVersion }).chat(modelId);
    }
    return createOpenAI({
        baseURL: `${endpoint}/openai/deployments/${modelId}`,
        apiKey,
        headers: { 'api-key': apiKey },
        fetch: (url, init) => {
            const u = new URL(url as string);
            u.searchParams.set('api-version', apiVersion);
            return globalThis.fetch(u.toString(), init);
        },
    }).chat(modelId);
}

// ─── Model tier → model name resolution ─────────────────────────
const MODEL_TIER_MAP: Record<string, string> = {
    low: process.env.AZURE_OPENAI_MODEL_LOW || process.env.AI_MODEL_LOW || 'gpt-4o-mini',
    medium: process.env.AZURE_OPENAI_MODEL_MEDIUM || process.env.AI_MODEL_MEDIUM || process.env.AI_MODEL || 'gpt-4o',
    high: process.env.AZURE_OPENAI_MODEL_HIGH || process.env.AI_MODEL_HIGH || 'gpt-4o',
    reasoning: process.env.AZURE_OPENAI_MODEL_REASONING || process.env.AI_MODEL_REASONING || 'o3-mini',
};

function resolveModel(tier?: string): string {
    return MODEL_TIER_MAP[tier || 'medium'] || MODEL_TIER_MAP.medium;
}

export function registerSessionChatRoutes(app: FastifyInstance) {
    app.post('/sessions/:sessionId/chat', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        const { messages: incomingMessages, pageContext } = req.body as {
            messages: any[];
            pageContext?: { url?: string; title?: string; textContent?: string; selectedText?: string };
        };

        const session = await prisma.workflowSession.findUniqueOrThrow({
            where: { id: sessionId },
            include: {
                useCase: {
                    include: {
                        workflowTasks: { orderBy: { sortOrder: 'asc' } },
                        versions: { orderBy: { version: 'desc' }, take: 1 },
                    },
                },
            },
        });

        const tasks = session.useCase.workflowTasks;
        const currentTask = tasks[session.currentStepIdx];
        if (!currentTask) {
            return reply.status(400).send({ error: 'No active task found for this session.' });
        }

        // Resolve model from the use case version's tier
        const modelTier = session.useCase.versions?.[0]?.modelTier;
        const modelName = resolveModel(modelTier);

        // ─── Build system prompt with schema awareness ─────────────
        const schema = currentTask.dataSchema as any;
        const requiredFields: string[] = schema.required || [];
        const properties: Record<string, any> = schema.properties || {};
        
        const formData = session.formData as Record<string, unknown>;
        
        // Schema instructions — tell the AI what data it needs to collect
        let schemaInstructions = `\n\n## Data Collection Requirements\nYou must gather the following fields for this step:\n`;
        for (const [key, prop] of Object.entries(properties)) {
            const isReq = requiredFields.includes(key);
            const val = formData[key];
            const currentValStr = (val !== undefined && val !== null && val !== '') ? JSON.stringify(val) : 'empty';
            const descStr = prop.description ? ` — ${prop.description}` : '';
            schemaInstructions += `- **${key}** (${prop.type}) [${isReq ? 'REQUIRED' : 'OPTIONAL'}]${descStr} — currently: ${currentValStr}\n`;
        }

        schemaInstructions += `\nWhen you have gathered information for any field, respond with a JSON block exactly like this (alone on its own line):\n\`\`\`json\n{ "_formUpdate": { "fieldName": "collected value" } }\n\`\`\`\n`;

        schemaInstructions += `\nCRITICAL DATA EXTRACTION RULES:\n`;
        schemaInstructions += `- ACTIVELY SCAN every user message for data that matches ANY of the fields above.\n`;
        schemaInstructions += `- If the user pastes web page content, article text, or any unstructured data, EXTRACT relevant information and emit _formUpdate blocks immediately.\n`;
        schemaInstructions += `- You can emit MULTIPLE _formUpdate blocks in a single response for different fields.\n`;
        schemaInstructions += `- When extracting data from pasted content, summarize or clean the value as appropriate for the field type.\n`;
        schemaInstructions += `- Do NOT wait to be asked — proactively extract and update fields whenever you see relevant information.\n`;

        // Add instruction to proactively ask for missing required fields
        const missingRequired = requiredFields.filter(key => {
            const val = formData[key];
            return val === undefined || val === null || val === '';
        });
        if (missingRequired.length > 0) {
            schemaInstructions += `\nIMPORTANT: The following required fields are still empty: ${missingRequired.join(', ')}. Proactively ask for or extract this information.\n`;
        }

        // User hint context — what the user should be doing during this step
        const userHint = (currentTask as any).userHint as string | null;
        let hintContext = '';
        if (userHint) {
            hintContext = `\n\n## Suggested User Action\nThe user has been instructed to: "${userHint}"\nGuide them accordingly and help extract the relevant data from what they share.\n`;
        }

        // Context from previous steps
        let historyContext = `\n\n## Previously Collected Data\n`;
        if (Object.keys(formData).length > 0) {
            historyContext += "```json\n" + JSON.stringify(formData, null, 2) + "\n```\n";
        } else {
            historyContext += "None yet.\n";
        }

        // Step progress context
        const stepContext = `\n\n## Workflow Progress\nYou are on step ${session.currentStepIdx + 1} of ${tasks.length}: "${currentTask.title}".\n`;

        // Context from attachments
        const attachments = await prisma.workflowAttachment.findMany({
            where: {
                useCaseId: session.useCaseId,
                OR: [
                    { taskId: null },
                    { taskId: currentTask.id }
                ]
            }
        });
        
        let attachmentContext = '';
        if (attachments.length > 0) {
            attachmentContext = `\n\n## Reference Documents\nThese files are attached to your context:\n`;
            attachments.forEach(att => {
                attachmentContext += `- ${att.filename} (${att.mimeType}, ${Math.round(att.sizeBytes/1024)}KB)\n`;
            });
        }

        // Page context from the browser extension bridge
        let pageContextBlock = '';
        if (pageContext && (pageContext.url || pageContext.textContent)) {
            pageContextBlock = '\n\n## Current Browser Page Context';
            if (pageContext.url) pageContextBlock += `\nURL: ${pageContext.url}`;
            if (pageContext.title) pageContextBlock += `\nTitle: ${pageContext.title}`;
            if (pageContext.selectedText) pageContextBlock += `\nSelected text: ${pageContext.selectedText}`;
            if (pageContext.textContent) pageContextBlock += `\nPage content (excerpt):\n${pageContext.textContent.slice(0, 8000)}`;
            pageContextBlock += '\n\nUse this page context to extract relevant data for the form fields. If the user asks about the page, refer to this context.';
        }

        const systemMessage = {
            role: 'system',
            content: (currentTask.systemPrompt || '') + stepContext + hintContext + historyContext + attachmentContext + pageContextBlock + schemaInstructions,
        };

        // Include previous messages from this step for conversation continuity
        const previousMessages = await prisma.sessionMessage.findMany({
            where: { sessionId, stepIndex: session.currentStepIdx },
            orderBy: { createdAt: 'asc' },
        });

        const coreMessages: CoreMessage[] = [
            systemMessage,
            ...previousMessages.map((m) => ({ role: m.role as any, content: m.content })),
            ...incomingMessages.map((m: any) => ({ role: m.role as any, content: m.content })),
        ];

        // Save user message to DB
        const lastUserMessage = incomingMessages[incomingMessages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
            await prisma.sessionMessage.create({
                data: {
                    sessionId,
                    stepIndex: session.currentStepIdx,
                    role: 'user',
                    content: lastUserMessage.content,
                },
            });
        }

        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');

        // Build scoped tools for this step
        const allowedTools = (currentTask.allowedTools as string[]) || [];
        const tools = buildSessionTools(allowedTools.length > 0 ? allowedTools : undefined);
        const hasTools = Object.keys(tools).length > 0;

        try {
            const result = await streamText({
                model: getModel(modelName) as any,
                messages: coreMessages,
                ...(hasTools ? {
                    tools,
                    maxSteps: 3,
                } : {}),
                onStepFinish: async ({ toolCalls, toolResults }) => {
                    // Emit tool call events as SSE so the UI can show them
                    if (toolCalls) {
                        for (const tc of toolCalls) {
                            reply.raw.write(`data: ${JSON.stringify({ type: 'tool_call', toolName: tc.toolName, args: tc.args })}\n\n`);
                        }
                    }
                    if (toolResults) {
                        for (const tr of toolResults) {
                            reply.raw.write(`data: ${JSON.stringify({ type: 'tool_result', toolName: tr.toolName, result: typeof tr.result === 'string' ? tr.result.slice(0, 500) : JSON.stringify(tr.result).slice(0, 500) })}\n\n`);
                        }
                    }
                },
            });

            let fullText = '';
            for await (const chunk of result.textStream) {
                fullText += chunk;
                reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
            }

            // Save assistant message to DB
            await prisma.sessionMessage.create({
                data: {
                    sessionId,
                    stepIndex: session.currentStepIdx,
                    role: 'assistant',
                    content: fullText,
                },
            });

            // Parse for _formUpdate and apply — supports multiple updates in one response
            const formUpdateRegex = /```json\s*\{[\s]*"_formUpdate"[\s]*:[\s]*(\{[^}]+\})\s*\}\s*```/g;
            let match;
            let mergedUpdates: Record<string, unknown> = {};
            while ((match = formUpdateRegex.exec(fullText)) !== null) {
                try {
                    const updates = JSON.parse(match[1]);
                    mergedUpdates = { ...mergedUpdates, ...updates };
                } catch (err) {
                    console.error('Failed to parse formUpdate block', err);
                }
            }

            // Also try the non-fenced format as fallback
            if (Object.keys(mergedUpdates).length === 0) {
                const plainMatch = fullText.match(/\{[\s]*"_formUpdate"[\s]*:[\s]*(\{[^}]+\})\s*\}/);
                if (plainMatch) {
                    try {
                        const updates = JSON.parse(plainMatch[1]);
                        mergedUpdates = { ...mergedUpdates, ...updates };
                    } catch (err) {
                        console.error('Failed to parse plain formUpdate', err);
                    }
                }
            }

            if (Object.keys(mergedUpdates).length > 0) {
                const updatedData = { ...formData, ...mergedUpdates };
                await prisma.workflowSession.update({
                    where: { id: sessionId },
                    data: { formData: updatedData as any },
                });
            }

            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
            return reply;
        } catch (error: any) {
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            reply.raw.end();
            return reply;
        }
    });
}
