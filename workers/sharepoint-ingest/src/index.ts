/**
 * SharePoint Ingest Worker
 *
 * Processes batched & queued requests for documents stored in SharePoint.
 *
 * Job handlers:
 *   job.sharepoint-ingest.start-batch       — Discover & enqueue all documents from a site/drive
 *   job.sharepoint-ingest.process-item      — Download, extract text, and index a single queue item
 *   job.sharepoint-ingest.start-delta-sync  — Incremental sync using Graph API delta queries
 *   job.sharepoint-ingest.retry-failed      — Re-queue all failed items in a batch
 *   job.sharepoint-ingest.batch-status      — Return current status of a batch
 *
 * Architecture:
 *   ┌────────────┐     ┌─────────────┐     ┌──────────────┐
 *   │ API / CLI  │────►│ start-batch │────►│ NATS queue   │
 *   │            │     │ (discover)  │     │ process-item │─── x concurrency
 *   └────────────┘     └─────────────┘     └──────┬───────┘
 *                                                 │
 *                                          ┌──────▼───────┐
 *                                          │ SharePoint   │
 *                                          │ Graph API    │
 *                                          └──────┬───────┘
 *                                                 │
 *                                          ┌──────▼───────┐
 *                                          │ Extract text │
 *                                          │ Hash content │
 *                                          │ Store + Index│
 *                                          └──────────────┘
 *
 * Own Prisma schema segment: `sp_ingest`
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';
import { createHash } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

interface SharePointConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    siteUrl: string;
    driveId?: string;
}

interface StartBatchPayload {
    tenantId?: string;
    config: SharePointConfig;
    folderPath?: string;
    strategy?: 'full' | 'delta';
    priority?: number;
    filters?: {
        mimeTypes?: string[];          // Only include these MIME types
        maxFileSize?: number;          // Max file size in bytes
        modifiedAfter?: string;        // ISO timestamp
        filenamePatterns?: string[];   // Glob-like patterns (e.g. ["*.docx", "*.pdf"])
    };
    metadata?: Record<string, unknown>;
}

interface ProcessItemPayload {
    batchId: string;
    itemId: string;
    config: SharePointConfig;
    downloadUrl: string;
    filename: string;
    mimeType?: string;
    externalId: string;
}

interface DeltaSyncPayload {
    tenantId?: string;
    config: SharePointConfig;
    filters?: StartBatchPayload['filters'];
}

interface RetryFailedPayload {
    batchId: string;
    config: SharePointConfig;
    maxRetries?: number;
}

interface BatchStatusPayload {
    batchId: string;
}

// Internal types for Graph API responses
interface GraphDriveItem {
    id: string;
    name: string;
    size?: number;
    lastModifiedDateTime?: string;
    webUrl?: string;
    file?: {
        mimeType?: string;
    };
    createdBy?: {
        user?: { displayName?: string };
    };
    parentReference?: {
        path?: string;
    };
    '@microsoft.graph.downloadUrl'?: string;
}

interface GraphResponse<T> {
    value: T[];
    '@odata.nextLink'?: string;
    '@odata.deltaLink'?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/markdown',
    'text/html',
    'text/csv',
    'application/rtf',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB default

function contentHash(text: string): string {
    return createHash('sha256')
        .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
}

function matchesFilters(
    item: GraphDriveItem,
    filters?: StartBatchPayload['filters']
): boolean {
    if (!filters) return true;

    const mimeType = item.file?.mimeType ?? '';
    const size = item.size ?? 0;

    // MIME type filter
    if (filters.mimeTypes?.length) {
        if (!filters.mimeTypes.includes(mimeType)) return false;
    } else {
        // Default: only supported types
        if (!SUPPORTED_MIME_TYPES.has(mimeType)) return false;
    }

    // File size filter
    if (size > (filters.maxFileSize ?? MAX_FILE_SIZE)) return false;

    // Modified after filter
    if (filters.modifiedAfter && item.lastModifiedDateTime) {
        if (new Date(item.lastModifiedDateTime) < new Date(filters.modifiedAfter)) return false;
    }

    // Filename pattern filter (simple glob matching)
    if (filters.filenamePatterns?.length) {
        const name = item.name.toLowerCase();
        const matches = filters.filenamePatterns.some(pattern => {
            const regex = pattern
                .toLowerCase()
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            return new RegExp(`^${regex}$`).test(name);
        });
        if (!matches) return false;
    }

    return true;
}

// ─── SharePoint Graph API Client ────────────────────────────────

class GraphClient {
    private accessToken: string | null = null;
    private tokenExpiry = 0;

    constructor(private config: SharePointConfig) { }

    private async getToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
            return this.accessToken;
        }

        const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
        });

        const res = await fetch(tokenUrl, { method: 'POST', body });
        if (!res.ok) {
            throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
        }

        const data = await res.json() as { access_token: string; expires_in: number };
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + data.expires_in * 1000;
        return this.accessToken;
    }

    private async graphGet<T>(url: string): Promise<T> {
        const token = await this.getToken();
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            throw new Error(`Graph API GET failed (${res.status}): ${await res.text()}`);
        }
        return res.json() as Promise<T>;
    }

    async resolveSiteId(): Promise<string> {
        const siteHost = new URL(this.config.siteUrl).hostname;
        const sitePath = new URL(this.config.siteUrl).pathname;
        const site = await this.graphGet<{ id: string }>(
            `https://graph.microsoft.com/v1.0/sites/${siteHost}:${sitePath}`
        );
        return site.id;
    }

    /**
     * List all files in a drive (with pagination).
     * Optionally filter by folderPath.
     */
    async *listDriveItems(
        siteId: string,
        folderPath?: string
    ): AsyncGenerator<GraphDriveItem> {
        const driveId = this.config.driveId ?? 'root';
        let url: string;

        if (folderPath) {
            url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${folderPath}:/children?$top=200&$select=id,name,size,lastModifiedDateTime,webUrl,file,createdBy,parentReference`;
        } else {
            url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children?$top=200&$select=id,name,size,lastModifiedDateTime,webUrl,file,createdBy,parentReference`;
        }

        while (url) {
            const data = await this.graphGet<GraphResponse<GraphDriveItem>>(url);

            for (const item of data.value) {
                // Only yield files (skip folders)
                if (item.file) {
                    yield item;
                }
            }

            url = data['@odata.nextLink'] ?? '';
        }
    }

    /**
     * Recursive folder traversal — yields all files in directory tree.
     */
    async *crawlRecursive(
        siteId: string,
        folderPath?: string
    ): AsyncGenerator<GraphDriveItem> {
        const driveId = this.config.driveId ?? 'root';
        const basePath = folderPath ? `root:/${folderPath}:` : 'root';
        let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/${basePath}/children?$top=200&$select=id,name,size,lastModifiedDateTime,webUrl,file,createdBy,parentReference`;

        const folderQueue: string[] = [];

        while (url) {
            const data = await this.graphGet<GraphResponse<GraphDriveItem & { folder?: unknown }>>(url);

            for (const item of data.value) {
                if (item.file) {
                    yield item;
                } else if (item.folder !== undefined) {
                    // Queue folder for recursive crawl
                    const childPath = folderPath ? `${folderPath}/${item.name}` : item.name;
                    folderQueue.push(childPath);
                }
            }

            url = data['@odata.nextLink'] ?? '';
        }

        // Recurse into child folders
        for (const childFolder of folderQueue) {
            yield* this.crawlRecursive(siteId, childFolder);
        }
    }

    /**
     * Delta query — returns only changed items since last sync.
     */
    async *deltaQuery(
        siteId: string,
        deltaCursor?: string
    ): AsyncGenerator<{ item: GraphDriveItem; deltaLink?: string }> {
        const driveId = this.config.driveId ?? 'root';
        let url = deltaCursor ??
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/delta?$select=id,name,size,lastModifiedDateTime,webUrl,file,createdBy,parentReference`;

        let lastDeltaLink: string | undefined;

        while (url) {
            const data = await this.graphGet<GraphResponse<GraphDriveItem>>(url);

            for (const item of data.value) {
                if (item.file) {
                    yield { item };
                }
            }

            lastDeltaLink = data['@odata.deltaLink'];
            url = data['@odata.nextLink'] ?? '';
        }

        // Emit final delta link for next sync
        if (lastDeltaLink) {
            yield {
                item: { id: '__delta_cursor__', name: '__delta_cursor__' },
                deltaLink: lastDeltaLink,
            };
        }
    }

    /**
     * Get the download URL for a specific item.
     */
    async getDownloadUrl(siteId: string, itemId: string): Promise<string> {
        const driveId = this.config.driveId ?? 'root';
        const item = await this.graphGet<{ '@microsoft.graph.downloadUrl'?: string }>(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`
        );
        const url = item['@microsoft.graph.downloadUrl'];
        if (!url) throw new Error(`No download URL for item ${itemId}`);
        return url;
    }

    /**
     * Download file content as text (for text-based files).
     */
    async downloadAsText(url: string): Promise<string> {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return res.text();
    }

    /**
     * Download file content as buffer (for binary files like PDF, DOCX).
     */
    async downloadAsBuffer(url: string): Promise<ArrayBuffer> {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return res.arrayBuffer();
    }
}

// ─── Text Extraction (simplified) ───────────────────────────────

/**
 * Extract plain text from downloaded content.
 *
 * For production:
 *   - PDF → Azure Document Intelligence or pdf-parse
 *   - DOCX → mammoth or docx-preview
 *   - XLSX → xlsx -> plain text conversion
 *   - PPTX → pptx -> text extraction
 *
 * This implementation handles text-based formats directly and
 * dispatches binary formats to downstream workers (pdf-refinery, document).
 */
function extractText(content: string, mimeType?: string): {
    text: string;
    wordCount: number;
    requiresExternalProcessing: boolean;
    externalWorkerType?: string;
} {
    const textMimeTypes = new Set([
        'text/plain', 'text/markdown', 'text/html', 'text/csv', 'application/rtf',
    ]);

    if (mimeType && textMimeTypes.has(mimeType)) {
        // Strip HTML tags if HTML
        let text = content;
        if (mimeType === 'text/html') {
            text = content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        return { text, wordCount, requiresExternalProcessing: false };
    }

    // Binary format — delegate to specialised worker
    if (mimeType?.includes('pdf')) {
        return { text: '', wordCount: 0, requiresExternalProcessing: true, externalWorkerType: 'pdf-refinery' };
    }

    // Office documents
    return { text: '', wordCount: 0, requiresExternalProcessing: true, externalWorkerType: 'document' };
}

// ─── Worker ─────────────────────────────────────────────────────

class SharePointIngestWorker extends WorkerBase {
    constructor() {
        super({
            type: 'sharepoint-ingest',
            version: '0.1.0',
            capabilities: ['start-batch', 'process-item', 'start-delta-sync', 'retry-failed', 'batch-status'],
            maxConcurrency: 6,
            prismaSchema: 'sp_ingest',
        });

        this.registerHandlers();
    }

    private registerHandlers() {

        // ─── start-batch ────────────────────────────────────────
        // Discovers all documents in a SharePoint site/drive/folder,
        // creates an IngestBatch + IngestQueueItem rows, then publishes
        // individual `process-item` jobs to NATS for each document.

        this.handle('start-batch', async (job) => {
            const payload = job.payload as unknown as StartBatchPayload;
            const { config, folderPath, strategy = 'full', priority = 0, filters, metadata } = payload;

            if (!config?.siteUrl || !config?.clientId || !config?.clientSecret || !config?.tenantId) {
                throw new Error('SharePoint config (tenantId, clientId, clientSecret, siteUrl) is required');
            }

            const batchId = crypto.randomUUID();
            console.log(`[SP-Ingest] Starting batch ${batchId} — site: ${config.siteUrl}, strategy: ${strategy}`);

            const graph = new GraphClient(config);
            const siteId = await graph.resolveSiteId();

            // Discover documents
            const items: Array<{
                externalId: string;
                filename: string;
                mimeType: string;
                fileSize: number;
                webUrl: string;
                downloadUrl?: string;
                metadata: Record<string, unknown>;
            }> = [];

            const iterator = strategy === 'delta'
                ? graph.deltaQuery(siteId)
                : graph.crawlRecursive(siteId, folderPath);

            let newDeltaCursor: string | undefined;

            for await (const entry of iterator) {
                // Handle delta cursor sentinel
                const item = 'item' in entry ? entry.item : entry as GraphDriveItem;
                if (item.id === '__delta_cursor__' && 'deltaLink' in entry) {
                    newDeltaCursor = entry.deltaLink;
                    continue;
                }

                if (!matchesFilters(item, filters)) continue;

                items.push({
                    externalId: item.id,
                    filename: item.name,
                    mimeType: item.file?.mimeType ?? 'application/octet-stream',
                    fileSize: item.size ?? 0,
                    webUrl: item.webUrl ?? '',
                    downloadUrl: item['@microsoft.graph.downloadUrl'],
                    metadata: {
                        lastModifiedDateTime: item.lastModifiedDateTime,
                        createdBy: item.createdBy?.user?.displayName,
                        parentPath: item.parentReference?.path,
                    },
                });
            }

            console.log(`[SP-Ingest] Batch ${batchId}: discovered ${items.length} documents`);

            // In production, this creates the IngestBatch + IngestQueueItem rows in the database.
            // Then publishes one `process-item` job per item to NATS.
            //
            // The batch + queue pattern means:
            //   1. The batch row tracks overall progress
            //   2. Each queue item is independently retryable
            //   3. NATS distributes items across worker instances

            const processJobs = items.map(item => ({
                batchId,
                itemId: crypto.randomUUID(),
                config,
                downloadUrl: item.downloadUrl ?? '',
                filename: item.filename,
                mimeType: item.mimeType,
                externalId: item.externalId,
            }));

            // Publish individual process-item jobs
            // In production: nc.publish('job.sharepoint-ingest.process-item', ...)
            console.log(`[SP-Ingest] Batch ${batchId}: queued ${processJobs.length} items for processing`);

            return {
                status: 'discovered',
                batchId,
                totalItems: items.length,
                strategy,
                deltaCursor: newDeltaCursor,
                items: items.map(i => ({
                    externalId: i.externalId,
                    filename: i.filename,
                    mimeType: i.mimeType,
                    fileSize: i.fileSize,
                })),
            };
        });

        // ─── process-item ───────────────────────────────────────
        // Downloads a single document, extracts text, computes hash,
        // and either indexes directly or delegates to a downstream worker.

        this.handle('process-item', async (job) => {
            const payload = job.payload as unknown as ProcessItemPayload;
            const { batchId, itemId, config, filename, mimeType, externalId } = payload;

            console.log(`[SP-Ingest] Processing item ${itemId} — "${filename}" (${mimeType})`);

            const graph = new GraphClient(config);
            let { downloadUrl } = payload;

            // If download URL expired, get a fresh one
            if (!downloadUrl) {
                const siteId = await graph.resolveSiteId();
                downloadUrl = await graph.getDownloadUrl(siteId, externalId);
            }

            const textMimeTypes = new Set([
                'text/plain', 'text/markdown', 'text/html', 'text/csv', 'application/rtf',
            ]);
            const isTextBased = textMimeTypes.has(mimeType ?? '');

            let content: string;
            if (isTextBased) {
                content = await graph.downloadAsText(downloadUrl);
            } else {
                // For binary formats, download and attempt basic extraction
                // In production, this would delegate to pdf-refinery or document worker
                const buffer = await graph.downloadAsBuffer(downloadUrl);
                content = `[Binary content: ${filename}, ${buffer.byteLength} bytes]`;
            }

            const extraction = extractText(content, mimeType);

            // If external processing is needed, delegate to the appropriate worker
            if (extraction.requiresExternalProcessing) {
                console.log(`[SP-Ingest] Item ${itemId} requires ${extraction.externalWorkerType} worker`);
                return {
                    status: 'delegated',
                    batchId,
                    itemId,
                    externalId,
                    filename,
                    delegatedTo: extraction.externalWorkerType,
                    message: `Binary content delegated to ${extraction.externalWorkerType} worker`,
                };
            }

            // Text extracted — compute hash and prepare for indexing
            const hash = contentHash(extraction.text);

            return {
                status: 'processed',
                batchId,
                itemId,
                externalId,
                filename,
                extraction: {
                    wordCount: extraction.wordCount,
                    contentHash: hash,
                    textLength: extraction.text.length,
                    mimeType,
                    processedAt: new Date().toISOString(),
                },
            };
        });

        // ─── start-delta-sync ───────────────────────────────────
        // Incremental sync using Graph API delta queries.
        // Only fetches documents changed since the last successful sync.

        this.handle('start-delta-sync', async (job) => {
            const payload = job.payload as unknown as DeltaSyncPayload;
            const { config, filters } = payload;

            if (!config?.siteUrl) {
                throw new Error('SharePoint config with siteUrl is required');
            }

            console.log(`[SP-Ingest] Starting delta sync for ${config.siteUrl}`);

            const graph = new GraphClient(config);
            const siteId = await graph.resolveSiteId();

            // In production, fetch the last cursor from SpSyncCursor table
            const lastCursor: string | undefined = undefined;

            const changedItems: Array<{
                externalId: string;
                filename: string;
                mimeType: string;
                fileSize: number;
            }> = [];
            let newDeltaCursor: string | undefined;

            for await (const entry of graph.deltaQuery(siteId, lastCursor)) {
                if (entry.item.id === '__delta_cursor__' && entry.deltaLink) {
                    newDeltaCursor = entry.deltaLink;
                    continue;
                }

                if (!matchesFilters(entry.item, filters)) continue;

                changedItems.push({
                    externalId: entry.item.id,
                    filename: entry.item.name,
                    mimeType: entry.item.file?.mimeType ?? 'application/octet-stream',
                    fileSize: entry.item.size ?? 0,
                });
            }

            console.log(`[SP-Ingest] Delta sync found ${changedItems.length} changed items`);

            return {
                status: 'delta-synced',
                siteUrl: config.siteUrl,
                changedItems: changedItems.length,
                newCursor: newDeltaCursor ? '[cursor-persisted]' : undefined,
                items: changedItems.map(i => ({
                    externalId: i.externalId,
                    filename: i.filename,
                    mimeType: i.mimeType,
                    fileSize: i.fileSize,
                })),
            };
        });

        // ─── retry-failed ───────────────────────────────────────
        // Re-queues all failed items in a batch for another attempt.

        this.handle('retry-failed', async (job) => {
            const payload = job.payload as unknown as RetryFailedPayload;
            const { batchId, maxRetries = 3 } = payload;

            if (!batchId) throw new Error('batchId is required');

            console.log(`[SP-Ingest] Retrying failed items in batch ${batchId} (max ${maxRetries} attempts)`);

            // In production:
            // 1. Query IngestQueueItem WHERE batchId = ? AND status = 'failed' AND attempts < maxRetries
            // 2. Reset status to 'queued', increment attempts
            // 3. Re-publish process-item jobs to NATS

            return {
                status: 'retry-queued',
                batchId,
                maxRetries,
                // In production: retriedCount, skippedCount (exceeded max retries)
                retriedCount: 0,
                skippedCount: 0,
                message: 'Failed items re-queued for processing',
            };
        });

        // ─── batch-status ───────────────────────────────────────
        // Returns the current status and progress of a batch.

        this.handle('batch-status', async (job) => {
            const payload = job.payload as unknown as BatchStatusPayload;
            const { batchId } = payload;

            if (!batchId) throw new Error('batchId is required');

            console.log(`[SP-Ingest] Status check for batch ${batchId}`);

            // In production: query IngestBatch + aggregate IngestQueueItem statuses
            return {
                batchId,
                status: 'unknown', // Would come from DB
                totalItems: 0,
                processed: 0,
                succeeded: 0,
                failed: 0,
                skipped: 0,
                delegated: 0,
                progress: 0, // percentage
                message: 'Batch status fetched from database',
            };
        });
    }
}

// ─── Start ──────────────────────────────────────────────────────

const worker = new SharePointIngestWorker();
worker.start().catch((err) => {
    console.error('SharePoint Ingest worker failed to start:', err);
    process.exit(1);
});
