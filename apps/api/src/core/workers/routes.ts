/**
 * Worker Dashboard Routes
 *
 * Provides REST endpoints for the worker management frontend:
 *   GET  /api/workers           — list all workers
 *   GET  /api/workers/health    — aggregate health stats
 *   GET  /api/workers/metrics   — recent metrics across all workers
 *   GET  /api/workers/:id       — worker detail + heartbeats
 *   POST /api/workers/:id/drain — initiate graceful drain
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getNatsConnection, getJetStreamManager, isNatsConnected, statusToHealthState } from '../nats/index.js';
import { StringCodec } from 'nats';

const prisma = new PrismaClient();
const sc = StringCodec();

export async function workersRoutes(app: FastifyInstance) {
    /**
     * GET /api/workers — list all registered workers
     */
    app.get('/', async (_req, reply) => {
        const workers = await prisma.workerRegistration.findMany({
            orderBy: { registeredAt: 'desc' },
            include: {
                heartbeats: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        const result = workers.map((w) => ({
            id: w.id,
            instanceId: w.instanceId,
            type: w.type,
            version: w.version,
            capabilities: w.capabilities,
            maxConcurrency: w.maxConcurrency,
            hostname: w.hostname,
            status: w.status,
            healthState: statusToHealthState(w.status),
            registeredAt: w.registeredAt,
            lastHeartbeat: w.lastHeartbeat,
            latestMetrics: w.heartbeats[0]
                ? {
                    activeJobs: w.heartbeats[0].activeJobs,
                    totalProcessed: w.heartbeats[0].totalProcessed,
                    totalFailed: w.heartbeats[0].totalFailed,
                    memoryUsage: Number(w.heartbeats[0].memoryUsage),
                    cpuUsage: w.heartbeats[0].cpuUsage,
                }
                : null,
        }));

        return reply.send(result);
    });

    /**
     * GET /api/workers/health — aggregate health dashboard
     */
    app.get('/health', async (_req, reply) => {
        const workers = await prisma.workerRegistration.findMany();
        const counts = { total: 0, online: 0, degraded: 0, unhealthy: 0, offline: 0, draining: 0 };

        for (const w of workers) {
            counts.total++;
            const s = w.status as keyof typeof counts;
            if (s in counts && s !== 'total') (counts[s] as number)++;
        }

        return reply.send({
            natsConnected: isNatsConnected(),
            ...counts,
        });
    });

    /**
     * GET /api/workers/metrics — recent metrics across all workers
     */
    app.get('/metrics', async (_req, reply) => {
        const heartbeats = await prisma.workerHeartbeat.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                worker: {
                    select: { instanceId: true, type: true, hostname: true },
                },
            },
        });

        const result = heartbeats.map((h) => ({
            instanceId: h.instanceId,
            workerType: h.worker.type,
            hostname: h.worker.hostname,
            activeJobs: h.activeJobs,
            totalProcessed: h.totalProcessed,
            totalFailed: h.totalFailed,
            memoryUsage: Number(h.memoryUsage),
            cpuUsage: h.cpuUsage,
            timestamp: h.createdAt,
        }));

        return reply.send(result);
    });

    /**
     * GET /api/workers/:id — worker detail with recent heartbeats
     */
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const worker = await prisma.workerRegistration.findUnique({
            where: { instanceId: req.params.id },
            include: {
                heartbeats: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        });

        if (!worker) {
            return reply.status(404).send({ error: 'Worker not found' });
        }

        return reply.send({
            ...worker,
            healthState: statusToHealthState(worker.status),
            heartbeats: worker.heartbeats.map((h) => ({
                ...h,
                memoryUsage: Number(h.memoryUsage),
            })),
        });
    });

    /**
     * POST /api/workers/:id/drain — initiate graceful drain
     */
    app.post<{ Params: { id: string } }>('/:id/drain', async (req, reply) => {
        const worker = await prisma.workerRegistration.findUnique({
            where: { instanceId: req.params.id },
        });

        if (!worker) {
            return reply.status(404).send({ error: 'Worker not found' });
        }

        if (worker.status === 'offline') {
            return reply.status(400).send({ error: 'Worker is already offline' });
        }

        // Update status to draining
        await prisma.workerRegistration.update({
            where: { id: worker.id },
            data: { status: 'draining' },
        });

        // Send drain command via NATS
        if (isNatsConnected()) {
            try {
                const nc = getNatsConnection();
                nc.publish(
                    `worker.drain.${worker.instanceId}`,
                    sc.encode(JSON.stringify({ instanceId: worker.instanceId })),
                );
            } catch (err) {
                console.error('[Workers] Failed to publish drain command:', err);
            }
        }

        return reply.send({ ok: true, instanceId: worker.instanceId, status: 'draining' });
    });

    /**
     * GET /api/workers/queues — JetStream stream + consumer stats (queue depth, pending, etc.)
     */
    app.get('/queues', async (_req, reply) => {
        if (!isNatsConnected()) {
            return reply.send({ connected: false, streams: [], consumers: [] });
        }

        try {
            const jsm = getJetStreamManager();

            // Gather stream info
            const streamNames = ['JOBS', 'DLQ'];
            const streams: Array<{
                name: string;
                messages: number;
                bytes: number;
                firstSeq: number;
                lastSeq: number;
                consumerCount: number;
            }> = [];

            for (const name of streamNames) {
                try {
                    const info = await jsm.streams.info(name);
                    streams.push({
                        name: info.config.name,
                        messages: info.state.messages,
                        bytes: info.state.bytes,
                        firstSeq: info.state.first_seq,
                        lastSeq: info.state.last_seq,
                        consumerCount: info.state.consumer_count,
                    });
                } catch {
                    // Stream doesn't exist — skip
                }
            }

            // Gather consumer info for JOBS stream
            const consumers: Array<{
                stream: string;
                name: string;
                pending: number;
                waiting: number;
                ackPending: number;
                redelivered: number;
                delivered: number;
            }> = [];

            try {
                const consumerLister = jsm.consumers.list('JOBS');
                for await (const ci of consumerLister) {
                    consumers.push({
                        stream: 'JOBS',
                        name: ci.name,
                        pending: ci.num_pending,
                        waiting: ci.num_waiting,
                        ackPending: ci.num_ack_pending,
                        redelivered: ci.num_redelivered,
                        delivered: ci.delivered.stream_seq,
                    });
                }
            } catch {
                // No consumers yet
            }

            return reply.send({ connected: true, streams, consumers });
        } catch (err) {
            console.error('[Workers] Queue stats failed:', err);
            return reply.status(500).send({ error: 'Failed to fetch queue stats' });
        }
    });
}
