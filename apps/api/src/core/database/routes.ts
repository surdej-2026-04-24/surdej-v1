/**
 * Database introspection routes.
 *
 * Prefix: /api/database
 *
 * All endpoints accept an optional ?tenantId= query parameter.
 * When provided, tables that have a "tenantId" column will be
 * automatically filtered to show only that tenant's rows.
 *
 * ACL:
 *   - All endpoints require `database:read` permission.
 *   - Table visibility is further controlled by `TableAccessRule`.
 *
 * Endpoints:
 *   GET /schemas                          — list all non-system schemas
 *   GET /schemas/:schema/tables           — list tables in a schema with row counts & sizes
 *   GET /schemas/:schema/tables/:table    — column metadata + paginated rows
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requirePermission } from '../middleware/acl.js';
import { tableAccessCache } from '../middleware/cache.js';

// ── Helpers ──

/** Check whether a given table has a "tenantId" column. */
async function tableHasTenantId(schema: string, table: string): Promise<boolean> {
    const result = await prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) AS cnt
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name  = ${table}
          AND column_name = 'tenantId'
    `;
    return Number(result[0]?.cnt ?? 0) > 0;
}

/** Validate that a name is safe for use in dynamic SQL (prevents injection). */
function isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Resolve table access for a user's role in a tenant.
 *
 * Returns a map of tableName → { canRead, canWrite, canDelete }.
 * The wildcard entry ("*") serves as the fallback for unlisted tables.
 */
async function getTableAccess(
    tenantId: string,
    roleId: string,
): Promise<Map<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>> {
    const cacheKey = `table-access:${tenantId}:${roleId}`;
    return tableAccessCache.getOrSet(cacheKey, async () => {
        const rules = await prisma.tableAccessRule.findMany({
            where: { tenantId, roleId },
        });

        const accessMap = new Map<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>();
        for (const rule of rules) {
            accessMap.set(rule.tableName, {
                canRead: rule.canRead,
                canWrite: rule.canWrite,
                canDelete: rule.canDelete,
            });
        }
        return accessMap;
    });
}

/**
 * Resolve effective access for a specific table.
 *
 * 1. Exact table match
 * 2. Wildcard "*"
 * 3. Super-admin/admin (priority >= 80) → full access as default
 * 4. Default: no access
 */
function resolveAccess(
    accessMap: Map<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>,
    tableName: string,
    rolePriority: number,
): { canRead: boolean; canWrite: boolean; canDelete: boolean } {
    // Exact match
    const exact = accessMap.get(tableName);
    if (exact) return exact;

    // Wildcard
    const wildcard = accessMap.get('*');
    if (wildcard) return wildcard;

    // Admin/super-admin fallback
    if (rolePriority >= 80) {
        return { canRead: true, canWrite: true, canDelete: true };
    }

    // Default: no access
    return { canRead: false, canWrite: false, canDelete: false };
}

export async function databaseRoutes(app: FastifyInstance) {
    // ─── GET /schemas — list all non-system schemas ──────────────
    app.get(
        '/schemas',
        { preHandler: [requirePermission('database', 'read')] },
        async (_request, reply) => {
            const schemas = await prisma.$queryRaw<{ schema_name: string }[]>`
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                ORDER BY schema_name
            `;
            return reply.send(schemas.map((s) => s.schema_name));
        },
    );

    // ─── GET /schemas/:schema/tables — list tables ───────────────
    app.get<{
        Params: { schema: string };
        Querystring: { tenantId?: string };
    }>(
        '/schemas/:schema/tables',
        {
            preHandler: [requirePermission('database', 'read')],
        },
        async (
            request,
            reply,
        ) => {
            const { schema } = request.params;
            const { tenantId } = request.query;
            const acl = request.acl;

            if (!isValidIdentifier(schema)) {
                return reply.status(400).send({ error: 'Invalid schema name' });
            }

            // Get all tables with basic info
            const tables = await prisma.$queryRaw<
                {
                    table_name: string;
                    size_bytes: bigint;
                    size_pretty: string;
                }[]
            >`
                SELECT
                    t.table_name,
                    COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0) AS size_bytes,
                    pg_size_pretty(COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0)) AS size_pretty
                FROM information_schema.tables t
                WHERE t.table_schema = ${schema}
                  AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name
            `;

            // Resolve table access rules for this user's role
            const effectiveTenantId = tenantId ?? acl?.tenantId;
            let accessMap: Map<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }> | null = null;
            if (acl?.roleId && effectiveTenantId) {
                accessMap = await getTableAccess(effectiveTenantId, acl.roleId);
            }

            // For each table, compute tenant-scoped row count if applicable
            const result = await Promise.all(
                tables.map(async (t) => {
                    // Check table access
                    const access = accessMap
                        ? resolveAccess(accessMap, t.table_name, acl?.rolePriority ?? 0)
                        : { canRead: true, canWrite: true, canDelete: true };

                    // Skip tables the user can't read
                    if (!access.canRead) return null;

                    const hasTenant = await tableHasTenantId(schema, t.table_name);

                    let rowCount: number;
                    if (tenantId && hasTenant) {
                        // Exact count filtered by tenantId
                        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
                            `SELECT COUNT(*) AS count FROM "${schema}"."${t.table_name}" WHERE "tenantId" = $1`,
                            tenantId,
                        );
                        rowCount = Number(countResult[0]?.count ?? 0);
                    } else {
                        // Exact count (no filter)
                        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
                            `SELECT COUNT(*) AS count FROM "${schema}"."${t.table_name}"`,
                        );
                        rowCount = Number(countResult[0]?.count ?? 0);
                    }

                    return {
                        name: t.table_name,
                        estimatedRows: rowCount,
                        sizeBytes: Number(t.size_bytes),
                        sizePretty: t.size_pretty,
                        tenantScoped: hasTenant,
                        access,
                    };
                }),
            );

            // Filter out null entries (tables user can't read)
            return reply.send(result.filter(Boolean));
        },
    );

    // ─── GET /schemas/:schema/tables/:table — columns + rows ─────
    app.get<{
        Params: { schema: string; table: string };
        Querystring: { limit?: string; offset?: string; sort?: string; dir?: string; tenantId?: string };
    }>(
        '/schemas/:schema/tables/:table',
        {
            preHandler: [requirePermission('database', 'read')],
        },
        async (
            request,
            reply,
        ) => {
            const { schema, table } = request.params;
            const {
                limit: limitCheck,
                offset: offsetCheck,
                sort: sortCol,
                dir,
                tenantId,
            } = request.query;

            const limit = Math.min(parseInt(limitCheck ?? '50', 10), 500);
            const offset = parseInt(offsetCheck ?? '0', 10);
            const sortDir = dir === 'desc' ? 'DESC' : 'ASC';
            const acl = request.acl;

            if (!isValidIdentifier(schema) || !isValidIdentifier(table)) {
                return reply.status(400).send({ error: 'Invalid schema or table name' });
            }

            // Check table access
            const effectiveTenantId = tenantId ?? acl?.tenantId;
            let access = { canRead: true, canWrite: true, canDelete: true };
            if (acl?.roleId && effectiveTenantId) {
                const accessMap = await getTableAccess(effectiveTenantId, acl.roleId);
                access = resolveAccess(accessMap, table, acl?.rolePriority ?? 0);
            }

            if (!access.canRead) {
                return reply.status(403).send({
                    error: 'Forbidden',
                    message: `No read access to table: ${schema}.${table}`,
                });
            }

            // 1. Get columns
            const columns = await prisma.$queryRaw<
                {
                    column_name: string;
                    data_type: string;
                    udt_name: string;
                    is_nullable: string;
                    column_default: string | null;
                    ordinal_position: number;
                    character_maximum_length: number | null;
                }[]
            >`
                SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = ${schema} AND table_name = ${table}
                ORDER BY ordinal_position
            `;

            if (columns.length === 0) {
                return reply.status(404).send({ error: 'Table not found' });
            }

            // 2. Determine if tenant filtering applies
            const hasTenant = await tableHasTenantId(schema, table);
            const applyTenantFilter = !!(tenantId && hasTenant);

            // Build WHERE clause
            const whereClause = applyTenantFilter ? `WHERE "tenantId" = $1` : '';
            const queryParams = applyTenantFilter ? [tenantId] : [];

            // 3. Get total row count
            const countQuery = `SELECT COUNT(*) AS count FROM "${schema}"."${table}" ${whereClause}`;
            const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(countQuery, ...queryParams);
            const totalRows = Number(countResult[0]?.count ?? 0);

            // 4. Get primary key columns
            const pkResult = await prisma.$queryRaw<{ column_name: string }[]>`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = ${schema}
                  AND tc.table_name = ${table}
                ORDER BY kcu.ordinal_position
            `;
            const primaryKeys = pkResult.map((r) => r.column_name);

            // 5. Build and run row query
            const validColumns = columns.map((c) => c.column_name);
            let orderClause = '';
            if (sortCol && validColumns.includes(sortCol)) {
                orderClause = `ORDER BY "${sortCol}" ${sortDir}`;
            } else if (primaryKeys.length > 0) {
                orderClause = `ORDER BY "${primaryKeys[0]}" ASC`;
            }

            // Build parameterized query
            let rows: Record<string, unknown>[];
            try {
                if (applyTenantFilter) {
                    rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
                        `SELECT * FROM "${schema}"."${table}" WHERE "tenantId" = $1 ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
                        tenantId
                    );
                } else {
                    rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
                        `SELECT * FROM "${schema}"."${table}" ${orderClause} LIMIT ${limit} OFFSET ${offset}`
                    );
                }
            } catch (e) {
                console.error("Query failed", e);
                rows = [];
            }

            // Serialize bigint/date values to strings for JSON
            const serializedRows = rows.map((row) => {
                const out: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(row)) {
                    if (typeof value === 'bigint') {
                        out[key] = Number(value);
                    } else if (value instanceof Date) {
                        out[key] = value.toISOString();
                    } else {
                        out[key] = value;
                    }
                }
                return out;
            });

            return reply.send({
                schema,
                table,
                tenantScoped: hasTenant,
                tenantFiltered: applyTenantFilter,
                access,
                columns: columns.map((c) => ({
                    name: c.column_name,
                    type: c.udt_name,
                    dataType: c.data_type,
                    nullable: c.is_nullable === 'YES',
                    default: c.column_default,
                    maxLength: c.character_maximum_length,
                    isPrimaryKey: primaryKeys.includes(c.column_name),
                })),
                primaryKeys,
                totalRows,
                limit,
                offset,
                rows: serializedRows,
            });
        },
    );
}
