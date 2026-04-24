import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../node_modules/.prisma/mental-klarhed-client/index.js';
import { CreateProgrammeSchema } from '@surdej/module-mental-klarhed-shared';
import { sendMagicLink } from '../services/email.js';
import { generateMagicToken } from '../lib/livshjulet.js';

const prisma = new PrismaClient();
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL ?? 'http://localhost:5173';

export function registerAdminRoutes(app: FastifyInstance) {
    // GET /admin/programmes
    app.get('/admin/programmes', async (req, reply) => {
        const programmes = await prisma.programme.findMany({
            include: { client: true, sessions: true },
            orderBy: { createdAt: 'desc' },
        });
        return {
            items: programmes.map(p => ({
                id: p.id,
                clientId: p.clientId,
                clientName: p.client.name,
                clientEmail: p.client.email,
                status: p.status,
                startedAt: p.startedAt?.toISOString() ?? null,
                completedAt: p.completedAt?.toISOString() ?? null,
                sessions: p.sessions.map(s => ({
                    id: s.id,
                    sessionNumber: s.sessionNumber,
                    scheduledAt: s.scheduledAt?.toISOString() ?? null,
                    status: s.status,
                    hasAssessment: false,
                    hasMaterial: false,
                })),
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
            })),
            total: programmes.length,
        };
    });

    // GET /admin/programmes/:id
    app.get<{ Params: { id: string } }>('/admin/programmes/:id', async (req, reply) => {
        const p = await prisma.programme.findUnique({
            where: { id: req.params.id },
            include: {
                client: true,
                sessions: { include: { assessment: true, material: true } },
            },
        });
        if (!p) return reply.status(404).send({ error: 'Not found' });
        return {
            id: p.id,
            clientId: p.clientId,
            clientName: p.client.name,
            clientEmail: p.client.email,
            status: p.status,
            startedAt: p.startedAt?.toISOString() ?? null,
            completedAt: p.completedAt?.toISOString() ?? null,
            sessions: p.sessions.map(s => ({
                id: s.id,
                sessionNumber: s.sessionNumber,
                scheduledAt: s.scheduledAt?.toISOString() ?? null,
                status: s.status,
                hasAssessment: !!s.assessment,
                hasMaterial: !!s.material,
            })),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        };
    });

    // POST /admin/programmes — create programme + invite client
    app.post('/admin/programmes', async (req, reply) => {
        const result = CreateProgrammeSchema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });

        const { client: clientData } = result.data;

        // Upsert client (idempotent)
        const client = await prisma.client.upsert({
            where: { email: clientData.email },
            update: { name: clientData.name, locale: clientData.locale },
            create: { email: clientData.email, name: clientData.name, locale: clientData.locale },
        });

        // Create programme with 5 sessions
        const programme = await prisma.programme.create({
            data: {
                clientId: client.id,
                sessions: {
                    create: [1, 2, 3, 4, 5].map(n => ({
                        sessionNumber: n,
                        scheduledAt: result.data.scheduledDates?.[n - 1]
                            ? new Date(result.data.scheduledDates[n - 1])
                            : null,
                    })),
                },
            },
            include: { sessions: true },
        });

        // Send welcome magic-link (for initial Livshjulet assessment)
        const token = await generateMagicToken(prisma, client.id, 'portal', null, 7);
        await sendMagicLink({
            to: client.email,
            name: client.name,
            locale: client.locale as 'da' | 'en',
            purpose: 'portal',
            url: `${CLIENT_BASE_URL}/k/${token}`,
        });

        return reply.status(201).send({ programmeId: programme.id });
    });

    // POST /admin/programmes/:id/sessions/:sn/send-assessment
    app.post<{ Params: { id: string; sn: string } }>(
        '/admin/programmes/:id/sessions/:sn/send-assessment',
        async (req, reply) => {
            const session = await prisma.session.findFirst({
                where: {
                    programmeId: req.params.id,
                    sessionNumber: parseInt(req.params.sn, 10),
                },
                include: { programme: { include: { client: true } } },
            });
            if (!session) return reply.status(404).send({ error: 'Session not found' });

            const client = session.programme.client;
            const token = await generateMagicToken(prisma, client.id, 'assessment', session.id, 7);

            await prisma.session.update({
                where: { id: session.id },
                data: { status: 'ASSESSMENT_SENT' },
            });

            await sendMagicLink({
                to: client.email,
                name: client.name,
                locale: client.locale as 'da' | 'en',
                purpose: 'assessment',
                sessionNumber: session.sessionNumber,
                url: `${CLIENT_BASE_URL}/k/${token}`,
            });

            return { ok: true };
        }
    );

    // GET /admin/programmes/:id/sessions/:sn/material
    app.get<{ Params: { id: string; sn: string } }>(
        '/admin/programmes/:id/sessions/:sn/material',
        async (req, reply) => {
            const session = await prisma.session.findFirst({
                where: {
                    programmeId: req.params.id,
                    sessionNumber: parseInt(req.params.sn, 10),
                },
                include: { material: true },
            });
            if (!session?.material) return reply.status(404).send({ error: 'Material not found' });
            return {
                id: session.material.id,
                sessionId: session.material.sessionId,
                pdfContent: session.material.pdfContent,
                pdfUrl: session.material.pdfUrl,
                videoScript: session.material.videoScript,
                generatedAt: session.material.generatedAt.toISOString(),
                sentAt: session.material.sentAt?.toISOString() ?? null,
            };
        }
    );

    // POST /admin/programmes/:id/sessions/:sn/send-material
    app.post<{ Params: { id: string; sn: string } }>(
        '/admin/programmes/:id/sessions/:sn/send-material',
        async (req, reply) => {
            const session = await prisma.session.findFirst({
                where: {
                    programmeId: req.params.id,
                    sessionNumber: parseInt(req.params.sn, 10),
                },
                include: { material: true },
            });
            if (!session?.material) return reply.status(404).send({ error: 'Material not found' });

            await prisma.preSessionMaterial.update({
                where: { id: session.material.id },
                data: { sentAt: new Date() },
            });
            await prisma.session.update({
                where: { id: session.id },
                data: { status: 'MATERIAL_SENT' },
            });

            return { ok: true };
        }
    );

    // GET /admin/programmes/:id/assessments
    app.get<{ Params: { id: string } }>('/admin/programmes/:id/assessments', async (req, reply) => {
        const assessments = await prisma.assessment.findMany({
            where: { programmeId: req.params.id },
            orderBy: { createdAt: 'asc' },
        });
        return {
            items: assessments.map(a => ({
                id: a.id,
                programmeId: a.programmeId,
                sessionId: a.sessionId,
                isInitial: a.isInitial,
                isFinal: a.isFinal,
                scores: a.scores,
                notes: a.notes,
                completedAt: a.completedAt?.toISOString() ?? null,
                createdAt: a.createdAt.toISOString(),
            })),
        };
    });
}
