/**
 * SurdejClient — Async MessageChannel Bridge
 *
 * Used inside a Spread (sandboxed micro-app) to communicate with the
 * Surdej host. Wraps postMessage fire-and-forget into typed Promises
 * using unique messageId correlation.
 *
 * When no MessagePort is provided (localhost dev mode), falls back to
 * mock responses so the Spread can be developed and tested in isolation.
 */

import type { SurdejAction, HostResponse } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

export class SurdejClient {
    private port: MessagePort | null = null;
    private pendingRequests = new Map<
        string,
        { resolve: (val: unknown) => void; reject: (err: Error) => void }
    >();

    constructor(port?: MessagePort) {
        if (port) {
            this.port = port;
            this.port.onmessage = this.handleHostMessage.bind(this);
        } else {
            console.warn('[SurdejClient] Running in MOCK mode (no host port provided).');
        }
    }

    private handleHostMessage(event: MessageEvent<HostResponse>): void {
        const { messageId, success, data, error } = event.data;
        const pending = this.pendingRequests.get(messageId);
        if (!pending) return;

        if (success) {
            pending.resolve(data);
        } else {
            pending.reject(new Error(error ?? 'Unknown error from host'));
        }
        this.pendingRequests.delete(messageId);
    }

    /**
     * Send a typed action to the Surdej host and await the response.
     * Falls back to mockHandler when not connected to a host port.
     */
    public async request<T = unknown>(action: SurdejAction): Promise<T> {
        if (!this.port) {
            return this.mockHandler<T>(action);
        }

        return new Promise<T>((resolve, reject) => {
            const messageId = crypto.randomUUID();

            this.pendingRequests.set(messageId, {
                resolve: resolve as (val: unknown) => void,
                reject,
            });

            this.port!.postMessage({ messageId, ...action });

            setTimeout(() => {
                if (this.pendingRequests.has(messageId)) {
                    this.pendingRequests.delete(messageId);
                    reject(new Error(`[SurdejClient] Host timeout for action: ${action.type}`));
                }
            }, REQUEST_TIMEOUT_MS);
        });
    }

    // ─── Mock handlers for localhost development ─────────────────────

    private async mockHandler<T>(action: SurdejAction): Promise<T> {
        await new Promise((res) => setTimeout(res, 400));

        switch (action.type) {
            case 'SCRAPE_PAGE':
                return [
                    `[mock] Element matching "${action.payload.selector}": Example Product — $19.99`,
                ] as unknown as T;

            case 'PROXY_FETCH':
                return {
                    ok: true,
                    status: 200,
                    body: { mock: true, url: action.payload.url, message: 'Mock proxied response' },
                } as unknown as T;

            case 'AUTOMATE':
                return undefined as unknown as T;

            case 'GET_AUTH_TOKEN':
                return `mock-token-for-${action.payload.provider}` as unknown as T;

            case 'CALL_MCP_TOOL':
                return {
                    tool: action.payload.toolName,
                    result: `[mock] Tool "${action.payload.toolName}" executed with args: ${JSON.stringify(action.payload.args)}`,
                } as unknown as T;

            default:
                throw new Error(`[SurdejClient] Unknown action type`);
        }
    }

    /** Whether this client is connected to a real host port */
    public get isConnected(): boolean {
        return this.port !== null;
    }
}
