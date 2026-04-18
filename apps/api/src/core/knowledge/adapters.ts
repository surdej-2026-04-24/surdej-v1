/**
 * Knowledge Integration Adapters (Phase 6.9)
 *
 * `KnowledgeAdapter` interface defines how the knowledge system publishes,
 * syncs, searches duplicates, and imports articles from external systems.
 *
 * Built-in: InternalAdapter (PostgreSQL via Prisma)
 * Stubs: ServiceNow, Confluence, SharePoint, Notion adapters
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────

export interface KnowledgeArticle {
    id: string;
    title: string;
    slug: string;
    content: string;
    contentHash: string | null;
    status: string;
    authorId: string;
    tags: string[];
    metadata?: Record<string, unknown>;
    createdAt: Date | string;
    updatedAt: Date | string;
    publishedAt: Date | string | null;
}

export interface ArticleImport {
    title: string;
    content: string;
    authorId: string;
    tags?: string[];
    sourceSystem: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
}

export interface DuplicateMatch {
    id: string;
    title: string;
    similarity: number;
    matchType: 'title' | 'content' | 'both';
}

export interface SyncResult {
    status: 'synced' | 'conflict' | 'error';
    articleId: string;
    externalId?: string;
    details?: string;
}

export interface PublishResult {
    status: 'published' | 'error';
    articleId: string;
    externalUrl?: string;
    details?: string;
}

// ─── Interface ──────────────────────────────────────────────────

export interface KnowledgeAdapter {
    /** Adapter name / system identifier */
    readonly name: string;

    /** Publish an article to the target system */
    publishArticle(article: KnowledgeArticle): Promise<PublishResult>;

    /** Sync an article's content with the target system */
    syncArticle(article: KnowledgeArticle): Promise<SyncResult>;

    /** Search for potential duplicates in the target system */
    searchDuplicates(title: string, content: string): Promise<DuplicateMatch[]>;

    /** Import an article from the target system */
    importArticle(externalId: string): Promise<ArticleImport | null>;
}

// ─── Helpers ────────────────────────────────────────────────────

function contentHash(text: string): string {
    return createHash('sha256')
        .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
}




function titleSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

// ─── Internal Adapter (PostgreSQL) ──────────────────────────────

export class InternalAdapter implements KnowledgeAdapter {
    readonly name = 'internal';

    async publishArticle(article: KnowledgeArticle): Promise<PublishResult> {
        try {
            // Transition to published in the database
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    status: 'published',
                    publishedAt: new Date(),
                },
            });

            return {
                status: 'published',
                articleId: article.id,
                externalUrl: `/knowledge/articles/${article.id}`,
            };
        } catch (err) {
            return {
                status: 'error',
                articleId: article.id,
                details: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    async syncArticle(article: KnowledgeArticle): Promise<SyncResult> {
        try {
            const existing = await prisma.article.findUnique({
                where: { id: article.id },
            });

            if (!existing) {
                return { status: 'error', articleId: article.id, details: 'Article not found' };
            }

            // Check for content conflicts
            const existingHash = existing.contentHash;
            const incomingHash = article.contentHash ?? contentHash(article.content);

            if (existingHash && existingHash !== incomingHash) {
                // Both sides changed — conflict
                return {
                    status: 'conflict',
                    articleId: article.id,
                    details: `Content hash mismatch: local=${existingHash} incoming=${incomingHash}`,
                };
            }

            // Update article
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    title: article.title,
                    content: article.content,
                    contentHash: incomingHash,
                    tags: article.tags,
                    metadata: article.metadata as any ?? undefined,
                },
            });

            return { status: 'synced', articleId: article.id };
        } catch (err) {
            return {
                status: 'error',
                articleId: article.id,
                details: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    async searchDuplicates(title: string, content: string): Promise<DuplicateMatch[]> {
        const hash = contentHash(content);
        const threshold = 0.5;

        // Get all articles for comparison
        const articles = await prisma.article.findMany({
            select: { id: true, title: true, contentHash: true },
            take: 500,
        });

        const duplicates: DuplicateMatch[] = [];

        for (const existing of articles) {
            let matchType: 'title' | 'content' | 'both' | null = null;
            let similarity = 0;

            // Title similarity
            const titleSim = titleSimilarity(title, existing.title);
            if (titleSim >= threshold) {
                matchType = 'title';
                similarity = titleSim;
            }

            // Content hash
            if (existing.contentHash === hash) {
                matchType = matchType === 'title' ? 'both' : 'content';
                similarity = matchType === 'both' ? 1.0 : 0.95;
            }

            if (matchType) {
                duplicates.push({
                    id: existing.id,
                    title: existing.title,
                    similarity: Math.round(similarity * 100) / 100,
                    matchType,
                });
            }
        }

        return duplicates.sort((a, b) => b.similarity - a.similarity);
    }

    async importArticle(externalId: string): Promise<ArticleImport | null> {
        // For internal adapter, "import" means reading an existing article
        const article = await prisma.article.findUnique({
            where: { id: externalId },
            include: { author: { select: { id: true } } },
        });

        if (!article) return null;

        return {
            title: article.title,
            content: article.content,
            authorId: article.authorId,
            tags: article.tags,
            sourceSystem: 'internal',
            sourceId: article.id,
        };
    }
}

// ─── Stub Adapters ──────────────────────────────────────────────

export class ServiceNowAdapter implements KnowledgeAdapter {
    readonly name = 'servicenow';

    async publishArticle(article: KnowledgeArticle): Promise<PublishResult> {
        console.log(`[ServiceNow] publish stub for: ${article.id}`);
        return { status: 'error', articleId: article.id, details: 'ServiceNow adapter not configured' };
    }

    async syncArticle(article: KnowledgeArticle): Promise<SyncResult> {
        return { status: 'error', articleId: article.id, details: 'ServiceNow adapter not configured' };
    }

    async searchDuplicates(_title: string, _content: string): Promise<DuplicateMatch[]> {
        return [];
    }

    async importArticle(_externalId: string): Promise<ArticleImport | null> {
        return null;
    }
}

export class ConfluenceAdapter implements KnowledgeAdapter {
    readonly name = 'confluence';

    async publishArticle(article: KnowledgeArticle): Promise<PublishResult> {
        console.log(`[Confluence] publish stub for: ${article.id}`);
        return { status: 'error', articleId: article.id, details: 'Confluence adapter not configured' };
    }

    async syncArticle(article: KnowledgeArticle): Promise<SyncResult> {
        return { status: 'error', articleId: article.id, details: 'Confluence adapter not configured' };
    }

    async searchDuplicates(_title: string, _content: string): Promise<DuplicateMatch[]> {
        return [];
    }

    async importArticle(_externalId: string): Promise<ArticleImport | null> {
        return null;
    }
}

export class SharePointAdapter implements KnowledgeAdapter {
    readonly name = 'sharepoint';

    async publishArticle(article: KnowledgeArticle): Promise<PublishResult> {
        console.log(`[SharePoint] publish stub for: ${article.id}`);
        return { status: 'error', articleId: article.id, details: 'SharePoint adapter not configured' };
    }

    async syncArticle(article: KnowledgeArticle): Promise<SyncResult> {
        return { status: 'error', articleId: article.id, details: 'SharePoint adapter not configured' };
    }

    async searchDuplicates(_title: string, _content: string): Promise<DuplicateMatch[]> {
        return [];
    }

    async importArticle(_externalId: string): Promise<ArticleImport | null> {
        return null;
    }
}

export class NotionAdapter implements KnowledgeAdapter {
    readonly name = 'notion';

    async publishArticle(article: KnowledgeArticle): Promise<PublishResult> {
        console.log(`[Notion] publish stub for: ${article.id}`);
        return { status: 'error', articleId: article.id, details: 'Notion adapter not configured' };
    }

    async syncArticle(article: KnowledgeArticle): Promise<SyncResult> {
        return { status: 'error', articleId: article.id, details: 'Notion adapter not configured' };
    }

    async searchDuplicates(_title: string, _content: string): Promise<DuplicateMatch[]> {
        return [];
    }

    async importArticle(_externalId: string): Promise<ArticleImport | null> {
        return null;
    }
}

// ─── Adapter Registry ───────────────────────────────────────────

const adapters = new Map<string, KnowledgeAdapter>();

// Register built-in adapter
adapters.set('internal', new InternalAdapter());

export function registerAdapter(adapter: KnowledgeAdapter): void {
    adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): KnowledgeAdapter | undefined {
    return adapters.get(name);
}

export function listAdapters(): string[] {
    return [...adapters.keys()];
}

export function getDefaultAdapter(): KnowledgeAdapter {
    return adapters.get('internal')!;
}
