import type { FastifyInstance } from 'fastify';
import {
    SendEmailSchema,
    SendSmsSchema,
    SendWebhookSchema,
    CreateWebhookEndpointSchema,
} from '@surdej/module-core-comms-shared';
import { prisma } from './db.js';
import { sendEmail } from './providers/email-sendgrid.js';
import { sendSms } from './providers/sms-smsgate.js';
import { sendWebhook } from './providers/webhook-outbound.js';

export function registerRoutes(app: FastifyInstance) {
    // ─── Send Email ────────────────────────────────────────────
    app.post('/send/email', async (req, reply) => {
        const result = SendEmailSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { to, subject, body, html, initiatorId, initiatorType, metadata } = result.data;
        const recipientStr = Array.isArray(to) ? to.join(', ') : to;

        // Log the communication
        const comm = await prisma.communication.create({
            data: {
                channel: 'email',
                direction: 'outbound',
                status: 'pending',
                initiatorId,
                initiatorType: initiatorType ?? 'user',
                recipient: recipientStr,
                sender: process.env.SENDGRID_FROM_EMAIL ?? '',
                subject,
                body,
                metadata: metadata ?? undefined,
            },
        });

        // Send via provider
        const emailResult = await sendEmail({ to, subject, body, html });

        // Update log with result
        await prisma.communication.update({
            where: { id: comm.id },
            data: {
                status: emailResult.success ? 'sent' : 'failed',
                providerMessageId: emailResult.messageId,
                providerResponse: emailResult.response ?? undefined,
                errorMessage: emailResult.error,
            },
        });

        if (!emailResult.success) {
            return reply.status(502).send({
                error: 'Failed to send email',
                detail: emailResult.error,
                communicationId: comm.id,
            });
        }

        return reply.status(201).send({
            communicationId: comm.id,
            messageId: emailResult.messageId,
            status: 'sent',
        });
    });

    // ─── Send SMS ──────────────────────────────────────────────
    app.post('/send/sms', async (req, reply) => {
        const result = SendSmsSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { to, message, initiatorId, initiatorType, metadata } = result.data;

        const comm = await prisma.communication.create({
            data: {
                channel: 'sms',
                direction: 'outbound',
                status: 'pending',
                initiatorId,
                initiatorType: initiatorType ?? 'user',
                recipient: to,
                body: message,
                metadata: metadata ?? undefined,
            },
        });

        const smsResult = await sendSms({ to, message });

        await prisma.communication.update({
            where: { id: comm.id },
            data: {
                status: smsResult.success ? 'sent' : 'failed',
                providerMessageId: smsResult.messageId,
                providerResponse: smsResult.response ?? undefined,
                errorMessage: smsResult.error,
            },
        });

        if (!smsResult.success) {
            return reply.status(502).send({
                error: 'Failed to send SMS',
                detail: smsResult.error,
                communicationId: comm.id,
            });
        }

        return reply.status(201).send({
            communicationId: comm.id,
            messageId: smsResult.messageId,
            status: 'sent',
        });
    });

    // ─── Send Outbound Webhook ─────────────────────────────────
    app.post('/send/webhook', async (req, reply) => {
        const result = SendWebhookSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { url, method, headers, payload, initiatorId, initiatorType, metadata } = result.data;

        const comm = await prisma.communication.create({
            data: {
                channel: 'webhook_outbound',
                direction: 'outbound',
                status: 'pending',
                initiatorId,
                initiatorType: initiatorType ?? 'system',
                recipient: url,
                body: JSON.stringify(payload),
                metadata: { ...metadata, method, headers } as Record<string, unknown>,
            },
        });

        const webhookResult = await sendWebhook({ url, method, headers, payload });

        await prisma.communication.update({
            where: { id: comm.id },
            data: {
                status: webhookResult.success ? 'sent' : 'failed',
                providerResponse: webhookResult.response ?? undefined,
                errorMessage: webhookResult.error,
            },
        });

        if (!webhookResult.success) {
            return reply.status(502).send({
                error: 'Failed to send webhook',
                detail: webhookResult.error,
                communicationId: comm.id,
            });
        }

        return reply.status(201).send({
            communicationId: comm.id,
            status: 'sent',
            statusCode: webhookResult.statusCode,
        });
    });

    // ─── List Communications (log) ─────────────────────────────
    app.get('/communications', async (req) => {
        const query = req.query as Record<string, string>;

        const where: Record<string, unknown> = {};
        if (query.channel) where.channel = query.channel;
        if (query.direction) where.direction = query.direction;
        if (query.status) where.status = query.status;
        if (query.initiatorId) where.initiatorId = query.initiatorId;

        const items = await prisma.communication.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(query.limit ?? '50', 10),
            skip: parseInt(query.offset ?? '0', 10),
        });

        const total = await prisma.communication.count({ where });

        return { items, total };
    });

    // ─── Get Single Communication ──────────────────────────────
    app.get<{ Params: { id: string } }>('/communications/:id', async (req, reply) => {
        const item = await prisma.communication.findUnique({
            where: { id: req.params.id },
        });
        if (!item) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // ─── Webhook Endpoints CRUD ────────────────────────────────
    app.get('/webhooks/endpoints', async () => {
        const items = await prisma.webhookEndpoint.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { items, total: items.length };
    });

    app.post('/webhooks/endpoints', async (req, reply) => {
        const result = CreateWebhookEndpointSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const endpoint = await prisma.webhookEndpoint.create({
            data: result.data,
        });
        return reply.status(201).send(endpoint);
    });

    app.get<{ Params: { id: string } }>('/webhooks/endpoints/:id', async (req, reply) => {
        const endpoint = await prisma.webhookEndpoint.findUnique({
            where: { id: req.params.id },
            include: { events: { orderBy: { receivedAt: 'desc' }, take: 20 } },
        });
        if (!endpoint) return reply.status(404).send({ error: 'Not found' });
        return endpoint;
    });

    app.delete<{ Params: { id: string } }>('/webhooks/endpoints/:id', async (req, reply) => {
        try {
            await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
            return { success: true };
        } catch {
            return reply.status(404).send({ error: 'Not found' });
        }
    });

    // ─── Webhook Events (received via NATS from webhook-receiver) ──
    app.get('/webhooks/events', async (req) => {
        const query = req.query as Record<string, string>;
        const where: Record<string, unknown> = {};
        if (query.endpointId) where.endpointId = query.endpointId;
        if (query.status) where.status = query.status;

        const items = await prisma.webhookEvent.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
            take: parseInt(query.limit ?? '50', 10),
            skip: parseInt(query.offset ?? '0', 10),
        });

        const total = await prisma.webhookEvent.count({ where });
        return { items, total };
    });
}
