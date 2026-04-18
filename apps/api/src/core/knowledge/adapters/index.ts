/**
 * Knowledge Integration Adapters (Phase 6.9)
 *
 * Adapters allow external knowledge sources (Confluence, Notion, SharePoint,
 * Google Docs, etc.) to be synced into the Surdej knowledge system.
 *
 * Each adapter implements the KnowledgeAdapter interface and is registered
 * with the KnowledgeAdapterRegistry.
 *
 * @module knowledge/adapters
 */

// ─── Adapter Interface ─────────────────────────────────────────

export interface KnowledgeArticleImport {
    externalId: string;
    title: string;
    content: string;
    contentType: 'markdown' | 'html' | 'plain';
    author?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    lastModified?: string; // ISO timestamp
    url?: string; // Source URL
}

export interface KnowledgeSyncResult {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ externalId: string; error: string }>;
    syncedAt: string;
}

export interface KnowledgeAdapterConfig {
    /** Adapter identifier */
    id: string;
    /** Display name */
    name: string;
    /** Connection settings (API keys, URLs, etc.) */
    settings: Record<string, string>;
}

export interface KnowledgeAdapter {
    /** Unique adapter type identifier */
    readonly type: string;

    /** Human-readable name */
    readonly name: string;

    /** Description of what this adapter connects to */
    readonly description: string;

    /** Lucide icon name */
    readonly icon: string;

    /** Validate connection settings */
    validateConfig(config: KnowledgeAdapterConfig): Promise<{
        valid: boolean;
        errors?: string[];
    }>;

    /** Test connectivity to the external source */
    testConnection(config: KnowledgeAdapterConfig): Promise<{
        connected: boolean;
        error?: string;
    }>;

    /** List available documents/articles from the external source */
    listArticles(
        config: KnowledgeAdapterConfig,
        options?: { cursor?: string; limit?: number }
    ): Promise<{
        articles: KnowledgeArticleImport[];
        nextCursor?: string;
        total?: number;
    }>;

    /** Fetch a single article by its external ID */
    fetchArticle(
        config: KnowledgeAdapterConfig,
        externalId: string
    ): Promise<KnowledgeArticleImport | null>;

    /** Full sync: import/update all articles from the external source */
    sync(config: KnowledgeAdapterConfig): Promise<KnowledgeSyncResult>;
}

// ─── Adapter Registry ───────────────────────────────────────────

export class KnowledgeAdapterRegistry {
    private adapters = new Map<string, KnowledgeAdapter>();

    register(adapter: KnowledgeAdapter): void {
        if (this.adapters.has(adapter.type)) {
            throw new Error(`Adapter already registered: ${adapter.type}`);
        }
        this.adapters.set(adapter.type, adapter);
        console.log(`[Knowledge] Adapter registered: ${adapter.type} (${adapter.name})`);
    }

    get(type: string): KnowledgeAdapter | undefined {
        return this.adapters.get(type);
    }

    getAll(): KnowledgeAdapter[] {
        return Array.from(this.adapters.values());
    }

    has(type: string): boolean {
        return this.adapters.has(type);
    }
}

// ─── Global registry singleton ──────────────────────────────────

export const adapterRegistry = new KnowledgeAdapterRegistry();
