# Surdej — Worker Development Guide

> How to create background workers that process jobs via NATS.

---

## Overview

Workers are **standalone TypeScript processes** that connect to NATS JetStream, register with the worker registry, and process jobs. Each worker:

- Runs as its own Docker container
- Connects to NATS and subscribes to job subjects
- Sends heartbeats every 30 seconds
- Owns its data in a separate Prisma schema segment
- Can be horizontally scaled

---

## Quick Start

### 1. Copy the template

```bash
cp -r workers/_template workers/my-worker
```

### 2. Update `package.json`

```json
{
    "name": "@surdej/worker-my-worker",
    "version": "1.0.0",
    "private": true,
    "scripts": {
        "dev": "tsx watch src/index.ts",
        "build": "tsc",
        "start": "node dist/index.js"
    },
    "dependencies": {
        "@surdej/core": "workspace:*",
        "@surdej/worker-template": "workspace:*",
        "nats": "^2.28.0"
    }
}
```

### 3. Implement job handlers

```typescript
// workers/my-worker/src/index.ts
import { WorkerBase } from '@surdej/worker-template';

// Define payload types
interface ProcessPayload {
    itemId: string;
    priority: 'low' | 'medium' | 'high';
    data: Record<string, unknown>;
}

interface TransformPayload {
    itemId: string;
    format: 'pdf' | 'csv' | 'json';
}

// Create worker instance
const worker = new WorkerBase({
    type: 'my-worker',
    version: '1.0.0',
    capabilities: ['process', 'transform'],
    maxConcurrency: 4,
    prismaSchema: 'my_schema',
});

// Register job handlers
worker.handle<ProcessPayload>('job.my-domain.process', async (job) => {
    const { itemId, priority, data } = job.payload;
    worker.log(`[process] Processing item ${itemId} (priority: ${priority})`);

    // Your processing logic here...
    const result = await doSomething(data);

    return {
        itemId,
        status: 'completed',
        result,
    };
});

worker.handle<TransformPayload>('job.my-domain.transform', async (job) => {
    const { itemId, format } = job.payload;
    worker.log(`[transform] Transforming ${itemId} to ${format}`);

    // Your transformation logic here...

    return {
        itemId,
        format,
        status: 'transformed',
    };
});

// Start the worker
worker.start().catch((err: unknown) => {
    console.error('Failed to start worker:', err);
    process.exit(1);
});
```

### 4. Create a Dockerfile

```dockerfile
FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY workers/_template/package.json workers/_template/
COPY workers/my-worker/package.json workers/my-worker/

RUN pnpm install --frozen-lockfile

COPY packages/core/ packages/core/
COPY workers/_template/ workers/_template/
COPY workers/my-worker/ workers/my-worker/

RUN pnpm --filter @surdej/core build

WORKDIR /app/workers/my-worker
CMD ["pnpm", "dev"]
```

### 5. Add to Docker Compose

```yaml
# docker-compose.yml
my-worker:
    build:
        context: .
        dockerfile: workers/my-worker/Dockerfile
    profiles: ["workers"]
    volumes:
        - ./packages/core/src:/app/packages/core/src
        - ./workers/_template/src:/app/workers/_template/src
        - ./workers/my-worker/src:/app/workers/my-worker/src
    environment:
        NATS_URL: nats://nats:4222
        NODE_ENV: development
    depends_on:
        nats:
            condition: service_healthy
        postgres:
            condition: service_healthy
```

---

## WorkerBase API

### Constructor options

```typescript
new WorkerBase({
    type: string;          // Worker type identifier
    version: string;       // Semantic version
    capabilities: string[]; // List of job actions this worker handles
    maxConcurrency: number; // Max concurrent jobs (default: 4)
    prismaSchema: string;  // Prisma schema segment name
});
```

### Methods

| Method | Description |
|--------|-------------|
| `handle<T>(subject, handler)` | Register a handler for a NATS job subject |
| `start()` | Connect to NATS, register, subscribe, start heartbeats |
| `drain()` | Stop accepting new jobs, finish active ones |
| `stop()` | Immediately stop the worker |
| `log(message)` | Structured logging |

### Handler signature

```typescript
worker.handle<PayloadType>('job.domain.action', async (job) => {
    // job.payload: PayloadType
    // job.id: string
    // job.subject: string
    // job.timestamp: string

    return {
        // Return value is sent as the job result
        status: 'completed',
        // ...any result data
    };
});
```

---

## NATS Subject Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `job.<domain>.<action>` | Job request | `job.pdf-refinery.extract-text` |
| `worker.register` | Registration | Sent on start |
| `worker.heartbeat` | Health check | Every 30 seconds |
| `worker.deregister` | Shutdown | Sent on drain/stop |

---

## Worker Health States

The worker registry tracks health using a state machine:

```
          ┌──────────────────────────┐
          │                          │
          ▼                          │
    ┌──────────┐    3 missed    ┌────┴──────┐
    │ healthy  │───heartbeats──▶│ degraded  │
    └──────────┘                └─────┬─────┘
         ▲                            │
         │                            │ 3 more missed
    heartbeat                         │
    received                          ▼
         │                     ┌───────────┐
         └─────────────────────│ unhealthy │
                               └─────┬─────┘
                                     │ 3 more missed
                                     ▼
                               ┌───────────┐
                               │  offline  │
                               └───────────┘
```

---

## Adding a Prisma Schema

If your worker needs database access, create a Prisma schema segment:

```prisma
// workers/my-worker/prisma/schema/my_schema.prisma

generator client {
    provider = "prisma-client-js"
    output   = "../../node_modules/.prisma/my-schema"
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    schemas  = ["my_schema"]
}

model MyItem {
    id        String   @id @default(uuid())
    name      String
    status    String   @default("pending")
    data      Json?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@schema("my_schema")
}
```

**Rules:**
- Each schema segment uses a separate PostgreSQL schema
- Never cross-reference tables across schema segments
- Schema segment name matches the worker's `prismaSchema` config

---

## Testing Workers

```typescript
// workers/my-worker/src/index.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('my-worker', () => {
    it('should process items', async () => {
        const handler = vi.fn().mockResolvedValue({
            status: 'completed',
        });

        // Test the handler logic directly
        const result = await handler({
            payload: { itemId: '123', priority: 'high', data: {} },
            id: 'test-job-1',
            subject: 'job.my-domain.process',
            timestamp: new Date().toISOString(),
        });

        expect(result.status).toBe('completed');
    });
});
```

---

## Example Workers

| Worker | Domain | Capabilities |
|--------|--------|-------------|
| `pdf-refinery` | PDF Refinery | extract-text, ocr, analyze, embed, extract-rentals |
| `laka-dispatch` | Nexi | ingest, classify, route, notify |
| `knowledge` | Core | index-article, validate-template, generate-training |
| `document` | Core | process, convert, thumbnail |

See `workers/pdf-refinery/src/index.ts` and `workers/laka-dispatch/src/index.ts` for full examples.

---

## See Also

- [Architecture Guide](./architecture.md) — Platform design
- [Domain Extension Guide](./domain-extension.md) — Adding domains
