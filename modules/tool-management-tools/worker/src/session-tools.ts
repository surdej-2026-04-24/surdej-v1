/**
 * Session Workflow Tools
 *
 * Vercel AI SDK tool definitions available during workflow session chats.
 * Mirrors a subset of the main API's mcp-tools but runs in the worker process.
 */

import { tool } from 'ai';
import { z } from 'zod';

// ── Web Search via SearXNG (self-hosted, same Docker network) ───

const SEARXNG_URL = process.env['SEARXNG_URL'] || 'http://searxng:8080';

interface SearxResult {
    title: string;
    url: string;
    content: string;
    engine: string;
    score: number;
}

async function searxngSearch(query: string, maxResults = 5): Promise<SearxResult[]> {
    try {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            categories: 'general',
            language: 'all',
            pageno: '1',
        });

        const res = await fetch(`${SEARXNG_URL}/search?${params}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
            console.error('[search_web] SearXNG error:', res.status);
            return [];
        }

        const data = (await res.json()) as { results: SearxResult[] };
        return (data.results ?? []).slice(0, maxResults);
    } catch (err) {
        console.error('[search_web] SearXNG error:', err);
        return [];
    }
}

// ── All available tools ─────────────────────────────────────────

const ALL_TOOLS = {
    search_web: tool({
        description:
            'Search the internet for current information. Use when you need factual data, recent events, or the user asks to look something up online. Returns results with source URLs.',
        parameters: z.object({
            query: z.string().describe('Search query — be specific and include key terms'),
            maxResults: z
                .number()
                .int()
                .min(1)
                .max(10)
                .default(5)
                .describe('Number of results to return'),
        }),
        execute: async ({ query, maxResults }: { query: string; maxResults: number }) => {
            console.log(`[search_web] Searching: "${query}" (max=${maxResults})`);
            const results = await searxngSearch(query, maxResults);
            if (results.length === 0) {
                return { query, resultCount: 0, sources: [] as never[] };
            }
            return {
                query,
                resultCount: results.length,
                sources: results.map((r, i) => ({
                    rank: i + 1,
                    title: r.title,
                    url: r.url,
                    snippet: r.content?.slice(0, 500) ?? '',
                    engine: r.engine,
                })),
            };
        },
    }),

    web_search: tool({
        description:
            'Search the internet (alias for search_web). Use when you need to find information online.',
        parameters: z.object({
            query: z.string().describe('Search query'),
            maxResults: z.number().int().min(1).max(10).default(5),
        }),
        execute: async ({ query, maxResults }: { query: string; maxResults: number }) => {
            const results = await searxngSearch(query, maxResults);
            if (results.length === 0) {
                return { query, resultCount: 0, sources: [] as never[] };
            }
            return {
                query,
                resultCount: results.length,
                sources: results.map((r, i) => ({
                    rank: i + 1,
                    title: r.title,
                    url: r.url,
                    snippet: r.content?.slice(0, 500) ?? '',
                    engine: r.engine,
                })),
            };
        },
    }),
} as const;

type ToolName = keyof typeof ALL_TOOLS;

/**
 * Build a filtered tools object for streamText() based on allowedTools.
 * If allowedTools is empty/undefined, returns all tools.
 */
export function buildSessionTools(allowedTools?: string[]): Record<string, (typeof ALL_TOOLS)[ToolName]> {
    if (!allowedTools || allowedTools.length === 0) return { ...ALL_TOOLS };

    const filtered: Record<string, (typeof ALL_TOOLS)[ToolName]> = {};
    for (const name of allowedTools) {
        if (name in ALL_TOOLS) {
            filtered[name] = ALL_TOOLS[name as ToolName];
        }
    }

    // Always include at least search_web if any tool was requested
    if (Object.keys(filtered).length === 0 && allowedTools.length > 0) {
        filtered.search_web = ALL_TOOLS.search_web;
    }

    return filtered;
}
