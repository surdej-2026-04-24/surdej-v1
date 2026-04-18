import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../middleware/acl.js';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────

const ConsentLevel = z.enum(['READ', 'READ_WRITE']).default('READ');

const CreateTenantConsentSchema = z.object({
    domain: z.string().min(1).max(253),
    pattern: z.string().min(1).max(253),
    description: z.string().max(500).optional(),
    level: ConsentLevel,
});

const UpdateTenantConsentSchema = z.object({
    isEnabled: z.boolean().optional(),
    description: z.string().max(500).optional(),
    level: ConsentLevel.optional(),
});

const CreateUserConsentSchema = z.object({
    domain: z.string().min(1).max(253),
    pattern: z.string().min(1).max(253),
    level: ConsentLevel,
    status: z.enum(['ALLOWED', 'DENIED']).default('ALLOWED'),
});

const UpdateUserConsentSchema = z.object({
    status: z.enum(['ALLOWED', 'DENIED', 'REVOKED']),
    level: ConsentLevel.optional(),
});

// ─── Pattern matching ───────────────────────────────────────────

function matchesDomainPattern(hostname: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === hostname) return true;
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2);
        return hostname === suffix || hostname.endsWith(`.${suffix}`);
    }
    return false;
}

// ─── Routes ─────────────────────────────────────────────────────

export async function bridgeConsentRoutes(app: FastifyInstance) {

    // ═══════════════════════════════════════════════════════════
    // TENANT CONSENT (Admin-only)
    // ═══════════════════════════════════════════════════════════

    app.get('/tenant', {
        preHandler: [requirePermission('bridge-consent', 'read')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId ?? undefined;
        const consents = await prisma.bridgeConsentTenant.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send(consents);
    });

    app.post('/tenant', {
        preHandler: [requirePermission('bridge-consent', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const body = CreateTenantConsentSchema.parse(request.body);
        const consent = await prisma.bridgeConsentTenant.create({
            data: {
                tenantId,
                domain: body.domain.toLowerCase(),
                pattern: body.pattern.toLowerCase(),
                description: body.description,
                level: body.level,
                grantedBy: userId,
            },
        });
        return reply.status(201).send(consent);
    });

    app.patch<{ Params: { id: string } }>('/tenant/:id', {
        preHandler: [requirePermission('bridge-consent', 'write')],
    }, async (request, reply) => {
        const { id } = request.params;
        const tenantId = request.acl!.tenantId ?? undefined;
        const body = UpdateTenantConsentSchema.parse(request.body);
        const consent = await prisma.bridgeConsentTenant.updateMany({
            where: { id, tenantId },
            data: body,
        });
        if (consent.count === 0) return reply.status(404).send({ error: 'Consent not found' });
        const updated = await prisma.bridgeConsentTenant.findUnique({ where: { id } });
        return reply.send(updated);
    });

    app.delete<{ Params: { id: string } }>('/tenant/:id', {
        preHandler: [requirePermission('bridge-consent', 'write')],
    }, async (request, reply) => {
        const { id } = request.params;
        const tenantId = request.acl!.tenantId ?? undefined;
        const result = await prisma.bridgeConsentTenant.deleteMany({ where: { id, tenantId } });
        if (result.count === 0) return reply.status(404).send({ error: 'Consent not found' });
        return reply.status(204).send();
    });

    // ═══════════════════════════════════════════════════════════
    // USER CONSENT
    // ═══════════════════════════════════════════════════════════

    app.get('/user', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const userId = request.acl!.userId ?? undefined;
        const tenantId = request.acl!.tenantId ?? undefined;

        const tenantConsents = await prisma.bridgeConsentTenant.findMany({
            where: { tenantId, isEnabled: true },
            orderBy: { domain: 'asc' },
        });
        const userConsents = await prisma.bridgeConsentUser.findMany({
            where: { userId, tenantId },
            orderBy: { domain: 'asc' },
        });

        const merged = [
            ...tenantConsents.map(c => ({
                id: c.id,
                domain: c.domain,
                pattern: c.pattern,
                description: c.description,
                level: c.level,
                status: 'ALLOWED' as const,
                source: 'tenant' as const,
                createdAt: c.createdAt,
                userOverride: userConsents.find(uc => uc.domain === c.domain)?.status ?? null,
            })),
            ...userConsents
                .filter(uc => !tenantConsents.some(tc => tc.domain === uc.domain))
                .map(c => ({
                    id: c.id,
                    domain: c.domain,
                    pattern: c.pattern,
                    description: null,
                    level: c.level,
                    status: c.status,
                    source: 'user' as const,
                    createdAt: c.grantedAt,
                    userOverride: null,
                })),
        ];
        return reply.send(merged);
    });

    app.post('/user', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const userId = request.acl!.userId!;
        const tenantId = request.acl!.tenantId!;
        const body = CreateUserConsentSchema.parse(request.body);

        const consent = await prisma.bridgeConsentUser.upsert({
            where: {
                userId_tenantId_domain: {
                    userId, tenantId,
                    domain: body.domain.toLowerCase(),
                },
            },
            create: {
                userId, tenantId,
                domain: body.domain.toLowerCase(),
                pattern: body.pattern.toLowerCase(),
                level: body.level,
                status: body.status,
            },
            update: {
                pattern: body.pattern.toLowerCase(),
                level: body.level,
                status: body.status,
                revokedAt: body.status === 'DENIED' ? new Date() : null,
            },
        });
        return reply.status(201).send(consent);
    });

    app.patch<{ Params: { id: string } }>('/user/:id', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.acl!.userId ?? undefined;
        const body = UpdateUserConsentSchema.parse(request.body);

        const consent = await prisma.bridgeConsentUser.updateMany({
            where: { id, userId },
            data: {
                status: body.status,
                level: body.level,
                revokedAt: body.status === 'DENIED' || body.status === 'REVOKED' ? new Date() : null,
            },
        });
        if (consent.count === 0) return reply.status(404).send({ error: 'Consent not found' });
        const updated = await prisma.bridgeConsentUser.findUnique({ where: { id } });
        return reply.send(updated);
    });

    app.delete<{ Params: { id: string } }>('/user/:id', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.acl!.userId ?? undefined;
        const result = await prisma.bridgeConsentUser.deleteMany({ where: { id, userId } });
        if (result.count === 0) return reply.status(404).send({ error: 'Consent not found' });
        return reply.status(204).send();
    });

    // ═══════════════════════════════════════════════════════════
    // RUNTIME CHECK
    // ═══════════════════════════════════════════════════════════

    app.get<{ Querystring: { domain: string } }>('/check', {
        preHandler: [requireAuth],
    }, async (request, reply) => {
        const { domain } = request.query;
        if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });

        const hostname = domain.toLowerCase();
        const userId = request.acl!.userId ?? undefined;
        const tenantId = request.acl!.tenantId ?? undefined;

        // 1. Check user-level consent
        const userConsents = await prisma.bridgeConsentUser.findMany({
            where: { userId, tenantId },
        });
        for (const uc of userConsents) {
            if (matchesDomainPattern(hostname, uc.pattern)) {
                if (uc.status === 'DENIED' || uc.status === 'REVOKED') {
                    return reply.send({ consented: false, source: 'user', domain: uc.domain, pattern: uc.pattern, level: null, status: uc.status });
                }
                if (uc.status === 'ALLOWED') {
                    return reply.send({ consented: true, source: 'user', domain: uc.domain, pattern: uc.pattern, level: uc.level });
                }
            }
        }

        // 2. Check tenant-level consent
        const tenantConsents = await prisma.bridgeConsentTenant.findMany({
            where: { tenantId, isEnabled: true },
        });
        for (const tc of tenantConsents) {
            if (matchesDomainPattern(hostname, tc.pattern)) {
                return reply.send({ consented: true, source: 'tenant', domain: tc.domain, pattern: tc.pattern, level: tc.level });
            }
        }

        // 3. No consent
        return reply.send({ consented: false, source: 'none', domain: hostname, pattern: null, level: null });
    });
}
