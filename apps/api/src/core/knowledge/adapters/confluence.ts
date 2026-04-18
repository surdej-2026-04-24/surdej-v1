/**
 * Confluence Adapter — Imports articles from Atlassian Confluence
 *
 * Connects to a Confluence Cloud instance via the REST API v2
 * and syncs pages from a specified space into Surdej's knowledge base.
 *
 * Settings:
 *   - baseUrl:  Confluence instance URL (e.g. https://mycompany.atlassian.net)
 *   - email:    Atlassian account email
 *   - apiToken: Atlassian API token
 *   - spaceKey: Space key to import from (e.g. "KB")
 *
 * @module knowledge/adapters/confluence
 */

import type {
    KnowledgeAdapter,
    KnowledgeAdapterConfig,
    KnowledgeArticleImport,
    KnowledgeSyncResult,
} from './index.js';

export class ConfluenceAdapter implements KnowledgeAdapter {
    readonly type = 'confluence';
    readonly name = 'Atlassian Confluence';
    readonly description = 'Import pages from a Confluence Cloud space into Surdej knowledge base.';
    readonly icon = 'Globe';

    async validateConfig(config: KnowledgeAdapterConfig) {
        const errors: string[] = [];
        const { settings } = config;

        if (!settings.baseUrl) errors.push('baseUrl is required');
        if (!settings.email) errors.push('email is required');
        if (!settings.apiToken) errors.push('apiToken is required');
        if (!settings.spaceKey) errors.push('spaceKey is required');

        if (settings.baseUrl && !settings.baseUrl.startsWith('https://')) {
            errors.push('baseUrl must start with https://');
        }

        return { valid: errors.length === 0, errors };
    }

    async testConnection(config: KnowledgeAdapterConfig) {
        const { settings } = config;
        const auth = Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64');

        try {
            const res = await fetch(`${settings.baseUrl}/wiki/api/v2/spaces?keys=${settings.spaceKey}`, {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
            });

            if (!res.ok) {
                return { connected: false, error: `Confluence API returned ${res.status}` };
            }

            const data = await res.json() as { results: unknown[] };
            if (data.results.length === 0) {
                return { connected: false, error: `Space "${settings.spaceKey}" not found` };
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
        const auth = Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64');
        const limit = options?.limit ?? 25;

        const params = new URLSearchParams({
            spaceKey: settings.spaceKey,
            limit: String(limit),
            expand: 'body.storage,version',
        });
        if (options?.cursor) params.set('cursor', options.cursor);

        const res = await fetch(`${settings.baseUrl}/wiki/api/v2/pages?${params}`, {
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: 'application/json',
            },
        });

        if (!res.ok) throw new Error(`Confluence API error: ${res.status}`);
        const data = await res.json() as {
            results: Array<{
                id: string;
                title: string;
                body?: { storage?: { value?: string } };
                version?: { when?: string; by?: { displayName?: string } };
                _links?: { webui?: string };
            }>;
            _links?: { next?: string };
        };

        const articles: KnowledgeArticleImport[] = data.results.map(page => ({
            externalId: page.id,
            title: page.title,
            content: page.body?.storage?.value ?? '',
            contentType: 'html' as const,
            author: page.version?.by?.displayName,
            lastModified: page.version?.when,
            url: page._links?.webui
                ? `${settings.baseUrl}/wiki${page._links.webui}`
                : undefined,
            metadata: {
                source: 'confluence',
                spaceKey: settings.spaceKey,
            },
        }));

        // Extract cursor from next link
        const nextLink = data._links?.next;
        const nextCursor = nextLink
            ? new URLSearchParams(nextLink.split('?')[1]).get('cursor') ?? undefined
            : undefined;

        return { articles, nextCursor };
    }

    async fetchArticle(config: KnowledgeAdapterConfig, externalId: string) {
        const { settings } = config;
        const auth = Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64');

        const res = await fetch(
            `${settings.baseUrl}/wiki/api/v2/pages/${externalId}?body-format=storage`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
            }
        );

        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Confluence API error: ${res.status}`);

        const page = await res.json() as {
            id: string;
            title: string;
            body?: { storage?: { value?: string } };
            version?: { when?: string; by?: { displayName?: string } };
            _links?: { webui?: string };
        };

        return {
            externalId: page.id,
            title: page.title,
            content: page.body?.storage?.value ?? '',
            contentType: 'html' as const,
            author: page.version?.by?.displayName,
            lastModified: page.version?.when,
            url: page._links?.webui
                ? `${settings.baseUrl}/wiki${page._links.webui}`
                : undefined,
            metadata: {
                source: 'confluence',
                spaceKey: settings.spaceKey,
            },
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
                        // In production, this would:
                        // 1. Check if article exists (by externalId)
                        // 2. Compare lastModified to skip unchanged
                        // 3. Create or update the article
                        // 4. Dispatch indexing job
                        result.imported++;
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
}
