/**
 * Analyze Contract — Ephemeral media analysis types
 *
 * Shared between API routes, the analyze worker, and the frontend.
 * All analysis data is ephemeral (stored in NATS KV/OS with 24h TTL).
 *
 * @module contracts/analyze
 */

// ─── Job Types ──────────────────────────────────────────────────

/** Supported analysis input types */
export type AnalyzeMediaType = 'text' | 'url' | 'image' | 'audio' | 'video';

/** Job lifecycle states */
export type AnalyzeJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Analysis result returned by the worker */
export interface AnalyzeResult {
    /** Human-readable summary of the analysis */
    summary: string;
    /** Structured details (varies by media type) */
    details: Record<string, unknown>;
    /** Extracted topic/category tags */
    tags?: string[];
    /** Confidence score 0–1 */
    confidence?: number;
}

/** Full job record stored in NATS KV bucket ANALYZE_JOBS */
export interface AnalyzeJob {
    id: string;
    type: AnalyzeMediaType;
    status: AnalyzeJobStatus;
    /** Original filename (for file uploads) */
    fileName?: string;
    /** MIME type of uploaded file */
    mimeType?: string;
    /** File size in bytes */
    fileSize?: number;
    /** Raw text input (for type='text') */
    textInput?: string;
    /** URL input (for type='url') */
    urlInput?: string;
    /** Analysis result (populated when status='completed') */
    result?: AnalyzeResult;
    /** Error message (populated when status='failed') */
    error?: string;
    createdAt: string;
    completedAt?: string;
}

/** Payload sent to the analyze worker via NATS job.analyze.* */
export interface AnalyzeJobPayload {
    /** Reference back to the KV job ID */
    jobId: string;
    type: AnalyzeMediaType;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    textInput?: string;
    urlInput?: string;
}

// ─── API Response Types ─────────────────────────────────────────

/** POST /api/analyze response */
export interface AnalyzeSubmitResponse {
    jobId: string;
    type: AnalyzeMediaType;
    status: 'pending';
    message: string;
}

/** GET /api/analyze response */
export interface AnalyzeListResponse {
    jobs: AnalyzeJob[];
    count: number;
}

// ─── NATS Bucket/Subject Constants ──────────────────────────────

export const ANALYZE_NATS = {
    /** KV bucket for job metadata — 24h TTL */
    KV_BUCKET: 'ANALYZE_JOBS',
    /** Object store for uploaded files — 24h TTL */
    OBJ_STORE: 'ANALYZE_FILES',
    /** NATS subject pattern for analyze jobs */
    JOB_SUBJECT: 'job.analyze',
    /** TTL in nanoseconds (24 hours) */
    TTL_NS: 24 * 60 * 60 * 1e9,
} as const;
