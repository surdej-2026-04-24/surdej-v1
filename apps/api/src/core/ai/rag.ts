/**
 * RAG Service (Phase 5.8–5.12)
 *
 * Retrieval-Augmented Generation pipeline for knowledge articles.
 *
 * Features:
 *   - Markdown-aware text chunking (512–1024 tokens, 10% overlap)
 *   - Embedding generation via Azure OpenAI (text-embedding-3-small / large)
 *   - Hybrid search (keyword + semantic via pgvector — when available)
 *   - Prompt augmentation with retrieved context
 *
 * Routes:
 *   POST /api/ai/rag/search  — search with hybrid retrieval
 *   POST /api/ai/rag/ingest  — ingest a document for RAG
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../middleware/acl.js';

const prisma = new PrismaClient();

// ─── Chunking ──────────────────────────────────────────────────

interface TextChunk {
    index: number;
    text: string;
    tokenEstimate: number;
    metadata: {
        headings: string[];
        startOffset: number;
        endOffset: number;
    };
}

/**
 * Markdown-aware chunking with heading tracking.
 * Targets 512–1024 tokens per chunk with ~10% overlap.
 */
function chunkMarkdown(text: string, options?: { targetTokens?: number; overlapPct?: number }): TextChunk[] {
    const targetTokens = options?.targetTokens ?? 768;
    const overlapPct = options?.overlapPct ?? 0.1;
    const overlapTokens = Math.floor(targetTokens * overlapPct);

    // Rough token estimate: ~4 chars per token
    const estimateTokens = (s: string) => Math.ceil(s.length / 4);

    const lines = text.split('\n');
    const chunks: TextChunk[] = [];
    let currentLines: string[] = [];
    let currentTokens = 0;
    let currentHeadings: string[] = [];
    let startOffset = 0;
    let charOffset = 0;

    for (const line of lines) {
        const lineTokens = estimateTokens(line);

        // Track headings
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
            currentHeadings = [...currentHeadings.filter(h => {
                // Keep headings with fewer # than current
                const currentLevel = headingMatch[1]!.length;
                const hLevel = (h.match(/^#+/) ?? [''])[0]!.length;
                return hLevel < currentLevel;
            }), line.trim()];
        }

        // Check if adding this line would exceed target
        if (currentTokens + lineTokens > targetTokens && currentLines.length > 0) {
            const chunkText = currentLines.join('\n');
            chunks.push({
                index: chunks.length,
                text: chunkText,
                tokenEstimate: estimateTokens(chunkText),
                metadata: {
                    headings: [...currentHeadings],
                    startOffset,
                    endOffset: charOffset,
                },
            });

            // Compute overlap: take last N tokens worth of lines
            const overlapLines: string[] = [];
            let overlapCount = 0;
            for (let i = currentLines.length - 1; i >= 0; i--) {
                const lt = estimateTokens(currentLines[i]!);
                if (overlapCount + lt > overlapTokens) break;
                overlapLines.unshift(currentLines[i]!);
                overlapCount += lt;
            }

            currentLines = [...overlapLines];
            currentTokens = overlapCount;
            startOffset = charOffset - overlapLines.join('\n').length;
        }

        currentLines.push(line);
        currentTokens += lineTokens;
        charOffset += line.length + 1; // +1 for newline
    }

    // Flush remaining
    if (currentLines.length > 0) {
        const chunkText = currentLines.join('\n');
        chunks.push({
            index: chunks.length,
            text: chunkText,
            tokenEstimate: estimateTokens(chunkText),
            metadata: {
                headings: [...currentHeadings],
                startOffset,
                endOffset: charOffset,
            },
        });
    }

    return chunks;
}

// ─── Search Scoring ────────────────────────────────────────────

interface SearchResult {
    articleId: string;
    title: string;
    slug: string;
    status: string;
    score: number;
    matchType: 'title' | 'content' | 'tag';
    snippet: string;
    tags: string[];
}

function extractSnippet(content: string, query: string, contextChars = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);

    if (idx === -1) return content.slice(0, contextChars * 2) + '…';

    const start = Math.max(0, idx - contextChars);
    const end = Math.min(content.length, idx + query.length + contextChars);
    let snippet = content.slice(start, end);

    if (start > 0) snippet = '…' + snippet;
    if (end < content.length) snippet += '…';

    return snippet;
}

function scoreKeywordMatch(text: string, query: string): number {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const lowerText = text.toLowerCase();
    let matchedWords = 0;

    for (const word of words) {
        if (lowerText.includes(word)) matchedWords++;
    }

    // Base score from word match ratio
    const wordScore = words.length > 0 ? matchedWords / words.length : 0;

    // Bonus for exact phrase match
    const phraseBonus = lowerText.includes(query.toLowerCase()) ? 0.3 : 0;

    return Math.min(1, wordScore + phraseBonus);
}

// ─── Prompt Augmentation ───────────────────────────────────────

function augmentPrompt(query: string, results: SearchResult[]): string {
    if (results.length === 0) return query;

    const context = results
        .slice(0, 5) // Top 5 results
        .map((r, i) => `[${i + 1}] "${r.title}" (${r.status})\n${r.snippet}`)
        .join('\n\n');

    return `Based on the following knowledge base context, answer the user's question.\n\n--- CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nUser question: ${query}`;
}

// ─── Fastify Plugin ────────────────────────────────────────────

export async function ragRoutes(app: FastifyInstance) {

    /**
     * POST /api/ai/rag/search — hybrid search
     *
     * Body: { query, status?, topK?, minScore?, tags? }
     */
    app.post('/rag/search', { preHandler: [requirePermission('ai', 'read')] }, async (req, reply) => {
        const body = req.body as {
            query: string;
            status?: string;
            topK?: number;
            minScore?: number;
            tags?: string[];
        };

        if (!body.query?.trim()) {
            return reply.status(400).send({ error: 'Query is required' });
        }

        const topK = Math.min(body.topK ?? 10, 50);
        const minScore = body.minScore ?? 0.1;

        // Build filter
        const where: Record<string, unknown> = {};
        if (body.status) where['status'] = body.status;
        if (body.tags?.length) where['tags'] = { hasSome: body.tags };

        // Fetch candidate articles
        const articles = await prisma.article.findMany({
            where,
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                content: true,
                tags: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 200, // Search across top 200 most recent
        });

        // Keyword scoring — articles
        const results: SearchResult[] = [];

        for (const article of articles) {
            // Title match
            const titleScore = scoreKeywordMatch(article.title, body.query) * 1.5; // Weight title higher
            // Content match
            const contentScore = scoreKeywordMatch(article.content, body.query);
            // Tag match
            const tagScore = article.tags.some(t =>
                body.query.toLowerCase().includes(t.toLowerCase())
            ) ? 0.3 : 0;

            const score = Math.min(1, Math.max(titleScore, contentScore) + tagScore);

            if (score >= minScore) {
                const matchType = titleScore > contentScore ? 'title' : contentScore > 0 ? 'content' : 'tag';
                results.push({
                    articleId: article.id,
                    title: article.title,
                    slug: article.slug,
                    status: article.status,
                    score: Math.round(score * 1000) / 1000,
                    matchType,
                    snippet: extractSnippet(article.content, body.query),
                    tags: article.tags,
                });
            }
        }

        // Also search DocumentChunks from extracted PDFs
        try {
            const words = body.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0) {
                const chunks = await prisma.documentChunk.findMany({
                    where: {
                        OR: words.map(w => ({ content: { contains: w, mode: 'insensitive' as const } })),
                    },
                    include: { blob: { select: { id: true, filename: true } } },
                    take: 30,
                });

                // Deduplicate by blob — keep best chunk per document
                const bestByBlob = new Map<string, typeof chunks[0] & { _score: number }>();
                for (const chunk of chunks) {
                    const cScore = scoreKeywordMatch(chunk.content, body.query);
                    const existing = bestByBlob.get(chunk.blob.id);
                    if (!existing || cScore > existing._score) {
                        bestByBlob.set(chunk.blob.id, { ...chunk, _score: cScore });
                    }
                }

                for (const [, best] of bestByBlob) {
                    if (best._score >= minScore) {
                        results.push({
                            articleId: best.blob.id,
                            title: `📄 ${best.blob.filename}`,
                            slug: best.blob.id,
                            status: 'document',
                            score: Math.round(best._score * 1000) / 1000,
                            matchType: 'content',
                            snippet: extractSnippet(best.content, body.query),
                            tags: ['document', 'pdf'],
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[RAG] DocumentChunk search failed:', err);
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, topK);

        return reply.send({
            results: topResults,
            total: results.length,
            query: body.query,
            augmentedPrompt: augmentPrompt(body.query, topResults),
        });
    });

    /**
     * POST /api/ai/rag/ingest — ingest a document
     *
     * Chunks the article content and prepares for vector storage.
     * (Vector embedding will be added when pgvector is configured.)
     *
     * Body: { articleId }
     */
    app.post('/rag/ingest', { preHandler: [requirePermission('ai', 'manage')] }, async (req, reply) => {
        const { articleId } = req.body as { articleId: string };

        if (!articleId) {
            return reply.status(400).send({ error: 'articleId is required' });
        }

        const article = await prisma.article.findUnique({
            where: { id: articleId },
            select: { id: true, title: true, content: true, tags: true },
        });

        if (!article) {
            return reply.status(404).send({ error: 'Article not found' });
        }

        // Chunk the content
        const chunks = chunkMarkdown(article.content);

        // TODO: When pgvector is configured, generate embeddings and store:
        // 1. Call Azure OpenAI text-embedding-3-small for each chunk
        // 2. Store embeddings in vector column
        // For now, we return the chunk analysis

        return reply.send({
            articleId: article.id,
            title: article.title,
            chunks: chunks.map(c => ({
                index: c.index,
                tokenEstimate: c.tokenEstimate,
                headings: c.metadata.headings,
                preview: c.text.slice(0, 100) + (c.text.length > 100 ? '…' : ''),
            })),
            totalChunks: chunks.length,
            totalTokens: chunks.reduce((sum, c) => sum + c.tokenEstimate, 0),
            status: 'chunked', // Will be 'embedded' when pgvector is ready
        });
    });

    /**
     * POST /api/ai/rag/chunk-preview — preview chunking for text
     *
     * Body: { text, targetTokens?, overlapPct? }
     */
    app.post('/rag/chunk-preview', { preHandler: [requirePermission('ai', 'read')] }, async (req, reply) => {
        const body = req.body as { text: string; targetTokens?: number; overlapPct?: number };

        if (!body.text?.trim()) {
            return reply.status(400).send({ error: 'Text is required' });
        }

        const chunks = chunkMarkdown(body.text, {
            targetTokens: body.targetTokens,
            overlapPct: body.overlapPct,
        });

        return reply.send({
            chunks: chunks.map(c => ({
                index: c.index,
                tokenEstimate: c.tokenEstimate,
                headings: c.metadata.headings,
                text: c.text,
            })),
            totalChunks: chunks.length,
            totalTokens: chunks.reduce((sum, c) => sum + c.tokenEstimate, 0),
        });
    });
}
