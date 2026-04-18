/**
 * WorkerBase — Runtime base class for Surdej workers.
 *
 * Uses NATS JetStream for durable, reliable job processing:
 *   - Messages persisted in the JOBS stream (created by the API)
 *   - Durable pull consumers per worker type → competing consumers
 *   - Explicit ack/nak with automatic retry on failure
 *   - Dead-letter queue (DLQ) after max retries
 *   - Graceful drain/shutdown with in-progress job completion
 *
 * Workers are standalone Node.js processes that:
 *   1. Connect to NATS
 *   2. Register with the API's worker registry
 *   3. Create/bind JetStream consumers for each action
 *   4. Pull and process jobs with ack/nak semantics
 *   5. Send periodic heartbeats
 *   6. Handle graceful drain/shutdown
 *
 * Usage:
 *   const worker = new WorkerBase({ type: 'my-worker', ... });
 *   worker.handle('extract', async (job) => { ... });
 *   await worker.start();
 *
 * @module worker-base
 */

import {
    connect,
    StringCodec,
    AckPolicy,
    DeliverPolicy,
    type NatsConnection,
    type JetStreamClient,
    type JetStreamManager,
    type ConsumerMessages,
} from 'nats';
import type { WorkerConfig, JobMessage, JobHandler, WorkerMetrics } from '@surdej/core';
import { startNatsSpan, injectTraceHeaders } from '@surdej/core/node';
import { context } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { hostname as osHostname } from 'os';

const sc = StringCodec();

// ─── Constants ─────────────────────────────────────────────────

const STREAM_NAME = 'JOBS';           // Must match API's stream definition
const DLQ_SUBJECT_PREFIX = 'dlq.';    // Dead-letter queue subject prefix
const MAX_DELIVER = 5;                // Max delivery attempts before DLQ
const ACK_WAIT_NS = 300_000_000_000;  // 5 minutes ack timeout (nanoseconds)
const PULL_BATCH = 10;                // Messages per pull batch from NATS
const PULL_EXPIRES_MS = 30_000;       // Pull request timeout (30s)
const WORKING_INTERVAL_MS = 30_000;   // Send msg.working() every 30s to extend ack deadline

export class WorkerBase {
    readonly instanceId: string;
    readonly config: WorkerConfig;
    private nc: NatsConnection | null = null;
    private js: JetStreamClient | null = null;
    private jsm: JetStreamManager | null = null;
    private handlers = new Map<string, JobHandler>();
    private consumers: ConsumerMessages[] = [];
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private abortController: AbortController | null = null;
    private inFlightJobs = new Set<string>();  // Deduplication: track in-progress job IDs
    private metrics: WorkerMetrics = {
        activeJobs: 0,
        totalProcessed: 0,
        totalFailed: 0,
        memoryUsage: 0,
        cpuUsage: 0,
    };
    private _running = false;

    constructor(config: WorkerConfig) {
        this.config = config;
        this.instanceId = `${config.type}-${randomUUID().slice(0, 8)}`;
    }

    /** Register a handler for a specific action. Subject: job.<type>.<action> */
    handle<T = unknown, R = unknown>(action: string, handler: JobHandler<T, R>): void {
        this.handlers.set(action, handler as JobHandler);
    }

    /** Publish a message to a NATS subject (core NATS, not JetStream). */
    publish(subject: string, payload: Record<string, unknown>): void {
        if (!this.nc || this.nc.isClosed()) return;
        this.nc.publish(subject, sc.encode(JSON.stringify(payload)));
    }

    /** Start the worker: connect → create consumers → pull loop → heartbeat */
    async start(): Promise<void> {
        const natsUrl = process.env['NATS_URL'] ?? 'nats://localhost:4222';

        console.log(`[${this.instanceId}] Connecting to NATS at ${natsUrl}...`);

        this.nc = await connect({
            servers: natsUrl,
            name: this.instanceId,
            maxReconnectAttempts: -1,
            reconnectTimeWait: 2000,
        });

        console.log(`[${this.instanceId}] Connected to ${this.nc.getServer()}`);

        // Initialize JetStream
        this.jsm = await this.nc.jetstreamManager();
        this.js = this.nc.jetstream();

        // Register with the API's worker registry
        await this.register();

        // Create an AbortController for graceful shutdown
        this.abortController = new AbortController();

        // Set up JetStream consumers for each handler
        for (const [action] of this.handlers) {
            await this.setupConsumer(action);
        }

        // Also listen for drain commands on core NATS (lightweight, no persistence needed)
        const drainSub = this.nc.subscribe(`worker.drain.${this.instanceId}`);
        (async () => {
            for await (const _msg of drainSub) {
                console.log(`[${this.instanceId}] Drain command received`);
                await this.drain();
            }
        })();

        // Start heartbeat loop (every 30s)
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 30_000);
        await this.sendHeartbeat();

        this._running = true;

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`[${this.instanceId}] ${signal} received — shutting down...`);
            await this.stop();
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        console.log(`[${this.instanceId}] Worker started (${this.handlers.size} JetStream consumers)`);
    }

    /** Graceful drain: stop accepting new jobs, finish current ones */
    async drain(): Promise<void> {
        console.log(`[${this.instanceId}] Draining...`);

        // Signal all consumer loops to stop pulling
        this.abortController?.abort();

        // Wait for active jobs to finish (poll every second, max 60s)
        let waited = 0;
        while (this.metrics.activeJobs > 0 && waited < 60_000) {
            await new Promise((r) => setTimeout(r, 1000));
            waited += 1000;
        }

        if (this.metrics.activeJobs > 0) {
            console.warn(`[${this.instanceId}] Drain timeout: ${this.metrics.activeJobs} jobs still active`);
        }

        await this.deregister();
    }

    /** Full stop: drain + disconnect */
    async stop(): Promise<void> {
        this._running = false;

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        // Stop all consumer message iterators
        for (const consumer of this.consumers) {
            consumer.stop();
        }
        this.consumers = [];

        await this.deregister();

        if (this.nc && !this.nc.isClosed()) {
            await this.nc.drain();
        }

        console.log(`[${this.instanceId}] Stopped`);
    }

    get isRunning(): boolean {
        return this._running;
    }

    // ─── JetStream Consumer Setup ──────────────────────────────

    /**
     * Create or bind to a durable JetStream consumer for the given action.
     *
     * Consumer naming convention: <workerType>_<action>
     * This means all instances of the same worker type share the consumer,
     * enabling competing consumer (work queue) semantics.
     */
    private async setupConsumer(action: string): Promise<void> {
        if (!this.jsm || !this.js) return;

        const subject = `job.${this.config.type}.${action}`;
        const consumerName = `${this.config.type}_${action}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Create or update the durable consumer
        try {
            await this.jsm.consumers.add(STREAM_NAME, {
                durable_name: consumerName,
                filter_subject: subject,
                ack_policy: AckPolicy.Explicit,
                deliver_policy: DeliverPolicy.All,
                max_deliver: MAX_DELIVER,
                ack_wait: ACK_WAIT_NS,
                // Inactive threshold: clean up if unused for 24h
                inactive_threshold: 24 * 60 * 60 * 1e9,
            });
            console.log(`[${this.instanceId}] Consumer ${consumerName} ready on ${subject}`);
        } catch (err: any) {
            // Consumer might already exist with compatible config
            if (err?.message?.includes?.('already')) {
                console.log(`[${this.instanceId}] Consumer ${consumerName} already exists, binding...`);
            } else {
                console.error(`[${this.instanceId}] Failed to create consumer ${consumerName}:`, err);
                throw err;
            }
        }

        // Start the pull loop
        this.startPullLoop(action, consumerName);
    }

    /**
     * Pull loop: continuously fetch messages from the JetStream consumer.
     *
     * - Respects maxConcurrency by only pulling when below the limit
     * - Acks on success, naks on failure (triggers redelivery)
     * - Sends to DLQ after max retries
     */
    private async startPullLoop(action: string, consumerName: string): Promise<void> {
        if (!this.js) return;

        const handler = this.handlers.get(action);
        if (!handler) return;

        const consumer = await this.js.consumers.get(STREAM_NAME, consumerName);

        // Use consume() for continuous message delivery
        const messages = await consumer.consume({
            max_messages: PULL_BATCH,
            expires: PULL_EXPIRES_MS,
        });

        this.consumers.push(messages);

        // Process messages concurrently (up to maxConcurrency)
        (async () => {
            for await (const msg of messages) {
                // Check concurrency — if at capacity, nak with delay to retry later
                if (this.metrics.activeJobs >= this.config.maxConcurrency) {
                    console.log(`[${this.instanceId}] At capacity (${this.config.maxConcurrency}), requeuing...`);
                    msg.nak(5_000); // Retry after 5 seconds
                    continue;
                }

                this.metrics.activeJobs++;

                // Fire handler concurrently — don't await, so the loop
                // continues pulling the next message immediately
                void this.processMessage(action, msg, handler);
            }
        })().catch((err) => {
            if (!this._running) return; // Expected during shutdown
            console.error(`[${this.instanceId}] Consumer loop error for ${action}:`, err);
        });
    }

    /**
     * Process a single message concurrently.
     * Called without await from the pull loop so multiple jobs run in parallel.
     */
    private async processMessage(action: string, msg: any, handler: JobHandler): Promise<void> {
        const deliveryCount = msg.info?.redeliveryCount ?? 0;
        const isLastAttempt = deliveryCount >= MAX_DELIVER - 1;
        const subject = `job.${this.config.type}.${action}`;

        // Parse job early so we can deduplicate by job ID
        let job: JobMessage;
        try {
            job = JSON.parse(sc.decode(msg.data));
        } catch (parseErr) {
            console.error(`[${this.instanceId}] Failed to parse job message:`, parseErr);
            msg.ack(); // Bad message — ack to remove from queue
            this.metrics.activeJobs--;
            return;
        }

        // Deduplication: if this job ID is already being processed, nak with delay
        if (this.inFlightJobs.has(job.id)) {
            console.log(`[${this.instanceId}] Duplicate job ${job.id} — already in flight, requeuing`);
            msg.nak(30_000); // Retry after 30s
            this.metrics.activeJobs--;
            return;
        }
        this.inFlightJobs.add(job.id);

        // Progressive ack: send msg.working() periodically to extend the ack deadline
        const workingTimer = setInterval(() => {
            try { msg.working(); } catch { /* msg may be done */ }
        }, WORKING_INTERVAL_MS);

        const { span, ctx } = startNatsSpan(subject, msg.headers, {
            'worker.instance_id': this.instanceId,
            'worker.type': this.config.type,
            'job.action': action,
            'job.delivery_count': deliveryCount + 1,
        });

        try {
            const startTime = Date.now();

            span.setAttribute('job.id', job.id);

            console.log(
                `[${this.instanceId}] Processing ${action}: ${job.id}` +
                ` (${this.metrics.activeJobs}/${this.config.maxConcurrency} active)` +
                (deliveryCount > 0 ? ` (attempt ${deliveryCount + 1}/${MAX_DELIVER})` : '')
            );

            await context.with(ctx, () => handler(job));
            const durationMs = Date.now() - startTime;

            this.metrics.totalProcessed++;
            msg.ack();
            span.setAttribute('job.duration_ms', durationMs);
            span.end();

            console.log(
                `[${this.instanceId}] ✅ ${action}: ${job.id} completed (${durationMs}ms)`
            );
        } catch (err) {
            this.metrics.totalFailed++;
            console.error(`[${this.instanceId}] ❌ Job ${action} failed:`, err);

            span.recordException(err instanceof Error ? err : new Error(String(err)));
            span.setAttribute('job.failed', true);

            if (isLastAttempt) {
                console.error(
                    `[${this.instanceId}] 💀 Max retries (${MAX_DELIVER}) reached — sending to DLQ`
                );
                span.setAttribute('job.sent_to_dlq', true);
                await this.sendToDLQ(action, msg.data, err);
                msg.ack();
            } else {
                msg.nak(10_000);
            }

            span.end();
        } finally {
            clearInterval(workingTimer);
            this.inFlightJobs.delete(job.id);
            this.metrics.activeJobs--;
        }
    }

    /**
     * Send a failed message to the Dead Letter Queue.
     */
    private async sendToDLQ(action: string, data: Uint8Array, error: unknown): Promise<void> {
        if (!this.js) return;

        const dlqSubject = `${DLQ_SUBJECT_PREFIX}${this.config.type}.${action}`;
        const dlqPayload = {
            originalSubject: `job.${this.config.type}.${action}`,
            originalData: JSON.parse(sc.decode(data)),
            error: error instanceof Error ? error.message : String(error),
            workerInstance: this.instanceId,
            failedAt: new Date().toISOString(),
            maxDeliverReached: MAX_DELIVER,
        };

        try {
            await this.js.publish(
                dlqSubject,
                sc.encode(JSON.stringify(dlqPayload)),
                { headers: injectTraceHeaders() },
            );
            console.log(`[${this.instanceId}] Sent to DLQ: ${dlqSubject}`);
        } catch (dlqErr) {
            console.error(`[${this.instanceId}] Failed to send to DLQ:`, dlqErr);
        }
    }

    // ─── Worker Registry ───────────────────────────────────────

    private async register(): Promise<void> {
        if (!this.nc) return;

        const payload = {
            instanceId: this.instanceId,
            type: this.config.type,
            version: this.config.version,
            capabilities: this.config.capabilities,
            maxConcurrency: this.config.maxConcurrency,
            hostname: osHostname(),
        };

        try {
            const response = await this.nc.request(
                'worker.register',
                sc.encode(JSON.stringify(payload)),
                { timeout: 5000 },
            );
            const result = JSON.parse(sc.decode(response.data));
            if (!result.ok) {
                console.error(`[${this.instanceId}] Registration failed:`, result.error);
            } else {
                console.log(`[${this.instanceId}] Registered with registry`);
            }
        } catch (err) {
            console.warn(`[${this.instanceId}] Registry unavailable (will retry via heartbeat):`, err);
        }
    }

    private async sendHeartbeat(): Promise<void> {
        if (!this.nc || this.nc.isClosed()) return;

        const mem = process.memoryUsage();
        this.metrics.memoryUsage = mem.heapUsed;
        this.metrics.cpuUsage = 0;

        const payload = {
            instanceId: this.instanceId,
            ...this.metrics,
        };

        this.nc.publish('worker.heartbeat', sc.encode(JSON.stringify(payload)));
    }

    private async deregister(): Promise<void> {
        if (!this.nc || this.nc.isClosed()) return;

        const payload = {
            instanceId: this.instanceId,
            reason: 'shutdown',
        };

        this.nc.publish('worker.deregister', sc.encode(JSON.stringify(payload)));
        console.log(`[${this.instanceId}] Deregistered`);
    }
}
