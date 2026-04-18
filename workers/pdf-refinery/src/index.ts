/**
 * PDF Refinery Worker — Handles document processing jobs.
 *
 * Job handlers:
 *   - job.pdf.extract-text    — Extract text from PDF, quality scoring
 *   - job.pdf.ocr             — OCR fallback for low-quality extractions
 *   - job.pdf.analyze         — AI analysis with GPT-4o (structured extraction)
 *   - job.pdf.embed           — Generate embeddings and store in vector DB
 *   - job.pdf.extract-rentals — Extract per-unit rental data from Lejeliste tables
 *
 * Own Prisma schema segment: `pdf_refinery`
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';
import { createHash } from 'crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { PrismaClient } from '@prisma/client';
import { StringCodec } from 'nats';
import { injectTraceHeaders } from '@surdej/core/node';

const prisma = new PrismaClient();
const sc = StringCodec();


// ─── Storage Layer (Azure Blob or S3/MinIO) ─────────────────
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';

const STORAGE_PROVIDER = (process.env['STORAGE_PROVIDER'] || 'MINIO').toUpperCase();
const BUCKET = process.env['STORAGE_BUCKET'] || 'storage';

// Azure Blob client (lazy-initialized)
let azureContainer: ContainerClient | null = null;
if (STORAGE_PROVIDER === 'AZURE') {
    const connStr = process.env['AZURE_STORAGE_CONNECTION_STRING'];
    if (connStr) {
        azureContainer = BlobServiceClient.fromConnectionString(connStr).getContainerClient(BUCKET);
    } else {
        console.warn('[storage] STORAGE_PROVIDER=AZURE but AZURE_STORAGE_CONNECTION_STRING is missing');
    }
}

// S3/MinIO client (only when not Azure)
const s3 = STORAGE_PROVIDER !== 'AZURE' ? new S3Client({
    region: 'us-east-1',
    endpoint: process.env['MINIO_ENDPOINT'] || 'http://localhost:9000',
    credentials: {
        accessKeyId: process.env['MINIO_ROOT_USER'] || 'surdej',
        secretAccessKey: process.env['MINIO_ROOT_PASSWORD'] || 'surdej_dev',
    },
    forcePathStyle: true,
}) : null;

/** Read a stream into a Buffer */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/** Fetch a file from blob storage by its storage key */
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

/** Upload a buffer to blob storage */
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

// ─── Action Log Helper (HTTP callback to API) ──────────────
const API_BASE = process.env['API_URL'] || 'http://localhost:4000';

/** Log a document lifecycle action via the API's POST /api/pdf/actions endpoint */
async function logWorkerAction(opts: {
    blobId: string;
    tenantId?: string | null;
    action: string;
    status?: string;
    details?: Record<string, unknown>;
    durationMs?: number | null;
}) {
    // Broadcast via NATS for real-time SSE streaming
    worker.publish(`event.pdf.rescan.${opts.blobId}`, {
        blobId: opts.blobId,
        tenantId: opts.tenantId ?? null,
        action: opts.action,
        status: opts.status ?? 'ok',
        details: opts.details ?? {},
        durationMs: opts.durationMs ?? null,
        timestamp: new Date().toISOString(),
        source: 'worker',
    });

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
        // Non-fatal: don't break processing if logging fails
        console.warn(`[action-log] Failed to log ${opts.action} for ${opts.blobId}:`, (err as Error).message);
    }
}

// ─── Helpers ────────────────────────────────────────────────


/** Compute content hash for deduplication */
function contentHash(text: string): string {
    return createHash('sha256')
        .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
}

/**
 * Simple text quality scorer (0–100).
 * Heuristic based on character density, word diversity, and structure.
 */
function scoreTextQuality(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const words = text.split(/\s+/);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));

    let score = 0;

    // Length factor — more text generally means better extraction
    const lengthScore = Math.min(words.length / 100, 1) * 25;
    score += lengthScore;

    // Diversity — ratio of unique words to total words
    const diversityScore = words.length > 0
        ? (uniqueWords.size / words.length) * 25
        : 0;
    score += diversityScore;

    // Structure — presence of paragraphs, numbers, and Danish characters
    const hasParagraphs = (text.match(/\n\n/g)?.length ?? 0) > 2;
    const hasNumbers = /\d+/.test(text);
    const hasDanish = /[æøåÆØÅ]/.test(text);
    const hasStructure = /\d+[.,]\d+/.test(text); // Decimal numbers

    if (hasParagraphs) score += 10;
    if (hasNumbers) score += 10;
    if (hasDanish) score += 10;
    if (hasStructure) score += 5;

    // Penalty for garbage characters
    const garbageRatio = (text.match(/[^\w\sæøåÆØÅ.,;:!?\-()[\]"'/\\@#€$%&+*=<>]/g)?.length ?? 0) / text.length;
    score -= garbageRatio * 50;

    // Penalty for very short extractions
    if (words.length < 20) score -= 20;

    return Math.max(0, Math.min(100, Math.round(score)));
}

/** Detect if text appears to contain a rental table (Lejeliste) */
function detectRentalTable(text: string): boolean {
    const markers = [
        /leje\s*liste/i,
        /husleje/i,
        /lejemål/i,
        /leje\s*beløb/i,
        /depositum/i,
        /leje\s*kvarter/i,
        /bolig\s*areal/i,
        /m²|kvm/i,
        /kr\.?\s*\/\s*m/i,
    ];
    const matchCount = markers.filter((m) => m.test(text)).length;
    return matchCount >= 3;
}

/** Simple rental unit extraction from structured text */
interface RentalUnit {
    unitId: string;
    floor?: string;
    area?: number;
    rooms?: number;
    rent?: number;
    rentPerSqm?: number;
    tenantName?: string;
    moveInDate?: string;
    confidence: number;
}

function extractRentalUnits(text: string): RentalUnit[] {
    const units: RentalUnit[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        // Match patterns like: "2. sal th  |  75 m²  |  3 rum  |  8.500 kr"
        const match = line.match(
            /(\d+\.?\s*(?:sal|etage|st|kld)\.?\s*(?:tv|th|mf)?)\s*[|\t,]\s*(\d+)\s*(?:m²|kvm)\s*[|\t,]\s*(\d+)\s*(?:rum|vær)/i
        );

        if (match) {
            const area = parseInt(match[2], 10);
            const rentMatch = line.match(/(\d[\d.]*)\s*(?:kr|DKK)/i);
            const rent = rentMatch ? parseFloat(rentMatch[1].replace(/\./g, '')) : undefined;

            units.push({
                unitId: `unit-${units.length + 1}`,
                floor: match[1].trim(),
                area,
                rooms: parseInt(match[3], 10),
                rent,
                rentPerSqm: rent && area > 0 ? Math.round(rent / area) : undefined,
                confidence: 0.75,
            });
        }
    }

    return units;
}

// ─── Job Payload Types ──────────────────────────────────────

interface ExtractTextPayload {
    documentId: string;
    storagePath: string;
    filename?: string;
    sizeBytes?: number;
    /** Override extraction model (from model registry) */
    extractionModel?: string;
    /** Override analysis model — passed through to analyze job */
    analysisModel?: string;
}

interface OcrPayload {
    documentId: string;
    storagePath: string;
    qualityScore: number;
}

interface AnalyzePayload {
    documentId: string;
    text: string;
    filename: string;
    /** Override analysis model (from model registry) */
    analysisModel?: string;
}

interface EmbedPayload {
    documentId: string;
    storagePath: string; // path to .md companion file in blob storage
}

interface ExtractRentalsPayload {
    documentId: string;
    text: string;
    filename: string;
}

// ─── Worker ─────────────────────────────────────────────────

const worker = new WorkerBase({
    type: 'pdf-refinery',
    version: '1.0.0',
    capabilities: ['extract-text', 'ocr', 'analyze', 'embed', 'extract-rentals', 'extract-images'],
    maxConcurrency: 10,
    prismaSchema: 'pdf_refinery',
});

// ── job.pdf.extract-text ─────────────────────────────────
worker.handle<ExtractTextPayload>('extract-text', async (job) => {
    const { documentId, storagePath, filename, extractionModel: requestedModel, analysisModel } = job.payload;
    console.log(`[extract-text] Starting extraction for ${documentId} (${filename ?? storagePath})${requestedModel ? ` [model: ${requestedModel}]` : ''}`);
    const extractionStartMs = Date.now();
    let extractionPromptUsed: string | undefined;

    // Log extract-start IMMEDIATELY (before any processing)
    logWorkerAction({
        blobId: documentId,
        action: 'extract-start',
        details: { model: requestedModel ?? 'auto', storagePath, filename },
    });

    // Mark blob as processing
    try {
        await prisma.blob.update({
            where: { id: documentId },
            data: { metadata: { status: 'processing', quality: null, pageCount: null, domain: 'pdf' } },
        });
    } catch (dbErr) {
        console.warn(`[extract-text] Could not update blob status to processing:`, dbErr);
    }

    // 1. Fetch PDF from blob storage
    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await fetchFromStorage(storagePath);
        console.log(`[extract-text] Fetched ${pdfBuffer.length} bytes from ${storagePath}`);
    } catch (err) {
        console.error(`[extract-text] Failed to fetch PDF from storage:`, err);
        logWorkerAction({
            blobId: documentId,
            action: 'extract-failed',
            status: 'error',
            details: { error: 'Failed to fetch PDF from storage', model: requestedModel ?? 'auto' },
            durationMs: Date.now() - extractionStartMs,
        });
        await prisma.blob.update({
            where: { id: documentId },
            data: { metadata: { status: 'failed', quality: 0, pageCount: null, domain: 'pdf' } },
        }).catch(() => { });
        return {
            documentId,
            error: 'Failed to fetch PDF from storage',
            quality: 0,
            needsOcr: false,
        };
    }

    // 2. Extract text — tries Mistral Document AI → Python pymupdf4llm → pdfjs-dist
    let extractedText = '';
    let pageCount = 0;
    let pdfDate: string | null = null; // CreationDate or ModDate from PDF metadata
    const extractedImages: { pageNum: number; imageKey: string; width: number; height: number }[] = [];
    const basePath = storagePath.replace(/\/[^/]+$/, '');

    // 1b. Read PDF creation date from document metadata (best-effort)
    let pdfCreationDate: string | null = null;
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const metaDoc = await (pdfjs as typeof import('pdfjs-dist')).getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
        const { info } = await metaDoc.getMetadata();
        const raw = (info as Record<string, unknown>)?.['CreationDate'] as string | undefined;
        if (raw) {
            // PDF date format: D:YYYYMMDDHHmmSSOHH'mm' (e.g. D:20241015142305+02'00')
            const m = raw.match(/^D:(\d{4})(\d{2})(\d{2})/);
            if (m) {
                pdfCreationDate = `${m[1]}-${m[2]}-${m[3]}`;
                console.log(`[extract-text] PDF creation date: ${pdfCreationDate}`);
            }
        }
        await metaDoc.destroy();
    } catch {
        // Non-fatal — not all PDFs have metadata
    }
    let extractionEngine = 'unknown';

    // Extract PDF metadata dates (CreationDate / ModDate) using pdfjs-dist
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
        const info = await doc.getMetadata();
        const pdfInfo = info?.info as Record<string, any> | undefined;
        const rawDate = pdfInfo?.ModDate ?? pdfInfo?.CreationDate ?? null;
        if (rawDate && typeof rawDate === 'string') {
            // PDF date format: D:YYYYMMDDHHmmSS or similar
            const m = rawDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
            if (m) {
                pdfDate = `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}Z`;
            }
        }
        doc.destroy();
        if (pdfDate) console.log(`[extract-text] PDF metadata date: ${pdfDate}`);
    } catch (metaErr) {
        // Non-fatal: some PDFs don't have metadata
        console.warn(`[extract-text] Could not extract PDF metadata dates:`, (metaErr as Error).message);
    }

    const EXTRACTOR_URL = process.env['PDF_EXTRACTOR_URL'] || 'http://pdf-extractor:8090';

    // ── Model dispatch based on requested model or auto-detect ──
    const mistralEndpoint = process.env['MISTRAL_ENDPOINT']?.replace(/\/$/, '');
    const mistralKey = process.env['MISTRAL_API_KEY'];
    const mistralModel = process.env['MISTRAL_DOCUMENT_MODEL'] || 'mistral-document-ai-2512';

    const azureDocIntEndpoint = process.env['AZURE_OPENAI_ENDPOINT']
        ?.replace('.openai.azure.com', '.cognitiveservices.azure.com')
        ?.replace(/\/$/, '');
    const azureDocIntKey = process.env['AZURE_OPENAI_API_KEY'];

    // Determine which extraction engine to use
    const shouldUseMistral = requestedModel === 'mistral-document-ai-2512' || (!requestedModel && mistralEndpoint && mistralKey);
    const shouldUseAzureDI = requestedModel === 'azure-document-intelligence' || (!requestedModel && !shouldUseMistral && azureDocIntEndpoint && azureDocIntKey);
    const shouldUsePymupdf = requestedModel === 'pymupdf4llm';
    const shouldUsePdfjs = requestedModel === 'pdfjs-dist';

    // ── Try Mistral Document AI ──
    if (shouldUseMistral && mistralEndpoint && mistralKey) {
        try {
            console.log(`[extract-text] Trying Mistral Document AI (${mistralModel})...`);

            // Encode PDF as base64 for the vision API
            const pdfBase64 = pdfBuffer.toString('base64');
            const chatUrl = `${mistralEndpoint}/v1/chat/completions`;

            const res = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${mistralKey}`,
                },
                body: JSON.stringify({
                    model: mistralModel,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'document_url',
                                    document_url: `data:application/pdf;base64,${pdfBase64}`,
                                },
                                {
                                    type: 'text',
                                    text: (extractionPromptUsed = 'Extract the full content of this document as clean, well-structured markdown. Preserve all tables, headings, lists, and formatting. Include all text verbatim — do not summarize or omit any content.'),
                                },
                            ],
                        },
                    ],
                    max_completion_tokens: 16384,
                }),
                signal: AbortSignal.timeout(180_000), // 3 min timeout for large documents
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Mistral API ${res.status}: ${body}`);
            }

            const data = await res.json() as {
                choices: { message: { content: string } }[];
                usage?: { prompt_tokens: number; completion_tokens: number };
            };
            extractedText = data.choices?.[0]?.message?.content ?? '';

            if (extractedText) {
                extractionEngine = 'mistral-document-ai';

                // Estimate page count from page breaks or content length
                const pageBreaks = extractedText.match(/---/g)?.length ?? 0;
                pageCount = pageBreaks > 0 ? pageBreaks + 1 : Math.max(1, Math.ceil(extractedText.length / 3000));

                const tokens = data.usage;
                console.log(
                    `[extract-text] ✅ Mistral Document AI succeeded: ${extractedText.length} chars, ` +
                    `~${pageCount} pages` +
                    (tokens ? `, ${tokens.prompt_tokens}+${tokens.completion_tokens} tokens` : '')
                );
                logWorkerAction({ blobId: documentId, action: 'text-extracted', details: { engine: 'mistral-document-ai', chars: extractedText.length, pages: pageCount, ...(tokens ? { promptTokens: tokens.prompt_tokens, completionTokens: tokens.completion_tokens } : {}) } });
            } else {
                throw new Error('Mistral returned empty content');
            }
        } catch (mistralErr) {
            console.warn(`[extract-text] Mistral Document AI failed, falling back:`, mistralErr);
            extractedText = '';
            pageCount = 0;
        }
    }

    // ── Try Azure Document Intelligence ──
    if (!extractedText && (shouldUseAzureDI || (!requestedModel && !extractedText)) && azureDocIntEndpoint && azureDocIntKey) {
        try {
            console.log(`[extract-text] Trying Azure Document Intelligence (prebuilt-layout)...`);
            const analyzeUrl = `${azureDocIntEndpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?outputContentFormat=markdown&api-version=2024-11-30`;
            const submitRes = await fetch(analyzeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/pdf', 'Ocp-Apim-Subscription-Key': azureDocIntKey },
                body: new Uint8Array(pdfBuffer),
                signal: AbortSignal.timeout(30_000),
            });
            if (!submitRes.ok) throw new Error(`Submit failed ${submitRes.status}: ${await submitRes.text()}`);
            const operationUrl = submitRes.headers.get('Operation-Location');
            if (!operationUrl) throw new Error('No Operation-Location header');

            let result: any = null;
            for (let poll = 0; poll < 60; poll++) {
                await new Promise(r => setTimeout(r, 5000));
                const pollRes = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': azureDocIntKey }, signal: AbortSignal.timeout(15_000) });
                if (!pollRes.ok) throw new Error(`Poll failed ${pollRes.status}`);
                const pollData = await pollRes.json() as { status: string; analyzeResult?: any; error?: any };
                if (pollData.status === 'succeeded') { result = pollData.analyzeResult; break; }
                if (pollData.status === 'failed') throw new Error(`Analysis failed: ${JSON.stringify(pollData.error)}`);
                if (poll % 6 === 0) console.log(`[extract-text] Still analyzing... (${poll * 5}s)`);
            }
            if (!result) throw new Error('Timed out');
            extractedText = result.content || '';
            pageCount = result.pages?.length ?? 0;
            extractionEngine = 'azure-document-intelligence';
            console.log(`[extract-text] ✅ Azure DI: ${extractedText.length} chars, ${pageCount} pages`);
            logWorkerAction({ blobId: documentId, action: 'text-extracted', details: { engine: 'azure-document-intelligence', chars: extractedText.length, pages: pageCount } });
        } catch (azErr) {
            console.warn(`[extract-text] Azure DI failed, falling back:`, azErr);
            extractedText = '';
            pageCount = 0;
        }
    }

    // ── Fallback: Try Python pymupdf4llm extractor ──
    if (!extractedText && !shouldUsePdfjs) {
        try {
            console.log(`[extract-text] Trying Python extractor at ${EXTRACTOR_URL}...`);
            const formData = new FormData();
            formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), filename ?? 'document.pdf');

            const extractorResponse = await fetch(`${EXTRACTOR_URL}/extract?write_images=true&page_chunks=false`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(120_000), // 2 min timeout for large PDFs
            });

            if (!extractorResponse.ok) {
                throw new Error(`Extractor returned ${extractorResponse.status}: ${await extractorResponse.text()}`);
            }

            const result = await extractorResponse.json() as {
                markdown: string;
                pageCount: number;
                quality: number;
                imageCount: number;
                images: { filename: string; size: number; mimeType: string; base64: string }[];
                engine: string;
            };

            extractedText = result.markdown;
            pageCount = result.pageCount;
            extractionEngine = result.engine ?? 'pymupdf4llm';

            // ── Upload extracted images to storage and fix markdown references ──
            if (result.images && result.images.length > 0) {
                console.log(`[extract-text] Uploading ${result.images.length} images to storage...`);
                for (const img of result.images) {
                    try {
                        const imgBuffer = Buffer.from(img.base64, 'base64');
                        const imgKey = `${basePath}/images/${img.filename}`;
                        await uploadToStorage(imgKey, imgBuffer, img.mimeType);

                        // Replace the local temp path reference in markdown with storage URL
                        // pymupdf4llm generates refs like ![img](images/filename.png)
                        const localRef = `images/${img.filename}`;
                        const storageRef = `/api/blobs/storage/${imgKey}`;
                        extractedText = extractedText.replaceAll(localRef, storageRef);

                        extractedImages.push({
                            pageNum: 0, // pymupdf4llm doesn't track page per image
                            imageKey: imgKey,
                            width: 0,
                            height: 0,
                        });
                    } catch (imgErr) {
                        console.warn(`[extract-text] Failed to upload image ${img.filename}:`, imgErr);
                    }
                }
                console.log(`[extract-text] ✅ Uploaded ${extractedImages.length} images`);
                logWorkerAction({ blobId: documentId, action: 'images-extracted', details: { engine: extractionEngine, imageCount: extractedImages.length, imageKeys: extractedImages.map(i => i.imageKey) } });
            }

            console.log(`[extract-text] ✅ Python extractor succeeded: ${extractedText.length} chars, ${pageCount} pages, ${extractedImages.length} images, engine=${extractionEngine}`);
            logWorkerAction({ blobId: documentId, action: 'text-extracted', details: { engine: extractionEngine, chars: extractedText.length, pages: pageCount, images: extractedImages.length } });

        } catch (pyErr) {
            // ── Fallback to pdfjs-dist ──
            console.warn(`[extract-text] Python extractor unavailable, falling back to pdfjs-dist:`, pyErr);
            extractionEngine = 'pdfjs-dist';

            try {
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
                pageCount = doc.numPages;

                interface TextItem { str: string; transform: number[]; fontName: string; hasEOL: boolean; width: number; height: number; }
                function getFontSize(item: TextItem): number { return Math.max(Math.abs(item.transform[0]), Math.abs(item.transform[3])); }
                function isBoldFont(fontName: string): boolean { const l = fontName.toLowerCase(); return l.includes('bold') || l.includes('black') || l.includes('heavy'); }

                const pageTexts: string[] = [];
                for (let i = 1; i <= pageCount; i++) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    const items = content.items as TextItem[];

                    if (items.length === 0) { pageTexts.push(''); continue; }

                    const fontSizes = items.filter((it: TextItem) => it.str.trim()).map((it: TextItem) => getFontSize(it));
                    const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a: number, b: number) => a + b, 0) / fontSizes.length : 12;

                    interface LineGroup { y: number; items: TextItem[]; fontSize: number; isBold: boolean; }
                    const lines: LineGroup[] = [];

                    for (const item of items) {
                        if (!item.str && !item.hasEOL) continue;
                        const y = Math.round(item.transform[5]);
                        const fs = getFontSize(item);
                        const bold = isBoldFont(item.fontName);
                        let line = lines.find(l => Math.abs(l.y - y) <= 2);
                        if (!line) { line = { y, items: [], fontSize: fs, isBold: bold }; lines.push(line); }
                        line.items.push(item);
                        if (fs > line.fontSize) line.fontSize = fs;
                        if (bold) line.isBold = true;
                    }

                    lines.sort((a, b) => b.y - a.y);
                    for (const line of lines) line.items.sort((a, b) => a.transform[4] - b.transform[4]);

                    const mdLines: string[] = [];
                    let prevY = lines.length > 0 ? lines[0].y : 0;

                    for (const line of lines) {
                        const lineText = line.items.map(it => it.str).join('').trim();
                        if (!lineText) continue;
                        const yGap = prevY - line.y;
                        const isLargeGap = yGap > line.fontSize * 1.8;
                        const sizeRatio = line.fontSize / avgFontSize;

                        if (sizeRatio > 1.8 && lineText.length < 120) {
                            if (isLargeGap) mdLines.push('');
                            mdLines.push(`# ${lineText}`);
                        } else if (sizeRatio > 1.3 && lineText.length < 120) {
                            if (isLargeGap) mdLines.push('');
                            mdLines.push(`## ${lineText}`);
                        } else if ((sizeRatio > 1.1 || line.isBold) && lineText.length < 100 && isLargeGap) {
                            mdLines.push(''); mdLines.push(`### ${lineText}`);
                        } else {
                            const allBold = line.items.every(it => isBoldFont(it.fontName));
                            if (isLargeGap && mdLines.length > 0) mdLines.push('');
                            mdLines.push(allBold ? `**${lineText}**` : lineText);
                        }
                        prevY = line.y;
                    }

                    pageTexts.push(mdLines.join('\n'));
                }

                extractedText = pageTexts.join('\n\n---\n\n');
                console.log(`[extract-text] pdfjs fallback: ${extractedText.length} chars, ${pageCount} pages`);
                logWorkerAction({ blobId: documentId, action: 'text-extracted', details: { engine: 'pdfjs-dist', chars: extractedText.length, pages: pageCount } });
            } catch (err) {
                console.error(`[extract-text] PDF parsing failed (all extractors):`, err);
                logWorkerAction({
                    blobId: documentId,
                    action: 'extract-failed',
                    status: 'error',
                    details: { error: 'All extractors failed', model: requestedModel ?? 'auto' },
                    durationMs: Date.now() - extractionStartMs,
                });
                await prisma.blob.update({
                    where: { id: documentId },
                    data: { metadata: { status: 'failed', quality: 0, pageCount: 0, domain: 'pdf', lastError: 'All text extractors failed — document may require OCR processing or manual review' } },
                }).catch(() => { });
                return { documentId, error: 'PDF parsing failed', quality: 0, needsOcr: true, pageCount: 0 };
            }
        }
    } // end if (!extractedText)

    // 3. Score text quality
    const quality = scoreTextQuality(extractedText);
    console.log(`[extract-text] Quality score: ${quality}/100 (engine: ${extractionEngine})`);

    // 4. Store extracted markdown text as a companion file in blob storage
    {
        const mdKey = storagePath.replace(/\.pdf$/i, '.md');

        // Build markdown with header
        let mdContent = `# ${filename ?? 'Document'}\n\n` +
            `> Extracted from PDF · ${pageCount} pages · Quality: ${quality}/100 · Engine: ${extractionEngine}\n\n---\n\n`;

        if (extractedText.length > 0) {
            if (extractionEngine === 'mistral-document-ai' || extractionEngine === 'azure-document-intelligence') {
                // AI-powered engines already provide well-structured markdown — use as-is
                mdContent += extractedText;
            } else {
                // Split text by page separators and insert images at the right locations
                const pageTexts = extractedText.split('\n\n---\n\n');
                for (let i = 0; i < pageTexts.length; i++) {
                    const pageNum = i + 1;
                    mdContent += pageTexts[i] + '\n\n';

                    // Insert any images from this page
                    const pageImages = extractedImages.filter(img => img.pageNum === pageNum);
                    for (const img of pageImages) {
                        mdContent += `![Page ${pageNum} image](/api/blobs/storage/${img.imageKey})\n\n`;
                    }

                    // Page break between pages
                    if (i < pageTexts.length - 1) {
                        mdContent += '---\n\n';
                    }
                }
            }
        } else {
            mdContent += '*No text content extracted from this document.*\n\n';

            // Still include all images even if no text
            for (const img of extractedImages) {
                mdContent += `![Page ${img.pageNum} image](/api/blobs/storage/${img.imageKey})\n\n`;
            }
        }

        try {
            await uploadToStorage(mdKey, Buffer.from(mdContent, 'utf-8'), 'text/markdown');
            console.log(`[extract-text] Saved markdown to ${mdKey}`);
        } catch (err) {
            console.warn(`[extract-text] Failed to save markdown:`, err);
        }
    }

    // 5. If quality is too low, signal OCR fallback but still trigger analysis
    if (quality < 40) {
        console.log(`[extract-text] Low quality (${quality}) — flagging for OCR, still triggering analysis`);
        const hasRentalDataLow = extractedText.length > 0 ? detectRentalTable(extractedText) : false;
        const hashLow = extractedText.length > 0 ? contentHash(extractedText) : undefined;
        await prisma.blob.update({
            where: { id: documentId },
            data: {
                metadata: {
                    status: 'completed', quality, pageCount, domain: 'pdf' as const,
                    hasRentalData: hasRentalDataLow, extractionEngine,
                    extractionModel: requestedModel ?? extractionEngine as any,
                    extractedAt: new Date().toISOString(),
                    extractionDurationMs: Date.now() - extractionStartMs,
                    extractionPrompt: extractionPromptUsed,
                    extractedChars: extractedText.length,
                    needsOcr: true,
                    ...(hashLow ? { contentHash: hashLow } : {}),
                }
            },
        }).catch(() => { });

        // Still trigger embedding + analysis + image extraction even for low-quality extractions
        if (extractedText.length > 0) {
            await publishEmbedJob(worker, documentId, storagePath);
            await publishAnalyzeJob(worker, documentId, extractedText, filename ?? 'document.pdf', storagePath, analysisModel);
        }
        await publishExtractImagesJob(worker, documentId, storagePath);

        logWorkerAction({
            blobId: documentId,
            action: 'extract-done',
            details: {
                model: requestedModel ?? extractionEngine,
                quality,
                pageCount,
                charCount: extractedText.length,
                engine: extractionEngine,
                needsOcr: true,
            },
            durationMs: Date.now() - extractionStartMs,
        });

        return {
            documentId,
            quality,
            text: extractedText,
            needsOcr: true,
            pageCount,
            hasRentalData: hasRentalDataLow,
        };
    }

    // 6. Text is usable — proceed
    const hash = contentHash(extractedText);
    const hasRentalData = detectRentalTable(extractedText);

    // Update blob metadata to completed
    try {
        await prisma.blob.update({
            where: { id: documentId },
            data: {
                metadata: {
                    status: 'completed', quality, pageCount, domain: 'pdf' as const,
                    hasRentalData, contentHash: hash, extractionEngine,
                    extractionModel: requestedModel ?? extractionEngine as any,
                    extractedAt: new Date().toISOString(),
                    extractionDurationMs: Date.now() - extractionStartMs,
                    extractionPrompt: extractionPromptUsed,
                    extractedChars: extractedText.length,
                    ...(pdfDate ? { pdfDate } : {}),
                    ...(extractedImages.length > 0 ? { imageKeys: extractedImages.map(i => i.imageKey) } : {}),
                }
            },
        });
        console.log(`[extract-text] ✅ ${documentId} completed — quality: ${quality}, pages: ${pageCount}, engine: ${extractionEngine}, ${Date.now() - extractionStartMs}ms`);
    } catch (dbErr) {
        console.warn(`[extract-text] Could not update blob status to completed:`, dbErr);
    }

    // Auto-trigger embedding + AI analysis + image extraction
    await publishEmbedJob(worker, documentId, storagePath);
    await publishAnalyzeJob(worker, documentId, extractedText, filename ?? 'document.pdf', storagePath, analysisModel);
    await publishExtractImagesJob(worker, documentId, storagePath);

    // Log extract-done
    logWorkerAction({
        blobId: documentId,
        action: 'extract-done',
        details: {
            model: requestedModel ?? extractionEngine,
            quality,
            pageCount,
            charCount: extractedText.length,
            engine: extractionEngine,
        },
        durationMs: Date.now() - extractionStartMs,
    });

    return {
        documentId,
        quality,
        text: extractedText,
        hash,
        pageCount,
        hasRentalData,
        needsOcr: false,
    };
});

// ── Auto-trigger embedding after extraction ─────────────────
// Helper: publish an embed job for a document via NATS JetStream
async function publishEmbedJob(worker: WorkerBase, documentId: string, storagePath: string) {
    try {
        // Access the JetStream client from the worker (private field)
        const js = (worker as any).js;
        if (!js) {
            // Fallback: try core NATS publish
            const nc = (worker as any).nc;
            if (nc && !nc.isClosed()) {
                const mdPath = storagePath.replace(/\.pdf$/i, '.md');
                nc.publish('job.pdf-refinery.embed', sc.encode(JSON.stringify({
                    id: `embed-${documentId}`,
                    action: 'embed',
                    payload: { documentId, storagePath: mdPath },
                })));
                console.log(`[extract-text] Published embed job (core NATS) for ${documentId}`);
            }
            return;
        }

        // storagePath points to .pdf — derive .md path
        const mdPath = storagePath.replace(/\.pdf$/i, '.md');
        const jobMessage = {
            id: `embed-${documentId}`,
            action: 'embed',
            payload: { documentId, storagePath: mdPath },
        };
        await js.publish('job.pdf-refinery.embed', sc.encode(JSON.stringify(jobMessage)), { headers: injectTraceHeaders() });
        console.log(`[extract-text] Published embed job for ${documentId}`);
    } catch (err) {
        console.warn(`[extract-text] Failed to publish embed job:`, err);
    }
}

// Helper: publish an analyze job for a document via NATS
async function publishAnalyzeJob(worker: WorkerBase, documentId: string, text: string, filename: string, storagePath: string, analysisModel?: string) {
    try {
        const nc = (worker as any).nc;
        if (!nc || nc.isClosed()) return;

        // Truncate text to avoid huge NATS messages (GPT-4o has its own context window)
        const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n\n[...truncated...]' : text;
        const jobMessage = {
            id: `analyze-${documentId}`,
            action: 'analyze',
            payload: { documentId, text: truncated, filename, storagePath, analysisModel },
        };

        const js = (worker as any).js;
        if (js) {
            await js.publish('job.pdf-refinery.analyze', sc.encode(JSON.stringify(jobMessage)), { headers: injectTraceHeaders() });
        } else {
            nc.publish('job.pdf-refinery.analyze', sc.encode(JSON.stringify(jobMessage)));
        }
        console.log(`[extract-text] Published analyze job for ${documentId}${analysisModel ? ` [model: ${analysisModel}]` : ''}`);
    } catch (err) {
        console.warn(`[extract-text] Failed to publish analyze job:`, err);
    }
}

// Helper: publish an extract-images job for a document via NATS
async function publishExtractImagesJob(worker: WorkerBase, documentId: string, storagePath: string) {
    try {
        const nc = (worker as any).nc;
        if (!nc || nc.isClosed()) return;

        const jobMessage = {
            id: `extract-images-${documentId}`,
            action: 'extract-images',
            payload: { documentId, storagePath },
        };

        const js = (worker as any).js;
        if (js) {
            await js.publish('job.pdf-refinery.extract-images', sc.encode(JSON.stringify(jobMessage)), { headers: injectTraceHeaders() });
        } else {
            nc.publish('job.pdf-refinery.extract-images', sc.encode(JSON.stringify(jobMessage)));
        }
        console.log(`[extract-text] Published extract-images job for ${documentId}`);
    } catch (err) {
        console.warn(`[extract-text] Failed to publish extract-images job:`, err);
    }
}

// ── job.pdf.ocr ──────────────────────────────────────────
worker.handle<OcrPayload>('ocr', async (job) => {
    const { documentId, qualityScore } = job.payload;
    console.log(`[ocr] OCR fallback for ${documentId} (original quality: ${qualityScore})`);

    // TODO: Use Azure Document Intelligence for scanned PDFs
    // For now, return the existing text with a note
    return {
        documentId,
        quality: qualityScore,
        text: '[OCR not yet implemented — use Azure Document Intelligence]',
        ocrProvider: 'pending',
    };
});

// ── job.pdf.analyze ──────────────────────────────────────
// AI structured analysis of extracted document text.
// Produces: 1) .analysis.md in blob storage, 2) validated BlobAnalysis in Blob.analysis JSONB

interface AnalyzePayloadExt extends AnalyzePayload {
    storagePath?: string;
}

worker.handle<AnalyzePayloadExt>('analyze', async (job) => {
    const { documentId, filename, storagePath, analysisModel: requestedModel } = job.payload;
    let { text } = job.payload;
    const model = requestedModel || process.env['AZURE_OPENAI_MODEL_HIGH'] || process.env['AZURE_OPENAI_MODEL_MEDIUM'] || 'gpt-4o';
    const analysisStartMs = Date.now();
    let markdownPromptUsed: string | undefined;
    let structuredPromptUsed: string | undefined;
    console.log(`[analyze] AI analysis for ${documentId}: ${filename} [model: ${model}]`);

    // Log analyze-start IMMEDIATELY
    logWorkerAction({
        blobId: documentId,
        action: 'analyze-start',
        details: { model, filename },
    });

    // ── 0. If text is empty, fetch from .md storage (re-analyze scenario) ──
    if (!text || text.trim().length === 0) {
        try {
            const mdPath = (storagePath ?? '').replace(/\.pdf$/i, '.md');
            if (mdPath) {
                console.log(`[analyze] No text in payload — fetching from storage: ${mdPath}`);
                const mdBuffer = await fetchFromStorage(mdPath);
                text = mdBuffer.toString('utf-8');
                console.log(`[analyze] Fetched ${text.length} chars from ${mdPath}`);
                logWorkerAction({ blobId: documentId, action: 'text-fetched-from-storage', details: { storagePath: mdPath, chars: text.length } });
            }
        } catch (fetchErr) {
            console.warn(`[analyze] Could not fetch .md from storage:`, fetchErr);
        }
    }

    if (!text || text.trim().length === 0) {
        console.warn(`[analyze] No text available for ${documentId} — skipping analysis`);
        // Update blob metadata to indicate analysis failure
        try {
            const existing = await prisma.blob.findUnique({ where: { id: documentId }, select: { metadata: true } });
            const prevMeta = (existing?.metadata as Record<string, unknown> ?? {});
            await prisma.blob.update({
                where: { id: documentId },
                data: {
                    metadata: {
                        ...prevMeta,
                        analyzed: false,
                        lastError: 'No extracted text available for analysis — ensure document extraction completed successfully',
                        attempts: ((prevMeta.attempts as number) ?? 0) + 1,
                    },
                },
            });
        } catch (dbErr) {
            console.warn(`[analyze] Could not update blob metadata for no-text failure:`, dbErr);
        }
        logWorkerAction({
            blobId: documentId,
            action: 'analyze-failed',
            status: 'error',
            details: { error: 'No text available for analysis', model, filename },
            durationMs: Date.now() - analysisStartMs,
        });
        return { documentId, error: 'No text available for analysis' };
    }

    // ── 1. Heuristic pre-analysis ──
    const hasRentalData = detectRentalTable(text);
    const language = /[æøåÆØÅ]/.test(text) ? 'da' : 'en';
    const wordCount = text.split(/\s+/).length;

    logWorkerAction({ blobId: documentId, action: 'heuristic-pre-analysis', details: { language, wordCount, hasRentalData, textLength: text.length } });

    // ── 2. Extract address candidate from raw text (regex heuristic) ──
    // This is stored as a fallback; the AI-extracted address takes precedence.
    const regexAddress = extractAddressFromText(text);
    if (regexAddress) {
        console.log(`[analyze] Regex address candidate: "${regexAddress}"`);
    }

    // ── 3. AI Analysis (markdown + structured JSON) ──
    let aiAnalysis = '';
    let structuredAnalysis: Record<string, unknown> | null = null;
    let addressWash: Record<string, unknown> | null = null;
    const azureEndpoint = process.env['AZURE_OPENAI_ENDPOINT']?.replace(/\/$/, '');
    const azureKey = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-08-01-preview';

    if (azureEndpoint && azureKey) {
        try {
            // ── Pass 1: Markdown analysis ──
            const systemPrompt = (markdownPromptUsed = `Du er en dansk ejendomsanalytiker. Analyser det vedlagte dokument og skriv en struktureret analyse på dansk i markdown-format.

Brug følgende struktur:

# Ejendomsanalyse: [Adresse eller dokumentnavn]

## Resumé
Kort opsummering af dokumentets indhold (2-3 sætninger).

## Dokumenttype
Hvilken type dokument er dette? (f.eks. vurderingsrapport, lejeliste, tinglysning, BBR-meddelelse, energimærkning, forsikringspolice, etc.)

## Nøgletal
| Parameter | Værdi |
|---|---|
| (relevante nøgletal fra dokumentet) |

## Ejendomsoplysninger
Adresse, matrikelnummer, ejendomsnummer, BBR-data, etc. — alt hvad der kan identificeres.

## Økonomisk Overblik
Leje, driftsudgifter, afkast, vurdering, etc.

## Lejeforhold
Hvis dokumentet indeholder lejedata: antal lejemål, gennemsnitlig husleje, tomgang, etc.

## Teknisk Stand
Ejendomens tilstand, vedligeholdelse, energimærke, etc.

## Risici & Opmærksomhedspunkter
Eventuelle risici, mangler, eller punkter der kræver opmærksomhed.

## Konklusion
Samlet vurdering og anbefaling.

Hvis et afsnit ikke er relevant for dokumentet, udelad det. Vær præcis og brug data fra dokumentet.`);

            const docText = text.length > 25000 ? text.slice(0, 25000) + '\n\n[...dokument forkortet...]' : text;

            const chatUrl = `${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
            const res = await fetch(chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': azureKey },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Dokument: ${filename}\n\n${docText}` },
                    ],
                    max_completion_tokens: 4000,
                }),
                signal: AbortSignal.timeout(180_000),  // 3 minute timeout for markdown analysis
            });

            if (!res.ok) throw new Error(`${model} API ${res.status}: ${await res.text()}`);
            const data = await res.json() as { choices: { message: { content: string } }[] };
            aiAnalysis = data.choices?.[0]?.message?.content ?? '';
            console.log(`[analyze] ✅ Markdown analysis: ${aiAnalysis.length} chars`);
            logWorkerAction({ blobId: documentId, action: 'markdown-analysis-done', details: { model, chars: aiAnalysis.length } });

            // ── Pass 2: Structured JSON extraction ──
            try {
                logWorkerAction({ blobId: documentId, action: 'json-extraction-start', details: { model, textLength: docText.length } });
                const jsonPrompt = (structuredPromptUsed = `Extract structured data from this Danish property document as JSON. Return ONLY valid JSON matching this schema:
{
  "summary": "string — document summary",
  "keyInformation": ["string array of key facts"],
  "prospectId": "broker's own prospect/listing reference code as printed in the document header or filename (e.g. 'ID18122'). Set to null if not found.",
  "propertyDescription": "full verbatim property description/marketing text as it appears in the prospectus — do NOT truncate or summarise",
  "broker": { "companyName": "name of the selling broker/agent firm (e.g. 'Colliers', 'Nordicals', 'Cushman & Wakefield RED')" },
  "property": {
    "address": "full address as written in the document",
    "postalCode": "4-digit Danish postal code",
    "city": "city name",
    "region": "one of: Nordjylland, Midtjylland, Syddanmark, Sjælland, Hovedstaden",
    "municipality": "kommune (optional)",
    "matrikelNr": "cadastral number / matrikelnummer (e.g. '5a' or '12ab, Hvidovre By' — include partial if found)",
    "bfeNumber": number or null — BFE-nummer (Bestemt Fast Ejendom) if stated in the document,
    "propertyType": "Bolig/Erhverv/Kontor/Lager/Detail/Mixed — Detail = butikslejemål / retail storefront; Erhverv = general commercial (not retail)",
    "constructionYear": number or null,
    "renovationYear": number or null,
    "energyRating": "A2015/B/C/etc (optional)",
    "heatingType": "Fjernvarme/gas/etc (optional)",
    "areas": { "grundareal": number, "bebyggetAreal": number, "totalFloorArea": number, "residentialArea": number, "commercialArea": number },
    "numberOfUnits": number or null,
    "condition": "text (optional)"
  },
  "seller": "string — name of the selling broker/agent (mægler/formidler), e.g. 'Colliers', 'EDC Erhverv', 'Nybolig Erhverv'. Look for logos, headers, contact info, 'Sælger', 'Mægler', 'Formidler', 'Udbyder' on the front page or last page. Return null if not found.",
  "financials": {
    "salePrice": number or null,
    "pricePerSqm": number or null,
    "netYield": number as a decimal between 0 and 1 (e.g. 0.055 for 5.5% — NEVER return as percentage like 5.5) or null,
    "publicValuation": number or null,
    "annualRentIncome": number or null,
    "annualOperatingCosts": number or null — this is a PROPERTY-LEVEL aggregate, never per unit,
    "netIncome": number or null,
    "rentType": "'netto' or 'brutto' — whether the stated rent/yield is net or gross. Look for 'nettoleje', 'bruttoleje', 'netto afkast', 'brutto afkast'. Return null if not determinable."
  },
  "expenses": [{ "label": "string", "labelDa": "string", "amount": number }],
  "leaseTerms": {
    "totalUnits": number, "vacantUnits": number,
    "averageRentPerSqm": number, "totalAnnualIncome": number,
    "rentRegulation": "text",
    "units": [{
      "address": "str including floor/side e.g. 'Gaden 5, st. tv.'",
      "type": "Bolig/Erhverv/Kontor/Lager/Detail — Detail = butik/retail, Erhverv = general commercial (NOT retail)",
      "specificUsage": "fine-grained usage sub-type for this unit. For Bolig: one of 'Fri leje', 'Omkostningsbestemt leje', 'Småejendom (fri leje)', 'Rækkehus', 'Andelsbolig', 'Almennyttig bolig'. For Erhverv/Detail/Kontor/Lager: the specific use as stated (e.g. 'Butik', 'Kontor', 'Lager', 'Restaurant'). Extract verbatim if available.",
      "areaSqm": number — MUST be the individual unit area from the per-unit row, NOT the building total,
      "annualRent": number,
      "rentType": "Netto or Brutto — whether the stated rent excludes or includes operating costs. Derive from document context (look for 'netto leje', 'brutto leje', 'ekskl. drift', 'inkl. drift'). Default to 'Brutto' for Bolig if not stated.",
      "prepaidRent": number or null — forudbetalt leje amount in DKK (often 1 or 3 months rent, listed alongside depositum),
      "matrikelNr": "cadastral number for this specific unit if stated (optional)",
      "postalCode": "4-digit postal code for this unit (optional, use property-level if not stated per unit)",
      "city": "city for this unit (optional, use property-level if not stated per unit)",
      "floor": "floor/etage e.g. 'st.', '1. sal', 'kld.' (optional)",
      "anvendelse": "full usage/purpose description — extract the COMPLETE text, do NOT truncate",
      "lejefastsaettelse": "rent setting type — ONLY for Bolig units (e.g. 'fri lejefastsættelse', 'omkostningsbestemt leje'). Set to null for Erhverv/Kontor/Detail/Lager",
      "lejeregulering": "rent regulation clause (e.g. 'nettoprisindeks', 'fast 3% p.a.')",
      "lejestart": "lease commencement/start date",
      "uopsigelighed": "notice/irrevocability period (e.g. '5 år fra lejestart') — DEPRECATED, prefer the split fields below",
      "opsigelsesvarsel": "notice period for termination (e.g. '6 måneder', '3 måneder') — opsigelsesvarsel",
      "uopsigelighedUdlejer": "landlord irrevocability period (e.g. '10 år fra lejestart') — uopsigelighed for udlejer",
      "uopsigelighedLejer": "tenant irrevocability period (e.g. '5 år fra lejestart') — uopsigelighed for lejer",
      "indvendigVedligehold": "who handles interior maintenance (e.g. 'lejer', 'udlejer', 'delt') — indvendig vedligeholdelse",
      "udvendigVedligehold": "who handles exterior maintenance (e.g. 'udlejer', 'lejer', 'delt') — udvendig vedligeholdelse",
      "afstaelsesret": "whether tenant has assignment right (e.g. 'ja', 'nej', 'betinget', or description)",
      "fremlejeret": "whether tenant has subletting right (e.g. 'ja', 'nej', 'betinget', or description)",
      "bemaerkninger": "string or null — any additional remarks/notes about this unit's lease terms",
      "tenantName": "name of the tenant/renter (lejer) if stated in the document",
      "prepaidRent": number or null — forudbetalt leje (prepaid rent) in DKK, if stated per unit
    }]
  },
  "recommendations": ["string array"],
  "dataQuality": { "completeness": "text", "reliability": "text", "score": 0-100 }
}
Important:
- For prospectId: look for broker reference codes in the document header, footer, or filename. Common patterns: 'ID' followed by digits, or alphanumeric codes like 'SAG-2024-001'.
- For propertyDescription: extract the full marketing description text verbatim. Do NOT summarise. Include all paragraphs.
- For broker.companyName: look for the name of the estate agent or brokerage firm selling the property.
- For matrikelNr, look for patterns like "Matr.nr.", "matrikelnummer", "matrikel nr." in the document. Include partial information.
- For netYield/afkast: ALWAYS express as a decimal 0-1, never as a percentage. E.g. if document says "5,5%" return 0.055.
- For type classification: "Detail" = butik, retail, butikslejemål. "Erhverv" = general commercial that is NOT retail. Do NOT classify retail/butik as Erhverv.
- For areaSqm on units: use the INDIVIDUAL UNIT area from each row in the prospectus table, NOT the total/aggregate building area. If a units table is present, use individual row areas not column sums.
- For lejefastsaettelse: this field is ONLY relevant for residential (Bolig) units. Set to null for all commercial types (Erhverv, Kontor, Detail, Lager).
- For specificUsage on Bolig units: Danish residential lease law defines these categories — use the correct term based on document context:
  * 'Fri leje' (free rent): new builds after 31 Dec 1991, or properties with ≤6 residential units (LL § 54, stk. 2)
  * 'Omkostningsbestemt leje': older regulated properties, rent based on operating costs
  * 'Småejendom (fri leje)': properties with ≤2 residential units built before 1 Jan 1992
  * 'Rækkehus': row house / terraced house unit
  * Use 'Fri leje' as default for Bolig if no specific regulation is stated.
- For anvendelse: extract the FULL usage description text. Do NOT truncate or abbreviate.
- For drift/operating costs (annualOperatingCosts): this is a property-level aggregate, NOT per unit. Store only in financials, never in unit entries.
- For bfeNumber: look for patterns like "BFE", "BFE-nr", "BFE-nummer", "BFE nr." in the document. It is a numeric identifier (typically 7 digits). If found, include it as an integer.
- Do NOT include rentPerSqm or netYield in individual unit entries — these will be computed server-side.
- For seller/mægler: look at the front page, headers, logos, and last page for the broker/agent name. Common Danish brokers include Colliers, EDC Erhverv, Nybolig Erhverv, Sadolin & Albæk, CBRE, Cushman & Wakefield, RED, Nordicals, etc.
- For rentType: determine if stated rents/yields are 'netto' or 'brutto'. Look for keywords like 'nettoleje', 'bruttoleje', 'netto afkast', 'brutto afkast', 'start netto afkast', 'brutto startafkast'.
- For prepaidRent: look for 'forudbetalt leje', 'forudbetalt', 'prepaid rent' per unit. This is typically listed alongside depositum.
- For kontraktvilkår (contract terms): look for tables labeled 'Kontraktvilkår', 'Lejevilkår', 'Vilkår', or similar. These typically contain per-unit data:
  - opsigelsesvarsel: notice period ('opsigelsesvarsel', 'opsigelsesfrist')
  - uopsigelighedUdlejer: landlord irrevocability ('uopsigelighed udlejer', 'udlejers uopsigelighed')
  - uopsigelighedLejer: tenant irrevocability ('uopsigelighed lejer', 'lejers uopsigelighed')
  - indvendigVedligehold: interior maintenance ('indvendig vedligeholdelse', 'ind. vedl.')
  - udvendigVedligehold: exterior maintenance ('udvendig vedligeholdelse', 'ud. vedl.')
  - afstaelsesret: assignment right ('afståelsesret', 'afstaaelsesret')
  - fremlejeret: subletting right ('fremlejeret', 'fremleje')
  - bemaerkninger: remarks/notes ('bemærkninger', 'notes')
- MERGE these contract term fields with the matching unit by address/number, just like other split-table data.
- CRITICAL for leaseTerms.units: Danish sales prospectuses (salgsprospekter) commonly present rental data across MULTIPLE tables and pages. You MUST scan the ENTIRE document to find ALL units/lejemål. Common patterns:
  - A main lease table ("Lejeliste") listing all units with address, type, area, and rent
  - Separate tables for residential vs. commercial units
  - Additional tables with contract details (lejestart, regulering, uopsigelighed, depositum)
  - Summary rows ("I ALT", "Total") — do NOT include these as units
  - Data may be split: one table has areaSqm + annualRent, another has lejestart + lejeregulering for the same units — MERGE them by matching on unit address/number
  - Some documents list units on one page and their lease conditions on another page — cross-reference and combine
  - If you see "Nr." or "Lejemål" columns with numbered entries, each row is a separate unit
  - Do NOT stop after the first table — always check subsequent pages for additional rental data
- Omit fields you cannot determine. All monetary values in DKK. Return ONLY the JSON object, no markdown or wrapping.`);
                const jsonRes = await fetch(chatUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': azureKey },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: jsonPrompt },
                            { role: 'user', content: docText },
                        ],
                        max_completion_tokens: 8000,
                        response_format: { type: 'json_object' },
                    }),
                    signal: AbortSignal.timeout(240_000),  // 4 minute timeout for JSON extraction
                });

                if (jsonRes.ok) {
                    const jsonData = await jsonRes.json() as { choices: { message: { content: string } }[] };
                    const rawJson = jsonData.choices?.[0]?.message?.content ?? '';
                    if (rawJson) {
                        const parsed = JSON.parse(rawJson);
                        // ── 3b. DAWA Address Wash — runs after AI so AI address takes precedence ──
                        // Priority: 1) AI-extracted property.address, 2) regex heuristic, 3) skip
                        const aiAddress = (parsed.property as Record<string, any> | undefined)?.address as string | undefined;
                        const addressCandidate = aiAddress || regexAddress;
                        if (addressCandidate) {
                            try {
                                console.log(`[analyze] Address candidate (${aiAddress ? 'AI' : 'regex'}): "${addressCandidate}" — running DAWA datavask...`);
                                // TODO: dawaService was part of a domain-specific module (not available in generic template)
                                const washResult = await dawaService.washAddressForBlob(addressCandidate);
                                if (washResult) {
                                    addressWash = washResult as Record<string, unknown>;
                                    console.log(`[analyze] ✅ DAWA datavask: ${washResult.matchCategory} match → ${washResult.fullAddress}`);
                                    logWorkerAction({ blobId: documentId, action: 'address-washed', details: { input: addressCandidate, matchCategory: washResult.matchCategory, fullAddress: washResult.fullAddress, source: aiAddress ? 'ai' : 'regex' } });
                                } else {
                                    console.log(`[analyze] ⚠️ DAWA datavask returned no result — keeping extracted address`);
                                }
                            } catch (dawaErr) {
                                console.warn(`[analyze] DAWA datavask failed (non-fatal):`, dawaErr);
                            }
                        }

                        // Enrich property.matrikelNr with regex fallback if AI didn't find one
                        const aiMatrikel = (parsed.property as Record<string, any> | undefined)?.matrikelNr as string | undefined;
                        if (!aiMatrikel) {
                            const regexMatrikel = extractMatrikelFromText(text);
                            if (regexMatrikel && parsed.property) {
                                (parsed.property as Record<string, any>).matrikelNr = regexMatrikel;
                                console.log(`[analyze] Regex matrikel fallback: "${regexMatrikel}"`);
                            }
                        }

                        // Enrich prospectId from filename if AI didn't find one
                        if (!parsed.prospectId && filename) {
                            const idFromFilename = filename.match(PROSPECT_ID_FROM_FILENAME_RE)?.[1];
                            if (idFromFilename) {
                                parsed.prospectId = idFromFilename.toUpperCase();
                                console.log(`[analyze] prospectId from filename: "${parsed.prospectId}"`);
                            }
                        }

                        // ── Post-processing: server-side derivations and corrections ──
                        const postFin = parsed.financials as Record<string, any> | undefined;
                        const postLt = parsed.leaseTerms as Record<string, any> | undefined;
                        const postUnits = (postLt?.units ?? []) as Record<string, any>[];
                        const postProp = parsed.property as Record<string, any> | undefined;
                        const nonBoligTypes = ['erhverv', 'kontor', 'detail', 'lager', 'mixed'];

                        for (const unit of postUnits) {
                            // 2.1: Compute rentPerSqm deterministically — never rely on AI
                            if (unit.annualRent != null && unit.areaSqm != null && unit.areaSqm > 0) {
                                unit.rentPerSqm = Math.round(unit.annualRent / unit.areaSqm);
                            } else {
                                delete unit.rentPerSqm;
                            }

                            // 2.2: Strip yield from individual unit entries (property-level only)
                            delete unit.netYield;
                            delete unit.yield;

                            // 2.3: Strip operating costs from units (property-level only)
                            delete unit.annualOperatingCosts;
                            delete unit.operatingCosts;

                            // 1.3: Clear lejefastsaettelse for non-Bolig units
                            const uType = (unit.type ?? '').toLowerCase();
                            if (nonBoligTypes.some(t => uType.includes(t))) {
                                unit.lejefastsaettelse = null;
                            }

                            // 1.2: Inherit postalCode/city from property level if not on unit
                            if (!unit.postalCode && postProp?.postalCode) {
                                unit.postalCode = postProp.postalCode;
                            }
                            if (!unit.city && postProp?.city) {
                                unit.city = postProp.city;
                            }
                        }

                        // Promote BFE number from addressWash to property level if AI didn't extract one
                        if (postProp && !postProp.bfeNumber && addressWash) {
                            const awBfe = (addressWash as Record<string, unknown>).bfeNumber;
                            if (typeof awBfe === 'number') {
                                postProp.bfeNumber = awBfe;
                                console.log(`[analyze] BFE enriched from DAWA addressWash: ${awBfe}`);
                                logWorkerAction({ blobId: documentId, action: 'bfe-enriched', details: { bfeNumber: awBfe, source: 'dawa-addressWash' } });
                            }
                        }

                        // 2.2: Compute property-level netYield if we have the data
                        if (postFin) {
                            const totalRent = postFin.annualRentIncome ?? postLt?.totalAnnualIncome ?? null;
                            const opCosts = postFin.annualOperatingCosts ?? 0;
                            const salePrice = postFin.salePrice;
                            if (totalRent != null && salePrice != null && salePrice > 0) {
                                const computed = (totalRent - opCosts) / salePrice;
                                // 2.4: Cross-validate against AI-stated yield
                                const aiYield = postFin.netYield;
                                if (aiYield != null) {
                                    const normalised = aiYield > 1 ? aiYield / 100 : aiYield;
                                    const diff = Math.abs(computed - normalised);
                                    if (diff > 0.01) {
                                        console.log(`[analyze] ⚠️ Yield discrepancy: computed=${(computed * 100).toFixed(2)}% vs AI=${(normalised * 100).toFixed(2)}% — using computed`);
                                        logWorkerAction({ blobId: documentId, action: 'yield-discrepancy', status: 'warning', details: { computed: +(computed * 100).toFixed(2), aiStated: +(normalised * 100).toFixed(2), diff: +(diff * 100).toFixed(2) } });
                                        const dq = (parsed.dataQuality ?? {}) as Record<string, any>;
                                        dq.reliability = (dq.reliability ?? '') + ` [Yield discrepancy: computed ${(computed * 100).toFixed(2)}% vs stated ${(normalised * 100).toFixed(2)}%]`;
                                        parsed.dataQuality = dq;
                                    }
                                }
                                postFin.netYield = Math.round(computed * 10000) / 10000; // 4 decimal precision
                            }
                        }

                        // 4.3: Deduct dataQuality.score when key fields are missing
                        {
                            const dq = (parsed.dataQuality ?? { completeness: '', reliability: '', score: 50 }) as Record<string, any>;
                            let score = dq.score ?? 50;
                            const missingFields: string[] = [];
                            if (!postProp?.postalCode) { score -= 5; missingFields.push('postalCode'); }
                            if (!postProp?.city) { score -= 5; missingFields.push('city'); }
                            for (const unit of postUnits) {
                                if (!unit.areaSqm) { score -= 3; missingFields.push('unit.areaSqm'); break; }
                            }
                            if (missingFields.length > 0) {
                                dq.completeness = (dq.completeness ?? '') + ` [Missing: ${missingFields.join(', ')}]`;
                            }
                            dq.score = Math.max(0, Math.min(100, score));
                            parsed.dataQuality = dq;
                        }

                        structuredAnalysis = {
                            version: 1,
                            analyzedAt: new Date().toISOString(),
                            model,
                            ...parsed,
                            // Store the raw PDF-extracted address for reference
                            ...(addressCandidate ? { extractedAddress: addressCandidate } : {}),
                            ...(addressWash ? { addressWash } : {}),
                            rawMarkdown: aiAnalysis,
                        };

                        // Validate against BlobAnalysisSchema (soft — log but don't fail)
                        try {
                            // TODO: BlobAnalysisSchema was part of a domain-specific module (not available in generic template)
                            const validation = BlobAnalysisSchema.safeParse(structuredAnalysis);
                            if (validation.success) {
                                structuredAnalysis = validation.data as Record<string, unknown>;
                                console.log(`[analyze] ✅ Structured analysis validated against BlobAnalysisSchema`);
                            } else {
                                console.warn(`[analyze] ⚠️ Zod validation issues (storing anyway):`, validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
                            }
                        } catch (zodErr) {
                            console.warn(`[analyze] Could not validate against schema:`, zodErr);
                        }
                        console.log(`[analyze] ✅ Structured JSON analysis extracted`);
                        const unitCount = postUnits.length;
                        const propAddr = postProp?.address ?? null;
                        logWorkerAction({ blobId: documentId, action: 'structured-json-extracted', details: { model, units: unitCount, propertyAddress: propAddr, hasFinancials: !!postFin, hasBfe: !!postProp?.bfeNumber, dataQualityScore: (parsed.dataQuality as any)?.score } });
                    }
                }
            } catch (jsonErr) {
                console.warn(`[analyze] Structured JSON extraction failed (non-fatal):`, jsonErr);
                logWorkerAction({ blobId: documentId, action: 'json-extraction-failed', status: 'warning', details: { model, error: (jsonErr as Error).message?.slice(0, 500) ?? String(jsonErr) }, durationMs: Date.now() - analysisStartMs });
            }
        } catch (err) {
            console.warn(`[analyze] ${model} analysis failed:`, err);
            aiAnalysis = `# Analyse: ${filename}\n\n> Automatisk analyse ikke tilgængelig — ${model} fejlede.\n\n## Dokumentinfo\n- Sprog: ${language}\n- Antal ord: ${wordCount}\n- Lejedata: ${hasRentalData ? 'Ja' : 'Nej'}\n`;

            // Log analyze-failed
            logWorkerAction({
                blobId: documentId,
                action: 'analyze-failed',
                status: 'error',
                details: {
                    model,
                    error: (err as Error).message?.slice(0, 500) ?? String(err),
                },
                durationMs: Date.now() - analysisStartMs,
            });
        }
    } else {
        aiAnalysis = `# Analyse: ${filename}\n\n> AI-analyse kræver Azure OpenAI konfiguration.\n\n## Dokumentinfo\n- Sprog: ${language}\n- Antal ord: ${wordCount}\n- Lejedata: ${hasRentalData ? 'Ja' : 'Nej'}\n`;
    }

    // ── 3b-fallback. DAWA wash using regex address when AI analysis was skipped or failed ──
    if (!addressWash && regexAddress) {
        try {
            console.log(`[analyze] Fallback DAWA datavask on regex address: "${regexAddress}"`);
            // TODO: dawaService was part of a domain-specific module (not available in generic template)
            const washResult = await dawaService.washAddressForBlob(regexAddress);
            if (washResult) {
                addressWash = washResult as Record<string, unknown>;
                console.log(`[analyze] ✅ Fallback DAWA datavask: ${washResult.matchCategory} match → ${washResult.fullAddress}`);
                logWorkerAction({ blobId: documentId, action: 'address-washed', details: { input: regexAddress, matchCategory: washResult.matchCategory, fullAddress: washResult.fullAddress, source: 'regex-fallback' } });
            }
        } catch (dawaErr) {
            console.warn(`[analyze] Fallback DAWA datavask failed (non-fatal):`, dawaErr);
        }
    }

    // ── 4. Append address info if found ──
    const extractedAddressForLog = (structuredAnalysis as any)?.extractedAddress ?? regexAddress;
    if (addressWash) {
        aiAnalysis += `\n\n## DAWA Adressevalidering\n| Parameter | Værdi |\n|---|---|\n| Adresse | ${(addressWash as any).fullAddress ?? 'N/A'} |\n| DAWA ID | ${(addressWash as any).dawaId ?? 'N/A'} |\n| Match | ${(addressWash as any).matchCategory ?? 'N/A'} |\n`;
    } else if (extractedAddressForLog) {
        aiAnalysis += `\n\n## Adresse (ikke DAWA-valideret)\n> Adresse fundet i dokumentet: **${extractedAddressForLog}**\n> DAWA-validering var ikke mulig.\n`;
    }

    // ── 5. Save .analysis.md to blob storage ──
    const analysisKey = (storagePath ?? `documents/pdf/${documentId}/${filename}`).replace(/\.pdf$/i, '.analysis.md');
    try {
        await uploadToStorage(analysisKey, Buffer.from(aiAnalysis, 'utf-8'), 'text/markdown');
        console.log(`[analyze] Saved analysis to ${analysisKey}`);
        logWorkerAction({ blobId: documentId, action: 'analysis-saved', details: { storagePath: analysisKey, chars: aiAnalysis.length } });
    } catch (err) {
        console.warn(`[analyze] Failed to save analysis to storage:`, err);
    }

    // ── 6. Update blob metadata + analysis JSONB ──
    try {
        const existing = await prisma.blob.findUnique({ where: { id: documentId }, select: { metadata: true } });
        const prevMeta = (existing?.metadata as Record<string, unknown> ?? {});
        const updateData: Record<string, unknown> = {
            metadata: {
                ...prevMeta,
                analyzed: true,
                analyzedAt: new Date().toISOString(),
                analysisDurationMs: Date.now() - analysisStartMs,
                analysisModel: model,
                analysisPrompt: markdownPromptUsed,
                structuredPrompt: structuredPromptUsed,
                hasRentalData,
                attempts: ((prevMeta.attempts as number) ?? 0) + 1,
                lastError: undefined, // clear on success
                ...(addressWash ? { addressWash: addressWash as any } : {}),
                ...(extractedAddressForLog ? { extractedAddress: extractedAddressForLog } : {}),
            },
        };

        // Store structured analysis in the dedicated analysis JSONB field
        if (structuredAnalysis) {
            updateData['analysis'] = structuredAnalysis;
        }

        await prisma.blob.update({
            where: { id: documentId },
            data: updateData,
        });
        console.log(`[analyze] ✅ Updated blob ${documentId} — metadata + ${structuredAnalysis ? 'structured analysis' : 'no structured data'}`);
        logWorkerAction({ blobId: documentId, action: 'blob-updated', details: { hasStructuredAnalysis: !!structuredAnalysis, hasAddressWash: !!addressWash, model, units: structuredAnalysis ? ((structuredAnalysis as any).leaseTerms?.units?.length ?? 0) : 0 } });
    } catch (err) {
        console.warn(`[analyze] Failed to update blob:`, err);
    }

    const result = {
        documentId,
        analysisLength: aiAnalysis.length,
        hasRentalData,
        hasAddress: !!addressWash,
        hasStructuredAnalysis: !!structuredAnalysis,
        model,
    };

    // Log analyze-done
    logWorkerAction({
        blobId: documentId,
        action: 'analyze-done',
        details: {
            model,
            hasStructuredAnalysis: !!structuredAnalysis,
            hasAddress: !!addressWash,
            address: (structuredAnalysis as any)?.extractedAddress ?? regexAddress ?? undefined,
            analysisChars: aiAnalysis.length,
        },
        durationMs: Date.now() - analysisStartMs,
    });

    return result;
});

/**
 * Extract the most likely property address from document text.
 *
 * Looks for common Danish address patterns like:
 *   - "Vestergade 10, 1456 København K"
 *   - "Ibæk Strandvej 28A, 7100 Vejle"
 *   - "Adresse: Taksvej 19, 7400 Herning"
 *
 * Returns null if no address-like pattern is found.
 */
/** Regex to extract a broker prospect ID from a filename (e.g. "ID18122" or "SAG-2024-001") */
const PROSPECT_ID_FROM_FILENAME_RE = /^(ID\d+|SAG[-_]?\d+)/i;

function extractAddressFromText(text: string): string | null {
    // Pattern 1: Explicit "Adresse:" or "Address:" label
    const labelMatch = text.match(
        /(?:Adresse|Address|Beliggenhed|Ejendom)\s*:\s*([A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå. ]+\s+\d+[A-Za-z]?\s*,\s*\d{4}\s+[A-ZÆØÅa-zæøå ]+)/i,
    );
    if (labelMatch) return labelMatch[1].trim();

    // Pattern 2: Street + number + comma + postal code + city
    const streetMatch = text.match(
        /([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ]?[a-zæøå]+)*\s+\d+[A-Za-z]?)\s*,\s*(\d{4})\s+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ]?[a-zæøå]+)*)/,
    );
    if (streetMatch) return `${streetMatch[1]}, ${streetMatch[2]} ${streetMatch[3]}`;

    // Pattern 3: "Vejnavn Husnr" followed nearby by a 4-digit postal code
    const looseMatch = text.match(
        /([A-ZÆØÅ][a-zæøå]+(?:vej|gade|alle|vænge|stræde|plads|boulevard|torv|park)\s+\d+[A-Za-z]?)/i,
    );
    if (looseMatch) {
        // Try to find postal code nearby (within 100 chars)
        const after = text.substring(text.indexOf(looseMatch[0]), text.indexOf(looseMatch[0]) + 100);
        const postalMatch = after.match(/(\d{4})\s+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ]?[a-zæøå]+)*)/);
        if (postalMatch) return `${looseMatch[1]}, ${postalMatch[1]} ${postalMatch[2]}`;
        return looseMatch[1]; // Street only, datavask may still find it
    }

    return null;
}

/**
 * Extract matrikel number(s) from Danish property document text.
 *
 * Looks for patterns like:
 *   - "Matr.nr. 5a, Hvidovre By, Hvidovre"
 *   - "matrikelnummer 12ab"
 *   - "Matr. nr. 5 a"
 *
 * Returns the first found matrikel string, or null.
 * The result may be partial if the full ejerlav description is not present.
 */
function extractMatrikelFromText(text: string): string | null {
    // Pattern 1: "Matr.nr." / "Matr. nr." with optional ejerlav (e.g. "5a, Hvidovre By, Hvidovre")
    const unitPattern = /[0-9]+[a-zA-Z]*/;           // the cadastral unit number, e.g. "5a"
    const ejerlavPattern = /(?:\s*,\s*[A-ZÆØÅ][a-zæøå]+(?: [A-ZÆØÅ][a-zæøå]+)* [Bb]y,\s*[A-ZÆØÅ][a-zæøå]+(?: [A-ZÆØÅ][a-zæøå]+)*)?/; // optional ", Ejerlav By, Ejerlav"
    const matrNrPattern = new RegExp(
        `[Mm]atr(?:ikel)?\\.?\\s*nr\\.?\\s*(${unitPattern.source}${ejerlavPattern.source})`,
    );
    const explicit = text.match(matrNrPattern);
    if (explicit) return explicit[1].trim();

    // Pattern 2: "matrikelnummer XXXX"
    const full = text.match(/[Mm]atrikelnummer\s+([0-9]+[a-zA-Z]*)/);
    if (full) return full[1].trim();

    return null;
}

// ── job.pdf.embed ────────────────────────────────────────
// Delegates to embed.py (Python) for memory-efficient vector embedding.
// Python uses ~50MB RSS vs Node.js OOM at 6GB+ due to V8 string handling.
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

worker.handle<EmbedPayload>('embed', async (job) => {
    const { documentId, storagePath } = job.payload;
    console.log(`[embed] Delegating to Python for ${documentId}`);
    const embedStartMs = Date.now();

    // Log embed-start IMMEDIATELY
    logWorkerAction({
        blobId: documentId,
        action: 'embed-start',
        details: { storagePath },
    });

    const mdPath = (storagePath ?? '').endsWith('.md')
        ? storagePath
        : (storagePath ?? '').replace(/\.pdf$/i, '.md');

    try {
        const { stdout, stderr } = await execFileAsync(
            'python3',
            ['/app/workers/pdf-refinery/embed.py', documentId, mdPath],
            {
                timeout: 10 * 60 * 1000, // 10 min timeout (includes rate-limit retries)
                maxBuffer: 10 * 1024 * 1024, // 10MB stdout buffer
                env: process.env as Record<string, string>,
            },
        );

        if (stderr) console.warn(`[embed] Python stderr: ${stderr}`);

        // Parse the last line of stdout as JSON result
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1] ?? '{}';
        for (const line of lines.slice(0, -1)) {
            console.log(line);
        }

        try {
            const result = JSON.parse(lastLine);
            console.log(`[embed] ✅ ${documentId}: ${result.chunkCount ?? 0} chunks embedded`);

            // Log embed-done
            logWorkerAction({
                blobId: documentId,
                action: 'embed-done',
                details: { chunks: result.chunkCount ?? 0 },
                durationMs: Date.now() - embedStartMs,
            });

            return result;
        } catch {
            console.log(lastLine);
            return { documentId, chunkCount: 0, output: stdout };
        }
    } catch (err: any) {
        console.error(`[embed] Python embed failed for ${documentId}:`, err.message);
        if (err.stderr) console.error(`[embed] stderr: ${err.stderr}`);

        // Log embed-failed
        logWorkerAction({
            blobId: documentId,
            action: 'embed-failed',
            status: 'error',
            details: { error: err.message?.slice(0, 500) ?? 'Unknown error' },
            durationMs: Date.now() - embedStartMs,
        });

        return { documentId, chunkCount: 0, error: err.message };
    }
});

// ── job.pdf.extract-rentals ──────────────────────────────
worker.handle<ExtractRentalsPayload>('extract-rentals', async (job) => {
    const { documentId, text, filename } = job.payload;
    console.log(`[extract-rentals] Extracting rental data from ${filename}`);

    if (!detectRentalTable(text)) {
        return {
            documentId,
            hasRentalData: false,
            units: [],
        };
    }

    const units = extractRentalUnits(text);
    console.log(`[extract-rentals] Found ${units.length} rental units`);

    return {
        documentId,
        hasRentalData: true,
        units,
        totalUnits: units.length,
        avgRent: units.length > 0
            ? Math.round(units.reduce((s, u) => s + (u.rent ?? 0), 0) / units.length)
            : 0,
    };
});

// ── job.pdf.extract-images ───────────────────────────────
// Extract images from PDF, filter out small/logo images, store in blob storage,
// and describe each image using Azure OpenAI vision API.

interface ExtractImagesPayload {
    documentId: string;
    storagePath: string;
}

/** Minimum dimensions to keep an image (filters logos, icons, decorations) */
const MIN_IMAGE_WIDTH = 150;
const MIN_IMAGE_HEIGHT = 150;
const MIN_IMAGE_BYTES = 5_000; // 5KB minimum

worker.handle<ExtractImagesPayload>('extract-images', async (job) => {
    const { documentId, storagePath } = job.payload;
    console.log(`[extract-images] Starting image extraction for ${documentId}`);
    const startMs = Date.now();

    logWorkerAction({
        blobId: documentId,
        action: 'images-extract-start',
        details: { storagePath },
    });

    // 1. Fetch PDF from blob storage
    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await fetchFromStorage(storagePath);
    } catch (err) {
        console.error(`[extract-images] Failed to fetch PDF:`, err);
        logWorkerAction({
            blobId: documentId,
            action: 'images-extract-failed',
            status: 'error',
            details: { error: 'Failed to fetch PDF from storage' },
            durationMs: Date.now() - startMs,
        });
        return { documentId, error: 'Failed to fetch PDF', imageCount: 0 };
    }

    // 2. Look up tenant from blob
    const blob = await prisma.blob.findUnique({ where: { id: documentId }, select: { tenantId: true } });
    const tenantId = blob?.tenantId ?? '';

    // 3. Delete any existing images for this document (re-extract scenario)
    try {
        await prisma.blobImage.deleteMany({ where: { blobId: documentId } });
    } catch {
        // Table may not exist yet if migration hasn't run
    }

    // 4. Extract images using Python pymupdf4llm extractor
    const EXTRACTOR_URL = process.env['PDF_EXTRACTOR_URL'] || 'http://pdf-extractor:8090';
    const basePath = storagePath.replace(/\/[^/]+$/, '');
    const savedImages: { storagePath: string; pageNum: number; width: number; height: number; sizeBytes: number; mimeType: string; sortOrder: number }[] = [];

    try {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), 'document.pdf');

        const extractorResponse = await fetch(`${EXTRACTOR_URL}/extract?write_images=true&page_chunks=false`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(120_000),
        });

        if (!extractorResponse.ok) {
            throw new Error(`Extractor returned ${extractorResponse.status}: ${await extractorResponse.text()}`);
        }

        const result = await extractorResponse.json() as {
            markdown: string;
            images: { filename: string; size: number; mimeType: string; base64: string; width?: number; height?: number; page?: number }[];
        };

        if (!result.images || result.images.length === 0) {
            console.log(`[extract-images] No images found in PDF`);
            logWorkerAction({
                blobId: documentId,
                action: 'images-extract-done',
                details: { imageCount: 0, filtered: 0 },
                durationMs: Date.now() - startMs,
            });
            return { documentId, imageCount: 0 };
        }

        console.log(`[extract-images] Extractor returned ${result.images.length} raw images — filtering...`);

        let filtered = 0;
        let sortOrder = 0;
        for (const img of result.images) {
            const imgBuffer = Buffer.from(img.base64, 'base64');
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            const size = imgBuffer.length;

            // Filter out small images, logos, icons
            if (size < MIN_IMAGE_BYTES) { filtered++; continue; }
            if (w > 0 && h > 0 && (w < MIN_IMAGE_WIDTH || h < MIN_IMAGE_HEIGHT)) { filtered++; continue; }

            // Filter out likely logos: very wide and short, or very narrow
            if (w > 0 && h > 0) {
                const aspect = w / h;
                if ((aspect > 5 || aspect < 0.2) && Math.max(w, h) < 400) { filtered++; continue; }
            }

            // Upload to storage
            const imgKey = `${basePath}/images/${img.filename}`;
            try {
                await uploadToStorage(imgKey, imgBuffer, img.mimeType);
                savedImages.push({
                    storagePath: imgKey,
                    pageNum: img.page ?? 0,
                    width: w,
                    height: h,
                    sizeBytes: size,
                    mimeType: img.mimeType,
                    sortOrder: sortOrder++,
                });
            } catch (uploadErr) {
                console.warn(`[extract-images] Failed to upload ${img.filename}:`, uploadErr);
            }
        }

        console.log(`[extract-images] Kept ${savedImages.length} images, filtered ${filtered}`);
    } catch (extractErr) {
        console.warn(`[extract-images] Python extractor failed (non-fatal):`, extractErr);
        logWorkerAction({
            blobId: documentId,
            action: 'images-extract-failed',
            status: 'error',
            details: { error: 'Image extraction failed' },
            durationMs: Date.now() - startMs,
        });
        return { documentId, error: 'Image extraction failed', imageCount: 0 };
    }

    if (savedImages.length === 0) {
        logWorkerAction({
            blobId: documentId,
            action: 'images-extract-done',
            details: { imageCount: 0 },
            durationMs: Date.now() - startMs,
        });
        return { documentId, imageCount: 0 };
    }

    // 5. AI Vision analysis — describe each image
    const azureEndpoint = process.env['AZURE_OPENAI_ENDPOINT']?.replace(/\/$/, '');
    const azureKey = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-08-01-preview';
    const visionModel = process.env['AZURE_OPENAI_MODEL_MEDIUM'] || process.env['AZURE_OPENAI_MODEL_HIGH'] || 'gpt-4o';

    const imageRecords: { storagePath: string; pageNum: number; width: number; height: number; sizeBytes: number; mimeType: string; sortOrder: number; description: string | null; category: string | null; metadata: Record<string, unknown> }[] = [];

    for (const img of savedImages) {
        let description: string | null = null;
        let category: string | null = null;
        const imgMeta: Record<string, unknown> = {};

        if (azureEndpoint && azureKey) {
            try {
                const imgBuffer = await fetchFromStorage(img.storagePath);
                const base64 = imgBuffer.toString('base64');
                const dataUri = `data:${img.mimeType};base64,${base64}`;

                const chatUrl = `${azureEndpoint}/openai/deployments/${visionModel}/chat/completions?api-version=${apiVersion}`;
                const res = await fetch(chatUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': azureKey },
                    body: JSON.stringify({
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a property document image analyst. Analyze this image from a Danish commercial real estate prospectus. Respond in JSON format with: {"description": "detailed description in Danish", "category": "one of: photo, floorplan, map, chart, table, diagram, aerial, facade, interior, site_plan, other", "isHero": boolean, "labels": ["keyword1", "keyword2"]}',
                            },
                            {
                                role: 'user',
                                content: [
                                    { type: 'image_url', image_url: { url: dataUri, detail: 'low' } },
                                    { type: 'text', text: 'Beskriv dette billede fra et ejendomsprospekt.' },
                                ],
                            },
                        ],
                        max_completion_tokens: 500,
                        response_format: { type: 'json_object' },
                    }),
                    signal: AbortSignal.timeout(30_000),
                });

                if (res.ok) {
                    const data = await res.json() as { choices: { message: { content: string } }[] };
                    const raw = data.choices?.[0]?.message?.content ?? '';
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        description = parsed.description ?? null;
                        category = parsed.category ?? null;
                        imgMeta.isHero = parsed.isHero ?? false;
                        imgMeta.labels = parsed.labels ?? [];
                        imgMeta.visionModel = visionModel;
                    }
                }
            } catch (visionErr) {
                console.warn(`[extract-images] Vision analysis failed for ${img.storagePath}:`, (visionErr as Error).message);
            }
        }

        imageRecords.push({ ...img, description, category, metadata: imgMeta });
    }

    // 6. Store in BlobImage table
    let dbStored = 0;
    try {
        for (const rec of imageRecords) {
            await prisma.blobImage.create({
                data: {
                    blobId: documentId,
                    tenantId,
                    pageNum: rec.pageNum,
                    storagePath: rec.storagePath,
                    mimeType: rec.mimeType,
                    width: rec.width,
                    height: rec.height,
                    sizeBytes: rec.sizeBytes,
                    sortOrder: rec.sortOrder,
                    description: rec.description,
                    category: rec.category,
                    metadata: rec.metadata,
                },
            });
            dbStored++;
        }
        console.log(`[extract-images] ✅ Stored ${dbStored} image records in DB`);
    } catch (dbErr) {
        console.warn(`[extract-images] Failed to store image records (table may not exist):`, dbErr);
    }

    logWorkerAction({
        blobId: documentId,
        action: 'images-extract-done',
        details: {
            imageCount: savedImages.length,
            withDescription: imageRecords.filter(r => r.description).length,
            categories: [...new Set(imageRecords.map(r => r.category).filter(Boolean))],
            dbStored,
        },
        durationMs: Date.now() - startMs,
    });

    return {
        documentId,
        imageCount: savedImages.length,
        withDescription: imageRecords.filter(r => r.description).length,
    };
});

// ─── Self-Heal: Re-queue orphaned documents on startup ──────

/**
 * After the worker starts, check for documents stuck in 'queued' or 'processing'
 * status. These may have been orphaned after a pod restart, deployment, or NATS
 * disconnection. Re-publish extraction jobs for them.
 *
 * Also detects documents that completed extraction but were never analyzed
 * (analyzed flag missing) and re-queues analyze jobs.
 *
 * Runs once, 10 seconds after startup (to let consumers settle).
 */
async function selfHeal() {
    const HEAL_DELAY_MS = 10_000;
    await new Promise(r => setTimeout(r, HEAL_DELAY_MS));

    console.log('[self-heal] Checking for orphaned documents...');

    try {
        // 1. Find documents stuck in queued/processing
        const stuckDocs = await prisma.blob.findMany({
            where: {
                mimeType: 'application/pdf',
                OR: [
                    { metadata: { path: ['status'], equals: 'queued' } },
                    { metadata: { path: ['status'], equals: 'processing' } },
                ],
            },
            select: { id: true, storagePath: true, filename: true, sizeBytes: true },
        });

        if (stuckDocs.length > 0) {
            console.log(`[self-heal] Found ${stuckDocs.length} documents stuck in queued/processing — re-publishing extraction jobs...`);

            const nc = (worker as any).nc;
            const js = (worker as any).js;
            if (!nc || nc.isClosed() || !js) {
                console.warn('[self-heal] NATS not available, skipping re-queue');
                return;
            }

            let requeued = 0;
            for (const doc of stuckDocs) {
                try {
                    const jobMessage = {
                        id: `heal-extract-${doc.id}`,
                        action: 'extract-text',
                        payload: {
                            documentId: doc.id,
                            storagePath: doc.storagePath,
                            filename: doc.filename,
                            sizeBytes: doc.sizeBytes,
                        },
                    };
                    await js.publish('job.pdf-refinery.extract-text', sc.encode(JSON.stringify(jobMessage)), { headers: injectTraceHeaders() });
                    requeued++;
                } catch (err) {
                    console.warn(`[self-heal] Failed to re-queue ${doc.id}:`, err);
                }
            }
            console.log(`[self-heal] ✅ Re-queued ${requeued}/${stuckDocs.length} extraction jobs`);
        }

        // 2. Find documents that completed extraction but never got analyzed
        const unanalyzed = await prisma.blob.findMany({
            where: {
                mimeType: 'application/pdf',
                metadata: { path: ['status'], equals: 'completed' },
                analysis: { equals: null },
            },
            select: { id: true, storagePath: true, filename: true },
        });

        // Filter to only those that also lack the analyzed flag
        const needsAnalysis: typeof unanalyzed = [];
        for (const doc of unanalyzed) {
            const blob = await prisma.blob.findUnique({ where: { id: doc.id }, select: { metadata: true } });
            const meta = blob?.metadata as Record<string, unknown> | null;
            if (!meta?.analyzed) {
                needsAnalysis.push(doc);
            }
        }

        if (needsAnalysis.length > 0) {
            console.log(`[self-heal] Found ${needsAnalysis.length} documents completed but not analyzed — re-publishing analyze jobs...`);

            const nc = (worker as any).nc;
            const js = (worker as any).js;
            if (!nc || nc.isClosed() || !js) return;

            let requeued = 0;
            for (const doc of needsAnalysis) {
                try {
                    const jobMessage = {
                        id: `heal-analyze-${doc.id}`,
                        action: 'analyze',
                        payload: {
                            documentId: doc.id,
                            text: '', // Worker will fetch from .md file
                            filename: doc.filename,
                            storagePath: doc.storagePath,
                        },
                    };
                    await js.publish('job.pdf-refinery.analyze', sc.encode(JSON.stringify(jobMessage)), { headers: injectTraceHeaders() });
                    requeued++;
                } catch (err) {
                    console.warn(`[self-heal] Failed to re-queue analyze for ${doc.id}:`, err);
                }
            }
            console.log(`[self-heal] ✅ Re-queued ${requeued}/${needsAnalysis.length} analyze jobs`);
        }

        if (stuckDocs.length === 0 && needsAnalysis.length === 0) {
            console.log('[self-heal] ✅ No orphaned documents found — all good!');
        }
    } catch (err) {
        console.warn('[self-heal] Self-heal check failed (non-fatal):', err);
    }
}

// ─── Start ──────────────────────────────────────────────────

async function main() {
    await worker.start();

    // Run self-heal in the background (non-blocking)
    selfHeal().catch(err => console.warn('[self-heal] Error:', err));

    // Keep process alive — block until NATS connection closes
    // The setInterval heartbeat in WorkerBase also helps, but
    // awaiting at top level ensures we don't exit prematurely.
    await new Promise(() => { }); // Block forever
}

main().catch((err: unknown) => {
    console.error('Failed to start pdf-refinery worker:', err);
    process.exit(1);
});
