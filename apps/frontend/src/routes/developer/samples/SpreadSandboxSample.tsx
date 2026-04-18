/**
 * Spread Sandbox Sample
 *
 * Interactive developer sample demonstrating the Surdej Spread architecture:
 * a securely sandboxed micro-app that communicates with the host via a
 * typed MessageChannel bridge.
 *
 * This page loads a self-contained demo Spread (vanilla JS, no bundler
 * required) and wires up mock capability handlers to show the full
 * request/response flow.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Box, Shield, Zap, Globe, Search, Code2 } from 'lucide-react';
import { SecureSandbox, type SpreadCapabilities } from '@/core/spread/SecureSandbox';

// ─── Demo Spread HTML ────────────────────────────────────────────────
//
// A self-contained single-file HTML app that demonstrates the Spread
// client protocol. Real Spreads are built with vite-plugin-singlefile.
// This inline demo uses vanilla JS so no bundler step is needed.

const DEMO_SPREAD_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Demo Spread</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      background: #0f172a;
      color: #e2e8f0;
      padding: 16px;
      min-height: 100vh;
    }
    h1 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #f1f5f9; }
    .subtitle { font-size: 11px; color: #64748b; margin-bottom: 16px; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; padding: 2px 8px; border-radius: 9999px;
      border: 1px solid #334155; color: #94a3b8; margin-bottom: 12px;
    }
    .badge.connected { border-color: #16a34a; color: #4ade80; background: #052e16; }
    .badge.mock { border-color: #92400e; color: #fbbf24; background: #1c1002; }
    .section { margin-bottom: 14px; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
      color: #475569; margin-bottom: 6px; }
    .row { display: flex; gap: 6px; margin-bottom: 6px; }
    input {
      flex: 1; background: #1e293b; border: 1px solid #334155; color: #e2e8f0;
      padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;
    }
    input:focus { border-color: #6366f1; }
    button {
      background: #6366f1; color: #fff; border: none; padding: 6px 14px;
      border-radius: 6px; font-size: 12px; cursor: pointer; white-space: nowrap;
      transition: background .15s;
    }
    button:hover:not(:disabled) { background: #4f46e5; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    button.secondary {
      background: #1e293b; border: 1px solid #334155; color: #94a3b8;
    }
    button.secondary:hover:not(:disabled) { background: #334155; }
    .result {
      background: #1e293b; border: 1px solid #334155; border-radius: 6px;
      padding: 8px 10px; font-size: 11px; color: #94a3b8;
      min-height: 36px; font-family: 'SF Mono', 'Fira Code', monospace;
      white-space: pre-wrap; word-break: break-all;
      max-height: 120px; overflow-y: auto;
    }
    .result.success { border-color: #166534; color: #86efac; }
    .result.error { border-color: #991b1b; color: #fca5a5; }
    .result.loading { color: #6366f1; }
    .divider { border: none; border-top: 1px solid #1e293b; margin: 12px 0; }
    .log {
      background: #020617; border: 1px solid #1e293b; border-radius: 6px;
      padding: 8px 10px; font-family: monospace; font-size: 10px; color: #475569;
      max-height: 100px; overflow-y: auto;
    }
    .log .entry { padding: 1px 0; }
    .log .ts { color: #334155; margin-right: 4px; }
    .log .in { color: #4ade80; }
    .log .out { color: #60a5fa; }
    .log .err { color: #f87171; }
  </style>
</head>
<body>
  <h1>🟣 Demo Spread</h1>
  <p class="subtitle">Sandboxed micro-app — null origin, MessageChannel bridge</p>

  <div id="status" class="badge mock">⚡ Mock mode</div>

  <!-- PROXY_FETCH -->
  <div class="section">
    <div class="section-label">Proxied Fetch</div>
    <div class="row">
      <input id="fetchUrl" type="text" value="https://jsonplaceholder.typicode.com/todos/1" />
      <button id="fetchBtn">Fetch</button>
    </div>
    <div id="fetchResult" class="result">—</div>
  </div>

  <hr class="divider" />

  <!-- SCRAPE_PAGE -->
  <div class="section">
    <div class="section-label">Scrape Page Element</div>
    <div class="row">
      <input id="selectorInput" type="text" value="h1" />
      <button id="scrapeBtn">Scrape</button>
    </div>
    <div id="scrapeResult" class="result">—</div>
  </div>

  <hr class="divider" />

  <!-- AUTOMATE -->
  <div class="section">
    <div class="section-label">Automate</div>
    <div class="row">
      <button id="clickBtn" class="secondary">Click #submit</button>
      <button id="fillBtn" class="secondary">Fill #search = "hello"</button>
    </div>
    <div id="automateResult" class="result">—</div>
  </div>

  <hr class="divider" />

  <!-- Message log -->
  <div class="section">
    <div class="section-label">Bridge log</div>
    <div id="log" class="log"></div>
  </div>

  <script>
    // ── SurdejClient (inline implementation) ──────────────────────────
    const pendingRequests = new Map();
    let port = null;
    let connected = false;

    function log(direction, text) {
      const el = document.getElementById('log');
      const entry = document.createElement('div');
      entry.className = 'entry';
      const ts = new Date().toLocaleTimeString('en', { hour12: false });
      entry.innerHTML =
        '<span class="ts">' + ts + '</span>' +
        '<span class="' + direction + '">' +
        (direction === 'out' ? '→ ' : direction === 'in' ? '← ' : '✗ ') + text + '</span>';
      el.prepend(entry);
    }

    function handleHostMessage(event) {
      const { messageId, success, data, error } = event.data;
      const pending = pendingRequests.get(messageId);
      if (!pending) return;
      log('in', (success ? 'OK' : 'ERR') + ' ' + messageId.slice(0, 8) + '…');
      if (success) pending.resolve(data);
      else pending.reject(new Error(error || 'Unknown error'));
      pendingRequests.delete(messageId);
    }

    async function request(action) {
      if (!port) return mockResponse(action);
      return new Promise((resolve, reject) => {
        const messageId = crypto.randomUUID();
        pendingRequests.set(messageId, { resolve, reject });
        log('out', action.type + ' ' + messageId.slice(0, 8) + '…');
        port.postMessage({ messageId, ...action });
        setTimeout(() => {
          if (pendingRequests.has(messageId)) {
            pendingRequests.delete(messageId);
            reject(new Error('Timeout: ' + action.type));
          }
        }, 15000);
      });
    }

    async function mockResponse(action) {
      await new Promise(r => setTimeout(r, 350));
      if (action.type === 'SCRAPE_PAGE')
        return ['[mock] ' + action.payload.selector + ': Example text content'];
      if (action.type === 'PROXY_FETCH')
        return { mock: true, url: action.payload.url, status: 200,
          body: { id: 1, title: 'Mock response', completed: false } };
      return { mock: true };
    }

    // ── INIT_PORT handshake ───────────────────────────────────────────
    window.addEventListener('message', function(event) {
      if (event.data?.type !== 'INIT_PORT') return;
      port = event.ports[0];
      if (!port) return;
      port.onmessage = handleHostMessage;
      connected = true;
      const statusEl = document.getElementById('status');
      statusEl.className = 'badge connected';
      statusEl.textContent = '🔗 Host connected';
      log('in', 'INIT_PORT — MessageChannel established');
    });

    // ── UI wiring ─────────────────────────────────────────────────────
    function setResult(id, text, state) {
      const el = document.getElementById(id);
      el.className = 'result ' + (state || '');
      el.textContent = text;
    }

    document.getElementById('fetchBtn').addEventListener('click', async () => {
      const url = document.getElementById('fetchUrl').value.trim();
      if (!url) return;
      setResult('fetchResult', 'Requesting…', 'loading');
      document.getElementById('fetchBtn').disabled = true;
      try {
        const data = await request({ type: 'PROXY_FETCH', payload: { url } });
        setResult('fetchResult', JSON.stringify(data, null, 2), 'success');
      } catch (e) {
        setResult('fetchResult', e.message, 'error');
      } finally {
        document.getElementById('fetchBtn').disabled = false;
      }
    });

    document.getElementById('scrapeBtn').addEventListener('click', async () => {
      const selector = document.getElementById('selectorInput').value.trim();
      if (!selector) return;
      setResult('scrapeResult', 'Scraping…', 'loading');
      document.getElementById('scrapeBtn').disabled = true;
      try {
        const data = await request({ type: 'SCRAPE_PAGE', payload: { selector } });
        setResult('scrapeResult', Array.isArray(data) ? data.join('\\n') : JSON.stringify(data), 'success');
      } catch (e) {
        setResult('scrapeResult', e.message, 'error');
      } finally {
        document.getElementById('scrapeBtn').disabled = false;
      }
    });

    document.getElementById('clickBtn').addEventListener('click', async () => {
      setResult('automateResult', 'Automating click…', 'loading');
      try {
        await request({ type: 'AUTOMATE', payload: { action: 'CLICK', selector: '#submit' } });
        setResult('automateResult', 'Click dispatched on #submit', 'success');
      } catch (e) {
        setResult('automateResult', e.message, 'error');
      }
    });

    document.getElementById('fillBtn').addEventListener('click', async () => {
      setResult('automateResult', 'Filling input…', 'loading');
      try {
        await request({ type: 'AUTOMATE', payload: { action: 'FILL', selector: '#search', value: 'hello' } });
        setResult('automateResult', 'Filled #search with "hello"', 'success');
      } catch (e) {
        setResult('automateResult', e.message, 'error');
      }
    });

    log('out', 'Spread initialized — awaiting INIT_PORT');
  </script>
</body>
</html>`;

// ─── Host-side mock capability handlers ─────────────────────────────

function useMockCapabilities() {
    const logRef = useRef<Array<{ ts: string; direction: 'in' | 'out'; text: string }>>([]);
    const [log, setLog] = useState<typeof logRef.current>([]);

    const addLog = useCallback(
        (direction: 'in' | 'out', text: string) => {
            const entry = {
                ts: new Date().toLocaleTimeString('en', { hour12: false }),
                direction,
                text,
            };
            logRef.current = [entry, ...logRef.current].slice(0, 50);
            setLog([...logRef.current]);
        },
        [],
    );

    const capabilities: SpreadCapabilities = {
        onProxyFetch: async (url, options) => {
            addLog('in', `PROXY_FETCH ${url}`);
            // Simulate a proxied fetch with mock data
            await new Promise((r) => setTimeout(r, 300));
            const result = {
                ok: true,
                status: 200,
                url,
                method: options?.method ?? 'GET',
                body: {
                    id: 1,
                    title: 'Proxied response (mock)',
                    message: `Host forwarded request to ${url}`,
                    timestamp: new Date().toISOString(),
                },
            };
            addLog('out', `PROXY_FETCH OK → ${JSON.stringify(result).slice(0, 60)}…`);
            return result;
        },

        onScrapePage: async (selector) => {
            addLog('in', `SCRAPE_PAGE selector="${selector}"`);
            await new Promise((r) => setTimeout(r, 200));
            const mockElements = [
                `<${selector}> → "Surdej Developer Tools" (host:mock)`,
                `<${selector}> → "SecureSandbox Demo" (host:mock)`,
            ];
            addLog('out', `SCRAPE_PAGE OK → ${mockElements.length} element(s)`);
            return mockElements;
        },

        onAutomate: async (action, selector, value) => {
            addLog('in', `AUTOMATE ${action} "${selector}"${value ? ` = "${value}"` : ''}`);
            await new Promise((r) => setTimeout(r, 150));
            addLog('out', `AUTOMATE OK → dispatched`);
        },

        onGetAuthToken: async (provider) => {
            addLog('in', `GET_AUTH_TOKEN provider="${provider}"`);
            await new Promise((r) => setTimeout(r, 100));
            const token = `mock-jwt-${provider}-${Date.now()}`;
            addLog('out', `GET_AUTH_TOKEN OK → ${token.slice(0, 24)}…`);
            return token;
        },

        onCallMcpTool: async (toolName, args) => {
            addLog('in', `CALL_MCP_TOOL "${toolName}" args=${JSON.stringify(args)}`);
            await new Promise((r) => setTimeout(r, 250));
            const result = { tool: toolName, result: `Mock output from tool "${toolName}"` };
            addLog('out', `CALL_MCP_TOOL OK → ${JSON.stringify(result).slice(0, 60)}`);
            return result;
        },
    };

    return { capabilities, log };
}

// ─── Page ────────────────────────────────────────────────────────────

export function SpreadSandboxSample() {
    const navigate = useNavigate();
    const { capabilities, log } = useMockCapabilities();

    return (
        <div className="h-full flex flex-col animate-fade-in">
            {/* Header */}
            <div className="mb-6 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => navigate('/developer/samples')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Box className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Spread Sandbox</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Secure micro-app isolation via sandboxed iframe + MessageChannel bridge
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-6 flex-shrink-0" />

            {/* Architecture callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 flex-shrink-0">
                {[
                    {
                        icon: Shield,
                        color: 'text-emerald-500',
                        bg: 'bg-emerald-500/10',
                        title: 'Null Origin Isolation',
                        desc: 'Blob URL sandbox — no cookies, localStorage, or parent DOM access',
                    },
                    {
                        icon: Zap,
                        color: 'text-violet-500',
                        bg: 'bg-violet-500/10',
                        title: 'MessageChannel Bridge',
                        desc: 'Promise-based async bridge with unique messageId correlation',
                    },
                    {
                        icon: Globe,
                        color: 'text-sky-500',
                        bg: 'bg-sky-500/10',
                        title: 'Capability Routing',
                        desc: 'PROXY_FETCH, SCRAPE_PAGE, AUTOMATE, AUTH, MCP tools',
                    },
                ].map(({ icon: Icon, color, bg, title, desc }) => (
                    <Card key={title} className="border-border/50">
                        <CardContent className="p-4 flex gap-3">
                            <div className={`${bg} rounded-lg p-2 h-fit`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold mb-0.5">{title}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main split: sandbox + host log */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                {/* Spread iframe */}
                <Card className="flex flex-col overflow-hidden">
                    <CardHeader className="pb-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">
                                Spread{' '}
                                <Badge variant="secondary" className="text-[10px] ml-1">
                                    sandbox="allow-scripts"
                                </Badge>
                            </CardTitle>
                        </div>
                        <CardDescription className="text-[11px]">
                            Loaded via Blob URL · null origin · isolated MessageChannel
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 min-h-0">
                        <div className="h-full min-h-[480px]">
                            <SecureSandbox
                                appSource={DEMO_SPREAD_HTML}
                                capabilities={capabilities}
                                className="rounded-b-lg"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Host side panel */}
                <div className="flex flex-col gap-4 min-h-0">
                    {/* Capability status */}
                    <Card className="flex-shrink-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-muted-foreground" />
                                Host Capabilities
                            </CardTitle>
                            <CardDescription className="text-[11px]">
                                Mock handlers active — in production these call the extension API
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-1.5">
                                {['PROXY_FETCH', 'SCRAPE_PAGE', 'AUTOMATE', 'GET_AUTH_TOKEN', 'CALL_MCP_TOOL'].map(
                                    (cap) => (
                                        <Badge
                                            key={cap}
                                            variant="secondary"
                                            className="text-[10px] font-mono gap-1"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                            {cap}
                                        </Badge>
                                    ),
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bridge log */}
                    <Card className="flex-1 flex flex-col min-h-0">
                        <CardHeader className="pb-2 flex-shrink-0">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                Host Bridge Log
                            </CardTitle>
                            <CardDescription className="text-[11px]">
                                Capability requests received from the Spread
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-3 min-h-0">
                            {log.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground/60 italic">
                                    No requests yet — interact with the Spread above.
                                </p>
                            ) : (
                                <div className="space-y-0.5">
                                    {log.map((entry, i) => (
                                        <div key={i} className="flex gap-2 text-[11px] font-mono">
                                            <span className="text-muted-foreground/50 shrink-0">
                                                {entry.ts}
                                            </span>
                                            <span
                                                className={
                                                    entry.direction === 'in'
                                                        ? 'text-emerald-400'
                                                        : 'text-sky-400'
                                                }
                                            >
                                                {entry.direction === 'in' ? '← ' : '→ '}
                                            </span>
                                            <span className="text-muted-foreground break-all">
                                                {entry.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Code reference */}
                    <Card className="flex-shrink-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Code2 className="h-4 w-4 text-muted-foreground" />
                                Integration Reference
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <pre className="text-[10px] bg-muted/40 rounded-md p-3 overflow-x-auto text-muted-foreground leading-relaxed">
{`// Host — load a Spread
import { SecureSandbox } from '@/core/spread';

<SecureSandbox
  appSource={spreadHtmlBundle}
  capabilities={{
    onProxyFetch: (url, opts) => extensionAPI.fetch(url, opts),
    onScrapePage: (sel) => bridge.querySelector(sel),
  }}
/>

// Spread — use capabilities
import { useSurdej } from '@surdej/spread-sdk';

const client = useSurdej();
const data = await client.request({
  type: 'PROXY_FETCH',
  payload: { url: 'https://api.example.com/data' },
});`}
                            </pre>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
