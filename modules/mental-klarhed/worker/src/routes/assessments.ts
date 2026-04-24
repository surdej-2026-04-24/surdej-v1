import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '../../node_modules/.prisma/mental-klarhed-client/index.js';
import { SubmitAssessmentSchema } from '@surdej/module-mental-klarhed-shared';
import { generateMaterial } from '../services/ai-generator.js';
import { renderPdf } from '../services/pdf-renderer.js';

const prisma = new PrismaClient();

// Retrieve the authenticated client ID from the JWT cookie
function getClientId(req: FastifyRequest): string {
    const payload = req.user as { clientId: string } | undefined;
    if (!payload?.clientId) throw { statusCode: 401, message: 'Unauthorized' };
    return payload.clientId;
}

export function registerAssessmentRoutes(app: FastifyInstance) {
    // GET /client/me
    app.get('/client/me', async (req, reply) => {
        const clientId = (() => {
            try {
                return getClientId(req);
            } catch {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
        })();
        if (!clientId) return;

        const programme = await prisma.programme.findFirst({
            where: { clientId: clientId as string, status: { not: 'CANCELLED' } },
            include: {
                client: true,
                sessions: {
                    include: { assessment: true, material: true },
                    orderBy: { sessionNumber: 'asc' },
                },
            },
        });

        if (!programme) return reply.status(404).send({ error: 'No active programme' });

        const pendingSession = programme.sessions.find(
            s => s.status === 'ASSESSMENT_SENT' && !s.assessment
        );

        return {
            clientId: programme.clientId,
            clientName: programme.client.name,
            locale: programme.client.locale,
            programme: {
                id: programme.id,
                status: programme.status,
                currentSessionNumber: pendingSession?.sessionNumber ?? 0,
                sessions: programme.sessions.map(s => ({
                    id: s.id,
                    sessionNumber: s.sessionNumber,
                    scheduledAt: s.scheduledAt?.toISOString() ?? null,
                    status: s.status,
                    hasAssessment: !!s.assessment,
                    hasMaterial: !!s.material,
                })),
            },
            pendingAssessment: pendingSession
                ? {
                    sessionId: pendingSession.id,
                    sessionNumber: pendingSession.sessionNumber,
                    isFinal: pendingSession.sessionNumber === 5,
                }
                : null,
        };
    });

    // POST /client/assessments — submit Livshjulet
    app.post<{ Body: { sessionId: string } & unknown }>(
        '/client/assessments',
        async (req, reply) => {
            let clientId: string;
            try {
                clientId = getClientId(req);
            } catch {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const bodyResult = SubmitAssessmentSchema.safeParse(req.body);
            if (!bodyResult.success) {
                return reply.status(400).send({ error: bodyResult.error.issues });
            }

            const body = req.body as { sessionId?: string };
            const { scores, notes, consentGiven } = bodyResult.data;

            // Ensure client has consented (GDPR)
            if (consentGiven) {
                await prisma.client.update({
                    where: { id: clientId },
                    data: { consentAt: new Date() },
                });
            }

            const session = body.sessionId
                ? await prisma.session.findFirst({
                    where: { id: body.sessionId, programme: { clientId } },
                    include: { programme: { include: { client: true } } },
                })
                : null;

            const programme = await prisma.programme.findFirst({
                where: { clientId, status: { not: 'CANCELLED' } },
                include: { client: true },
            });

            if (!programme) return reply.status(404).send({ error: 'No active programme' });

            const isFinal = session?.sessionNumber === 5;
            const isInitial = !session;

            // Check for existing initial assessment
            if (isInitial) {
                const existing = await prisma.assessment.findFirst({
                    where: { programmeId: programme.id, isInitial: true },
                });
                if (existing) return reply.status(409).send({ error: 'Initial assessment already submitted' });
            }

            const assessment = await prisma.assessment.create({
                data: {
                    programmeId: programme.id,
                    sessionId: session?.id ?? null,
                    isInitial,
                    isFinal,
                    scores,
                    notes,
                    completedAt: new Date(),
                },
            });

            if (session) {
                await prisma.session.update({
                    where: { id: session.id },
                    data: { status: 'ASSESSMENT_DONE' },
                });

                // Trigger AI material generation asynchronously
                setImmediate(async () => {
                    try {
                        const { pdfContent, videoScript } = await generateMaterial({
                            client: programme.client,
                            session,
                            scores,
                            notes,
                            programmeId: programme.id,
                        });

                        const pdfUrl = await renderPdf(pdfContent, session.id);

                        await prisma.preSessionMaterial.create({
                            data: {
                                sessionId: session.id,
                                pdfContent,
                                pdfUrl,
                                videoScript,
                            },
                        });

                        await prisma.session.update({
                            where: { id: session.id },
                            data: { status: 'MATERIAL_GENERATED' },
                        });
                    } catch (err) {
                        console.error('AI generation failed for session', session.id, err);
                    }
                });
            }

            return reply.status(201).send({ assessmentId: assessment.id });
        }
    );

    // GET /client/evaluation — final before/after comparison
    app.get('/client/evaluation', async (req, reply) => {
        let clientId: string;
        try {
            clientId = getClientId(req);
        } catch {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const programme = await prisma.programme.findFirst({
            where: { clientId },
            include: { assessments: true },
        });

        if (!programme) return reply.status(404).send({ error: 'No programme found' });

        const initial = programme.assessments.find(a => a.isInitial);
        const final = programme.assessments.find(a => a.isFinal);

        if (!initial || !final) {
            return reply.status(404).send({ error: 'Evaluation not available yet' });
        }

        const iScores = initial.scores as Record<string, number>;
        const fScores = final.scores as Record<string, number>;
        const deltas = Object.fromEntries(
            Object.keys(iScores).map(k => [k, (fScores[k] ?? 0) - (iScores[k] ?? 0)])
        );
        const biggestGains = Object.entries(deltas)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k);

        return {
            initial: { ...initial, createdAt: initial.createdAt.toISOString() },
            final: { ...final, createdAt: final.createdAt.toISOString() },
            deltas,
            biggestGains,
        };
    });

    // DELETE /client/me — GDPR: soft-delete
    app.delete('/client/me', async (req, reply) => {
        let clientId: string;
        try {
            clientId = getClientId(req);
        } catch {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        await prisma.client.update({
            where: { id: clientId },
            data: { deletedAt: new Date() },
        });

        // Clear session cookie
        reply.clearCookie('mk_session');
        return { ok: true };
    });

    // GET /client/me/export — GDPR: data export
    app.get('/client/me/export', async (req, reply) => {
        let clientId: string;
        try {
            clientId = getClientId(req);
        } catch {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                programmes: {
                    include: {
                        sessions: { include: { assessment: true, material: { select: { pdfUrl: true, generatedAt: true, sentAt: true } } } },
                        assessments: true,
                    },
                },
            },
        });

        if (!client) return reply.status(404).send({ error: 'Not found' });

        reply.header('Content-Disposition', 'attachment; filename="mine-data.json"');
        return {
            exportedAt: new Date().toISOString(),
            client: {
                id: client.id,
                name: client.name,
                email: client.email,
                locale: client.locale,
                consentAt: client.consentAt?.toISOString(),
                createdAt: client.createdAt.toISOString(),
            },
            programmes: client.programmes,
        };
    });
}
