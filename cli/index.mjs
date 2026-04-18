#!/usr/bin/env node
/**
 * Surdej CLI (Phase 4.9 / 8.7)
 *
 * Lightweight CLI for platform operations. Talks to the local API.
 *
 * Usage:
 *   pnpm cli workers              — list workers
 *   pnpm cli workers <id>         — worker detail
 *   pnpm cli workers drain <id>   — drain a worker
 *   pnpm cli articles             — list articles
 *   pnpm cli articles create <title> — create an article
 *   pnpm cli db status            — migration status
 *   pnpm cli db migrate           — run migrations
 *   pnpm cli mcp tools            — list MCP tools
 *   pnpm cli mcp call <tool>      — call an MCP tool
 *   pnpm cli rag search <query>   — RAG keyword search
 *   pnpm cli health               — API health check
 */

const API = process.env.API_URL ?? 'http://localhost:5001/api';

// ─── Helpers ───────────────────────────────────────────────────

async function get(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
}

async function post(path, body) {
    const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
}

function table(data, columns) {
    if (!data.length) return console.log('  (empty)');
    const widths = columns.map(c => Math.max(c.label.length, ...data.map(r => String(c.get(r) ?? '').length)));
    const header = columns.map((c, i) => c.label.padEnd(widths[i])).join(' │ ');
    const sep = widths.map(w => '─'.repeat(w)).join('─┼─');
    console.log(`  ${header}`);
    console.log(`  ${sep}`);
    for (const row of data) {
        const line = columns.map((c, i) => String(c.get(row) ?? '').padEnd(widths[i])).join(' │ ');
        console.log(`  ${line}`);
    }
}

function heading(text) {
    console.log(`\n\x1b[1m\x1b[36m▸ ${text}\x1b[0m\n`);
}

function success(text) {
    console.log(`  \x1b[32m✓\x1b[0m ${text}`);
}

function error(text) {
    console.error(`  \x1b[31m✗\x1b[0m ${text}`);
}

function relTime(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ─── Commands ──────────────────────────────────────────────────

const COMMANDS = {
    async health() {
        heading('Health Check');
        try {
            const data = await get('/health');
            success(`API running — ${data.status ?? 'ok'}`);
            if (data.uptime) success(`Uptime: ${Math.floor(data.uptime)}s`);
        } catch (e) {
            error(`API unreachable: ${e.message}`);
        }
    },

    async workers(args) {
        if (args[0] === 'drain') {
            heading(`Drain Worker: ${args[1]}`);
            const res = await post(`/workers/${args[1]}/drain`);
            success(`Worker drained: ${JSON.stringify(res)}`);
            return;
        }

        if (args[0]) {
            heading(`Worker: ${args[0]}`);
            const w = await get(`/workers/${args[0]}`);
            console.log(`  ID:       ${w.id}`);
            console.log(`  Type:     ${w.type}`);
            console.log(`  Status:   ${w.status}`);
            console.log(`  Health:   ${w.healthState}`);
            console.log(`  Version:  ${w.version ?? '—'}`);
            console.log(`  Instance: ${w.instanceId}`);
            return;
        }

        heading('Workers');
        const workers = await get('/workers');
        if (!workers.length) return console.log('  No workers registered.');
        table(workers, [
            { label: 'Instance', get: r => r.instanceId?.slice(0, 12) },
            { label: 'Type', get: r => r.type },
            { label: 'Status', get: r => r.status },
            { label: 'Health', get: r => r.healthState },
            { label: 'Last Heartbeat', get: r => relTime(r.lastHeartbeat) },
        ]);
    },

    async articles(args) {
        if (args[0] === 'create') {
            const title = args.slice(1).join(' ') || 'Untitled';
            heading(`Create Article: "${title}"`);
            // Get first user as author
            const users = await get('/auth/me').catch(() => null);
            const article = await post('/knowledge/articles', {
                title,
                content: `# ${title}\n\nContent goes here…`,
                authorId: users?.id ?? 'system',
            });
            success(`Created: ${article.id} (${article.slug})`);
            return;
        }

        heading('Articles');
        const data = await get('/knowledge/articles?limit=20');
        if (!data.articles.length) return console.log('  No articles.');
        table(data.articles, [
            { label: 'Title', get: r => r.title.slice(0, 40) },
            { label: 'Status', get: r => r.status },
            { label: 'Tags', get: r => r.tags.join(', ') || '—' },
            { label: 'Updated', get: r => relTime(r.updatedAt) },
        ]);
        if (data.total > data.articles.length) {
            console.log(`\n  Showing ${data.articles.length} of ${data.total}`);
        }
    },

    async db(args) {
        if (args[0] === 'status') {
            heading('Database — Migration Status');
            const { exec } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execP = promisify(exec);
            try {
                const { stdout } = await execP('npx prisma migrate status', { cwd: 'apps/api' });
                console.log(stdout);
            } catch (e) {
                console.log(e.stdout || e.message);
            }
            return;
        }

        if (args[0] === 'migrate') {
            heading('Database — Apply Migrations');
            const { exec } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execP = promisify(exec);
            try {
                const { stdout } = await execP('npx prisma migrate deploy', { cwd: 'apps/api' });
                console.log(stdout);
                success('Migrations applied');
            } catch (e) {
                error(e.stdout || e.message);
            }
            return;
        }

        heading('Database');
        console.log('  Subcommands: status, migrate');
    },

    async mcp(args) {
        if (args[0] === 'call') {
            const toolName = args[1];
            if (!toolName) { error('Usage: mcp call <tool-name>'); return; }
            heading(`MCP Call: ${toolName}`);
            const result = await post('/mcp/tools/call', { name: toolName, arguments: {} });
            for (const item of (result.content ?? [])) {
                console.log(item.text);
            }
            return;
        }

        if (args[0] === 'resources') {
            heading('MCP Resources');
            const { resources } = await get('/mcp/resources');
            table(resources, [
                { label: 'URI', get: r => r.uri },
                { label: 'Name', get: r => r.name },
                { label: 'Type', get: r => r.mimeType },
            ]);
            return;
        }

        if (args[0] === 'servers') {
            heading('MCP External Servers');
            const servers = await get('/mcp/servers');
            if (!servers.length) return console.log('  No external servers configured.');
            table(servers, [
                { label: 'Name', get: r => r.name },
                { label: 'Transport', get: r => r.transport },
                { label: 'Enabled', get: r => r.isEnabled ? '✓' : '✗' },
                { label: 'Calls', get: r => r._count?.invocations ?? 0 },
            ]);
            return;
        }

        // Default: show tools
        heading('MCP Tools');
        const { tools } = await get('/mcp/tools');
        table(tools, [
            { label: 'Tool', get: r => r.name },
            { label: 'Description', get: r => r.description.slice(0, 60) },
        ]);
    },

    async rag(args) {
        if (args[0] === 'search') {
            const query = args.slice(1).join(' ');
            if (!query) { error('Usage: rag search <query>'); return; }
            heading(`RAG Search: "${query}"`);
            const data = await post('/ai/rag/search', { query, topK: 10 });
            if (!data.results.length) {
                console.log('  No results found.');
                return;
            }
            table(data.results, [
                { label: 'Title', get: r => r.title.slice(0, 35) },
                { label: 'Score', get: r => r.score.toFixed(3) },
                { label: 'Match', get: r => r.matchType },
                { label: 'Status', get: r => r.status },
            ]);
            return;
        }

        heading('RAG');
        console.log('  Subcommands: search <query>');
    },
};

// ─── Main ──────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    const rest = args.slice(1);

    if (!cmd || cmd === 'help') {
        heading('Surdej CLI');
        console.log('  Commands:');
        console.log('    health              — API health check');
        console.log('    workers             — list / inspect / drain workers');
        console.log('    articles            — list / create articles');
        console.log('    db status|migrate   — database migration management');
        console.log('    mcp [tools|call|resources|servers] — MCP operations');
        console.log('    rag search <query>  — RAG keyword search');
        console.log('');
        return;
    }

    const handler = COMMANDS[cmd];
    if (!handler) {
        error(`Unknown command: ${cmd}`);
        console.log('  Run with no arguments for help.');
        process.exit(1);
    }

    try {
        await handler(rest);
    } catch (e) {
        error(e.message);
        process.exit(1);
    }
}

main();
