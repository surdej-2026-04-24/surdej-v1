/**
 * Routes: MCP Server Registry
 *
 * REST endpoints for managing MCP (Model Context Protocol) servers
 * and their tools. Supports both internal platform tools and
 * external user-added MCP servers.
 */

import type { FastifyInstance } from 'fastify';
import {
    CreateMcpServerSchema,
    UpdateMcpServerSchema,
    CreateMcpToolSchema,
    UpdateMcpToolSchema,
} from '@surdej/module-tool-management-tools-shared';
import { getPrisma } from './db.js';

export function registerMcpServerRoutes(app: FastifyInstance) {
    const prisma = getPrisma();

    // ─── MCP Servers ───────────────────────────────────────────

    // GET /mcp-servers — List all MCP servers with their tools
    app.get('/mcp-servers', async (req) => {
        const query = req.query as Record<string, string>;

        const where: Record<string, unknown> = { deletedAt: null };
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.enabled !== undefined) where.isEnabled = query.enabled === 'true';

        const servers = await prisma.mcpServer.findMany({
            where,
            include: { tools: { orderBy: { name: 'asc' } } },
            orderBy: [{ isBuiltIn: 'desc' }, { label: 'asc' }],
        });

        return { items: servers, total: servers.length };
    });

    // GET /mcp-servers/:id — Get a single MCP server with tools
    app.get<{ Params: { id: string } }>('/mcp-servers/:id', async (req, reply) => {
        const server = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
            include: { tools: { orderBy: { name: 'asc' } } },
        });
        if (!server || server.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }
        return server;
    });

    // POST /mcp-servers — Register a new MCP server
    app.post('/mcp-servers', async (req, reply) => {
        const result = CreateMcpServerSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const existing = await prisma.mcpServer.findUnique({
            where: { name: result.data.name },
        });
        if (existing && !existing.deletedAt) {
            return reply.status(409).send({ error: `MCP server "${result.data.name}" already exists` });
        }

        let server;
        if (existing && existing.deletedAt) {
            // Restore the soft-deleted record with new data
            server = await prisma.mcpServer.update({
                where: { id: existing.id },
                data: {
                    ...result.data,
                    args: result.data.args ?? [],
                    isEnabled: true,
                    deletedAt: null,
                    status: 'unknown',
                    statusMessage: null,
                    lastHealthCheck: null,
                },
                include: { tools: true },
            });
        } else {
            server = await prisma.mcpServer.create({
                data: {
                    ...result.data,
                    args: result.data.args ?? [],
                },
                include: { tools: true },
            });
        }

        return reply.status(201).send(server);
    });

    // PUT /mcp-servers/:id — Update an MCP server
    app.put<{ Params: { id: string } }>('/mcp-servers/:id', async (req, reply) => {
        const existing = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!existing || existing.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        const result = UpdateMcpServerSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const server = await prisma.mcpServer.update({
            where: { id: req.params.id },
            data: { ...result.data, updatedAt: new Date() },
            include: { tools: true },
        });

        return server;
    });

    // DELETE /mcp-servers/:id — Soft-delete an MCP server
    app.delete<{ Params: { id: string } }>('/mcp-servers/:id', async (req, reply) => {
        const existing = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!existing || existing.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        await prisma.mcpServer.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date(), isEnabled: false },
        });

        return { success: true };
    });

    // PATCH /mcp-servers/:id/toggle — Toggle enabled/disabled
    app.patch<{ Params: { id: string } }>('/mcp-servers/:id/toggle', async (req, reply) => {
        const existing = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!existing || existing.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        const server = await prisma.mcpServer.update({
            where: { id: req.params.id },
            data: { isEnabled: !existing.isEnabled },
            include: { tools: true },
        });

        return server;
    });

    // POST /mcp-servers/:id/health-check — Trigger a health check
    app.post<{ Params: { id: string } }>('/mcp-servers/:id/health-check', async (req, reply) => {
        const existing = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!existing || existing.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        // For now, just update the timestamp. Real health check would
        // attempt to connect to the endpoint and verify the MCP handshake.
        let status = 'unknown';
        let statusMessage: string | null = null;

        if (existing.type === 'internal') {
            status = 'online';
            statusMessage = 'Internal server — always available';
        } else if (existing.endpoint) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(existing.endpoint, {
                    method: 'GET',
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                status = res.ok || res.status === 405 ? 'online' : 'error';
                statusMessage = `HTTP ${res.status}`;
            } catch (err) {
                status = 'offline';
                statusMessage = err instanceof Error ? err.message : 'Connection failed';
            }
        }

        const server = await prisma.mcpServer.update({
            where: { id: req.params.id },
            data: {
                status,
                statusMessage,
                lastHealthCheck: new Date(),
            },
            include: { tools: true },
        });

        return server;
    });

    // ─── MCP Tools (within a server) ──────────────────────────

    // GET /mcp-servers/:id/tools — List tools for a server
    app.get<{ Params: { id: string } }>('/mcp-servers/:id/tools', async (req, reply) => {
        const server = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!server || server.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        const tools = await prisma.mcpTool.findMany({
            where: { serverId: req.params.id },
            orderBy: { name: 'asc' },
        });

        return { items: tools, total: tools.length };
    });

    // POST /mcp-servers/:id/tools — Add a tool to a server
    app.post<{ Params: { id: string } }>('/mcp-servers/:id/tools', async (req, reply) => {
        const server = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
        });
        if (!server || server.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        const result = CreateMcpToolSchema.safeParse(req.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.issues });
        }

        const existing = await prisma.mcpTool.findUnique({
            where: { serverId_name: { serverId: req.params.id, name: result.data.name } },
        });
        if (existing) {
            return reply.status(409).send({ error: `Tool "${result.data.name}" already exists on this server` });
        }

        const tool = await prisma.mcpTool.create({
            data: {
                ...result.data,
                serverId: req.params.id,
            },
        });

        return reply.status(201).send(tool);
    });

    // PUT /mcp-servers/:serverId/tools/:toolId — Update a tool
    app.put<{ Params: { serverId: string; toolId: string } }>(
        '/mcp-servers/:serverId/tools/:toolId',
        async (req, reply) => {
            const tool = await prisma.mcpTool.findFirst({
                where: { id: req.params.toolId, serverId: req.params.serverId },
            });
            if (!tool) {
                return reply.status(404).send({ error: 'Tool not found' });
            }

            const result = UpdateMcpToolSchema.safeParse(req.body);
            if (!result.success) {
                return reply.status(400).send({ error: result.error.issues });
            }

            const updated = await prisma.mcpTool.update({
                where: { id: req.params.toolId },
                data: { ...result.data, updatedAt: new Date() },
            });

            return updated;
        },
    );

    // PATCH /mcp-servers/:serverId/tools/:toolId/toggle — Toggle tool
    app.patch<{ Params: { serverId: string; toolId: string } }>(
        '/mcp-servers/:serverId/tools/:toolId/toggle',
        async (req, reply) => {
            const tool = await prisma.mcpTool.findFirst({
                where: { id: req.params.toolId, serverId: req.params.serverId },
            });
            if (!tool) {
                return reply.status(404).send({ error: 'Tool not found' });
            }

            const updated = await prisma.mcpTool.update({
                where: { id: req.params.toolId },
                data: { isEnabled: !tool.isEnabled },
            });

            return updated;
        },
    );

    // DELETE /mcp-servers/:serverId/tools/:toolId — Remove a tool
    app.delete<{ Params: { serverId: string; toolId: string } }>(
        '/mcp-servers/:serverId/tools/:toolId',
        async (req, reply) => {
            const tool = await prisma.mcpTool.findFirst({
                where: { id: req.params.toolId, serverId: req.params.serverId },
            });
            if (!tool) {
                return reply.status(404).send({ error: 'Tool not found' });
            }

            await prisma.mcpTool.delete({ where: { id: req.params.toolId } });

            return { success: true };
        },
    );

    // POST /mcp-servers/:id/discover — Discover tools from server
    // Placeholder for future MCP tools/list integration
    app.post<{ Params: { id: string } }>('/mcp-servers/:id/discover', async (req, reply) => {
        const server = await prisma.mcpServer.findUnique({
            where: { id: req.params.id },
            include: { tools: true },
        });
        if (!server || server.deletedAt) {
            return reply.status(404).send({ error: 'MCP server not found' });
        }

        // TODO: Connect to the MCP server and call tools/list
        // For now, return existing tools with a message
        return {
            message: 'Tool discovery not yet implemented — register tools manually or via seed',
            server: server.name,
            existingTools: server.tools.length,
        };
    });
}
