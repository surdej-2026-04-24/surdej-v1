/**
 * Worker types — mirrors @surdej/core/worker
 */

export interface WorkerConfig {
    type: string;
    version: string;
    capabilities: string[];
    maxConcurrency: number;
    natsUrl?: string;
    prismaSchema?: string;
}

export interface WorkerMetrics {
    activeJobs: number;
    totalProcessed: number;
    totalFailed: number;
    uptime: number;
}

export interface JobMessage {
    id: string;
    type: string;
    action: string;
    payload: Record<string, unknown>;
    tenantId?: string;
    replyTo?: string;
    timestamp: string;
}

export type JobHandler = (job: JobMessage) => Promise<Record<string, unknown>>;

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
    reason: string;
}

export type WorkerHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
