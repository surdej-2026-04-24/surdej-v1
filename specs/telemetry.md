# Telemetry & Usage Tracking

This document outlines the system for tracking API usage, infrastructure consumption (MinIO), and AI model costs within the Surdej platform.

## 1. Objectives

- **Cost Attribution**: Track AI token usage per user and per tenant to calculate billing or enforce quotas.
- **Audit Trail**: Log all significant API interactions for security and debugging.
- **Resource Monitoring**: Monitor blob storage usage (via MinIO metrics).

## 2. Data Models

### AI Usage (`AiUsageLog`)

Tracks specific LLM interactions.

| Field | Type | Description |
|---|---|---|
| `tenantId` | UUID | Tenant incurring the cost |
| `userId` | UUID | User initiating the request |
| `model` | String | e.g., `gpt-4o`, `claude-3-opus` |
| `provider` | String | e.g., `openai`, `anthropic`, `azure` |
| `inputTokens` | Int | Prompt tokens |
| `outputTokens` | Int | Completion tokens |
| `costUsd` | Float | Estimated cost |
| `operation` | String | `chat`, `embedding`, `rag` |

### API Requests (`ApiRequestLog`)

Tracks general API traffic.

| Field | Type | Description |
|---|---|---|
| `method` | String | HTTP Method (GET, POST, etc.) |
| `path` | String | Request path (e.g., `/api/articles`) |
| `status` | Int | HTTP Status Code |
| `duration` | Int | Processing time in ms |
| `userId/tenantId` | UUID | Context |

## 3. Implementation Strategy

### Middleware (Fastify)

A global `onResponse` hook in `apps/api/src/server.ts` will capture `ApiRequestLog` entries.

```typescript
app.addHook('onResponse', async (request, reply) => {
    const duration = reply.elapsedTime;
    // Log to Prisma asynchronously (fire-and-forget to avoid latency)
    prisma.apiRequestLog.create({ ... });
});
```

### AI Service Wrapper

The `CoreAiService` (or equivalent) will wrap all LLM calls to:
1.  Count tokens (using provider response or `tiktoken`).
2.  Calculate cost based on a configurable pricing map.
3.  Write to `AiUsageLog`.

### Blob Storage (MinIO)

- **Service**: MinIO running on ports `9000` (API) and `9001` (Console).
- **Buckets**:
    - `storage`: Public/Private mixed usage.
    - `system`: Internal system data.
- **Metrics**: MinIO exposes Prometheus metrics at `/minio/v2/metrics/cluster`.

## 4. Usage Reporting

A background worker (or scheduled job) can aggregate these logs to update:
- `Tenant.creditsUsed` (if applicable)
- Daily/Monthly usage reports.
