# Ephemeral Media Analysis — Findings & Spec

> **Date:** 2026-02-17  
> **Status:** Implemented  
> **Author:** AI Pair Programming session

---

## Overview

The Analyze feature enables users to upload or paste various media types (text, URLs, screenshots, audio, video) for quick, ephemeral analysis. A dedicated NATS-based worker handles processing. **No data is persisted to PostgreSQL** — everything lives in NATS JetStream with a 24-hour auto-expiry.

---

## Architecture

```
Frontend (AnalyzePage)
    │
    ├─ POST /api/analyze       → submit job (file upload OR JSON text/url)
    ├─ GET  /api/analyze       → list recent jobs (from KV)
    ├─ GET  /api/analyze/:id   → poll single job status + result
    └─ GET  /api/analyze/:id/file → download original uploaded file
    │
    ▼
API (analyzeRoutes @ /api/analyze)
    │
    ├─ NATS KV: ANALYZE_JOBS    → job metadata + results (24h TTL)
    ├─ NATS OS: ANALYZE_FILES   → uploaded binary files (24h TTL)
    └─ NATS pub: job.analyze.*  → dispatches job to worker
    │
    ▼
Worker (analyze-worker)
    │
    ├─ Subscribes: job.analyze.{text,url,image,audio,video}
    ├─ Reads file from OS if needed
    ├─ Runs analysis logic
    └─ Writes result back to KV
```

## Key Design Decisions

### 1. NATS-only Storage (No Postgres)

**Why:** Feedback analysis is inherently ephemeral. Users want quick insights, not permanent records. Using NATS KV + Object Store with TTL avoids:
- Database migrations
- Storage growth concerns
- GDPR cleanup obligations for transient data

**Trade-off:** Jobs disappear after 24 hours. If persistence is needed later, a simple `persist` flag can copy the KV entry to Postgres.

### 2. Worker Uses `WorkerBase` Template

The analyze worker extends `WorkerBase` from `workers/_template/`, gaining:
- Automatic NATS connection + reconnect
- Worker registry registration + heartbeats
- Graceful drain/shutdown
- Concurrency limiting

### 3. Five Media Type Handlers

| Type    | Subject              | Current Analysis          | Future (AI)                    |
|---------|----------------------|---------------------------|--------------------------------|
| `text`  | `job.analyze.text`   | Word count, sentiment, language detection | LLM summarization, entity extraction |
| `url`   | `job.analyze.url`    | URL parsing, domain info  | Page scraping, content summarization |
| `image` | `job.analyze.image`  | File metadata              | Vision model description, OCR |
| `audio` | `job.analyze.audio`  | File metadata              | Whisper STT, speaker diarization |
| `video` | `job.analyze.video`  | File metadata              | Keyframe extraction, audio track STT |

### 4. Auto-Polling Frontend

The `AnalyzePage` polls every 2 seconds while any job is in `pending` or `processing` state. Polling stops automatically once all jobs reach terminal states (`completed`/`failed`).

### 5. Shared Types in `@surdej/types`

All types are defined in `packages/types/src/contracts/analyze.ts` and exported from `@surdej/types`:
- `AnalyzeJob`, `AnalyzeResult`, `AnalyzeJobPayload`
- `AnalyzeMediaType`, `AnalyzeJobStatus`
- `ANALYZE_NATS` constants

---

## Files

| Path | Role |
|------|------|
| `apps/api/src/core/analyze/routes.ts` | API endpoints (POST, GET, file download) |
| `workers/analyze/src/index.ts` | Worker process with 5 handlers |
| `workers/analyze/package.json` | Worker package manifest |
| `workers/analyze/Dockerfile` | Docker image definition |
| `apps/frontend/src/routes/analyze/AnalyzePage.tsx` | Full UI (upload, text, URL, results) |
| `packages/types/src/contracts/analyze.ts` | Shared type definitions |
| `docker-compose.yml` | `analyze-worker` service (NATS-only dep) |

---

## NATS Bucket Configuration

| Bucket | Type | TTL | Purpose |
|--------|------|-----|---------|
| `ANALYZE_JOBS` | KV | 24h | Job metadata, status, results |
| `ANALYZE_FILES` | ObjectStore | 24h | Uploaded binary files |

---

## API Endpoints

### `POST /api/analyze`
- **Multipart:** Upload a file → stored in NATS OS, job created in KV
- **JSON:** `{ text: "..." }` or `{ url: "https://..." }`
- **Returns:** `202 Accepted` with `{ jobId, type, status: 'pending' }`

### `GET /api/analyze`
- Lists all active jobs from KV (newest first)
- **Returns:** `{ jobs: AnalyzeJob[], count: number }`

### `GET /api/analyze/:jobId`
- Polls a single job's current state
- **Returns:** Full `AnalyzeJob` object (including `result` when completed)

### `GET /api/analyze/:jobId/file`
- Downloads the original uploaded file
- Streams from NATS Object Store
- Sets correct `Content-Type` and `Content-Disposition`

---

## Future Enhancements

1. **AI Model Integration** — Plug in vision models (GPT-4o, Gemini) for image/video, Whisper for audio
2. **Persistence Toggle** — Optional flag to copy completed results to Postgres
3. **Batch Analysis** — Upload multiple files in one go, tracked as a batch
4. **WebSocket Streaming** — Replace polling with real-time status push
5. **Feedback Session Integration** — Link analysis results to existing FeedbackSession objects
