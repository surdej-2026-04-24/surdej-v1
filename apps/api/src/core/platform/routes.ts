/**
 * Platform Overview Routes
 *
 * Comprehensive endpoints for the platform health dashboard:
 *   GET /api/platform/health    — full system health (DB, NATS, workers, streams)
 *   GET /api/platform/streams   — NATS JetStream stream & consumer info
 *   GET /api/platform/database  — Database table stats (row counts, sizes)
 *   GET /api/platform/dlq       — Dead letter queue messages
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
    getNatsConnection,
    getJetStreamManager,
    isNatsConnected,
} from '../nats/index.js';

const prisma = new PrismaClient();

export async function platformRoutes(app: FastifyInstance) {
    /**
     * GET /api/platform/health — comprehensive system health
     */
    app.get('/health', async (_req, reply) => {
        // Database check
        let dbOk = false;
        let dbLatencyMs = 0;
        try {
            const start = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            dbLatencyMs = Date.now() - start;
            dbOk = true;
        } catch { /* db down */ }

        // NATS check
        const natsOk = isNatsConnected();
        let natsServer = '';
        try {
            if (natsOk) natsServer = getNatsConnection().getServer();
        } catch { /* */ }

        // Worker stats
        const workers = await prisma.workerRegistration.findMany().catch(() => []);
        const workerCounts = { total: workers.length, online: 0, offline: 0, degraded: 0 };
        for (const w of workers) {
            if (w.status === 'online') workerCounts.online++;
            else if (w.status === 'offline') workerCounts.offline++;
            else if (w.status === 'degraded') workerCounts.degraded++;
        }

        // Stream stats
        let streamStats: { name: string; messages: number; bytes: number; consumers: number }[] = [];
        if (natsOk) {
            try {
                const jsm = getJetStreamManager();
                const streams = await jsm.streams.list().next();
                streamStats = streams.map((s: any) => ({
                    name: s.config.name,
                    messages: s.state.messages,
                    bytes: s.state.bytes,
                    consumers: s.state.consumer_count,
                }));
            } catch { /* */ }
        }

        // Job stats from DB
        const jobCounts = await prisma.job.groupBy({
            by: ['status'],
            _count: true,
        }).catch(() => []);

        return reply.send({
            status: dbOk && natsOk ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: { ok: dbOk, latencyMs: dbLatencyMs },
            nats: { ok: natsOk, server: natsServer, streams: streamStats },
            workers: workerCounts,
            jobs: jobCounts.reduce((acc: Record<string, number>, j: any) => {
                acc[j.status] = j._count;
                return acc;
            }, {}),
        });
    });

    /**
     * GET /api/platform/streams — detailed NATS JetStream stream info
     */
    app.get('/streams', async (_req, reply) => {
        if (!isNatsConnected()) {
            return reply.status(503).send({ error: 'NATS not connected' });
        }

        try {
            const jsm = getJetStreamManager();
            const streams = await jsm.streams.list().next();

            const result: any[] = [];
            for (const stream of streams) {
                // Get consumers for this stream
                const consumers = await jsm.consumers.list(stream.config.name).next();

                result.push({
                    name: stream.config.name,
                    description: stream.config.description ?? '',
                    subjects: stream.config.subjects,
                    retention: stream.config.retention,
                    storage: stream.config.storage,
                    state: {
                        messages: stream.state.messages,
                        bytes: stream.state.bytes,
                        firstSeq: stream.state.first_seq,
                        lastSeq: stream.state.last_seq,
                        consumerCount: stream.state.consumer_count,
                    },
                    consumers: consumers.map((c: any) => ({
                        name: c.config.durable_name ?? c.name,
                        filterSubject: c.config.filter_subject ?? '*',
                        ackPolicy: c.config.ack_policy,
                        maxDeliver: c.config.max_deliver,
                        numPending: c.num_pending,
                        numAckPending: c.num_ack_pending,
                        numRedelivered: c.num_redelivered,
                        numWaiting: c.num_waiting,
                        delivered: {
                            streamSeq: c.delivered.stream_seq,
                            consumerSeq: c.delivered.consumer_seq,
                        },
                    })),
                });
            }

            return reply.send(result);
        } catch (err) {
            return reply.status(500).send({ error: String(err) });
        }
    });

    /**
     * GET /api/platform/database — database table statistics
     */
    app.get('/database', async (_req, reply) => {
        try {
            // Get table row counts and sizes from pg_stat_user_tables
            const tables = await prisma.$queryRaw<{
                table_name: string;
                row_count: bigint;
                total_bytes: bigint;
                index_bytes: bigint;
            }[]>`
                SELECT
                    relname AS table_name,
                    n_live_tup AS row_count,
                    pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) AS total_bytes,
                    pg_indexes_size(quote_ident(schemaname) || '.' || quote_ident(relname)) AS index_bytes
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC
            `;

            // Get database size
            const dbSize = await prisma.$queryRaw<{ size: string }[]>`
                SELECT pg_size_pretty(pg_database_size(current_database())) AS size
            `;

            // Get connection info
            const connInfo = await prisma.$queryRaw<{ count: bigint }[]>`
                SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
            `;

            return reply.send({
                databaseSize: dbSize[0]?.size ?? 'unknown',
                activeConnections: Number(connInfo[0]?.count ?? 0),
                tables: tables.map(t => ({
                    name: t.table_name,
                    rowCount: Number(t.row_count),
                    totalBytes: Number(t.total_bytes),
                    totalSize: formatBytes(Number(t.total_bytes)),
                    indexBytes: Number(t.index_bytes),
                    indexSize: formatBytes(Number(t.index_bytes)),
                })),
            });
        } catch (err) {
            return reply.status(500).send({ error: String(err) });
        }
    });

    /**
     * GET /api/platform/dlq — dead letter queue messages
     */
    app.get('/dlq', async (_req, reply) => {
        if (!isNatsConnected()) {
            return reply.status(503).send({ error: 'NATS not connected' });
        }

        try {
            const jsm = getJetStreamManager();

            // Check if DLQ stream exists
            let dlqStream;
            try {
                dlqStream = await jsm.streams.info('DLQ');
            } catch {
                return reply.send({ messages: [], total: 0 });
            }

            // If no messages, return empty
            if (dlqStream.state.messages === 0) {
                return reply.send({ messages: [], total: 0 });
            }

            // Read recent DLQ messages (up to 50)
            const nc = getNatsConnection();
            const js = nc.jetstream();
            const consumer = await js.consumers.get('DLQ');
            const messages: any[] = [];

            try {
                const batch = await consumer.fetch({ max_messages: 50, expires: 3000 });
                for await (const msg of batch) {
                    try {
                        const data = JSON.parse(new TextDecoder().decode(msg.data));
                        messages.push({
                            subject: msg.subject,
                            seq: msg.seq,
                            timestamp: msg.info?.timestampNanos
                                ? new Date(Number(msg.info.timestampNanos) / 1e6).toISOString()
                                : null,
                            data,
                        });
                    } catch {
                        messages.push({ subject: msg.subject, seq: msg.seq, raw: true });
                    }
                    // Don't ack — we want to keep DLQ messages for review
                }
            } catch { /* timeout or no messages */ }

            return reply.send({
                messages,
                total: dlqStream.state.messages,
            });
        } catch (err) {
            return reply.status(500).send({ error: String(err) });
        }
    });
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
