import type { FastifyInstance } from 'fastify';
import {
    CreateTicketSchema,
    UpdateTicketSchema,
    TransitionTicketSchema,
    CreateCommentSchema,
    VALID_TRANSITIONS,
    NATS_SUBJECTS,
    type Ticket,
    type TicketStatus,
} from '@surdej/module-member-feedback-shared';
import { prisma } from './db.js';

// ─── Helpers ──────────────────────────────────────────────────

async function nextTicketNumber(): Promise<string> {
    const result = await prisma.ticketCounter.upsert({
        where: { id: 'default' },
        create: { id: 'default', counter: 1 },
        update: { counter: { increment: 1 } },
    });
    return `FB-${String(result.counter).padStart(4, '0')}`;
}

function generateCustomerUrl(ticketId: string): string {
    // Simple token for customer tracking — in prod this would be a signed JWT
    const token = Buffer.from(ticketId).toString('base64url');
    return `/feedback-ticket/${token}`;
}

// ─── Routes ───────────────────────────────────────────────────

export function registerRoutes(app: FastifyInstance) {

    // GET /tickets — List all tickets (with filters)
    app.get('/tickets', async (req) => {
        const query = req.query as Record<string, string>;
        const where: Record<string, unknown> = {};
        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.category) where.category = query.category;
        if (query.assigneeId) where.assigneeId = query.assigneeId;
        if (query.reporterId) where.reporterId = query.reporterId;

        const items = await prisma.ticket.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                comments: { orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { comments: true, transitions: true } },
            },
        });

        return { items, total: items.length };
    });

    // GET /tickets/:id — Get ticket with all details
    app.get<{ Params: { id: string } }>('/tickets/:id', async (req, reply) => {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                comments: { orderBy: { createdAt: 'asc' } },
                transitions: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
        return ticket;
    });

    // POST /tickets — Create new ticket
    app.post('/tickets', async (req, reply) => {
        const result = CreateTicketSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { userId, userName, userEmail } = (req.query as any) ?? {};
        const ticketNumber = await nextTicketNumber();

        const ticket = await prisma.ticket.create({
            data: {
                ticketNumber,
                title: result.data.title,
                description: result.data.description,
                priority: result.data.priority ?? 'medium',
                category: result.data.category ?? 'general',
                feedbackSessionId: result.data.feedbackSessionId,
                tags: result.data.tags ?? [],
                reporterId: userId ?? 'system',
                reporterName: userName,
                reporterEmail: userEmail,
                customerUrl: '', // will be set after creation
            },
        });

        // Set customer URL
        const customerUrl = generateCustomerUrl(ticket.id);
        const updated = await prisma.ticket.update({
            where: { id: ticket.id },
            data: { customerUrl },
        });

        // Create initial transition
        await prisma.ticketTransition.create({
            data: {
                ticketId: ticket.id,
                fromStatus: 'new',
                toStatus: 'new',
                changedById: userId ?? 'system',
                changedByName: userName,
                reason: 'Ticket created',
            },
        });

        return reply.status(201).send(updated);
    });

    // PUT /tickets/:id — Update ticket fields
    app.put<{ Params: { id: string } }>('/tickets/:id', async (req, reply) => {
        const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

        const result = UpdateTicketSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const ticket = await prisma.ticket.update({
            where: { id: req.params.id },
            data: result.data,
        });
        return ticket;
    });

    // POST /tickets/:id/transition — Transition ticket status
    app.post<{ Params: { id: string } }>('/tickets/:id/transition', async (req, reply) => {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

        const result = TransitionTicketSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const currentStatus = ticket.status as TicketStatus;
        const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(result.data.toStatus)) {
            return reply.status(400).send({
                error: `Cannot transition from '${currentStatus}' to '${result.data.toStatus}'. Allowed: ${allowed.join(', ')}`,
            });
        }

        const { userId, userName } = (req.query as any) ?? {};

        // Record transition
        const transition = await prisma.ticketTransition.create({
            data: {
                ticketId: ticket.id,
                fromStatus: currentStatus,
                toStatus: result.data.toStatus,
                changedById: userId ?? 'system',
                changedByName: userName,
                reason: result.data.reason,
            },
        });

        // Update ticket status
        const data: Record<string, unknown> = { status: result.data.toStatus };
        if (result.data.toStatus === 'resolved') data.resolvedAt = new Date();
        if (result.data.toStatus === 'closed') data.closedAt = new Date();
        if (result.data.toStatus === 'reopened') {
            data.resolvedAt = null;
            data.closedAt = null;
        }

        const updated = await prisma.ticket.update({
            where: { id: ticket.id },
            data,
            include: { transitions: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });

        return updated;
    });

    // POST /tickets/:id/comments — Add comment
    app.post<{ Params: { id: string } }>('/tickets/:id/comments', async (req, reply) => {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

        const result = CreateCommentSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { userId, userName, userEmail } = (req.query as any) ?? {};

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: ticket.id,
                authorId: userId ?? 'system',
                authorName: userName,
                authorEmail: userEmail,
                content: result.data.content,
                isInternal: result.data.isInternal ?? false,
            },
        });

        return reply.status(201).send(comment);
    });

    // GET /tickets/:id/comments — List comments
    app.get<{ Params: { id: string } }>('/tickets/:id/comments', async (req) => {
        const comments = await prisma.ticketComment.findMany({
            where: { ticketId: req.params.id },
            orderBy: { createdAt: 'asc' },
        });
        return comments;
    });

    // GET /tickets/:id/transitions — List transitions (audit trail)
    app.get<{ Params: { id: string } }>('/tickets/:id/transitions', async (req) => {
        const transitions = await prisma.ticketTransition.findMany({
            where: { ticketId: req.params.id },
            orderBy: { createdAt: 'desc' },
        });
        return transitions;
    });

    // GET /tickets/:id/customer — Public customer view (no auth)
    app.get<{ Params: { id: string } }>('/tickets/:id/customer', async (req, reply) => {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            select: {
                ticketNumber: true,
                title: true,
                status: true,
                priority: true,
                category: true,
                createdAt: true,
                resolvedAt: true,
                comments: {
                    where: { isInternal: false },
                    orderBy: { createdAt: 'asc' },
                    select: { content: true, authorName: true, createdAt: true },
                },
            },
        });
        if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
        return ticket;
    });

    // GET /stats — Dashboard statistics
    app.get('/stats', async () => {
        const [total, byStatus, byPriority, byCategory] = await Promise.all([
            prisma.ticket.count(),
            prisma.ticket.groupBy({ by: ['status'], _count: true }),
            prisma.ticket.groupBy({ by: ['priority'], _count: true }),
            prisma.ticket.groupBy({ by: ['category'], _count: true }),
        ]);
        return { total, byStatus, byPriority, byCategory };
    });
}
