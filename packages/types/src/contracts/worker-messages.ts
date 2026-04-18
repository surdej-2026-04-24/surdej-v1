/**
 * Worker Message Contract — type-only re-export
 *
 * @see contracts/worker-messages.d.ts
 */

export interface WorkerRegistration {
    instanceId: string;
    type: string;
    version: string;
    capabilities: string[];
    maxConcurrency: number;
    registeredAt: string;
    hostname: string;
}

export interface WorkerHeartbeat {
    instanceId: string;
    activeJobs: number;
    totalProcessed: number;
    totalFailed: number;
    memoryUsage: number;
    cpuUsage: number;
    timestamp: string;
}

export const NATS_SUBJECTS = {
    JOB: 'job.>',
    WORKER_REGISTER: 'worker.register',
    WORKER_HEARTBEAT: 'worker.heartbeat',
    WORKER_DEREGISTER: 'worker.deregister',
    EVENT: 'event.>',
    DLQ: 'dlq.>',
} as const;
