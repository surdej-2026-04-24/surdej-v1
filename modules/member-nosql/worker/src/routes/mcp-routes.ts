import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

// ─── MCP (Model Context Protocol) Routes ──────────────────────
// Exposes the NoSQL store as MCP tools for AI chat integration.
// Implements JSON-RPC 2.0 over HTTP per the MCP specification.

const MCP_SERVER_INFO = {
    name: 'nosql-store',
    version: '0.1.0',
};

const TOOLS = [
    {
        name: 'list_collections',
        description: 'List all NoSQL collections. Optionally filter by parentId to get sub-collections.',
        inputSchema: {
            type: 'object',
            properties: {
                tenantId: { type: 'string', description: 'Tenant identifier (default: "default")' },
                parentId: { type: 'string', description: 'Parent collection ID to list sub-collections of' },
            },
        },
    },
    {
        name: 'get_collection',
        description: 'Get details and metadata for a specific collection by its ID.',
        inputSchema: {
            type: 'object',
            properties: {
                collectionId: { type: 'string', description: 'Collection UUID' },
            },
            required: ['collectionId'],
        },
    },
    {
        name: 'query_documents',
        description: 'Query documents in a collection. Returns paginated results.',
        inputSchema: {
            type: 'object',
            properties: {
                collectionId: { type: 'string', description: 'Collection UUID to query' },
                tenantId: { type: 'string', description: 'Tenant identifier (default: "default")' },
                limit: { type: 'number', description: 'Max results (1-100, default 20)' },
                offset: { type: 'number', description: 'Pagination offset (default 0)' },
                includeDeleted: { type: 'boolean', description: 'Include soft-deleted documents' },
            },
            required: ['collectionId'],
        },
    },
    {
        name: 'get_document',
        description: 'Get a specific document by its ID, including its full BSON data.',
        inputSchema: {
            type: 'object',
            properties: {
                documentId: { type: 'string', description: 'Document UUID' },
            },
            required: ['documentId'],
        },
    },
    {
        name: 'create_document',
        description: 'Create a new document in a collection.',
        inputSchema: {
            type: 'object',
            properties: {
                collectionId: { type: 'string', description: 'Collection UUID' },
                tenantId: { type: 'string', description: 'Tenant identifier (default: "default")' },
                data: { type: 'object', description: 'Document data (any JSON object)' },
            },
            required: ['collectionId', 'data'],
        },
    },
    {
        name: 'update_document',
        description: 'Update an existing document. The previous version is automatically saved.',
        inputSchema: {
            type: 'object',
            properties: {
                documentId: { type: 'string', description: 'Document UUID' },
                data: { type: 'object', description: 'New document data (replaces existing)' },
            },
            required: ['documentId', 'data'],
        },
    },
    {
        name: 'get_document_versions',
        description: 'Get the version history of a document.',
        inputSchema: {
            type: 'object',
            properties: {
                documentId: { type: 'string', description: 'Document UUID' },
            },
            required: ['documentId'],
        },
    },
    {
        name: 'delete_document',
        description: 'Soft-delete a document (it can be restored later).',
        inputSchema: {
            type: 'object',
            properties: {
                documentId: { type: 'string', description: 'Document UUID' },
            },
            required: ['documentId'],
        },
    },
    {
        name: 'create_collection',
        description: 'Create a new collection or sub-collection.',
        inputSchema: {
            type: 'object',
            properties: {
                tenantId: { type: 'string', description: 'Tenant identifier (default: "default")' },
                name: { type: 'string', description: 'Human-readable name' },
                slug: { type: 'string', description: 'URL-friendly slug (lowercase, alphanumeric, dashes)' },
                description: { type: 'string', description: 'Optional description' },
                parentId: { type: 'string', description: 'Parent collection ID for sub-collections' },
            },
            required: ['name', 'slug'],
        },
    },
    {
        name: 'get_stats',
        description: 'Get document counts and statistics for all collections.',
        inputSchema: {
            type: 'object',
            properties: {
                tenantId: { type: 'string', description: 'Tenant identifier (default: "default")' },
            },
        },
    },
];

// ─── Tool handler ──────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const tenantId = (args.tenantId as string) ?? 'default';

    const text = (data: unknown) => ({
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    });

    switch (name) {
        case 'list_collections': {
            const parentId = (args.parentId as string) ?? null;
            const collections = await prisma.nosqlCollection.findMany({
                where: { tenantId, parentId, deletedAt: null },
                include: { _count: { select: { documents: true, children: true } } },
                orderBy: { name: 'asc' },
            });
            return text({ collections, total: collections.length });
        }

        case 'get_collection': {
            const col = await prisma.nosqlCollection.findUnique({
                where: { id: args.collectionId as string },
                include: {
                    parent: { select: { id: true, name: true, slug: true } },
                    _count: { select: { documents: true, children: true } },
                },
            });
            if (!col) return text({ error: 'Collection not found' });
            return text(col);
        }

        case 'query_documents': {
            const limit = Math.min((args.limit as number) ?? 20, 100);
            const offset = (args.offset as number) ?? 0;
            const includeDeleted = args.includeDeleted === true;
            const where = {
                collectionId: args.collectionId as string,
                tenantId,
                ...(includeDeleted ? {} : { deletedAt: null }),
            };
            const [items, total] = await Promise.all([
                prisma.nosqlDocument.findMany({ where, orderBy: { updatedAt: 'desc' }, take: limit, skip: offset }),
                prisma.nosqlDocument.count({ where }),
            ]);
            return text({ items, total, limit, offset });
        }

        case 'get_document': {
            const doc = await prisma.nosqlDocument.findUnique({
                where: { id: args.documentId as string },
                include: { collection: { select: { id: true, name: true, slug: true } } },
            });
            if (!doc) return text({ error: 'Document not found' });
            return text(doc);
        }

        case 'create_document': {
            const doc = await prisma.nosqlDocument.create({
                data: {
                    tenantId,
                    collectionId: args.collectionId as string,
                    data: args.data as any,
                    version: 1,
                    createdBy: 'mcp',
                    updatedBy: 'mcp',
                },
            });
            return text(doc);
        }

        case 'update_document': {
            const existing = await prisma.nosqlDocument.findUnique({ where: { id: args.documentId as string } });
            if (!existing) return text({ error: 'Document not found' });

            await prisma.nosqlDocumentVersion.create({
                data: {
                    documentId: existing.id,
                    version: existing.version,
                    data: existing.data as any,
                    createdBy: existing.updatedBy,
                },
            });

            const updated = await prisma.nosqlDocument.update({
                where: { id: args.documentId as string },
                data: { data: args.data as any, version: { increment: 1 }, updatedBy: 'mcp' },
            });
            return text(updated);
        }

        case 'get_document_versions': {
            const doc = await prisma.nosqlDocument.findUnique({
                where: { id: args.documentId as string },
                select: { id: true, version: true },
            });
            if (!doc) return text({ error: 'Document not found' });

            const versions = await prisma.nosqlDocumentVersion.findMany({
                where: { documentId: args.documentId as string },
                orderBy: { version: 'desc' },
            });
            return text({ documentId: doc.id, currentVersion: doc.version, versions });
        }

        case 'delete_document': {
            const doc = await prisma.nosqlDocument.findUnique({ where: { id: args.documentId as string } });
            if (!doc) return text({ error: 'Document not found' });
            await prisma.nosqlDocument.update({
                where: { id: args.documentId as string },
                data: { deletedAt: new Date(), updatedBy: 'mcp' },
            });
            return text({ success: true, documentId: args.documentId });
        }

        case 'create_collection': {
            const col = await prisma.nosqlCollection.create({
                data: {
                    tenantId,
                    name: args.name as string,
                    slug: args.slug as string,
                    description: (args.description as string) ?? undefined,
                    parentId: (args.parentId as string) ?? null,
                    createdBy: 'mcp',
                    updatedBy: 'mcp',
                },
            });
            return text(col);
        }

        case 'get_stats': {
            const collections = await prisma.nosqlCollection.findMany({
                where: { tenantId, deletedAt: null },
                select: { id: true, name: true, slug: true },
            });
            const stats = await Promise.all(
                collections.map(async (col) => {
                    const [active, deleted] = await Promise.all([
                        prisma.nosqlDocument.count({ where: { collectionId: col.id, deletedAt: null } }),
                        prisma.nosqlDocument.count({ where: { collectionId: col.id, deletedAt: { not: null } } }),
                    ]);
                    return { ...col, activeDocuments: active, deletedDocuments: deleted };
                })
            );
            return text({ tenantId, stats });
        }

        default:
            return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
    }
}

// ─── Route Registration ────────────────────────────────────────

export function registerMcpRoutes(app: FastifyInstance) {

    // POST /mcp — JSON-RPC 2.0 endpoint for MCP protocol
    app.post('/mcp', async (req, reply) => {
        const body = req.body as Record<string, unknown>;
        const id = body.id ?? null;
        const method = body.method as string;
        const params = (body.params as Record<string, unknown>) ?? {};

        reply.header('Content-Type', 'application/json');

        try {
            switch (method) {
                case 'initialize': {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: { tools: {} },
                            serverInfo: MCP_SERVER_INFO,
                        },
                    };
                }

                case 'tools/list': {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: { tools: TOOLS },
                    };
                }

                case 'tools/call': {
                    const toolName = params.name as string;
                    const toolArgs = (params.arguments as Record<string, unknown>) ?? {};
                    const result = await callTool(toolName, toolArgs);
                    return { jsonrpc: '2.0', id, result };
                }

                default:
                    return reply.status(400).send({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32601, message: `Method not found: ${method}` },
                    });
            }
        } catch (err) {
            app.log.error(err);
            return reply.status(500).send({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: 'Internal error', data: String(err) },
            });
        }
    });

    // GET /mcp/tools — convenience: list tools as plain JSON (non-RPC)
    app.get('/mcp/tools', async () => ({ tools: TOOLS, serverInfo: MCP_SERVER_INFO }));
}
