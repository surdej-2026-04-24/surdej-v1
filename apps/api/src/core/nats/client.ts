/**
 * NATS Client — Connection manager and JetStream setup.
 *
 * Manages a singleton NATS connection for the API server.
 * Creates JetStream streams for job, event, worker, and DLQ subjects.
 *
 * @module nats/client
 */

import { connect, RetentionPolicy, StorageType, type NatsConnection, type JetStreamManager, type JetStreamClient } from 'nats';

// ─── Configuration ─────────────────────────────────────────────

export interface NatsConfig {
    url: string;
    name?: string;
    maxReconnects?: number;
    reconnectTimeWait?: number; // ms
}

const DEFAULT_CONFIG: NatsConfig = {
    url: process.env['NATS_URL'] ?? 'nats://localhost:4222',
    name: 'surdej-api',
    maxReconnects: -1, // Unlimited
    reconnectTimeWait: 2000,
};

// ─── Stream Definitions ────────────────────────────────────────

interface StreamDef {
    name: string;
    subjects: string[];
    description: string;
    maxAge?: number; // nanoseconds
    maxMsgs?: number;
}

const STREAMS: StreamDef[] = [
    {
        name: 'JOBS',
        subjects: ['job.>'],
        description: 'Job queue — async work dispatched to workers',
        maxAge: 7 * 24 * 60 * 60 * 1e9, // 7 days in ns
    },
    {
        name: 'EVENTS',
        subjects: ['event.>'],
        description: 'Domain events — pub/sub across services',
        maxAge: 24 * 60 * 60 * 1e9, // 1 day
    },
    {
        name: 'WORKERS',
        subjects: ['worker.>'],
        description: 'Worker lifecycle — register, heartbeat, deregister',
        maxAge: 60 * 60 * 1e9, // 1 hour
    },
    {
        name: 'DLQ',
        subjects: ['dlq.>'],
        description: 'Dead letter queue — failed messages after max retries',
        maxAge: 30 * 24 * 60 * 60 * 1e9, // 30 days
    },
    {
        name: 'MODULES',
        subjects: ['module.>'],
        description: 'Module lifecycle — register, deregister, heartbeat',
        maxAge: 60 * 60 * 1e9, // 1 hour
    },
];

// ─── Singleton ─────────────────────────────────────────────────

let nc: NatsConnection | null = null;
let jsm: JetStreamManager | null = null;
let js: JetStreamClient | null = null;

/** Get the NATS connection. Throws if not connected. */
export function getNatsConnection(): NatsConnection {
    if (!nc) throw new Error('NATS not connected. Call connectNats() first.');
    return nc;
}

/** Get the JetStream client. Throws if not connected. */
export function getJetStream(): JetStreamClient {
    if (!js) throw new Error('JetStream not initialized. Call connectNats() first.');
    return js;
}

/** Get the JetStream manager (for administrative operations). */
export function getJetStreamManager(): JetStreamManager {
    if (!jsm) throw new Error('JetStreamManager not initialized. Call connectNats() first.');
    return jsm;
}

/**
 * Connect to NATS and initialize JetStream streams.
 *
 * This is idempotent — calling it multiple times reuses the existing connection.
 */
export async function connectNats(config: Partial<NatsConfig> = {}): Promise<NatsConnection> {
    if (nc && !nc.isClosed()) return nc;

    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log(`[NATS] Connecting to ${cfg.url}...`);

    nc = await connect({
        servers: cfg.url,
        name: cfg.name,
        maxReconnectAttempts: cfg.maxReconnects,
        reconnectTimeWait: cfg.reconnectTimeWait,
    });

    console.log(`[NATS] Connected to ${nc.getServer()}`);

    // Set up event handlers
    nc.closed().then(() => {
        console.log('[NATS] Connection closed');
        nc = null;
        jsm = null;
        js = null;
    });

    (async () => {
        for await (const s of nc!.status()) {
            switch (s.type) {
                case 'reconnect':
                    console.log(`[NATS] Reconnected to ${s.data}`);
                    break;
                case 'disconnect':
                    console.log('[NATS] Disconnected');
                    break;
                case 'error':
                    console.error('[NATS] Error:', s.data);
                    break;
            }
        }
    })();

    // Initialize JetStream
    jsm = await nc.jetstreamManager();
    js = nc.jetstream();

    // Create/update streams
    await ensureStreams();

    return nc;
}

/**
 * Create or update all JetStream streams.
 */
async function ensureStreams(): Promise<void> {
    if (!jsm) return;

    for (const def of STREAMS) {
        try {
            await jsm.streams.info(def.name);
            // Stream exists — update subjects if needed
            await jsm.streams.update(def.name, {
                subjects: def.subjects,
                description: def.description,
                max_age: def.maxAge,
            });
            console.log(`[NATS] Stream ${def.name} updated`);
        } catch {
            // Stream doesn't exist — create it
            await jsm.streams.add({
                name: def.name,
                subjects: def.subjects,
                description: def.description,
                max_age: def.maxAge,
                retention: def.name === 'EVENTS' ? RetentionPolicy.Interest : RetentionPolicy.Limits,
                storage: StorageType.File,
                num_replicas: 1,
            });
            console.log(`[NATS] Stream ${def.name} created`);
        }
    }
}

/**
 * Gracefully disconnect from NATS.
 */
export async function disconnectNats(): Promise<void> {
    if (nc && !nc.isClosed()) {
        await nc.drain();
        console.log('[NATS] Drained and disconnecting');
    }
    nc = null;
    jsm = null;
    js = null;
}

/** Check if NATS is currently connected. */
export function isNatsConnected(): boolean {
    return nc !== null && !nc.isClosed();
}
