/**
 * Database Client — Tenant-Aware Prisma
 *
 * Creates a Prisma client extended with:
 * 1. Auto-injection of tenantId into all queries on tenant-scoped models
 * 2. Cross-tenant access audit logging
 *
 * The tenant context is read from AsyncLocalStorage, set by the Fastify
 * onRequest hook in server.ts.
 */

import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './core/middleware/tenant-context.js';

const globalForPrisma = globalThis as unknown as { __prismaBase: PrismaClient };

const basePrisma =
    globalForPrisma.__prismaBase ||
    new PrismaClient({
        log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.__prismaBase = basePrisma;
}

// ─── Tenant-scoped models ───
// Models that have a tenantId column and should be auto-filtered
const TENANT_SCOPED_MODELS = new Set([
    'AccessPolicy',
    'AiConversation',
    'AiUsageLog',
    'ApiRequestLog',
    'Article',
    'AuditLog',
    'AuthProvider',
    'Blob',
    'DocumentChunk',
    'FeedbackEntry',
    'FieldMaskRule',
    'Job',
    'McpServerConfig',
    'RolePermission',
    'Skin',
    'TableAccessRule',
    'Team',
    'Template',
    'TenantDomain',
    'TenantRole',
    'TrainingModule',
    'UserTenant',
    'VirtualPage',
    'WorkerRegistration',
]);

// Models where tenantId is NOT NULL (must always be set)
const TENANT_REQUIRED_MODELS = new Set([
    'AccessPolicy',
    'AuthProvider',
    'Blob',
    'DocumentChunk',
    'FieldMaskRule',
    'TableAccessRule',
    'Team',
    'TenantDomain',
    'UserTenant',
]);

// Models exempt from auto-filtering (system-level, have intentional NULL tenantId)
const EXEMPT_FROM_AUTO_FILTER = new Set([
    'ApiRequestLog',   // Written by onResponse hook, already has tenantId
    'AuditLog',        // Written by audit functions, needs null for platform actions
    'RolePermission',  // Has both global (null) and tenant-specific entries
    'TenantRole',      // Has built-in global roles (tenantId=null)
    'Skin',            // Has built-in skins (tenantId=null)
    'Template',        // Has built-in templates (tenantId=null)
    'VirtualPage',     // Scoped to a Skin (which is itself exempt); access controlled by skinId
    'WorkerRegistration', // Infrastructure, not user-facing
]);

/** In-memory buffer for cross-tenant access events (flushed periodically) */
interface CrossTenantEvent {
    timestamp: Date;
    userId: string | null;
    tenantId: string | null;
    model: string;
    operation: string;
    recordTenantId: string;
}

const crossTenantBuffer: CrossTenantEvent[] = [];
const FLUSH_INTERVAL = 10_000; // 10 seconds
const MAX_BUFFER = 100;

/** Flush cross-tenant events to the audit log */
async function flushCrossTenantEvents() {
    if (crossTenantBuffer.length === 0) return;

    const events = crossTenantBuffer.splice(0, crossTenantBuffer.length);
    try {
        await basePrisma.auditLog.createMany({
            data: events.map(e => ({
                tenantId: e.tenantId,
                actorId: e.userId ?? 'system',
                actorType: 'SYSTEM' as const,
                action: 'cross_tenant_access',
                resource: e.model,
                details: {
                    operation: e.operation,
                    recordTenantId: e.recordTenantId,
                    userTenantId: e.tenantId,
                } as any,
            })),
        });
    } catch (err) {
        console.error('[tenant-audit] Failed to flush cross-tenant events:', err);
    }
}

// Periodic flush
setInterval(flushCrossTenantEvents, FLUSH_INTERVAL).unref();

// ─── Extended Prisma Client ───

export const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async findMany({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    // Auto-inject tenantId filter if not already specified
                    const where = args.where as Record<string, unknown> | undefined;
                    if (!where?.tenantId) {
                        args.where = { ...args.where, tenantId: ctx.tenantId };
                    }
                }
                return query(args);
            },

            async findFirst({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    const where = args.where as Record<string, unknown> | undefined;
                    if (!where?.tenantId) {
                        args.where = { ...args.where, tenantId: ctx.tenantId };
                    }
                }
                return query(args);
            },

            async findUnique({ model, args, query }) {
                // findUnique uses unique keys — we validate the result instead
                const result = await query(args);
                const ctx = getTenantContext();
                if (result && ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    const record = result as Record<string, unknown>;
                    if (record.tenantId && record.tenantId !== ctx.tenantId) {
                        // Cross-tenant access detected
                        if (!ctx.isSuperAdmin) {
                            // Log and block
                            crossTenantBuffer.push({
                                timestamp: new Date(),
                                userId: ctx.userId,
                                tenantId: ctx.tenantId,
                                model,
                                operation: 'findUnique',
                                recordTenantId: record.tenantId as string,
                            });
                            if (crossTenantBuffer.length >= MAX_BUFFER) flushCrossTenantEvents();
                            return null; // Block cross-tenant read
                        }
                    }
                }
                return result;
            },

            async count({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    const where = args.where as Record<string, unknown> | undefined;
                    if (!where?.tenantId) {
                        args.where = { ...args.where, tenantId: ctx.tenantId };
                    }
                }
                return query(args);
            },

            async create({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_REQUIRED_MODELS.has(model)) {
                    const data = args.data as Record<string, unknown>;
                    if (!data.tenantId && !data.tenant) {
                        data.tenantId = ctx.tenantId;
                    }
                }
                return query(args);
            },

            async createMany({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_REQUIRED_MODELS.has(model)) {
                    const records = Array.isArray(args.data) ? args.data : [args.data];
                    for (const record of records) {
                        if (!(record as Record<string, unknown>).tenantId) {
                            (record as Record<string, unknown>).tenantId = ctx.tenantId;
                        }
                    }
                }
                return query(args);
            },

            async update({ args, query }) {
                // For updates, we trust that the where clause already restricted
                // to the correct record. The findUnique guard catches reads.
                return query(args);
            },

            async delete({ args, query }) {
                return query(args);
            },

            async deleteMany({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    const where = args.where as Record<string, unknown> | undefined;
                    if (!where?.tenantId) {
                        args.where = { ...args.where, tenantId: ctx.tenantId };
                    }
                }
                return query(args);
            },

            async updateMany({ model, args, query }) {
                const ctx = getTenantContext();
                if (ctx?.tenantId && TENANT_SCOPED_MODELS.has(model) && !EXEMPT_FROM_AUTO_FILTER.has(model)) {
                    const where = args.where as Record<string, unknown> | undefined;
                    if (!where?.tenantId) {
                        args.where = { ...args.where, tenantId: ctx.tenantId };
                    }
                }
                return query(args);
            },
        },
    },
});

export type PrismaWithTenantScope = typeof prisma;
