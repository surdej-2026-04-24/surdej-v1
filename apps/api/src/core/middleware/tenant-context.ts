/**
 * Tenant Context — Request-scoped tenant propagation
 *
 * Provides request-scoped tenant context to any code that runs within
 * a Fastify request, including Prisma queries.
 *
 * Uses a global mutable reference (set per-request by the Fastify hook)
 * that the Prisma extension reads. This works because Node.js is single-threaded
 * and each request is processed synchronously between await points.
 *
 * For true async safety, we also support AsyncLocalStorage as a fallback.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
    tenantId: string | null;
    userId: string | null;
    roleSlug: string | null;
    /** If true, this is a super-admin operating across tenants */
    isSuperAdmin: boolean;
}

// AsyncLocalStorage for nested async operations
const storage = new AsyncLocalStorage<TenantContext>();

// Current request context (set by Fastify preHandler, read by Prisma extension)
let _currentContext: TenantContext | undefined;

/** Set the current tenant context (called by Fastify hook) */
export function setTenantContext(ctx: TenantContext | undefined): void {
    _currentContext = ctx;
}

/** Get the current tenant context */
export function getTenantContext(): TenantContext | undefined {
    // Try AsyncLocalStorage first (for nested async), then fallback to global
    return storage.getStore() ?? _currentContext;
}

/** Run a function within a tenant context (AsyncLocalStorage) */
export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn);
}
