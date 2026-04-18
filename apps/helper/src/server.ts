/**
 * Surdej Helper Server
 *
 * Lightweight localhost Express server providing development utilities:
 *   - /health       — liveness check
 *   - /open         — open file in VS Code (code --goto)
 *   - /read         — read file contents (with path validation)
 *   - /token        — token exchange placeholder
 *
 * Security:
 *   - Bearer token authentication (configurable via HELPER_TOKEN env)
 *   - Path validation — only project files can be accessed
 *   - Rate limiting — 60 req/min per endpoint
 *   - Localhost only
 */

import express from 'express';
import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, normalize, isAbsolute, relative, join } from 'path';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import { mountMcp } from './mcp.js';

// Load environment configuration from root .env file
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

// ─── Configuration ─────────────────────────────────────────────

const PORT = parseInt(process.env.HELPER_PORT || '5050', 10);
const TOKEN = process.env.HELPER_TOKEN || randomBytes(32).toString('hex');
const PROJECT_ROOT = process.env.HELPER_PROJECT_ROOT || resolve(process.cwd(), '../..');
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

// ─── Rate Limiting ─────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW = 60_000; // 1 minute in ms

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    entry.count++;
    return entry.count <= RATE_LIMIT;
}

// ─── Path Validation ───────────────────────────────────────────

function validatePath(filePath: string): { valid: boolean; resolved: string; error?: string } {
    if (!filePath) {
        return { valid: false, resolved: '', error: 'Path is required' };
    }

    const resolved = isAbsolute(filePath)
        ? normalize(filePath)
        : resolve(PROJECT_ROOT, filePath);

    // Ensure the resolved path is within the project root
    const rel = relative(PROJECT_ROOT, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
        return { valid: false, resolved, error: 'Path is outside the project root' };
    }

    // Block sensitive paths
    const blocked = ['.env', '.git/config', 'node_modules/.cache'];
    for (const pattern of blocked) {
        if (rel.includes(pattern)) {
            return { valid: false, resolved, error: 'Access to this path is restricted' };
        }
    }

    return { valid: true, resolved };
}

// ─── Express App ───────────────────────────────────────────────

import type { Express } from 'express';

const app: Express = express();
app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
    // Health and MCP endpoints are public
    if (req.path === '/health' || req.path === '/mcp' || req.path === '/messages') return next();

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const provided = auth.slice(7);
    if (provided !== TOKEN) {
        res.status(403).json({ error: 'Invalid token' });
        return;
    }

    next();
});

// Rate limiting middleware
app.use((req, res, next) => {
    const key = req.path;
    if (!checkRateLimit(key)) {
        res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
        return;
    }
    next();
});

// ─── Endpoints ─────────────────────────────────────────────────

/**
 * GET /health
 * Liveness probe. Returns server status and uptime.
 */
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'surdej-helper',
        uptime: Math.floor(process.uptime()),
        projectRoot: PROJECT_ROOT,
    });
});

/**
 * POST /open
 * Open a file in VS Code at a specific line/column.
 * Body: { file: string, line?: number, column?: number }
 */
app.post('/open', (req, res) => {
    const { file, line, column } = req.body as {
        file?: string;
        line?: number;
        column?: number;
    };

    if (!file) {
        res.status(400).json({ error: 'file is required' });
        return;
    }

    const pathResult = validatePath(file);
    if (!pathResult.valid) {
        res.status(400).json({ error: pathResult.error });
        return;
    }

    if (!existsSync(pathResult.resolved)) {
        res.status(404).json({ error: 'File not found' });
        return;
    }

    // Build the --goto argument: file:line:column
    let target = pathResult.resolved;
    if (line && line > 0) {
        target += ':' + line;
        if (column && column > 0) {
            target += ':' + column;
        }
    }

    try {
        execSync('code --goto "' + target + '"', {
            timeout: 5000,
            stdio: 'ignore',
        });
        res.json({ ok: true, opened: target });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: 'Failed to open in VS Code', details: msg });
    }
});

/**
 * POST /read
 * Read a file's contents. Returns text or base64 for binary.
 * Body: { file: string, encoding?: 'utf-8' | 'base64' }
 */
app.post('/read', (req, res) => {
    const { file, encoding } = req.body as {
        file?: string;
        encoding?: string;
    };

    if (!file) {
        res.status(400).json({ error: 'file is required' });
        return;
    }

    const pathResult = validatePath(file);
    if (!pathResult.valid) {
        res.status(400).json({ error: pathResult.error });
        return;
    }

    if (!existsSync(pathResult.resolved)) {
        res.status(404).json({ error: 'File not found' });
        return;
    }

    try {
        const stat = statSync(pathResult.resolved);
        if (stat.size > MAX_FILE_SIZE) {
            res.status(413).json({
                error: 'File too large',
                size: stat.size,
                maxSize: MAX_FILE_SIZE,
            });
            return;
        }

        const enc = encoding === 'base64' ? 'base64' : 'utf-8';
        const content = readFileSync(pathResult.resolved, enc as BufferEncoding);

        res.json({
            file: pathResult.resolved,
            encoding: enc,
            size: stat.size,
            content,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: 'Failed to read file', details: msg });
    }
});

/**
 * POST /token
 * Token exchange placeholder for future Entra/SSO integration.
 * Body: { provider: string }
 */
app.post('/token', (req, res) => {
    const { provider } = req.body as { provider?: string };

    if (!provider) {
        res.status(400).json({ error: 'provider is required' });
        return;
    }

    // Placeholder — in production this would exchange tokens with Azure/Entra
    res.json({
        provider,
        status: 'not_implemented',
        message: 'Token exchange is not yet implemented. Configure AUTH_PROVIDER for production use.',
    });
});

// ─── MCP Server ────────────────────────────────────────────────

mountMcp(app, { projectRoot: PROJECT_ROOT });

// ─── Fallback ──────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({
        error: 'Not found',
        endpoints: ['GET /health', 'POST /open', 'POST /read', 'POST /token', 'GET /mcp', 'POST /messages'],
    });
});

// ─── Start ─────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  Surdej Helper Server');
    console.log('  ────────────────────');
    console.log('  Local:   http://127.0.0.1:' + PORT);
    console.log('  Token:   ' + TOKEN.slice(0, 8) + '...');
    console.log('  Root:    ' + PROJECT_ROOT);
    console.log('');
    console.log('  Endpoints:');
    console.log('    GET  /health   — liveness check');
    console.log('    POST /open     — open file in VS Code');
    console.log('    POST /read     — read file contents');
    console.log('    POST /token    — token exchange (stub)');
    console.log('    GET  /mcp      — MCP SSE stream');
    console.log('    POST /messages — MCP JSON-RPC');
    console.log('');
});

export { app, TOKEN, PROJECT_ROOT };
