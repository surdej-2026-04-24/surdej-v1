/**
 * Worker Types & Base Class
 *
 * Defines the contract for Surdej workers — standalone processes that
 * connect to NATS, register with the API's worker registry, and handle
 * jobs asynchronously.
 *
 * @module worker
 */

// ─── Types ─────────────────────────────────────────────────────

export interface WorkerConfig {
    /** Worker type identifier, e.g. 'knowledge', 'document', 'pdf-refinery' */
    type: string;
    /** Semantic version string */
    version: string;
    /** List of capability tags */
    capabilities: string[];
    /** Maximum concurrent jobs */
    maxConcurrency: number;
    /** Prisma schema segment name (for isolated DB schema) */
    prismaSchema?: string;
}

export interface WorkerMetrics {
    activeJobs: number;
    totalProcessed: number;
    totalFailed: number;
    memoryUsage: number;
    cpuUsage: number;
}

export interface JobMessage<T = unknown> {
    id: string;
    action: string;
    payload: T;
    replyTo?: string;
    metadata?: Record<string, unknown>;
}

export type JobHandler<T = unknown, R = unknown> = (job: JobMessage<T>) => Promise<R>;

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

/** Worker health states as seen by the registry */
export type WorkerHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

/**
 * Maps a registry status string to a health state label.
 */
export function statusToHealthState(status: string): WorkerHealthState {
    switch (status) {
        case 'online': return 'healthy';
        case 'degraded': return 'degraded';
        case 'unhealthy': return 'unhealthy';
        default: return 'offline';
    }
}
