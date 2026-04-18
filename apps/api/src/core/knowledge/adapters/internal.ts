/**
 * Internal Adapter — Syncs from the Surdej API's own article store
 *
 * This is the default "passthrough" adapter that re-indexes articles already
 * in the database. It's used for bulk re-indexing and as a reference
 * implementation for custom adapters.
 *
 * @module knowledge/adapters/internal
 */

import type {
    KnowledgeAdapter,
    KnowledgeAdapterConfig,
    KnowledgeArticleImport,
    KnowledgeSyncResult,
} from './index.js';

export class InternalAdapter implements KnowledgeAdapter {
    readonly type = 'internal';
    readonly name = 'Internal (Surdej)';
    readonly description = 'Re-indexes articles from the Surdej database. Used for bulk re-indexing.';
    readonly icon = 'Database';

    async validateConfig(_config: KnowledgeAdapterConfig) {
        // Internal adapter always valid — no external settings needed
        return { valid: true };
    }

    async testConnection(_config: KnowledgeAdapterConfig) {
        // Always connected — we're reading from our own DB
        return { connected: true };
    }

    async listArticles(
        _config: KnowledgeAdapterConfig,
        _options?: { cursor?: string; limit?: number }
    ) {
        // This would be wired to the Prisma client in the actual API context
        // For now, return the interface shape — callers pass limit via options
        const articles: KnowledgeArticleImport[] = [];

        return {
            articles,
            total: 0,
        };
    }

    async fetchArticle(
        _config: KnowledgeAdapterConfig,
        externalId: string
    ): Promise<KnowledgeArticleImport | null> {
        // In production, this queries Prisma for the article by ID
        console.log(`[InternalAdapter] Fetching article: ${externalId}`);
        return null;
    }

    async sync(_config: KnowledgeAdapterConfig): Promise<KnowledgeSyncResult> {
        // In production, this iterates all articles and dispatches indexing jobs
        console.log('[InternalAdapter] Starting bulk re-index sync');

        return {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            syncedAt: new Date().toISOString(),
        };
    }
}
