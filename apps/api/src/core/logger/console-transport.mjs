/**
 * Custom pino transport — compact colored one-liner console output.
 *
 * HTTP requests:  10:30:45 ← GET /api/health 200 3ms
 * General logs:   10:30:45 ● NATS connected
 * Warnings:       10:30:45 ▲ Cache miss
 * Errors:         10:30:45 ✖ Connection failed
 *
 * This runs in a pino worker thread, so it must be plain JS (.mjs).
 */
import build from 'pino-abstract-transport';

// ── ANSI Colors ──
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';
const BG_RED = '\x1b[41m';

// Pino numeric levels
const LEVEL_LABELS = {
    10: { label: 'TRC', color: GRAY },
    20: { label: 'DBG', color: GRAY },
    30: { label: 'INF', color: GREEN },
    40: { label: 'WRN', color: YELLOW },
    50: { label: 'ERR', color: RED },
    60: { label: 'FTL', color: `${BG_RED}${WHITE}` },
};

const METHOD_COLORS = {
    GET: CYAN,
    POST: GREEN,
    PUT: YELLOW,
    PATCH: MAGENTA,
    DELETE: RED,
    OPTIONS: GRAY,
    HEAD: GRAY,
};

const LEVEL_ICONS = {
    10: '·',
    20: '·',
    30: '●',
    40: '▲',
    50: '✖',
    60: '✖',
};

function statusColor(code) {
    if (code >= 500) return `${BG_RED}${WHITE}`;
    if (code >= 400) return YELLOW;
    if (code >= 300) return CYAN;
    if (code >= 200) return GREEN;
    return WHITE;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function timestamp() {
    const d = new Date();
    return `${DIM}${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${RESET}`;
}

function formatLine(obj) {
    const level = obj.level ?? 30;
    const meta = LEVEL_LABELS[level] ?? LEVEL_LABELS[30];
    const icon = LEVEL_ICONS[level] ?? '●';
    const ts = timestamp();

    // HTTP request log (from our custom onResponse hook)
    const http = obj.http;
    if (http && http.method && http.statusCode != null) {
        const mc = METHOD_COLORS[http.method] ?? WHITE;
        const sc = statusColor(http.statusCode);
        const dur = http.duration != null ? `${GRAY}${http.duration}ms${RESET}` : '';
        const route = http.route && http.route !== http.url
            ? `${GRAY} (${http.route})${RESET}`
            : '';
        return `${ts} ${mc}${BOLD}${http.method}${RESET} ${http.url} ${sc}${http.statusCode}${RESET} ${dur}${route}`;
    }

    // Fastify's default request/response logs (if not suppressed)
    if (obj.req && obj.res) {
        const mc = METHOD_COLORS[obj.req.method] ?? WHITE;
        const sc = statusColor(obj.res.statusCode);
        const dur = obj.responseTime != null ? `${GRAY}${Math.round(obj.responseTime)}ms${RESET}` : '';
        return `${ts} ${mc}${BOLD}${obj.req.method}${RESET} ${obj.req.url} ${sc}${obj.res.statusCode}${RESET} ${dur}`;
    }

    // General log line
    const component = obj.component ? `${CYAN}[${obj.component}]${RESET} ` : '';
    const msg = obj.msg ?? '';
    const errMsg = obj.err?.message ? ` ${DIM}(${obj.err.message})${RESET}` : '';
    return `${ts} ${meta.color}${icon}${RESET} ${component}${msg}${errMsg}`;
}

export default function () {
    return build(async function (source) {
        for await (const obj of source) {
            const line = formatLine(obj);
            process.stdout.write(line + '\n');
        }
    });
}
