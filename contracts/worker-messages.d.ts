/**
 * Worker Message Contract
 *
 * Defines the message types exchanged between the API server and workers via NATS.
 */

/** Sent by a worker when it starts and connects to NATS */
export interface WorkerRegistration {
    /** Unique worker instance ID */
    instanceId: string;

    /** Worker type (e.g. "knowledge", "document", "pdf-refinery") */
    type: string;

    /** Worker version (semver) */
    version: string;

    /** Capabilities this worker supports */
    capabilities: string[];

    /** Maximum concurrent job capacity */
    maxConcurrency: number;

    /** ISO timestamp of registration */
    registeredAt: string;

    /** Hostname of the worker */
    hostname: string;
}

/** Sent by a worker every 30 seconds to report health */
export interface WorkerHeartbeat {
    /** Worker instance ID */
    instanceId: string;

    /** Current number of active jobs */
    activeJobs: number;

    /** Total jobs processed since start */
    totalProcessed: number;

    /** Total jobs failed since start */
    totalFailed: number;

    /** Memory usage in bytes */
    memoryUsage: number;

    /** CPU usage percentage (0-100) */
    cpuUsage: number;

    /** ISO timestamp */
    timestamp: string;
}

/** NATS subject patterns */
export const NATS_SUBJECTS = {
    /** Job dispatch: job.<worker-type>.<action> */
    JOB: 'job.>',

    /** Worker registration */
    WORKER_REGISTER: 'worker.register',

    /** Worker heartbeat */
    WORKER_HEARTBEAT: 'worker.heartbeat',

    /** Worker deregistration */
    WORKER_DEREGISTER: 'worker.deregister',

    /** Domain events: event.<domain>.<action> */
    EVENT: 'event.>',

    /** Dead letter queue */
    DLQ: 'dlq.>',
} as const;
