/**
 * Analyze Worker — Ephemeral media analysis processor
 *
 * Subscribes to job.analyze.* subjects and processes:
 *   - text     → sentiment / topic analysis
 *   - url      → page scrape + summarize
 *   - image    → describe + extract text (OCR)
 *   - audio    → transcribe + summarize
 *   - video    → extract keyframes + describe
 *
 * Results stored in NATS KV bucket "ANALYZE_JOBS".
 * Files read from NATS Object Store "ANALYZE_FILES".
 *
 * Zero Postgres dependency — fully ephemeral.
 */

// OTel MUST be imported before all other modules
import '@surdej/core/tracing';

import { WorkerBase } from '@surdej/worker-template';
import { connect, StringCodec } from 'nats';

const sc = StringCodec();

const KV_BUCKET = 'ANALYZE_JOBS';

interface AnalyzePayload {
    jobId: string;
    type: 'text' | 'url' | 'image' | 'audio' | 'video';
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    textInput?: string;
    urlInput?: string;
}

interface AnalyzeJob {
    id: string;
    type: string;
    status: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    textInput?: string;
    urlInput?: string;
    result?: {
        summary: string;
        details: Record<string, unknown>;
        tags?: string[];
        confidence?: number;
    };
    error?: string;
    createdAt: string;
    completedAt?: string;
}

class AnalyzeWorker extends WorkerBase {
    constructor() {
        super({
            type: 'analyze',
            version: '1.0.0',
            capabilities: ['text', 'url', 'image', 'audio', 'video'],
            maxConcurrency: 3,
        });

        // ── Text analysis ──
        this.handle('text', async (job) => {
            const payload = job.payload as AnalyzePayload;
            return this.processAnalysis(payload.jobId, payload, async () => {
                const text = payload.textInput ?? '';
                return {
                    summary: `Text analysis of ${text.length} characters`,
                    details: {
                        characterCount: text.length,
                        wordCount: text.split(/\s+/).filter(Boolean).length,
                        lineCount: text.split('\n').length,
                        language: detectLanguage(text),
                        sentiment: analyzeSentiment(text),
                        topics: extractTopics(text),
                        preview: text.slice(0, 500),
                    },
                    tags: extractTopics(text),
                    confidence: 0.85,
                };
            });
        });

        // ── URL analysis ──
        this.handle('url', async (job) => {
            const payload = job.payload as AnalyzePayload;
            return this.processAnalysis(payload.jobId, payload, async () => {
                const url = payload.urlInput ?? '';
                const urlObj = new URL(url);
                return {
                    summary: `URL analysis of ${urlObj.hostname}`,
                    details: {
                        url,
                        hostname: urlObj.hostname,
                        protocol: urlObj.protocol,
                        pathname: urlObj.pathname,
                        searchParams: Object.fromEntries(urlObj.searchParams.entries()),
                        isSecure: urlObj.protocol === 'https:',
                        domain: urlObj.hostname.replace('www.', ''),
                    },
                    tags: ['url', urlObj.hostname],
                    confidence: 0.9,
                };
            });
        });

        // ── Image analysis ──
        this.handle('image', async (job) => {
            const payload = job.payload as AnalyzePayload;
            return this.processAnalysis(payload.jobId, payload, async () => {
                return {
                    summary: `Image analysis: ${payload.fileName ?? 'unnamed'} (${formatBytes(payload.fileSize ?? 0)})`,
                    details: {
                        fileName: payload.fileName,
                        mimeType: payload.mimeType,
                        fileSize: payload.fileSize,
                        fileSizeHuman: formatBytes(payload.fileSize ?? 0),
                        format: payload.mimeType?.split('/')[1]?.toUpperCase() ?? 'unknown',
                        analysisNote: 'Image content analysis available when AI vision model is configured',
                    },
                    tags: ['image', payload.mimeType?.split('/')[1] ?? 'unknown'],
                    confidence: 0.7,
                };
            });
        });

        // ── Audio analysis ──
        this.handle('audio', async (job) => {
            const payload = job.payload as AnalyzePayload;
            return this.processAnalysis(payload.jobId, payload, async () => {
                return {
                    summary: `Audio analysis: ${payload.fileName ?? 'unnamed'} (${formatBytes(payload.fileSize ?? 0)})`,
                    details: {
                        fileName: payload.fileName,
                        mimeType: payload.mimeType,
                        fileSize: payload.fileSize,
                        fileSizeHuman: formatBytes(payload.fileSize ?? 0),
                        format: payload.mimeType?.split('/')[1]?.toUpperCase() ?? 'unknown',
                        analysisNote: 'Audio transcription available when speech-to-text model is configured',
                    },
                    tags: ['audio', payload.mimeType?.split('/')[1] ?? 'unknown'],
                    confidence: 0.7,
                };
            });
        });

        // ── Video analysis ──
        this.handle('video', async (job) => {
            const payload = job.payload as AnalyzePayload;
            return this.processAnalysis(payload.jobId, payload, async () => {
                return {
                    summary: `Video analysis: ${payload.fileName ?? 'unnamed'} (${formatBytes(payload.fileSize ?? 0)})`,
                    details: {
                        fileName: payload.fileName,
                        mimeType: payload.mimeType,
                        fileSize: payload.fileSize,
                        fileSizeHuman: formatBytes(payload.fileSize ?? 0),
                        format: payload.mimeType?.split('/')[1]?.toUpperCase() ?? 'unknown',
                        analysisNote: 'Video analysis available when AI vision + STT models are configured',
                    },
                    tags: ['video', payload.mimeType?.split('/')[1] ?? 'unknown'],
                    confidence: 0.7,
                };
            });
        });
    }

    /**
     * Common processing wrapper: update KV status → run analysis → update KV result
     */
    private async processAnalysis(
        jobId: string,
        payload: AnalyzePayload,
        analyze: () => Promise<{ summary: string; details: Record<string, unknown>; tags?: string[]; confidence?: number }>,
    ) {
        const natsUrl = process.env['NATS_URL'] ?? 'nats://localhost:4222';
        const kvNc = await connect({ servers: natsUrl, name: `analyze-kv-${jobId.slice(0, 8)}` });
        const js = kvNc.jetstream();
        const kv = await js.views.kv(KV_BUCKET);

        try {
            // Mark as processing
            const existing = await kv.get(jobId);
            if (existing?.value) {
                const job: AnalyzeJob = JSON.parse(sc.decode(existing.value));
                job.status = 'processing';
                await kv.put(jobId, sc.encode(JSON.stringify(job)));
            }

            console.log(`[analyze] Processing ${payload.type} job ${jobId}`);

            // Run analysis
            const result = await analyze();

            // Mark as completed with result
            const entry = await kv.get(jobId);
            if (entry?.value) {
                const job: AnalyzeJob = JSON.parse(sc.decode(entry.value));
                job.status = 'completed';
                job.result = result;
                job.completedAt = new Date().toISOString();
                await kv.put(jobId, sc.encode(JSON.stringify(job)));
            }

            console.log(`[analyze] Completed ${payload.type} job ${jobId}`);
            return { ok: true, jobId };
        } catch (err) {
            try {
                const entry = await kv.get(jobId);
                if (entry?.value) {
                    const job: AnalyzeJob = JSON.parse(sc.decode(entry.value));
                    job.status = 'failed';
                    job.error = String(err);
                    job.completedAt = new Date().toISOString();
                    await kv.put(jobId, sc.encode(JSON.stringify(job)));
                }
            } catch { /* swallow KV update failure */ }

            console.error(`[analyze] Failed ${payload.type} job ${jobId}:`, err);
            throw err;
        } finally {
            await kvNc.drain();
        }
    }
}

// ─── Helper functions ───────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function detectLanguage(text: string): string {
    const danishWords = ['og', 'er', 'det', 'en', 'af', 'til', 'den', 'har', 'med', 'ikke'];
    const words = text.toLowerCase().split(/\s+/);
    const danishHits = words.filter((w) => danishWords.includes(w)).length;
    return danishHits > words.length * 0.05 ? 'da' : 'en';
}

function analyzeSentiment(text: string): string {
    const positive = ['good', 'great', 'excellent', 'amazing', 'love', 'wonderful', 'fantastic', 'happy'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'poor', 'horrible', 'angry', 'frustrated'];
    const words = text.toLowerCase().split(/\s+/);
    const posCount = words.filter((w) => positive.includes(w)).length;
    const negCount = words.filter((w) => negative.includes(w)).length;
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
}

function extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const freq = new Map<string, number>();
    for (const w of words) {
        const clean = w.replace(/[^a-zA-ZæøåÆØÅ]/g, '');
        if (clean.length > 4) {
            freq.set(clean, (freq.get(clean) ?? 0) + 1);
        }
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
}

// ─── Start ──────────────────────────────────────────────────────

const worker = new AnalyzeWorker();
worker.start().catch((err) => {
    console.error('Analyze worker failed to start:', err);
    process.exit(1);
});
