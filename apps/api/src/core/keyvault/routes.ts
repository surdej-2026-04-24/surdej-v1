import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../middleware/acl.js';
import { encryptSecret, decryptSecret, maskSecret } from './crypto.js';
import { z } from 'zod';

// ─── Zod Schemas ────────────────────────────────────────────────

const CreateSecretSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/, 'Slug must be lowercase alphanumeric with dots, hyphens, underscores'),
    category: z.enum(['api-key', 'token', 'credential', 'certificate']).default('api-key'),
    value: z.string().min(1),
    description: z.string().max(1000).optional(),
    provider: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
});

const UpdateSecretSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
    provider: z.string().max(100).optional().nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
    value: z.string().min(1).optional(), // only set if rotating the secret
});

const CreateMappingSchema = z.object({
    endpoint: z.string().min(1).max(255),
    envVar: z.string().min(1).max(128).default('API_KEY'),
    secretId: z.string().min(1),
    priority: z.number().int().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
});

const UpdateMappingSchema = z.object({
    secretId: z.string().min(1).optional(),
    envVar: z.string().min(1).max(128).optional(),
    priority: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────

export async function keyvaultRoutes(app: FastifyInstance) {

    // ================================================================
    // SECRETS CRUD
    // ================================================================

    // ── GET /secrets — List all secrets (masked values) ─────────
    app.get('/secrets', {
        preHandler: [requireAuth, requirePermission('keyvault', 'read')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { category, provider } = request.query as { category?: string; provider?: string };

        const where: any = { tenantId };
        if (category) where.category = category;
        if (provider) where.provider = provider;

        const secrets = await prisma.secretVault.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                mappings: {
                    select: { id: true, endpoint: true, envVar: true, isActive: true },
                },
            },
        });

        // Never send encrypted values — return masked preview
        const result = secrets.map(s => {
            let maskedPreview: string;
            try {
                const plain = decryptSecret({
                    encryptedValue: s.encryptedValue,
                    iv: s.iv,
                    authTag: s.authTag,
                });
                maskedPreview = maskSecret(plain);
            } catch {
                maskedPreview = '••••••••';
            }

            return {
                id: s.id,
                name: s.name,
                slug: s.slug,
                category: s.category,
                maskedValue: maskedPreview,
                description: s.description,
                provider: s.provider,
                metadata: s.metadata,
                lastUsedAt: s.lastUsedAt,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                mappings: s.mappings,
            };
        });

        return reply.send({ secrets: result, total: result.length });
    });

    // ── POST /secrets — Create a new secret ─────────────────────
    app.post('/secrets', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const userId = request.acl!.userId!;
        const body = CreateSecretSchema.parse(request.body);

        const encrypted = encryptSecret(body.value);

        const secret = await prisma.secretVault.create({
            data: {
                tenantId,
                name: body.name,
                slug: body.slug,
                category: body.category,
                encryptedValue: encrypted.encryptedValue,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                description: body.description,
                provider: body.provider,
                metadata: body.metadata ?? undefined,
                createdBy: userId,
            },
        });

        return reply.status(201).send({
            id: secret.id,
            name: secret.name,
            slug: secret.slug,
            category: secret.category,
            maskedValue: maskSecret(body.value),
            description: secret.description,
            provider: secret.provider,
            createdAt: secret.createdAt,
        });
    });

    // ── GET /secrets/:id — Get a single secret (masked) ─────────
    app.get<{ Params: { id: string } }>('/secrets/:id', {
        preHandler: [requireAuth, requirePermission('keyvault', 'read')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { id } = request.params;

        const secret = await prisma.secretVault.findFirst({
            where: { id, tenantId },
            include: {
                mappings: {
                    include: { secret: { select: { name: true, slug: true } } },
                },
            },
        });

        if (!secret) return reply.status(404).send({ error: 'Secret not found' });

        let maskedPreview: string;
        try {
            maskedPreview = maskSecret(decryptSecret({
                encryptedValue: secret.encryptedValue,
                iv: secret.iv,
                authTag: secret.authTag,
            }));
        } catch {
            maskedPreview = '••••••••';
        }

        return reply.send({
            id: secret.id,
            name: secret.name,
            slug: secret.slug,
            category: secret.category,
            maskedValue: maskedPreview,
            description: secret.description,
            provider: secret.provider,
            metadata: secret.metadata,
            lastUsedAt: secret.lastUsedAt,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            mappings: secret.mappings,
        });
    });

    // ── PATCH /secrets/:id — Update (optionally rotate value) ───
    app.patch<{ Params: { id: string } }>('/secrets/:id', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { id } = request.params;
        const body = UpdateSecretSchema.parse(request.body);

        const existing = await prisma.secretVault.findFirst({ where: { id, tenantId } });
        if (!existing) return reply.status(404).send({ error: 'Secret not found' });

        const data: any = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.description !== undefined) data.description = body.description;
        if (body.provider !== undefined) data.provider = body.provider;
        if (body.metadata !== undefined) data.metadata = body.metadata;

        // Rotate the secret value
        if (body.value) {
            const encrypted = encryptSecret(body.value);
            data.encryptedValue = encrypted.encryptedValue;
            data.iv = encrypted.iv;
            data.authTag = encrypted.authTag;
        }

        const updated = await prisma.secretVault.update({
            where: { id },
            data,
        });

        return reply.send({
            id: updated.id,
            name: updated.name,
            slug: updated.slug,
            updatedAt: updated.updatedAt,
        });
    });

    // ── DELETE /secrets/:id — Delete a secret ───────────────────
    app.delete<{ Params: { id: string } }>('/secrets/:id', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { id } = request.params;

        const existing = await prisma.secretVault.findFirst({ where: { id, tenantId } });
        if (!existing) return reply.status(404).send({ error: 'Secret not found' });

        // Cascade deletes mappings
        await prisma.secretVault.delete({ where: { id } });
        return reply.status(204).send();
    });

    // ================================================================
    // ENDPOINT MAPPINGS
    // ================================================================

    // ── GET /mappings — List all endpoint-to-secret mappings ────
    app.get('/mappings', {
        preHandler: [requireAuth, requirePermission('keyvault', 'read')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { endpoint } = request.query as { endpoint?: string };

        const where: any = { tenantId };
        if (endpoint) where.endpoint = endpoint;

        const mappings = await prisma.endpointKeyMapping.findMany({
            where,
            orderBy: [{ endpoint: 'asc' }, { priority: 'desc' }],
            include: {
                secret: {
                    select: { id: true, name: true, slug: true, category: true, provider: true },
                },
            },
        });

        return reply.send({ mappings, total: mappings.length });
    });

    // ── POST /mappings — Create a new endpoint mapping ──────────
    app.post('/mappings', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const body = CreateMappingSchema.parse(request.body);

        // Verify the secret exists and belongs to this tenant
        const secret = await prisma.secretVault.findFirst({
            where: { id: body.secretId, tenantId },
        });
        if (!secret) return reply.status(404).send({ error: 'Secret not found' });

        const mapping = await prisma.endpointKeyMapping.create({
            data: {
                tenantId,
                endpoint: body.endpoint,
                envVar: body.envVar,
                secretId: body.secretId,
                priority: body.priority,
                isActive: body.isActive,
            },
            include: {
                secret: {
                    select: { id: true, name: true, slug: true, provider: true },
                },
            },
        });

        return reply.status(201).send(mapping);
    });

    // ── PATCH /mappings/:id — Update a mapping ──────────────────
    app.patch<{ Params: { id: string } }>('/mappings/:id', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { id } = request.params;
        const body = UpdateMappingSchema.parse(request.body);

        const existing = await prisma.endpointKeyMapping.findFirst({ where: { id, tenantId } });
        if (!existing) return reply.status(404).send({ error: 'Mapping not found' });

        if (body.secretId) {
            const secret = await prisma.secretVault.findFirst({
                where: { id: body.secretId, tenantId },
            });
            if (!secret) return reply.status(404).send({ error: 'Secret not found' });
        }

        const updated = await prisma.endpointKeyMapping.update({
            where: { id },
            data: body,
            include: {
                secret: {
                    select: { id: true, name: true, slug: true, provider: true },
                },
            },
        });

        return reply.send(updated);
    });

    // ── DELETE /mappings/:id — Remove a mapping ─────────────────
    app.delete<{ Params: { id: string } }>('/mappings/:id', {
        preHandler: [requireAuth, requirePermission('keyvault', 'write')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;
        const { id } = request.params;

        const existing = await prisma.endpointKeyMapping.findFirst({ where: { id, tenantId } });
        if (!existing) return reply.status(404).send({ error: 'Mapping not found' });

        await prisma.endpointKeyMapping.delete({ where: { id } });
        return reply.status(204).send();
    });

    // ================================================================
    // KEY RESOLUTION (internal use — resolves API key for a module)
    // ================================================================

    // ── GET /resolve/:endpoint — Resolve the active API key for an endpoint
    // This is used internally by the API gateway and MCP tools proxy.
    // Returns the decrypted value. Only accessible to authenticated admins.
    app.get<{ Params: { endpoint: string }; Querystring: { envVar?: string } }>(
        '/resolve/:endpoint',
        {
            preHandler: [requireAuth, requirePermission('keyvault', 'manage')],
        },
        async (request, reply) => {
            const tenantId = request.acl!.tenantId!;
            const { endpoint } = request.params;
            const envVar = (request.query as any).envVar ?? 'API_KEY';

            const mapping = await prisma.endpointKeyMapping.findFirst({
                where: {
                    tenantId,
                    endpoint,
                    envVar,
                    isActive: true,
                },
                orderBy: { priority: 'desc' },
                include: { secret: true },
            });

            if (!mapping) {
                return reply.status(404).send({ error: `No active key mapping for endpoint "${endpoint}" / envVar "${envVar}"` });
            }

            try {
                const value = decryptSecret({
                    encryptedValue: mapping.secret.encryptedValue,
                    iv: mapping.secret.iv,
                    authTag: mapping.secret.authTag,
                });

                // Update lastUsedAt
                await prisma.secretVault.update({
                    where: { id: mapping.secret.id },
                    data: { lastUsedAt: new Date() },
                });

                return reply.send({
                    endpoint,
                    envVar,
                    value,
                    secretSlug: mapping.secret.slug,
                    provider: mapping.secret.provider,
                });
            } catch (e) {
                request.log.error(e, 'Failed to decrypt secret');
                return reply.status(500).send({ error: 'Failed to decrypt secret' });
            }
        },
    );

    // ── GET /endpoints — List distinct endpoints that have mappings
    app.get('/endpoints', {
        preHandler: [requireAuth, requirePermission('keyvault', 'read')],
    }, async (request, reply) => {
        const tenantId = request.acl!.tenantId!;

        const mappings = await prisma.endpointKeyMapping.findMany({
            where: { tenantId },
            select: { endpoint: true, envVar: true, isActive: true },
            distinct: ['endpoint'],
            orderBy: { endpoint: 'asc' },
        });

        return reply.send({ endpoints: mappings });
    });
}
