# 15 — Worker Registry

## Overview

A server-side registry that tracks all connected workers — their type, health, capabilities,
and current load. The registry provides visibility into the worker fleet and enables
intelligent job routing, auto-scaling decisions, and operational dashboards.

## Architecture

```
┌────────────────┐     heartbeat      ┌──────────────────┐
│  Worker A      │──────────────────▶│  Worker Registry  │
│  (TypeScript)  │                    │  (API Server)     │
├────────────────┤     heartbeat      │                   │
│  Worker B      │──────────────────▶│  ┌─────────────┐  │
│  (TypeScript)  │                    │  │ Registry DB  │  │
├────────────────┤     heartbeat      │  │ (Prisma)     │  │
│  Worker C      │──────────────────▶│  └─────────────┘  │
│  (TypeScript)  │                    │                   │
└────────────────┘                    │  Health checks    │
                                      │  Job routing      │
                                      │  Dashboard API    │
                                      └──────────────────┘
```

## Worker Registration

Workers register themselves with the registry on startup and send periodic heartbeats.

### Registration Payload

```typescript
interface WorkerRegistration {
  workerId: string;            // unique instance ID (UUID)
  workerType: string;          // e.g., "pdf-processor", "excel-worker", "knowledge-indexer"
  version: string;             // semantic version of the worker
  capabilities: string[];      // job types this worker handles
  prismaSchema: string;        // which Prisma schema segment this worker uses
  maxConcurrency: number;      // max parallel jobs
  metadata?: Record<string, string>;  // custom labels
}
```

### Heartbeat

```typescript
interface WorkerHeartbeat {
  workerId: string;
  status: "idle" | "busy" | "draining" | "error";
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  uptime: number;              // seconds
  memoryUsage: number;         // MB
  lastError?: string;
}
```

### Protocol

Workers communicate registration and heartbeats via NATS subjects:

| Subject | Purpose |
|---------|---------|
| `worker.register` | Worker announces itself |
| `worker.heartbeat` | Periodic health signal (every 30s) |
| `worker.deregister` | Worker gracefully shuts down |
| `worker.registry.query` | Request current registry state |

## Health Monitoring

The registry tracks worker health and marks workers as unhealthy if:
- No heartbeat received within 90 seconds (3 missed heartbeats).
- Worker reports `error` status.
- Worker's active job count exceeds `maxConcurrency`.

### Health States

| State | Description |
|-------|-------------|
| `healthy` | Receiving heartbeats, no errors |
| `degraded` | Receiving heartbeats but reporting errors |
| `unhealthy` | Missed 3+ heartbeats |
| `draining` | Worker is shutting down gracefully (finishing current jobs) |
| `offline` | Deregistered or timed out |

## Job Routing

The registry enables intelligent job routing based on worker state:

```typescript
interface JobRoutingDecision {
  targetWorkerId: string | null;      // specific worker, or null for broadcast
  routingReason: "least-loaded" | "capability-match" | "affinity" | "round-robin";
}

// API publishes job → registry selects best worker → NATS delivers
const decision = workerRegistry.route(jobType, {
  strategy: "least-loaded",           // or "round-robin", "affinity"
  affinityKey?: string,               // e.g., tenant ID for data locality
});
```

## Dashboard API

The registry exposes endpoints for operational visibility:

| Endpoint | Description |
|----------|-------------|
| `GET /api/workers` | List all registered workers with current status |
| `GET /api/workers/:id` | Detailed worker info + job history |
| `GET /api/workers/health` | Aggregate health summary |
| `GET /api/workers/metrics` | Worker fleet metrics (total jobs, error rates, avg latency) |
| `POST /api/workers/:id/drain` | Signal a worker to drain (stop accepting new jobs) |

## Data Model (Prisma — `core` schema)

| Model | Purpose |
|-------|---------|
| `WorkerRegistration` | Registered worker instances |
| `WorkerHeartbeat` | Latest heartbeat per worker (rolling, keeps last N) |
| `WorkerJobLog` | Job execution log per worker |

## Frontend

The worker dashboard is a core page:

| Command ID | Description |
|------------|-------------|
| `navigate.workers` | Open worker registry dashboard |
| `navigate.workers.detail` | Worker detail view |
| `tool.worker.drain` | Drain a specific worker |

## TypeScript-Only Workers

All workers in Surdej are TypeScript/Node.js. Each worker:

1. Is a standalone TypeScript app in `workers/<worker-type>/`.
2. Has its own `package.json` and is part of the pnpm workspace.
3. Connects to NATS on startup and subscribes to its job subjects.
4. Registers itself with the worker registry.
5. Maintains its own Prisma schema segment (see spec 01 — Architecture).
6. Has its own Dockerfile for containerized deployment.

```typescript
// workers/my-worker/src/index.ts
import { WorkerBase } from "@surdej/core/worker";

const worker = new WorkerBase({
  type: "my-worker",
  version: "1.0.0",
  capabilities: ["process-document", "generate-embedding"],
  prismaSchema: "my_worker",
  maxConcurrency: 5,
});

worker.handle("process-document", async (job) => {
  // ... process job ...
  return { status: "completed", result: data };
});

await worker.start(); // connects NATS, registers, starts heartbeat
```

---

*New specification for Surdej core worker registry.*
