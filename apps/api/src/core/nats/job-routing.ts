/**
 * Job Routing
 *
 * Routes jobs to workers based on configurable strategies:
 *   - least-loaded: pick the worker with fewest active jobs
 *   - round-robin: cycle through available workers
 *   - capability-match: require specific worker capabilities
 *   - affinity: prefer a specific worker instance
 *
 * @module nats/job-routing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────

export type RoutingStrategy = 'least-loaded' | 'round-robin' | 'capability-match' | 'affinity';

export interface RoutingOptions {
    strategy?: RoutingStrategy;
    requiredCapabilities?: string[];
    affinityInstanceId?: string;
    excludeInstances?: string[];
}

export interface JobRoutingDecision {
    instanceId: string;
    type: string;
    hostname: string;
    strategy: RoutingStrategy;
    reason: string;
}

// ─── Round Robin State ─────────────────────────────────────────

const roundRobinIndex = new Map<string, number>();

// ─── Router ────────────────────────────────────────────────────

/**
 * Route a job to an available worker.
 *
 * @param jobType - The type of job (used to find workers that handle this type)
 * @param options - Routing options (strategy, required capabilities, affinity)
 * @returns The routing decision, or null if no worker is available
 */
export async function routeJob(
    jobType: string,
    options: RoutingOptions = {},
): Promise<JobRoutingDecision | null> {
    const strategy = options.strategy ?? 'least-loaded';

    // Get all online/degraded workers that handle this job type
    // Job type format: "job.<workerType>.<action>" → extract worker type
    const workerType = jobType.split('.')[1]; // e.g., "job.knowledge.index" → "knowledge"

    let workers = await prisma.workerRegistration.findMany({
        where: {
            type: workerType ?? undefined,
            status: { in: ['online', 'degraded'] },
        },
        include: {
            heartbeats: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    });

    // Exclude specified instances
    if (options.excludeInstances?.length) {
        workers = workers.filter((w) => !options.excludeInstances!.includes(w.instanceId));
    }

    // Filter by required capabilities
    if (options.requiredCapabilities?.length) {
        workers = workers.filter((w) => {
            const caps = (w.capabilities as string[]) ?? [];
            return options.requiredCapabilities!.every((rc) => caps.includes(rc));
        });
    }

    if (workers.length === 0) return null;

    switch (strategy) {
        case 'affinity':
            return routeAffinity(workers, options.affinityInstanceId, jobType);

        case 'round-robin':
            return routeRoundRobin(workers, jobType);

        case 'capability-match':
            // Already filtered by capabilities above — pick least loaded from matches
            return routeLeastLoaded(workers, jobType, 'capability-match');

        case 'least-loaded':
        default:
            return routeLeastLoaded(workers, jobType, 'least-loaded');
    }
}

// ─── Strategy Implementations ──────────────────────────────────

function routeLeastLoaded(
    workers: WorkerWithHeartbeats[],
    _jobType: string,
    strategy: RoutingStrategy,
): JobRoutingDecision {
    // Sort by active jobs (ascending), then by total processed (descending for experience)
    const sorted = [...workers].sort((a, b) => {
        const aJobs = a.heartbeats[0]?.activeJobs ?? 0;
        const bJobs = b.heartbeats[0]?.activeJobs ?? 0;
        if (aJobs !== bJobs) return aJobs - bJobs;
        // Tiebreaker: prefer the one with more capacity
        return b.maxConcurrency - a.maxConcurrency;
    });

    const winner = sorted[0]!;
    const activeJobs = winner.heartbeats[0]?.activeJobs ?? 0;

    return {
        instanceId: winner.instanceId,
        type: winner.type,
        hostname: winner.hostname,
        strategy,
        reason: `${strategy}: ${activeJobs}/${winner.maxConcurrency} active jobs`,
    };
}

function routeRoundRobin(
    workers: WorkerWithHeartbeats[],
    jobType: string,
): JobRoutingDecision {
    const key = jobType;
    const currentIdx = roundRobinIndex.get(key) ?? 0;
    const nextIdx = (currentIdx + 1) % workers.length;
    roundRobinIndex.set(key, nextIdx);

    const winner = workers[currentIdx % workers.length]!;

    return {
        instanceId: winner.instanceId,
        type: winner.type,
        hostname: winner.hostname,
        strategy: 'round-robin',
        reason: `round-robin: index ${currentIdx} of ${workers.length}`,
    };
}

function routeAffinity(
    workers: WorkerWithHeartbeats[],
    affinityId: string | undefined,
    jobType: string,
): JobRoutingDecision {
    // Try the preferred worker first
    if (affinityId) {
        const preferred = workers.find((w) => w.instanceId === affinityId);
        if (preferred) {
            return {
                instanceId: preferred.instanceId,
                type: preferred.type,
                hostname: preferred.hostname,
                strategy: 'affinity',
                reason: `affinity: matched preferred instance ${affinityId}`,
            };
        }
    }

    // Fallback to least-loaded
    return routeLeastLoaded(workers, jobType, 'affinity');
}

// ─── Internal Types ────────────────────────────────────────────

type WorkerWithHeartbeats = Awaited<ReturnType<typeof prisma.workerRegistration.findMany>> extends (infer T)[] ? T & {
    heartbeats: { activeJobs: number; totalProcessed: number }[];
} : never;
