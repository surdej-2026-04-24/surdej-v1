/**
 * Record-Level Security (RLS) Middleware
 *
 * Provides:
 *   1. Team-based filtering — records with teamId are only visible to team members
 *   2. Policy-based filtering — AccessPolicy conditions converted to Prisma where clauses
 *   3. Field masking — response fields hidden/redacted per FieldMaskRule
 *
 * All lookups are cached via TtlCache to avoid redundant DB queries.
 *
 * Usage:
 *   const where = await applyRLS('articles', baseWhere, request.acl);
 *   const data = await prisma.article.findMany({ where });
 *   const masked = await maskFields(data, 'Article', request.acl);
 */

import { prisma } from '../../db.js';
import type { RequestContext } from './acl.js';
import { rlsCache } from './cache.js';
import { createHash } from 'crypto';
import type { AccessPolicy } from '@prisma/client';

// ─── Types ───

interface PolicyCondition {
    field?: string;
    op?: string;
    operator?: string;
    value?: unknown;
    and?: PolicyCondition[];
    or?: PolicyCondition[];
}

// ─── Team-Based RLS ───

/**
 * Get all team IDs the user belongs to within a tenant (cached).
 */
async function getUserTeamIds(userId: string, tenantId: string): Promise<string[]> {
    const cacheKey = `teams:${tenantId}:user:${userId}`;
    return rlsCache.getOrSet(cacheKey, async () => {
        const memberships = await prisma.teamMember.findMany({
            where: {
                userId,
                team: { tenantId },
            },
            select: { teamId: true },
        });
        return memberships.map((m: { teamId: string }) => m.teamId);
    });
}

/**
 * Build a team-based RLS filter.
 *
 * Logic:
 *   - If record has teamId = null → visible to all in tenant
 *   - If record has teamId set → only visible to team members (or admin/super-admin)
 */
function teamFilter(userTeamIds: string[], rolePriority: number): Record<string, unknown> {
    // Admins and super-admins bypass team filtering
    if (rolePriority >= 80) {
        return {};
    }

    return {
        OR: [
            { teamId: null },                      // No team restriction
            { teamId: { in: userTeamIds } },       // User's teams
        ],
    };
}

// ─── Policy Engine ───

/**
 * Get active policies for a resource (cached).
 */
async function getActivePolicies(
    tenantId: string,
    resource: string,
    roleId: string,
): Promise<AccessPolicy[]> {
    const cacheKey = `policies:${tenantId}:${resource}:${roleId}`;
    return rlsCache.getOrSet(cacheKey, async () => {
        return prisma.accessPolicy.findMany({
            where: {
                tenantId,
                resource,
                isActive: true,
                OR: [
                    { roleId: null },      // applies to all roles
                    { roleId },            // specific to user's role
                ],
            },
            orderBy: { priority: 'desc' },
        });
    });
}

/**
 * Convert a policy condition to a Prisma where clause.
 *
 * Supports:
 *   - Simple field conditions: { field, op, value }
 *   - Compound: { and: [...] }, { or: [...] }
 *   - Dynamic variables: $userId, $tenantId, $userTeamIds, $userRole, $now, $30daysAgo
 */
function conditionToPrismaWhere(
    condition: PolicyCondition,
    ctx: { userId: string; tenantId: string | null; userTeamIds: string[]; roleSlug: string },
): Record<string, unknown> {
    // Compound AND
    if (condition.and) {
        return {
            AND: condition.and.map(c => conditionToPrismaWhere(c, ctx)),
        };
    }

    // Compound OR
    if (condition.or) {
        return {
            OR: condition.or.map(c => conditionToPrismaWhere(c, ctx)),
        };
    }

    // Simple field condition
    const field = condition.field;
    const op = condition.op || condition.operator;
    let value = condition.value;

    if (!field || !op) return {};

    // Resolve dynamic variables
    value = resolveDynamicValue(value, ctx);

    switch (op) {
        case 'eq':
            return { [field]: value };
        case 'neq':
            return { [field]: { not: value } };
        case 'in':
            return { [field]: { in: value as unknown[] } };
        case 'contains':
            return { [field]: { contains: value as string, mode: 'insensitive' } };
        case 'gt':
            return { [field]: { gt: value } };
        case 'gte':
            return { [field]: { gte: value } };
        case 'lt':
            return { [field]: { lt: value } };
        case 'lte':
            return { [field]: { lte: value } };
        case 'isNull':
            return { [field]: null };
        case 'isNotNull':
            return { NOT: { [field]: null } };
        case 'userField':
            // Match against current user's property
            if (value === 'id') return { [field]: ctx.userId };
            if (value === 'tenantId') return { [field]: ctx.tenantId };
            return {};
        default:
            return {};
    }
}

/**
 * Resolve dynamic variable prefixed with $
 */
function resolveDynamicValue(
    value: unknown,
    ctx: { userId: string; tenantId: string | null; userTeamIds: string[]; roleSlug: string },
): unknown {
    if (typeof value !== 'string' || !value.startsWith('$')) return value;

    switch (value) {
        case '$userId':
            return ctx.userId;
        case '$tenantId':
            return ctx.tenantId;
        case '$userTeamIds':
            return ctx.userTeamIds;
        case '$userRole':
            return ctx.roleSlug;
        case '$now':
            return new Date();
        case '$30daysAgo':
            return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        case '$7daysAgo':
            return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        default:
            return value;
    }
}

// ─── Main RLS Function ───

/**
 * Apply Record-Level Security to a Prisma `where` clause.
 *
 * Combines:
 *   1. Tenant scoping (if model has tenantId)
 *   2. Team-based filtering (if model has teamId)
 *   3. AccessPolicy conditions (ALLOW/DENY)
 *
 * @param resource - model/resource name: "articles", "templates", etc.
 * @param baseWhere - existing where clause to extend
 * @param acl - request ACL context
 * @param options - scoping options
 * @returns augmented where clause
 */
export async function applyRLS(
    resource: string,
    baseWhere: Record<string, unknown>,
    acl: RequestContext | undefined,
    options: {
        hasTeamId?: boolean;    // Model supports team-based filtering
        hasTenantId?: boolean;  // Model supports tenant scoping
    } = {},
): Promise<Record<string, unknown>> {
    if (!acl) return baseWhere;

    const conditions: Record<string, unknown>[] = [baseWhere];

    // Super-admin bypasses all RLS
    if (acl.rolePriority >= 100) {
        // Still apply tenant scoping if specified via context
        if (options.hasTenantId && acl.tenantId) {
            conditions.push({ tenantId: acl.tenantId });
        }
        return { AND: conditions };
    }

    // 1. Tenant scoping
    if (options.hasTenantId && acl.tenantId) {
        conditions.push({ tenantId: acl.tenantId });
    }

    // 2. Team-based filtering
    if (options.hasTeamId && acl.tenantId) {
        const userTeamIds = await getUserTeamIds(acl.userId, acl.tenantId);
        const tf = teamFilter(userTeamIds, acl.rolePriority);
        if (Object.keys(tf).length > 0) {
            conditions.push(tf);
        }
    }

    // 3. Access policies
    if (acl.tenantId && acl.roleId) {
        const policies = await getActivePolicies(acl.tenantId, resource, acl.roleId);

        if (policies.length > 0) {
            const userTeamIds = options.hasTeamId && acl.tenantId
                ? await getUserTeamIds(acl.userId, acl.tenantId)
                : [];

            const policyCtx = {
                userId: acl.userId,
                tenantId: acl.tenantId,
                userTeamIds,
                roleSlug: acl.roleSlug,
            };

            const allowConditions = policies
                .filter((p: AccessPolicy) => p.effect === 'ALLOW')
                .map((p: AccessPolicy) => conditionToPrismaWhere(p.conditions as PolicyCondition, policyCtx));

            const denyConditions = policies
                .filter((p: AccessPolicy) => p.effect === 'DENY')
                .map((p: AccessPolicy) => conditionToPrismaWhere(p.conditions as PolicyCondition, policyCtx));

            if (allowConditions.length > 0) {
                conditions.push({ OR: allowConditions });
            }

            if (denyConditions.length > 0) {
                conditions.push({ NOT: { OR: denyConditions } });
            }
        }
    }

    return conditions.length === 1 ? conditions[0]! : { AND: conditions };
}

// ─── Field Masking ───

interface FieldMaskRuleEntry {
    fieldName: string;
    maskType: string;
}

/**
 * Get mask rules for a resource and role (cached).
 */
async function getMaskRules(
    tenantId: string,
    roleId: string,
    resource: string,
): Promise<FieldMaskRuleEntry[]> {
    const cacheKey = `masks:${tenantId}:${resource}:${roleId}`;
    return rlsCache.getOrSet(cacheKey, async () => {
        return prisma.fieldMaskRule.findMany({
            where: {
                tenantId,
                resource,
                OR: [
                    { roleId: null },
                    { roleId },
                ],
            },
            select: { fieldName: true, maskType: true },
        });
    });
}

/**
 * Apply field masking to response data.
 *
 * Fetches FieldMaskRule entries for the resource and role, then
 * transforms matching fields according to the mask type.
 *
 * @param data - single record or array of records
 * @param resource - model name: "User", "Article", etc.
 * @param acl - request ACL context
 * @returns masked data (same shape, fields transformed)
 */
export async function maskFields<T extends Record<string, unknown>>(
    data: T | T[],
    resource: string,
    acl: RequestContext | undefined,
): Promise<T | T[]> {
    if (!acl || acl.rolePriority >= 100) return data; // Super-admin sees everything

    if (!acl.tenantId || !acl.roleId) return data;

    const rules = await getMaskRules(acl.tenantId, acl.roleId, resource);

    if (rules.length === 0) return data;

    const applyMask = (record: T): T => {
        const out = { ...record };
        for (const rule of rules) {
            if (rule.fieldName in out) {
                switch (rule.maskType) {
                    case 'HIDE':
                        delete out[rule.fieldName];
                        break;
                    case 'REDACT':
                        (out as Record<string, unknown>)[rule.fieldName] = '••••••';
                        break;
                    case 'PARTIAL':
                        (out as Record<string, unknown>)[rule.fieldName] = partialMask(
                            String(out[rule.fieldName] ?? ''),
                        );
                        break;
                    case 'HASH':
                        (out as Record<string, unknown>)[rule.fieldName] = sha256(
                            String(out[rule.fieldName] ?? ''),
                        );
                        break;
                }
            }
        }
        return out;
    };

    if (Array.isArray(data)) {
        return data.map(applyMask);
    }
    return applyMask(data);
}

// ─── Masking Helpers ───

/**
 * Partially mask a string value.
 * Emails: "j***@example.com"
 * Other strings: first 2 chars + "***" + last 2 chars
 */
function partialMask(value: string): string {
    if (!value) return '***';

    // Email pattern
    const atIdx = value.indexOf('@');
    if (atIdx > 0) {
        const local = value.substring(0, atIdx);
        const domain = value.substring(atIdx);
        return local[0] + '***' + domain;
    }

    // Short strings
    if (value.length <= 4) return '***';

    // General string
    return value.slice(0, 2) + '***' + value.slice(-2);
}

/**
 * SHA-256 hash for HASH mask type.
 */
function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}
