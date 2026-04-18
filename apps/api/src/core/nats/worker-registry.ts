/**
 * Worker Registry Service
 *
 * Manages worker lifecycle via NATS subscriptions:
 *   - worker.register   — worker comes online
 *   - worker.heartbeat  — periodic health signal
 *   - worker.deregister — graceful shutdown
 *
 * Health state machine:
 *   healthy → degraded (1 missed) → unhealthy (2 missed) → offline (3 missed)
 *
 * @module nats/worker-registry
 */

import { getNatsConnection } from './client.js';
import { StringCodec, type Subscription } from 'nats';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/index.js';

const log = logger.child({ component: 'WorkerRegistry' });

const sc = StringCodec();
const prisma = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────

export interface WorkerRegistrationPayload {
    instanceId: string;
    type: string;
    version: string;
    capabilities: string[];
    maxConcurrency: number;
    hostname: string;
}

export interface WorkerHeartbeatPayload {
    instanceId: string;
    activeJobs: number;
    totalProcessed: number;
    totalFailed: number;
    memoryUsage: number;
    cpuUsage: number;
}

export interface WorkerDeregisterPayload {
    instanceId: string;
    reason?: string;
}

export type WorkerHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

// ─── Constants ─────────────────────────────────────────────────

const HEARTBEAT_TIMEOUT = 90_000; // 90 seconds = 3 missed heartbeats (30s interval)
const HEALTH_CHECK_INTERVAL = 15_000; // 15 seconds

// ─── Service ───────────────────────────────────────────────────

let subs: Subscription[] = [];
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the worker registry service.
 * Subscribes to NATS subjects and begins health monitoring.
 */
export async function startWorkerRegistry(): Promise<void> {
    const nc = getNatsConnection();

    // Subscribe to worker lifecycle subjects (using core NATS, not JetStream)
    const registerSub = nc.subscribe('worker.register');
    const heartbeatSub = nc.subscribe('worker.heartbeat');
    const deregisterSub = nc.subscribe('worker.deregister');

    subs = [registerSub, heartbeatSub, deregisterSub];

    // Handle registrations
    (async () => {
        for await (const msg of registerSub) {
            try {
                const payload: WorkerRegistrationPayload = JSON.parse(sc.decode(msg.data));
                await handleRegister(payload);
                msg.respond(sc.encode(JSON.stringify({ ok: true })));
            } catch (err) {
                log.error({ err }, 'Register error');
                msg.respond(sc.encode(JSON.stringify({ ok: false, error: String(err) })));
            }
        }
    })();

    // Handle heartbeats
    (async () => {
        for await (const msg of heartbeatSub) {
            try {
                const payload: WorkerHeartbeatPayload = JSON.parse(sc.decode(msg.data));
                await handleHeartbeat(payload);
            } catch (err) {
                log.error({ err }, 'Heartbeat error');
            }
        }
    })();

    // Handle deregistrations
    (async () => {
        for await (const msg of deregisterSub) {
            try {
                const payload: WorkerDeregisterPayload = JSON.parse(sc.decode(msg.data));
                await handleDeregister(payload);
            } catch (err) {
                log.error({ err }, 'Deregister error');
            }
        }
    })();

    // Start health monitoring
    healthCheckTimer = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);

    log.info('Started — listening on worker.{register,heartbeat,deregister}');
}

/**
 * Stop the worker registry service.
 */
export async function stopWorkerRegistry(): Promise<void> {
    for (const sub of subs) {
        sub.unsubscribe();
    }
    subs = [];

    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }

    log.info('Stopped');
}

// ─── Handlers ──────────────────────────────────────────────────

async function handleRegister(payload: WorkerRegistrationPayload): Promise<void> {
    const { instanceId, type, version, capabilities, maxConcurrency, hostname } = payload;

    await prisma.workerRegistration.upsert({
        where: { instanceId },
        create: {
            instanceId,
            type,
            version,
            capabilities: capabilities as unknown as any,
            maxConcurrency,
            hostname,
            status: 'online',
            lastHeartbeat: new Date(),
        },
        update: {
            type,
            version,
            capabilities: capabilities as unknown as any,
            maxConcurrency,
            hostname,
            status: 'online',
            lastHeartbeat: new Date(),
        },
    });

    log.info(`Registered: ${instanceId} (${type} v${version})`);
}

async function handleHeartbeat(payload: WorkerHeartbeatPayload): Promise<void> {
    const { instanceId, activeJobs, totalProcessed, totalFailed, memoryUsage, cpuUsage } = payload;

    // Update last heartbeat — returns count of matched rows
    const { count } = await prisma.workerRegistration.updateMany({
        where: { instanceId },
        data: {
            lastHeartbeat: new Date(),
            status: 'online',
        },
    });

    // Skip heartbeat record if the worker isn't registered (avoids FK violation)
    if (count === 0) {
        log.warn(`Heartbeat from unregistered instance ${instanceId} — ignoring`);
        return;
    }

    // Record heartbeat entry
    try {
        await prisma.workerHeartbeat.create({
            data: {
                instanceId,
                activeJobs,
                totalProcessed,
                totalFailed,
                memoryUsage: BigInt(memoryUsage),
                cpuUsage,
            },
        });
    } catch (err: any) {
        if (err?.code === 'P2003') {
            log.warn(`Heartbeat FK miss for ${instanceId} — registration may have been pruned`);
            return;
        }
        throw err;
    }
}

async function handleDeregister(payload: WorkerDeregisterPayload): Promise<void> {
    const { instanceId, reason } = payload;

    await prisma.workerRegistration.updateMany({
        where: { instanceId },
        data: { status: 'offline' },
    });

    log.info(`Deregistered: ${instanceId}${reason ? ` (${reason})` : ''}`);
}

// ─── Health Check ──────────────────────────────────────────────

/**
 * Periodic health check — detects workers with missed heartbeats.
 *
 * State machine:
 *   - < 30s since heartbeat → healthy (online)
 *   - 30–60s → degraded
 *   - 60–90s → unhealthy
 *   - > 90s → offline
 */
async function runHealthCheck(): Promise<void> {
    const now = Date.now();

    const workers = await prisma.workerRegistration.findMany({
        where: {
            status: { not: 'offline' },
        },
    });

    for (const worker of workers) {
        if (!worker.lastHeartbeat) continue;

        const elapsed = now - worker.lastHeartbeat.getTime();
        let newStatus: string;

        if (elapsed < 30_000) {
            newStatus = 'online'; // healthy
        } else if (elapsed < 60_000) {
            newStatus = 'degraded';
        } else if (elapsed < HEARTBEAT_TIMEOUT) {
            newStatus = 'unhealthy';
        } else {
            newStatus = 'offline';
        }

        if (newStatus !== worker.status) {
            await prisma.workerRegistration.update({
                where: { id: worker.id },
                data: { status: newStatus },
            });
            log.info(`${worker.instanceId}: ${worker.status} → ${newStatus}`);
        }
    }
}

// ─── Queries ───────────────────────────────────────────────────

/** Get all registered workers. */
export async function getAllWorkers() {
    return prisma.workerRegistration.findMany({
        orderBy: { registeredAt: 'desc' },
    });
}

/** Get a specific worker by instance ID. */
export async function getWorkerByInstanceId(instanceId: string) {
    return prisma.workerRegistration.findUnique({
        where: { instanceId },
        include: {
            heartbeats: {
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    });
}

/** Get all workers of a specific type. */
export async function getWorkersByType(type: string) {
    return prisma.workerRegistration.findMany({
        where: { type },
        orderBy: { registeredAt: 'desc' },
    });
}

/** Get aggregate worker health stats. */
export async function getWorkerHealthStats() {
    const workers = await prisma.workerRegistration.findMany();
    const counts = { total: workers.length, online: 0, degraded: 0, unhealthy: 0, offline: 0, draining: 0 };

    for (const w of workers) {
        const s = w.status as keyof typeof counts;
        if (s in counts) (counts[s] as number)++;
    }

    return counts;
}

/**
 * Compute the health state label for a worker status.
 */
export function statusToHealthState(status: string): WorkerHealthState {
    switch (status) {
        case 'online': return 'healthy';
        case 'degraded': return 'degraded';
        case 'unhealthy': return 'unhealthy';
        default: return 'offline';
    }
}
