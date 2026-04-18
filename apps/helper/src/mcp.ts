/**
 * MCP Server for Surdej Helper
 *
 * Exposes local project data and file query tools via MCP protocol
 * so that workflow runners and AI agents can query downloaded data.
 *
 * Transport: SSE (GET /mcp) + JSON-RPC (POST /messages)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { resolve, relative, join, extname, normalize, isAbsolute } from 'path';
import type { Express, Request, Response } from 'express';

// ─── Types ─────────────────────────────────────────────────────

interface McpSetupOptions {
    projectRoot: string;
}

// ─── Transports ────────────────────────────────────────────────

const transports: Record<string, SSEServerTransport> = {};

// ─── Path helpers ──────────────────────────────────────────────

function safePath(projectRoot: string, filePath: string): string | null {
    const resolved = isAbsolute(filePath)
        ? normalize(filePath)
        : resolve(projectRoot, filePath);
    const rel = relative(projectRoot, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) return null;
    // Block sensitive files
    if (rel.includes('.env') || rel.includes('.git/config')) return null;
    return resolved;
}

function listFilesRecursive(
    dir: string,
    projectRoot: string,
    maxDepth = 4,
    depth = 0,
): string[] {
    if (depth > maxDepth) return [];
    const results: string[] = [];
    try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...listFilesRecursive(full, projectRoot, maxDepth, depth + 1));
            } else {
                results.push(relative(projectRoot, full));
            }
        }
    } catch {
        // permission error or similar — skip
    }
    return results;
}

// ─── Server factory ────────────────────────────────────────────

function createMcpServer(opts: McpSetupOptions): McpServer {
    const { projectRoot } = opts;

    const server = new McpServer({
        name: 'surdej-helper',
        version: '0.1.0',
    });

    // ── Tool: query_file ────────────────────────────────────────
    server.registerTool('query_file', {
        description: 'Read the contents of a project file. Path is relative to the project root.',
        inputSchema: {
            path: z.string().describe('Relative or absolute path to the file'),
            encoding: z.enum(['utf-8', 'base64']).optional().describe('Encoding (default utf-8)'),
        },
    }, async ({ path, encoding }) => {
        const resolved = safePath(projectRoot, path);
        if (!resolved) {
            return { content: [{ type: 'text', text: 'Error: path is outside the project root or restricted' }] };
        }
        if (!existsSync(resolved)) {
            return { content: [{ type: 'text', text: `Error: file not found: ${path}` }] };
        }
        const stat = statSync(resolved);
        if (stat.size > 2 * 1024 * 1024) {
            return { content: [{ type: 'text', text: `Error: file too large (${stat.size} bytes, max 2 MB)` }] };
        }
        const enc = encoding === 'base64' ? 'base64' : 'utf-8';
        const content = readFileSync(resolved, enc as BufferEncoding);
        return { content: [{ type: 'text', text: content }] };
    });

    // ── Tool: list_files ────────────────────────────────────────
    server.registerTool('list_files', {
        description: 'List files in a project directory. Returns relative paths.',
        inputSchema: {
            directory: z.string().optional().describe('Directory relative to project root (default: root)'),
            pattern: z.string().optional().describe('File extension filter, e.g. ".csv" or ".json"'),
            maxDepth: z.number().optional().describe('Max recursion depth (default 4)'),
        },
    }, async ({ directory, pattern, maxDepth }) => {
        const dir = directory
            ? safePath(projectRoot, directory)
            : projectRoot;
        if (!dir) {
            return { content: [{ type: 'text', text: 'Error: directory is outside the project root' }] };
        }
        if (!existsSync(dir)) {
            return { content: [{ type: 'text', text: `Error: directory not found: ${directory ?? '/'}` }] };
        }
        let files = listFilesRecursive(dir, projectRoot, maxDepth ?? 4);
        if (pattern) {
            const ext = pattern.startsWith('.') ? pattern : '.' + pattern;
            files = files.filter(f => extname(f).toLowerCase() === ext.toLowerCase());
        }
        if (files.length === 0) {
            return { content: [{ type: 'text', text: 'No files found matching criteria.' }] };
        }
        return { content: [{ type: 'text', text: files.join('\n') }] };
    });

    // ── Tool: search_files ──────────────────────────────────────
    server.registerTool('search_files', {
        description: 'Search for text across project files. Returns matching lines with file paths.',
        inputSchema: {
            query: z.string().describe('Text or regex pattern to search for'),
            directory: z.string().optional().describe('Subdirectory to search in'),
            filePattern: z.string().optional().describe('File extension filter, e.g. ".ts"'),
            maxResults: z.number().optional().describe('Maximum number of results (default 50)'),
        },
    }, async ({ query, directory, filePattern, maxResults }) => {
        const dir = directory
            ? safePath(projectRoot, directory)
            : projectRoot;
        if (!dir) {
            return { content: [{ type: 'text', text: 'Error: directory is outside the project root' }] };
        }

        const files = listFilesRecursive(dir, projectRoot, 5);
        const ext = filePattern
            ? (filePattern.startsWith('.') ? filePattern : '.' + filePattern)
            : null;

        const matches: string[] = [];
        const limit = maxResults ?? 50;
        let regex: RegExp;
        try {
            regex = new RegExp(query, 'gi');
        } catch {
            return { content: [{ type: 'text', text: `Error: invalid regex pattern: ${query}` }] };
        }

        for (const relPath of files) {
            if (matches.length >= limit) break;
            if (ext && extname(relPath).toLowerCase() !== ext.toLowerCase()) continue;

            const absPath = resolve(projectRoot, relPath);
            try {
                const stat = statSync(absPath);
                if (stat.size > 512 * 1024) continue; // skip large files
                const content = readFileSync(absPath, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (matches.length >= limit) break;
                    if (regex.test(lines[i])) {
                        matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                    }
                    regex.lastIndex = 0; // reset for global regex
                }
            } catch {
                // skip unreadable files
            }
        }

        if (matches.length === 0) {
            return { content: [{ type: 'text', text: `No matches found for: ${query}` }] };
        }
        return { content: [{ type: 'text', text: matches.join('\n') }] };
    });

    // ── Tool: query_csv ─────────────────────────────────────────
    server.registerTool('query_csv', {
        description: 'Parse and query a CSV file. Returns rows as JSON.',
        inputSchema: {
            path: z.string().describe('Path to the CSV file'),
            filter: z.string().optional().describe('Column:value filter, e.g. "status:active"'),
            limit: z.number().optional().describe('Max rows to return (default 100)'),
        },
    }, async ({ path, filter, limit }) => {
        const resolved = safePath(projectRoot, path);
        if (!resolved) {
            return { content: [{ type: 'text', text: 'Error: path is outside the project root' }] };
        }
        if (!existsSync(resolved)) {
            return { content: [{ type: 'text', text: `Error: file not found: ${path}` }] };
        }
        try {
            const raw = readFileSync(resolved, 'utf-8');
            const lines = raw.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                return { content: [{ type: 'text', text: 'CSV file is empty or has no data rows.' }] };
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const maxRows = limit ?? 100;
            let rows: Record<string, string>[] = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row: Record<string, string> = {};
                headers.forEach((h, j) => { row[h] = values[j] ?? ''; });
                rows.push(row);
            }

            // Apply filter
            if (filter && filter.includes(':')) {
                const [col, val] = filter.split(':', 2);
                rows = rows.filter(r => {
                    const cell = r[col] ?? '';
                    return cell.toLowerCase().includes(val.toLowerCase());
                });
            }

            rows = rows.slice(0, maxRows);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ headers, rowCount: rows.length, rows }, null, 2),
                }],
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `Error parsing CSV: ${msg}` }] };
        }
    });

    // ── Tool: query_json ────────────────────────────────────────
    server.registerTool('query_json', {
        description: 'Parse and query a JSON file. Optionally extract a nested path.',
        inputSchema: {
            path: z.string().describe('Path to the JSON file'),
            jsonPath: z.string().optional().describe('Dot-separated path to extract, e.g. "data.items"'),
        },
    }, async ({ path, jsonPath }) => {
        const resolved = safePath(projectRoot, path);
        if (!resolved) {
            return { content: [{ type: 'text', text: 'Error: path is outside the project root' }] };
        }
        if (!existsSync(resolved)) {
            return { content: [{ type: 'text', text: `Error: file not found: ${path}` }] };
        }
        try {
            const raw = readFileSync(resolved, 'utf-8');
            let data = JSON.parse(raw);

            if (jsonPath) {
                for (const key of jsonPath.split('.')) {
                    if (data == null || typeof data !== 'object') {
                        return { content: [{ type: 'text', text: `Path "${jsonPath}" not found in JSON` }] };
                    }
                    data = data[key];
                }
            }

            const text = JSON.stringify(data, null, 2);
            // Truncate if too large
            if (text.length > 100_000) {
                return { content: [{ type: 'text', text: text.slice(0, 100_000) + '\n\n... (truncated)' }] };
            }
            return { content: [{ type: 'text', text }] };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `Error parsing JSON: ${msg}` }] };
        }
    });

    // ── Resource: project info ──────────────────────────────────
    server.registerResource('project-info', 'surdej://helper/project', {
        description: 'Project root and server information',
        mimeType: 'application/json',
    }, async () => {
        return {
            contents: [{
                uri: 'surdej://helper/project',
                text: JSON.stringify({
                    projectRoot,
                    uptime: Math.floor(process.uptime()),
                    service: 'surdej-helper',
                }, null, 2),
            }],
        };
    });

    return server;
}

// ─── Express integration ───────────────────────────────────────

export function mountMcp(app: Express, opts: McpSetupOptions): void {
    // SSE endpoint — clients connect here to establish the stream
    app.get('/mcp', async (_req: Request, res: Response) => {
        const server = createMcpServer(opts);
        const transport = new SSEServerTransport('/messages', res);
        transports[transport.sessionId] = transport;

        transport.onclose = () => {
            delete transports[transport.sessionId];
        };

        await server.connect(transport);
    });

    // JSON-RPC messages from the client
    app.post('/messages', async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        if (!sessionId) {
            res.status(400).json({ error: 'sessionId query parameter is required' });
            return;
        }

        const transport = transports[sessionId];
        if (!transport) {
            res.status(404).json({ error: 'Unknown session. Connect via GET /mcp first.' });
            return;
        }

        await transport.handlePostMessage(req, res);
    });

    console.log('    GET  /mcp      — MCP SSE stream');
    console.log('    POST /messages — MCP JSON-RPC');
}

export { transports };
