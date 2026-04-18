/**
 * SharePoint Adapter — Imports documents from Microsoft SharePoint
 *
 * Connects via Microsoft Graph API using an app registration to sync
 * documents from a SharePoint site/library into Surdej's knowledge base.
 *
 * Settings:
 *   - tenantId:     Azure AD tenant ID
 *   - clientId:     App registration client ID
 *   - clientSecret: App registration client secret
 *   - siteUrl:      SharePoint site URL (e.g. https://company.sharepoint.com/sites/KB)
 *   - driveId:      Document library drive ID (optional — defaults to root drive)
 *
 * @module knowledge/adapters/sharepoint
 */

import type {
    KnowledgeAdapter,
    KnowledgeAdapterConfig,
    KnowledgeArticleImport,
    KnowledgeSyncResult,
} from './index.js';

export class SharePointAdapter implements KnowledgeAdapter {
    readonly type = 'sharepoint';
    readonly name = 'Microsoft SharePoint';
    readonly description = 'Import documents from a SharePoint site document library.';
    readonly icon = 'Cloud';

    async validateConfig(config: KnowledgeAdapterConfig) {
        const errors: string[] = [];
        const { settings } = config;

        if (!settings.tenantId) errors.push('tenantId is required');
        if (!settings.clientId) errors.push('clientId is required');
        if (!settings.clientSecret) errors.push('clientSecret is required');
        if (!settings.siteUrl) errors.push('siteUrl is required');

        return { valid: errors.length === 0, errors };
    }

    private async getAccessToken(config: KnowledgeAdapterConfig): Promise<string> {
        const { settings } = config;
        const tokenUrl = `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`;

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
        });

        const res = await fetch(tokenUrl, {
            method: 'POST',
            body,
        });

        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        const data = await res.json() as { access_token: string };
        return data.access_token;
    }

    async testConnection(config: KnowledgeAdapterConfig) {
        try {
            const token = await this.getAccessToken(config);
            const res = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                return { connected: false, error: `Graph API returned ${res.status}` };
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
        const token = await this.getAccessToken(config);
        const { settings } = config;
        const limit = options?.limit ?? 25;

        // Resolve site ID from URL
        const siteHost = new URL(settings.siteUrl).hostname;
        const sitePath = new URL(settings.siteUrl).pathname;

        let url: string;
        if (options?.cursor) {
            url = options.cursor; // Graph API provides full next URLs
        } else {
            const siteRes = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${siteHost}:${sitePath}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!siteRes.ok) throw new Error(`Site not found: ${siteRes.status}`);
            const site = await siteRes.json() as { id: string };

            const driveId = settings.driveId ?? 'root';
            url = `https://graph.microsoft.com/v1.0/sites/${site.id}/drives/${driveId}/root/children?$top=${limit}&$select=id,name,lastModifiedDateTime,webUrl,file`;
        }

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Graph API error: ${res.status}`);

        const data = await res.json() as {
            value: Array<{
                id: string;
                name: string;
                lastModifiedDateTime: string;
                webUrl: string;
                file?: { mimeType: string };
            }>;
            '@odata.nextLink'?: string;
        };

        // Filter to supported file types
        const supportedTypes = ['text/plain', 'text/markdown', 'text/html', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

        const articles: KnowledgeArticleImport[] = data.value
            .filter(item => item.file && supportedTypes.some(t => item.file?.mimeType?.includes(t)))
            .map(item => ({
                externalId: item.id,
                title: item.name.replace(/\.\w+$/, ''),
                content: '', // Content fetched via download URL
                contentType: 'plain' as const,
                lastModified: item.lastModifiedDateTime,
                url: item.webUrl,
                metadata: {
                    source: 'sharepoint',
                    mimeType: item.file?.mimeType,
                    siteUrl: settings.siteUrl,
                },
            }));

        return {
            articles,
            nextCursor: data['@odata.nextLink'],
        };
    }

    async fetchArticle(config: KnowledgeAdapterConfig, externalId: string) {
        const token = await this.getAccessToken(config);
        const { settings } = config;

        // Get item metadata
        const siteHost = new URL(settings.siteUrl).hostname;
        const sitePath = new URL(settings.siteUrl).pathname;

        const siteRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${siteHost}:${sitePath}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!siteRes.ok) return null;
        const site = await siteRes.json() as { id: string };

        const driveId = settings.driveId ?? 'root';
        const itemRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${site.id}/drives/${driveId}/items/${externalId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (itemRes.status === 404) return null;
        if (!itemRes.ok) throw new Error(`Graph API error: ${itemRes.status}`);

        const item = await itemRes.json() as {
            id: string;
            name: string;
            lastModifiedDateTime: string;
            webUrl: string;
            '@microsoft.graph.downloadUrl'?: string;
        };

        // Download content
        let content = '';
        const downloadUrl = item['@microsoft.graph.downloadUrl'];
        if (downloadUrl) {
            const dlRes = await fetch(downloadUrl);
            if (dlRes.ok) content = await dlRes.text();
        }

        return {
            externalId: item.id,
            title: item.name.replace(/\.\w+$/, ''),
            content,
            contentType: 'plain' as const,
            lastModified: item.lastModifiedDateTime,
            url: item.webUrl,
            metadata: {
                source: 'sharepoint',
                siteUrl: settings.siteUrl,
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
                const { articles, nextCursor } = await this.listArticles(config, { cursor, limit: 25 });

                for (const article of articles) {
                    try {
                        const full = await this.fetchArticle(config, article.externalId);
                        if (full && full.content) {
                            result.imported++;
                        } else {
                            result.skipped++;
                        }
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
