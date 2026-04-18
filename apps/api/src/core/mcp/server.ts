/**
 * MCP Server (Phase 5.14–5.15)
 *
 * Model Context Protocol server exposing Surdej tools and resources.
 * Registered as a Fastify plugin at /api/mcp.
 *
 * Tools:
 *   - surdej.search           — search articles
 *   - surdej.knowledge.create — create article
 *   - surdej.worker.status    — worker health
 *   - surdej.command.list     — list commands
 *   - surdej.feature.check    — check feature flag status
 *
 * Resources:
 *   - surdej://config         — platform configuration
 *   - surdej://workers        — worker status
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── MCP Protocol Types ────────────────────────────────────

interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, { type: string; description: string }>;
        required?: string[];
    };
}

interface McpToolCallResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

// ─── Tool Definitions ──────────────────────────────────────

const TOOLS: McpTool[] = [
    {
        name: 'surdej.search',
        description: 'Search knowledge articles by title or content.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                status: { type: 'string', description: 'Filter by status: draft, review, approved, published, archived' },
                limit: { type: 'string', description: 'Max results (default 10)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'surdej.knowledge.create',
        description: 'Create a new knowledge article.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Article title' },
                content: { type: 'string', description: 'Article content in Markdown' },
                tags: { type: 'string', description: 'Comma-separated tags' },
            },
            required: ['title', 'content'],
        },
    },
    {
        name: 'surdej.worker.status',
        description: 'Get worker health status summary.',
        inputSchema: { type: 'object', properties: {}, },
    },
    {
        name: 'surdej.feature.check',
        description: 'Check if a feature flag is enabled.',
        inputSchema: {
            type: 'object',
            properties: {
                featureId: { type: 'string', description: 'Feature flag ID to check' },
            },
            required: ['featureId'],
        },
    },
];

// ─── Resource Definitions ──────────────────────────────────

const RESOURCES: McpResource[] = [
    {
        uri: 'surdej://config',
        name: 'Platform Configuration',
        description: 'Current Surdej platform configuration and status.',
        mimeType: 'application/json',
    },
    {
        uri: 'surdej://workers',
        name: 'Worker Status',
        description: 'All registered workers and their health.',
        mimeType: 'application/json',
    },
];

// ─── Tool Execution ────────────────────────────────────────

async function executeTool(name: string, args: Record<string, string>): Promise<McpToolCallResult> {
    try {
        switch (name) {
            case 'surdej.search': {
                const limit = parseInt(args['limit'] ?? '10', 10);
                const where: Record<string, unknown> = {
                    OR: [
                        { title: { contains: args['query'], mode: 'insensitive' } },
                        { content: { contains: args['query'], mode: 'insensitive' } },
                    ],
                };
                if (args['status']) where['status'] = args['status'];

                const articles = await prisma.article.findMany({
                    where,
                    select: { id: true, title: true, slug: true, status: true, tags: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                });

                return {
                    content: [{
                        type: 'text',
                        text: articles.length > 0
                            ? articles.map((a: { title: string; status: string; slug: string; tags: string[]; updatedAt: Date }) => `- **${a.title}** [${a.status}] (${a.slug})\n  Tags: ${a.tags.join(', ') || 'none'}\n  Updated: ${a.updatedAt.toISOString()}`).join('\n\n')
                            : 'No articles found matching the query.',
                    }],
                };
            }

            case 'surdej.knowledge.create': {
                const slug = args['title']!.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80);
                // Get first user as default author for MCP-created articles
                const defaultUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
                if (!defaultUser) {
                    return { content: [{ type: 'text', text: 'Error: No users found in system.' }], isError: true };
                }

                const article = await prisma.article.create({
                    data: {
                        title: args['title']!,
                        slug: `${slug}-${Date.now().toString(36)}`,
                        content: args['content'] ?? '',
                        authorId: defaultUser.id,
                        tags: args['tags'] ? args['tags'].split(',').map(t => t.trim()) : [],
                        status: 'draft',
                    },
                });

                return {
                    content: [{ type: 'text', text: `Created article "${article.title}" (ID: ${article.id}, slug: ${article.slug})` }],
                };
            }

            case 'surdej.worker.status': {
                const workers = await prisma.workerRegistration.findMany({
                    select: { instanceId: true, type: true, status: true, lastHeartbeat: true },
                    orderBy: { registeredAt: 'desc' },
                });

                const summary = {
                    total: workers.length,
                    online: workers.filter(w => w.status === 'online').length,
                    offline: workers.filter(w => w.status === 'offline').length,
                };

                return {
                    content: [{
                        type: 'text',
                        text: `Workers: ${summary.total} total, ${summary.online} online, ${summary.offline} offline\n\n` +
                            workers.map(w => `- ${w.instanceId} (${w.type}) — ${w.status}`).join('\n'),
                    }],
                };
            }

            case 'surdej.feature.check': {
                const feature = await prisma.featureFlag.findUnique({ where: { featureId: args['featureId'] } });
                if (!feature) {
                    return { content: [{ type: 'text', text: `Feature "${args['featureId']}" not found.` }] };
                }
                return {
                    content: [{
                        type: 'text',
                        text: `Feature: ${feature.title}\nID: ${feature.featureId}\nEnabled by default: ${feature.enabledByDefault}\nRing: ${feature.ring}\nCategory: ${feature.category}`,
                    }],
                };
            }

            default:
                return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }
    } catch (err) {
        return {
            content: [{ type: 'text', text: `Tool error: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
        };
    }
}

// ─── Resource Reading ──────────────────────────────────────

async function readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
    switch (uri) {
        case 'surdej://config': {
            const config = {
                version: process.env['npm_package_version'] ?? '0.1.0',
                environment: process.env['NODE_ENV'] ?? 'development',
                uptime: process.uptime(),
                features: await prisma.featureFlag.count(),
                articles: await prisma.article.count(),
                workers: await prisma.workerRegistration.count(),
            };
            return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(config, null, 2) }] };
        }

        case 'surdej://workers': {
            const workers = await prisma.workerRegistration.findMany({
                select: { instanceId: true, type: true, version: true, status: true, hostname: true, lastHeartbeat: true },
                orderBy: { registeredAt: 'desc' },
            });
            return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(workers, null, 2) }] };
        }

        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
}

// ─── Fastify Plugin ────────────────────────────────────────

export async function mcpRoutes(app: FastifyInstance) {

    /**
     * GET /api/mcp — MCP server info
     */
    app.get('/', async (_req, reply) => {
        return reply.send({
            name: 'surdej-mcp',
            version: '1.0.0',
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false },
            },
        });
    });

    /**
     * GET /api/mcp/tools — list available tools
     */
    app.get('/tools', async (_req, reply) => {
        return reply.send({ tools: TOOLS });
    });

    /**
     * POST /api/mcp/tools/call — invoke a tool
     */
    app.post('/tools/call', async (req, reply) => {
        const { name, arguments: args } = req.body as { name: string; arguments?: Record<string, string> };
        if (!name) return reply.status(400).send({ error: 'Tool name is required' });

        const tool = TOOLS.find(t => t.name === name);
        if (!tool) return reply.status(404).send({ error: `Tool "${name}" not found` });

        // Log invocation
        const start = Date.now();
        const result = await executeTool(name, args ?? {});
        const durationMs = Date.now() - start;

        // Persist invocation log (best-effort)
        try {
            const mcpServer = await prisma.mcpServerConfig.findFirst({
                where: { name: 'surdej-internal' },
            });
            if (mcpServer) {
                await prisma.mcpToolInvocation.create({
                    data: {
                        serverId: mcpServer.id,
                        toolName: name,
                        input: args ?? {},
                        output: result as any,
                        durationMs,
                        status: result.isError ? 'error' : 'success',
                    },
                });
            }
        } catch {
            // Logging failure is non-critical
        }

        return reply.send(result);
    });

    /**
     * GET /api/mcp/resources — list available resources
     */
    app.get('/resources', async (_req, reply) => {
        return reply.send({ resources: RESOURCES });
    });

    /**
     * POST /api/mcp/resources/read — read a resource
     */
    app.post('/resources/read', async (req, reply) => {
        const { uri } = req.body as { uri: string };
        if (!uri) return reply.status(400).send({ error: 'Resource URI is required' });

        try {
            const result = await readResource(uri);
            return reply.send(result);
        } catch (err) {
            return reply.status(404).send({ error: err instanceof Error ? err.message : String(err) });
        }
    });

    /**
     * GET /api/mcp/servers — list configured MCP servers
     */
    app.get('/servers', async (_req, reply) => {
        const servers = await prisma.mcpServerConfig.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { invocations: true } } },
        });
        return reply.send(servers);
    });

    /**
     * POST /api/mcp/servers — add MCP server config
     */
    app.post('/servers', async (req, reply) => {
        const body = req.body as { name: string; transport: string; endpoint?: string; config?: unknown };
        if (!body.name?.trim()) return reply.status(400).send({ error: 'Name is required' });
        if (!['stdio', 'sse', 'http'].includes(body.transport)) {
            return reply.status(400).send({ error: 'Transport must be stdio, sse, or http' });
        }

        const server = await prisma.mcpServerConfig.create({
            data: {
                name: body.name.trim(),
                transport: body.transport,
                endpoint: body.endpoint ?? null,
                config: body.config as any ?? null,
            },
        });

        return reply.status(201).send(server);
    });

    /**
     * DELETE /api/mcp/servers/:id — remove an MCP server
     */
    app.delete<{ Params: { id: string } }>('/servers/:id', async (req, reply) => {
        try {
            await prisma.mcpServerConfig.delete({ where: { id: req.params.id } });
            return reply.send({ success: true });
        } catch {
            return reply.status(404).send({ error: 'MCP server not found' });
        }
    });
}
