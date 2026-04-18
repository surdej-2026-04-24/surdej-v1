/**
 * AI Chat Service
 *
 * Handles streaming AI chat with conversation persistence.
 *   - Uses Vercel AI SDK for streaming
 *   - Persists conversations and messages to Prisma
 *   - Tracks token usage in AiUsageLog
 *   - Auto-generates conversation titles
 *
 * @module ai/chat
 */

import { streamText, generateText, stepCountIs } from 'ai';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { getModel, resolveModelTier, getProviderName } from './config.js';
import { buildMcpTools } from './mcp-tools.js';
import { getBlob, getBlobByKey } from '../blobs/service.js';
import { buildMergedSystemPrompt, type UseCaseContext } from './prompts/builder.js';

const prisma = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────

export interface ChatRequest {
    conversationId?: string;
    message: string;
    model?: string;      // tier name or model ID
    userId: string;
    tenantId?: string;   // Context for billing/usage
    systemPrompt?: string;
    useCaseContext?: UseCaseContext; // Context overrides from prompt builder active Use Case
    enabledTools?: string[];  // Which MCP tools to enable (all if undefined)
    files?: string[];         // Array of blob IDs attached by the user
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// ─── Conversation Management ───────────────────────────────────

/**
 * Get or create a conversation.
 */
export async function getOrCreateConversation(
    conversationId: string | undefined,
    userId: string,
    model: string,
    tenantId?: string,
): Promise<string> {
    if (conversationId) {
        // Verify conversation exists and belongs to user
        const existing = await prisma.aiConversation.findFirst({
            where: { id: conversationId, userId },
        });
        if (existing) return existing.id;
    }

    // Create new conversation
    const conversation = await prisma.aiConversation.create({
        data: {
            userId,
            tenantId,
            model,
            title: null,
        },
    });

    return conversation.id;
}

/**
 * Load conversation history from the database.
 */
export async function loadConversationHistory(
    conversationId: string,
): Promise<ChatMessage[]> {
    const messages = await prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
    }));
}

/**
 * Save a message to the conversation.
 */
export async function saveMessage(
    conversationId: string,
    role: string,
    content: string,
    model?: string,
    tokenCount?: number,
): Promise<string> {
    const message = await prisma.aiMessage.create({
        data: {
            conversationId,
            role,
            content,
            model,
            tokenCount,
        },
    });

    // Update conversation timestamp
    await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return message.id;
}

/**
 * Log AI usage for cost tracking.
 */
export async function logUsage(
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    operation: string = 'chat',
    tenantId?: string,
): Promise<void> {
    const totalTokens = inputTokens + outputTokens;

    // Rough cost estimation (USD per 1K tokens)
    const costPer1kInput: Record<string, number> = {
        'gpt-4o-mini': 0.00015,
        'gpt-4o': 0.0025,
        'o3-mini': 0.0011,
    };
    const costPer1kOutput: Record<string, number> = {
        'gpt-4o-mini': 0.0006,
        'gpt-4o': 0.01,
        'o3-mini': 0.0044,
    };

    const inputCost = (inputTokens / 1000) * (costPer1kInput[model] ?? 0.0025);
    const outputCost = (outputTokens / 1000) * (costPer1kOutput[model] ?? 0.01);

    await prisma.aiUsageLog.create({
        data: {
            userId,
            tenantId,
            model,
            provider: getProviderName(),
            inputTokens,
            outputTokens,
            totalTokens,
            costUsd: inputCost + outputCost,
            operation,
        },
    });
}

/**
 * Auto-generate a title for a conversation from its first few messages.
 */
export async function generateConversationTitle(
    conversationId: string,
): Promise<string> {
    const conversation = await prisma.aiConversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' },
                take: 4,
            },
        },
    });

    if (!conversation) return 'New Chat';
    // Skip if title already exists (not null/empty)
    if (conversation.title && conversation.title.trim().length > 0) return conversation.title;

    // Build context from the first messages
    const context = conversation.messages
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');

    if (!context.trim()) {
        console.warn('[AI] Title generation skipped: no messages yet');
        return 'New Chat';
    }

    try {
        console.log(`[AI] Generating title for conversation ${conversationId} (${conversation.messages.length} messages)`);
        const { text } = await generateText({
            model: getModel('medium'),
            system: 'Generate a very short title (3-6 words) for this conversation. Return only the title, nothing else. No quotes.',
            prompt: context,
        });

        const title = text.trim().replace(/^["']|["']$/g, '');
        console.log(`[AI] Generated title: "${title}" for ${conversationId}`);

        await prisma.aiConversation.update({
            where: { id: conversationId },
            data: { title },
        });

        return title;
    } catch (err) {
        console.error('[AI] Title generation failed:', err);
        return 'New Chat';
    }
}

// ─── RAG Context Retrieval (Vector Semantic Search) ────────────

interface RagResult {
    source: string;
    title: string;
    snippet: string;
    score: number;
}

/**
 * Embed a text query using Azure OpenAI text-embedding-3-large.
 */
async function embedQuery(text: string): Promise<number[] | null> {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    const key = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-08-01-preview';
    if (!endpoint || !key) return null;

    try {
        const url = `${endpoint}openai/deployments/text-embedding-3-large/embeddings?api-version=${apiVersion}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'api-key': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: text, dimensions: 3072 }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { data: { embedding: number[] }[] };
        return data.data[0].embedding;
    } catch {
        return null;
    }
}

/**
 * Retrieve relevant context from documents using pgvector semantic search.
 * Falls back to keyword search if embeddings are unavailable.
 */
async function retrieveRagContext(query: string, tenantId?: string): Promise<RagResult[]> {
    const results: RagResult[] = [];

    // ── 1. Try vector semantic search first ──
    const embedding = await embedQuery(query);
    if (embedding) {
        try {
            const embStr = `[${embedding.join(',')}]`;
            const tenantFilter = tenantId || '';
            const chunks = await prisma.$queryRawUnsafe<{
                content: string; filename: string; similarity: number; chunkIndex: number;
            }[]>(`
                SELECT dc.content, b.filename,
                       1 - (dc.embedding <=> $1::vector) AS similarity,
                       dc."chunkIndex"
                FROM "DocumentChunk" dc
                JOIN "Blob" b ON b.id = dc."blobId"
                WHERE ($2 = '' OR dc."tenantId" = $2)
                  AND dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> $1::vector
                LIMIT 8
            `, embStr, tenantFilter);

            for (const chunk of chunks) {
                results.push({
                    source: 'document',
                    title: `${chunk.filename} (del ${chunk.chunkIndex + 1})`,
                    snippet: chunk.content.slice(0, 600),
                    score: Number(chunk.similarity),
                });
            }

            if (results.length > 0) {
                console.log(`[RAG] Vector search: ${results.length} chunks, top similarity: ${(results[0].score * 100).toFixed(1)}%`);
            }
        } catch (err) {
            console.warn('[RAG] Vector search failed, falling back to keyword:', err);
        }
    }

    // ── 2. Fallback to keyword search if vector search returned nothing ──
    if (results.length === 0) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            try {
                const chunks = await prisma.documentChunk.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        OR: words.map(w => ({ content: { contains: w, mode: 'insensitive' as const } })),
                    },
                    include: { blob: { select: { filename: true } } },
                    take: 10,
                });

                for (const chunk of chunks) {
                    const lower = chunk.content.toLowerCase();
                    const matched = words.filter(w => lower.includes(w)).length;
                    const score = matched / words.length;
                    if (score < 0.3) continue;

                    results.push({
                        source: 'document',
                        title: chunk.blob.filename,
                        snippet: chunk.content.slice(0, 500),
                        score,
                    });
                }
            } catch (err) {
                console.warn('[RAG] Keyword search failed:', err);
            }
        }
    }

    // ── 3. Also search Articles ──
    try {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            const articles = await prisma.article.findMany({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    OR: [
                        ...words.map(w => ({ title: { contains: w, mode: 'insensitive' as const } })),
                        ...words.map(w => ({ content: { contains: w, mode: 'insensitive' as const } })),
                    ],
                },
                select: { title: true, content: true },
                take: 5,
            });

            for (const article of articles) {
                results.push({
                    source: 'article',
                    title: article.title,
                    snippet: article.content.slice(0, 400),
                    score: 0.5,
                });
            }
        }
    } catch (err) {
        console.warn('[RAG] Article search failed:', err);
    }

    // Sort by score descending, return top 8
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 8);
}

// ─── Streaming Chat ────────────────────────────────────────────
/**
 * Create a streaming AI chat response.
 *
 * Returns conversationId, an async iterable of text chunks, and a usage promise.
 */
export async function streamChat(request: ChatRequest): Promise<{
    conversationId: string;
    textStream: AsyncIterable<string>;
    toolEvents: EventEmitter;
    usage: PromiseLike<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }>;
    docRefs: Map<string, string>;
    systemPrompt: string;
}> {
    const tier = resolveModelTier(request.model ?? 'medium');
    const model = getModel(tier);
    const modelId = request.model ?? 'gpt-4o';

    // Get or create conversation
    const conversationId = await getOrCreateConversation(
        request.conversationId,
        request.userId,
        modelId,
        request.tenantId
    );

    // Load history
    const history = await loadConversationHistory(conversationId);

    // Save user message
    await saveMessage(conversationId, 'user', request.message);

    // Build MCP-aligned tools scoped to the user's tenant, filtered by enabled tools
    const allTools = buildMcpTools(request.tenantId, request.userId);
    const mcpTools = request.enabledTools
        ? Object.fromEntries(
            Object.entries(allTools).filter(([key]) => request.enabledTools!.includes(key))
        )
        : allTools;
    const toolNames = Object.keys(mcpTools);

    // Build the dynamic system prompt
    let systemPrompt = request.systemPrompt ?? buildMergedSystemPrompt(
        request.useCaseContext ?? null,
        toolNames,
        mcpTools
    );

    // RAG: retrieve relevant document context for the user's message
    // Skip this when MCP tools are enabled — the rag_search tool handles it better
    const hasTools = !request.enabledTools || request.enabledTools.length > 0;
    if (!hasTools) {
        try {
            const ragResults = await retrieveRagContext(request.message, request.tenantId);
            if (ragResults.length > 0) {
                const contextBlock = ragResults
                    .map((r, i) => `[${i + 1}] ${r.source === 'document' ? '📄' : '📝'} "${r.title}"\n${r.snippet}`)
                    .join('\n\n');
                systemPrompt += `\n\n--- RELEVANT DOCUMENTS ---\n${contextBlock}\n--- END DOCUMENTS ---\n\nUse the above document context to help answer the user's question when relevant. Cite the document title when referencing specific information.`;
            }
        } catch (err) {
            console.warn('[AI] RAG retrieval failed, continuing without context:', err);
        }
    }

    // Attach text from files
    // Smart threshold: < 8k tokens (~32k chars) = inline full text; > 8k = RAG semantic search
    const INLINE_CHAR_LIMIT = 32_000; // ~8k tokens at ~4 chars/token

    // EventEmitter for status/tool events (consumed by route handler for SSE)
    const toolEvents = new EventEmitter();

    if (request.files && request.files.length > 0) {
        toolEvents.emit('status', { message: `Reading ${request.files.length} attached file(s)...` });
        systemPrompt += `\n\n--- ATTACHED FILES ---\n`;
        let i = 1;
        for (const fileId of request.files) {
            // Do not attempt to load web sources from blob storage
            if (fileId.startsWith('http://') || fileId.startsWith('https://')) {
                continue;
            }

            const blobResult = await getBlob(fileId);
            if (!blobResult) continue;
            toolEvents.emit('status', { message: `Extracting text from "${blobResult.blob.filename}"...` });

            try {
                // Determine how to extract text
                let extractedText = '';

                // Buffer stream
                const chunks: Buffer[] = [];
                for await (const chunk of blobResult.stream) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                }
                const buffer = Buffer.concat(chunks);

                if (
                    blobResult.blob.mimeType === 'application/pdf' ||
                    blobResult.blob.mimeType.includes('officedocument') ||
                    blobResult.blob.mimeType.includes('msword') ||
                    blobResult.blob.mimeType.includes('excel') ||
                    blobResult.blob.mimeType.includes('powerpoint')
                ) {
                    // It's processed asynchronously by workers. Try to get the .md file.
                    try {
                        const mdKey = blobResult.blob.storagePath.replace(/\.[^/.]+$/, '.md');
                        const mdBlob = await getBlobByKey(mdKey);
                        if (mdBlob) {
                            const mdChunks: Buffer[] = [];
                            for await (const chunk of mdBlob.stream) {
                                mdChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                            }
                            extractedText = Buffer.concat(mdChunks).toString('utf-8');
                        } else {
                            extractedText = `(Document content is still processing. Please try again in a few seconds or ask me to wait.)`;
                        }
                    } catch (e) {
                         extractedText = `(Document content unavailable)`;
                    }
                } else if (
                    blobResult.blob.mimeType.startsWith('text/') ||
                    blobResult.blob.mimeType === 'application/json' ||
                    blobResult.blob.mimeType === 'application/csv' ||
                    blobResult.blob.mimeType.includes('xml')
                ) {
                    // Plain text
                    extractedText = buffer.toString('utf-8');
                } else {
                    extractedText = `(Unsupported file type: ${blobResult.blob.mimeType})`;
                }

                // Smart context assembly: inline for small docs, RAG for large docs
                if (extractedText.length > INLINE_CHAR_LIMIT) {
                    // Large document — use RAG: search DocumentChunks for this blob
                    console.log(`[AI] File ${fileId} is large (${extractedText.length} chars) — using RAG`);
                    try {
                        const ragChunks = await prisma.documentChunk.findMany({
                            where: { blobId: fileId },
                            orderBy: { chunkIndex: 'asc' },
                            select: { content: true, chunkIndex: true },
                            take: 10,
                        });

                        if (ragChunks.length > 0) {
                            // If we have an embedding for the query, do semantic search
                            const queryEmbedding = await embedQuery(request.message);
                            if (queryEmbedding) {
                                const embStr = `[${queryEmbedding.join(',')}]`;
                                const semanticChunks = await prisma.$queryRawUnsafe<{
                                    content: string; similarity: number; chunkIndex: number;
                                }[]>(`
                                    SELECT dc.content,
                                           1 - (dc.embedding <=> $1::vector) AS similarity,
                                           dc."chunkIndex"
                                    FROM "DocumentChunk" dc
                                    WHERE dc."blobId" = $2
                                      AND dc.embedding IS NOT NULL
                                    ORDER BY dc.embedding <=> $1::vector
                                    LIMIT 10
                                `, embStr, fileId);

                                if (semanticChunks.length > 0) {
                                    const ragText = semanticChunks
                                        .map((c) => `[Chunk ${c.chunkIndex + 1}, relevance: ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`)
                                        .join('\n\n');
                                    extractedText = `(Large document — showing most relevant sections via semantic search)\n\n${ragText}`;
                                }
                            } else {
                                // No embeddings available — use first + last chunks as context
                                const firstChunks = ragChunks.slice(0, 5);
                                const ragText = firstChunks.map(c => c.content).join('\n\n');
                                extractedText = `(Large document — showing first sections. Full text available via search.)\n\n${ragText}`;
                            }
                        } else {
                            // No chunks yet — truncate with clear message
                            extractedText = extractedText.substring(0, INLINE_CHAR_LIMIT)
                                + '\n\n... (DOCUMENT TRUNCATED — remaining content available via search) ...';
                        }
                    } catch (ragErr) {
                        console.warn(`[AI] RAG lookup for file ${fileId} failed:`, ragErr);
                        extractedText = extractedText.substring(0, INLINE_CHAR_LIMIT)
                            + '\n\n... (TRUNCATED) ...';
                    }
                }

                systemPrompt += `[${i}] "${blobResult.blob.filename}"\n${extractedText}\n\n`;
            } catch (err) {
                console.warn(`[AI] Failed to extract text from file ${fileId}:`, err);
                systemPrompt += `[${i}] "${blobResult.blob.filename}"\n(Failed to read file content)\n\n`;
            }
            i++;
        }
        systemPrompt += `--- END ATTACHED FILES ---\n\nUse the above attached files context to help answer the user's question when relevant.`;
    }

    // Build messages array
    const messages: ChatMessage[] = [
        ...history,
        { role: 'user', content: request.message },
    ];

    // Tool names were already built above for the prompt builder
    console.log(`[AI] Chat: tenant=${request.tenantId ?? 'none'}, tools=[${toolNames.join(',')}], history=${history.length} msgs`);
    toolEvents.emit('status', { message: 'Generating response...' });

    // Collect document references from tool results
    const docRefs = new Map<string, string>();


    // Stream the response with tool calling — streamText returns synchronously in v6
    const result = streamText({
        model,
        system: systemPrompt,
        messages,
        ...(toolNames.length > 0 ? { tools: mcpTools, stopWhen: stepCountIs(3) } : {}),
        onStepFinish: async ({ toolCalls, toolResults }) => {
            try {
                if (toolCalls && toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                        const args = (tc as any).args ?? (tc as any).input ?? {};
                        const argsStr = JSON.stringify(args);
                        console.log(`[AI] Tool call: ${tc.toolName ?? 'unknown'}(${argsStr.slice(0, 120)})`);
                        // Emit tool_call event for SSE streaming
                        toolEvents.emit('tool_call', {
                            toolName: tc.toolName ?? 'unknown',
                            args,
                        });
                    }
                }
                if (toolResults && toolResults.length > 0) {
                    toolResults.forEach((tr: any) => {
                        const resStr = JSON.stringify(tr.result ?? tr.output ?? tr);
                        console.log(`[AI] Tool result ${tr.toolName ?? '?'}: ${resStr.slice(0, 200)}... (${resStr.length}b)`);

                        // Emit tool_result event for SSE streaming  
                        const resultObj = tr.result ?? tr.output;
                        let summary = `Completed ${tr.toolName ?? 'tool'}`;
                        if (tr.toolName === 'search_web') {
                            const rc = resultObj?.resultCount ?? resultObj?.sources?.length ?? 0;
                            summary = `Found ${rc} results for "${resultObj?.query ?? ''}"`.slice(0, 200);
                        } else if (tr.toolName === 'rag_search') {
                            summary = `Found ${resultObj?.results?.length ?? 0} document passages`;
                        } else if (tr.toolName === 'search_properties') {
                            summary = `Found ${resultObj?.total ?? 0} properties`;
                        }
                        toolEvents.emit('tool_result', {
                            toolName: tr.toolName ?? 'unknown',
                            summary,
                        });

                        // Extract document references from tool results
                        if (resultObj && typeof resultObj === 'object') {
                            // search_properties returns {properties: [{id, filename, ...}]}
                            const props = resultObj.properties ?? resultObj.results ?? [];
                            for (const p of props) {
                                if (p.id && p.filename) {
                                    docRefs.set(p.filename, p.id);
                                }
                            }
                            // get_property returns {id, filename, ...}
                            if (resultObj.id && resultObj.filename) {
                                docRefs.set(resultObj.filename, resultObj.id);
                            }
                            // rag_search returns {results: [{filename, ...}]}
                            if (resultObj.results) {
                                for (const r of resultObj.results) {
                                    if (r.filename && !docRefs.has(r.filename)) {
                                        // We don't have blob ID from RAG, but filename is useful
                                        docRefs.set(r.filename, '');
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (logErr) {
                console.warn('[AI] Logging step error (non-fatal):', logErr);
            }
        },
        onFinish: async ({ text, usage }) => {
            try {
                // Save assistant message
                await saveMessage(
                    conversationId,
                    'assistant',
                    text,
                    modelId,
                    usage?.totalTokens,
                );

                // Log usage
                if (usage) {
                    await logUsage(
                        request.userId,
                        modelId,
                        usage.inputTokens ?? 0,
                        usage.outputTokens ?? 0,
                        'chat',
                        request.tenantId,
                    );
                }

                // Auto-generate title after first exchange
                if (history.length === 0) {
                    generateConversationTitle(conversationId)
                        .then(title => console.log(`[AI] Conversation titled: "${title}"`))
                        .catch(err => console.error('[AI] Title generation error:', err));
                }
            } catch (err: unknown) {
                console.error('[AI] Stream completion handler error:', err);
            }
        },
    });

    return {
        conversationId,
        textStream: result.textStream,
        toolEvents,
        usage: result.usage,
        docRefs,
        systemPrompt,
    };
}

// ─── Conversation Queries ──────────────────────────────────────

/**
 * List conversations for a user.
 */
export async function listConversations(userId: string, limit = 50) {
    return prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
            _count: { select: { messages: true } },
        },
    });
}

/**
 * Get a conversation with all messages.
 */
export async function getConversation(conversationId: string, userId: string) {
    return prisma.aiConversation.findFirst({
        where: { id: conversationId, userId },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' },
            },
        },
    });
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId: string, userId: string) {
    // Verify ownership
    const conversation = await prisma.aiConversation.findFirst({
        where: { id: conversationId, userId },
    });
    if (!conversation) return false;

    await prisma.aiConversation.delete({
        where: { id: conversationId },
    });

    return true;
}
