/**
 * Document Worker — Handles Office document processing jobs.
 *
 * Job handlers:
 *   - job.document.process   — extract text via Python document-extractor, save .md companion
 *   - job.document.convert   — format conversion (future)
 *   - job.document.thumbnail — generate preview thumbnails (future)
 *
 * Architecture follows the pdf-refinery pattern:
 *   Node.js worker orchestrates → Python FastAPI service does extraction →
 *   Results saved to blob storage + DB.
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { PrismaClient } from '@prisma/client';
import { StringCodec } from 'nats';
import { injectTraceHeaders } from '@surdej/core/node';
import type { Readable } from 'stream';

const prisma = new PrismaClient();
const sc = StringCodec();

// ─── Storage Layer (Azure Blob or S3/MinIO) ─────────────────

const STORAGE_PROVIDER = (process.env['STORAGE_PROVIDER'] || 'MINIO').toUpperCase();
const BUCKET = process.env['STORAGE_BUCKET'] || 'storage';

let azureContainer: ContainerClient | null = null;
if (STORAGE_PROVIDER === 'AZURE') {
    const connStr = process.env['AZURE_STORAGE_CONNECTION_STRING'];
    if (connStr) {
        azureContainer = BlobServiceClient.fromConnectionString(connStr).getContainerClient(BUCKET);
    } else {
        console.warn('[storage] STORAGE_PROVIDER=AZURE but AZURE_STORAGE_CONNECTION_STRING is missing');
    }
}

const s3 = STORAGE_PROVIDER !== 'AZURE' ? new S3Client({
    region: 'us-east-1',
    endpoint: process.env['MINIO_ENDPOINT'] || 'http://localhost:9000',
    credentials: {
        accessKeyId: process.env['MINIO_ROOT_USER'] || 'surdej',
        secretAccessKey: process.env['MINIO_ROOT_PASSWORD'] || 'surdej_dev',
    },
    forcePathStyle: true,
}) : null;

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function fetchFromStorage(storagePath: string): Promise<Buffer> {
    if (STORAGE_PROVIDER === 'AZURE' && azureContainer) {
        const blob = azureContainer.getBlobClient(storagePath);
        return blob.downloadToBuffer();
    }
    const response = await s3!.send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: storagePath,
    }));
    return streamToBuffer(response.Body as Readable);
}

async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<void> {
    if (STORAGE_PROVIDER === 'AZURE' && azureContainer) {
        const blockBlob = azureContainer.getBlockBlobClient(key);
        await blockBlob.upload(body, body.length, {
            blobHTTPHeaders: { blobContentType: contentType },
        });
        return;
    }
    await s3!.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
    }));
}

// ─── Action Log Helper ──────────────────────────────────────

const API_BASE = process.env['API_URL'] || 'http://localhost:4000';

async function logWorkerAction(opts: {
    blobId: string;
    tenantId?: string | null;
    action: string;
    status?: string;
    details?: Record<string, unknown>;
    durationMs?: number | null;
}) {
    try {
        await fetch(`${API_BASE}/api/pdf/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blobId: opts.blobId,
                tenantId: opts.tenantId ?? null,
                action: opts.action,
                status: opts.status ?? 'ok',
                details: opts.details ?? {},
                source: 'worker',
                durationMs: opts.durationMs ?? null,
            }),
            signal: AbortSignal.timeout(5000),
        });
    } catch (err) {
        console.warn(`[action-log] Failed to log ${opts.action} for ${opts.blobId}:`, (err as Error).message);
    }
}

// ─── Job Payload Types ──────────────────────────────────────

interface ProcessPayload {
    documentId: string;
    storagePath: string;
    filename?: string;
    sizeBytes?: number;
}

// ─── Worker ─────────────────────────────────────────────────

const EXTRACTOR_URL = process.env['DOCUMENT_EXTRACTOR_URL'] || 'http://document-extractor:8091';

const worker = new WorkerBase({
    type: 'document',
    version: '1.0.0',
    capabilities: ['process', 'convert', 'thumbnail'],
    maxConcurrency: 8,
    prismaSchema: 'document',
});

// ── job.document.process ────────────────────────────────────
worker.handle<ProcessPayload>('process', async (job) => {
    const { documentId, storagePath, filename } = job.payload;
    console.log(`[document.process] Starting for ${documentId} (${filename ?? storagePath})`);
    const startMs = Date.now();

    // Log extract-start
    logWorkerAction({
        blobId: documentId,
        action: 'extract-start',
        details: { storagePath, filename, engine: 'document-extractor' },
    });

    // Mark blob as processing
    try {
        await prisma.blob.update({
            where: { id: documentId },
            data: { metadata: { status: 'processing', quality: null } },
        });
    } catch (dbErr) {
        console.warn(`[document.process] Could not update blob status to processing:`, dbErr);
    }

    // 1. Fetch document from blob storage
    let fileBuffer: Buffer;
    try {
        fileBuffer = await fetchFromStorage(storagePath);
        console.log(`[document.process] Fetched ${fileBuffer.length} bytes from ${storagePath}`);
    } catch (err) {
        console.error(`[document.process] Failed to fetch from storage:`, err);
        logWorkerAction({
            blobId: documentId,
            action: 'extract-failed',
            status: 'error',
            details: { error: 'Failed to fetch from storage' },
            durationMs: Date.now() - startMs,
        });
        await prisma.blob.update({
            where: { id: documentId },
            data: { metadata: { status: 'failed', quality: 0 } },
        }).catch(() => {});
        return { documentId, error: 'Failed to fetch from storage', quality: 0 };
    }

    // 2. Call Python document-extractor service
    let markdown = '';
    let pageCount = 0;
    let engine = 'unknown';
    let quality = 0;

    try {
        const formData = new FormData();
        const docFilename = filename || storagePath.split('/').pop() || 'document';
        formData.append('file', new Blob([new Uint8Array(fileBuffer)]), docFilename);

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(120_000), // 2 min timeout
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Extractor returned ${res.status}: ${errText}`);
        }

        const result = await res.json() as {
            markdown: string;
            pageCount?: number;
            sheetCount?: number;
            slideCount?: number;
            quality: number;
            engine: string;
            format: string;
        };

        markdown = result.markdown;
        pageCount = result.pageCount ?? result.sheetCount ?? result.slideCount ?? 0;
        engine = result.engine;
        quality = result.quality;

        console.log(`[document.process] Extracted: ${markdown.length} chars, quality=${quality}, engine=${engine}`);
    } catch (err) {
        console.error(`[document.process] Python extractor failed:`, err);
        logWorkerAction({
            blobId: documentId,
            action: 'extract-failed',
            status: 'error',
            details: { error: (err as Error).message, engine: 'document-extractor' },
            durationMs: Date.now() - startMs,
        });
        await prisma.blob.update({
            where: { id: documentId },
            data: { metadata: { status: 'failed', quality: 0 } },
        }).catch(() => {});
        return { documentId, error: (err as Error).message, quality: 0 };
    }

    // 3. Upload extracted .md companion file to storage
    const mdKey = storagePath.replace(/\.[^/.]+$/, '.md');
    try {
        const mdContent = `<!-- Extracted by ${engine} -->\n<!-- Source: ${filename ?? storagePath} -->\n\n${markdown}`;
        await uploadToStorage(mdKey, Buffer.from(mdContent, 'utf-8'), 'text/markdown');
        console.log(`[document.process] Saved companion .md → ${mdKey}`);
    } catch (err) {
        console.warn(`[document.process] Failed to upload .md:`, err);
    }

    // 4. Update blob metadata in DB
    const durationMs = Date.now() - startMs;
    try {
        await prisma.blob.update({
            where: { id: documentId },
            data: {
                metadata: {
                    status: 'completed',
                    quality,
                    pageCount,
                    extractionEngine: engine,
                    extractedAt: new Date().toISOString(),
                },
            },
        });
    } catch (dbErr) {
        console.warn(`[document.process] Failed to update blob metadata:`, dbErr);
    }

    // 5. Log extract-done
    logWorkerAction({
        blobId: documentId,
        action: 'extract-done',
        details: {
            quality,
            pageCount,
            engine,
            markdownLength: markdown.length,
            mdStoragePath: mdKey,
        },
        durationMs,
    });

    // 6. Trigger embed job (if text is substantial enough)
    if (markdown.length > 200) {
        try {
            const js = (worker as any).js;
            if (js) {
                await js.publish('job.pdf-refinery.embed', sc.encode(JSON.stringify({
                    id: `embed-${documentId}`,
                    action: 'embed',
                    payload: {
                        documentId,
                        storagePath: mdKey,
                    },
                })), { headers: injectTraceHeaders() });
                console.log(`[document.process] Triggered embed job for ${documentId}`);
            }
        } catch (natsErr) {
            console.warn(`[document.process] Failed to trigger embed:`, natsErr);
        }
    }

    console.log(`[document.process] ✅ Completed ${documentId} in ${durationMs}ms (quality=${quality})`);
    return { documentId, quality, pageCount, engine, durationMs };
});

// ── job.document.convert (placeholder) ──────────────────────
worker.handle('convert', async (job) => {
    console.log(`[document.convert] ${JSON.stringify(job.payload)}`);
    return { status: 'not-implemented' };
});

// ── job.document.thumbnail (placeholder) ────────────────────
worker.handle('thumbnail', async (job) => {
    console.log(`[document.thumbnail] ${JSON.stringify(job.payload)}`);
    return { status: 'not-implemented' };
});

// Start
worker.start().catch((err) => {
    console.error('Document worker failed to start:', err);
    process.exit(1);
});
