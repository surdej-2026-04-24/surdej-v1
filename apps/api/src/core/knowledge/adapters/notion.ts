/**
 * Notion Adapter — Imports pages from a Notion workspace
 *
 * Connects via the Notion API and syncs database entries / pages
 * into Surdej's knowledge base.
 *
 * Settings:
 *   - apiKey:     Notion integration token
 *   - databaseId: Notion database ID to import from (optional — if omitted, imports from workspace)
 *
 * @module knowledge/adapters/notion
 */

import type {
    KnowledgeAdapter,
    KnowledgeAdapterConfig,
    KnowledgeArticleImport,
    KnowledgeSyncResult,
} from './index.js';

export class NotionAdapter implements KnowledgeAdapter {
    readonly type = 'notion';
    readonly name = 'Notion';
    readonly description = 'Import pages from a Notion workspace or database.';
    readonly icon = 'FileText';

    private readonly BASE = 'https://api.notion.com/v1';
    private readonly API_VERSION = '2022-06-28';

    private headers(config: KnowledgeAdapterConfig) {
        return {
            Authorization: `Bearer ${config.settings.apiKey}`,
            'Notion-Version': this.API_VERSION,
            'Content-Type': 'application/json',
        };
    }

    async validateConfig(config: KnowledgeAdapterConfig) {
        const errors: string[] = [];
        if (!config.settings.apiKey) errors.push('apiKey is required');
        return { valid: errors.length === 0, errors };
    }

    async testConnection(config: KnowledgeAdapterConfig) {
        try {
            const res = await fetch(`${this.BASE}/users/me`, {
                headers: this.headers(config),
            });
            if (!res.ok) {
                return { connected: false, error: `Notion API returned ${res.status}` };
            }
            return { connected: true };
        } catch (e) {
            return { connected: false, error: `Connection failed: ${(e as Error).message}` };
        }
    }

    async listArticles(
        config: KnowledgeAdapterConfig,
        options?: { cursor?: string; limit?: number }
    ) {
        const { settings } = config;
        const limit = options?.limit ?? 25;

        let url: string;
        let body: Record<string, unknown>;

        if (settings.databaseId) {
            url = `${this.BASE}/databases/${settings.databaseId}/query`;
            body = {
                page_size: limit,
                ...(options?.cursor ? { start_cursor: options.cursor } : {}),
            };
        } else {
            url = `${this.BASE}/search`;
            body = {
                filter: { value: 'page', property: 'object' },
                page_size: limit,
                ...(options?.cursor ? { start_cursor: options.cursor } : {}),
            };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.headers(config),
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
        const data = await res.json() as {
            results: Array<{
                id: string;
                properties?: Record<string, { title?: Array<{ plain_text: string }> }>;
                last_edited_time?: string;
                url?: string;
            }>;
            has_more: boolean;
            next_cursor?: string;
        };

        const articles: KnowledgeArticleImport[] = data.results.map(page => ({
            externalId: page.id,
            title: this.extractTitle(page),
            content: '', // Content fetched separately via blocks API
            contentType: 'markdown' as const,
            lastModified: page.last_edited_time,
            url: page.url,
            metadata: { source: 'notion' },
        }));

        return {
            articles,
            nextCursor: data.has_more ? data.next_cursor ?? undefined : undefined,
        };
    }

    async fetchArticle(config: KnowledgeAdapterConfig, externalId: string) {
        // Fetch page metadata
        const pageRes = await fetch(`${this.BASE}/pages/${externalId}`, {
            headers: this.headers(config),
        });
        if (pageRes.status === 404) return null;
        if (!pageRes.ok) throw new Error(`Notion API error: ${pageRes.status}`);

        const page = await pageRes.json() as {
            id: string;
            properties?: Record<string, { title?: Array<{ plain_text: string }> }>;
            last_edited_time?: string;
            url?: string;
        };

        // Fetch blocks (content)
        const content = await this.fetchBlocks(config, externalId);

        return {
            externalId: page.id,
            title: this.extractTitle(page),
            content,
            contentType: 'markdown' as const,
            lastModified: page.last_edited_time,
            url: page.url,
            metadata: { source: 'notion' },
        };
    }

    async sync(config: KnowledgeAdapterConfig): Promise<KnowledgeSyncResult> {
        const result: KnowledgeSyncResult = {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            syncedAt: new Date().toISOString(),
        };

        let cursor: string | undefined;

        try {
            do {
                const { articles, nextCursor } = await this.listArticles(config, {
                    cursor,
                    limit: 25,
                });

                for (const article of articles) {
                    try {
                        const full = await this.fetchArticle(config, article.externalId);
                        if (full) result.imported++;
                        else result.skipped++;
                    } catch (e) {
                        result.failed++;
                        result.errors.push({
                            externalId: article.externalId,
                            error: (e as Error).message,
                        });
                    }
                }

                cursor = nextCursor;
            } while (cursor);
        } catch (e) {
            result.errors.push({
                externalId: '*',
                error: `Sync aborted: ${(e as Error).message}`,
            });
        }

        return result;
    }

    // ─── Private helpers ────────────────────────────────────────

    private extractTitle(page: { properties?: Record<string, { title?: Array<{ plain_text: string }> }> }): string {
        if (!page.properties) return 'Untitled';
        for (const prop of Object.values(page.properties)) {
            if (prop.title && prop.title.length > 0) {
                return prop.title.map(t => t.plain_text).join('');
            }
        }
        return 'Untitled';
    }

    private async fetchBlocks(config: KnowledgeAdapterConfig, pageId: string): Promise<string> {
        const res = await fetch(`${this.BASE}/blocks/${pageId}/children?page_size=100`, {
            headers: this.headers(config),
        });
        if (!res.ok) return '';

        const data = await res.json() as {
            results: Array<{
                type: string;
                [key: string]: unknown;
            }>;
        };

        // Simple block-to-markdown conversion
        const lines: string[] = [];
        for (const block of data.results) {
            const richText = (block[block.type] as { rich_text?: Array<{ plain_text: string }> })?.rich_text;
            const text = richText?.map(t => t.plain_text).join('') ?? '';

            switch (block.type) {
                case 'heading_1':
                    lines.push(`# ${text}`);
                    break;
                case 'heading_2':
                    lines.push(`## ${text}`);
                    break;
                case 'heading_3':
                    lines.push(`### ${text}`);
                    break;
                case 'paragraph':
                    lines.push(text);
                    break;
                case 'bulleted_list_item':
                    lines.push(`- ${text}`);
                    break;
                case 'numbered_list_item':
                    lines.push(`1. ${text}`);
                    break;
                case 'code':
                    lines.push(`\`\`\`\n${text}\n\`\`\``);
                    break;
                case 'divider':
                    lines.push('---');
                    break;
                default:
                    if (text) lines.push(text);
            }
        }

        return lines.join('\n\n');
    }
}
