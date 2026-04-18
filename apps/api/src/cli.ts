#!/usr/bin/env tsx
/**
 * Surdej CLI — lightweight auth helper
 *
 * Commands:
 *   login   — authenticate against a Surdej API and store the token
 *   logout  — delete the stored token
 *   whoami  — show the current session info
 *
 * The token is persisted to ~/.surdej/cli-token.json so subsequent
 * curl / fetch calls can use it:
 *
 *   TOKEN=$(pnpm --filter @surdej/api cli:login | jq -r .token)
 *   curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/...
 *
 * Environment:
 *   SURDEJ_API_URL  — API base URL (default: http://localhost:5001/api)
 *   SURDEJ_EMAIL    — email for demo login (prompted if missing)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

// ─── Config ────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.surdej');
const TOKEN_FILE = join(CONFIG_DIR, 'cli-token.json');
const API_URL = process.env['SURDEJ_API_URL'] || 'http://localhost:5001/api';

interface StoredSession {
    token: string;
    apiUrl: string;
    email: string;
    userId: string;
    displayName: string;
    role: string;
    tenantId?: string;
    tenantName?: string;
    createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadSession(): StoredSession | null {
    try {
        if (!existsSync(TOKEN_FILE)) return null;
        return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

function saveSession(session: StoredSession) {
    ensureConfigDir();
    writeFileSync(TOKEN_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

function deleteSession() {
    try { unlinkSync(TOKEN_FILE); } catch { /* ignore */ }
}

async function prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function api(method: string, path: string, body?: unknown, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
}

// ─── Commands ──────────────────────────────────────────────────

async function login() {
    const email = process.env['SURDEJ_EMAIL'] || await prompt('Email: ');
    if (!email) { console.error('Email is required'); process.exit(1); }

    console.error(`→ Authenticating ${email} against ${API_URL}...`);

    // Step 1: Login
    const loginRes = await api('POST', '/auth/login', { email });

    // Step 2: Get user info
    const meRes = await api('GET', '/auth/me', undefined, loginRes.token);

    // Step 3: Pick a tenant (if multiple)
    let tenantId: string | undefined;
    let tenantName: string | undefined;

    if (meRes.tenants && meRes.tenants.length > 0) {
        if (meRes.tenants.length === 1) {
            tenantId = meRes.tenants[0].id;
            tenantName = meRes.tenants[0].name;
        } else {
            console.error('\nAvailable tenants:');
            meRes.tenants.forEach((t: any, i: number) => {
                console.error(`  [${i + 1}] ${t.name} (${t.slug})`);
            });
            const choice = await prompt(`Choose tenant [1-${meRes.tenants.length}]: `);
            const idx = parseInt(choice) - 1;
            if (idx >= 0 && idx < meRes.tenants.length) {
                tenantId = meRes.tenants[idx].id;
                tenantName = meRes.tenants[idx].name;
            }
        }
    }

    const session: StoredSession = {
        token: loginRes.token,
        apiUrl: API_URL,
        email,
        userId: meRes.user?.id || loginRes.user?.id || '',
        displayName: meRes.user?.displayName || loginRes.user?.displayName || email,
        role: meRes.user?.role || loginRes.user?.role || 'unknown',
        tenantId,
        tenantName,
        createdAt: new Date().toISOString(),
    };

    saveSession(session);

    console.error(`✅ Logged in as ${session.displayName} (${session.role})`);
    if (tenantName) console.error(`   Tenant: ${tenantName}`);
    console.error(`   Token saved to ${TOKEN_FILE}`);

    // Output token to stdout (for piping)
    console.log(JSON.stringify({
        token: session.token,
        tenantId: session.tenantId,
        apiUrl: API_URL,
    }));
}

async function logout() {
    const session = loadSession();
    if (!session) {
        console.error('Not logged in.');
        process.exit(0);
    }

    // Try to invalidate server-side
    try {
        await api('POST', '/auth/logout', undefined, session.token);
    } catch {
        // Server may be unreachable — still clear local token
    }

    deleteSession();
    console.error(`✅ Logged out (token cleared from ${TOKEN_FILE})`);
}

async function whoami() {
    const session = loadSession();
    if (!session) {
        console.error('Not logged in. Run: pnpm --filter @surdej/api cli:login');
        process.exit(1);
    }

    console.error(`API:       ${session.apiUrl}`);
    console.error(`Email:     ${session.email}`);
    console.error(`Name:      ${session.displayName}`);
    console.error(`Role:      ${session.role}`);
    console.error(`Tenant:    ${session.tenantName || '(none)'}`);
    console.error(`Logged in: ${session.createdAt}`);

    // Validate the token is still alive
    try {
        await api('GET', '/auth/me', undefined, session.token);
        console.error(`Status:    ✅ valid`);
        // Output for scripting
        console.log(JSON.stringify({
            token: session.token,
            tenantId: session.tenantId,
            apiUrl: session.apiUrl,
            valid: true,
        }));
    } catch (err: any) {
        console.error(`Status:    ❌ expired or invalid (${err.message})`);
        console.log(JSON.stringify({ valid: false }));
        process.exit(1);
    }
}

// ─── Main ──────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
    case 'login':
        login().catch((e) => { console.error(`❌ Login failed: ${e.message}`); process.exit(1); });
        break;
    case 'logout':
        logout().catch((e) => { console.error(`❌ Logout failed: ${e.message}`); process.exit(1); });
        break;
    case 'whoami':
        whoami().catch((e) => { console.error(`❌ Error: ${e.message}`); process.exit(1); });
        break;
    default:
        console.error(`
Surdej CLI — Auth Helper

Usage:
  pnpm --filter @surdej/api cli:login     Authenticate and store token
  pnpm --filter @surdej/api cli:logout    Clear stored token
  pnpm --filter @surdej/api cli:whoami    Show current session

Environment:
  SURDEJ_API_URL   API base URL (default: http://localhost:5001/api)
  SURDEJ_EMAIL     Email for demo login (prompted if not set)

Examples:
  # Local login
  SURDEJ_EMAIL=admin@surdej.dev pnpm --filter @surdej/api cli:login

  # Production login
  SURDEJ_API_URL=https://api.example.com/api SURDEJ_EMAIL=admin@surdej.dev pnpm --filter @surdej/api cli:login

  # Use stored token in curl
  TOKEN=$(cat ~/.surdej/cli-token.json | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).token')
  curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/auth/me
`);
        process.exit(1);
}
