/**
 * SurdejMixinClient — Async MessageChannel Bridge for Iframe Mixins
 *
 * Used inside an iframe mixin tool to communicate with the Surdej host.
 * Establishes a secure handshake, then provides typed methods for:
 *   - Page content bridge (read/write depending on permissions)
 *   - NoSQL API (read/write depending on permissions)
 *   - Mixin KV store (read/write depending on permissions)
 *
 * Usage:
 *   const client = new SurdejMixinClient();
 *   await client.connect();
 *   const pageInfo = await client.bridge.getPageInfo();
 */

import type {
    MixinAction,
    MixinResponse,
    MixinPermission,
    MixinContext,
    HandshakeInit,
    HandshakeAck,
} from './types';

const REQUEST_TIMEOUT_MS = 15_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;

export class SurdejMixinClient {
    private port: MessagePort | null = null;
    private pendingRequests = new Map<
        string,
        { resolve: (val: unknown) => void; reject: (err: Error) => void }
    >();
    private _connected = false;
    private _context: MixinContext | null = null;
    private _permissions: MixinPermission[] = [];
    private _onConnectCallbacks: Array<() => void> = [];

    get connected(): boolean {
        return this._connected;
    }

    get context(): MixinContext | null {
        return this._context;
    }

    get permissions(): MixinPermission[] {
        return this._permissions;
    }

    /**
     * Wait for the Surdej host to initiate the handshake.
     * Call this once in your app's startup.
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('[SurdejMixinClient] Handshake timeout — not running inside Surdej host?'));
            }, HANDSHAKE_TIMEOUT_MS);

            const handler = (event: MessageEvent) => {
                const data = event.data as HandshakeAck;
                if (data?.type !== 'SURDEJ_MIXIN_ACK') return;

                window.removeEventListener('message', handler);
                clearTimeout(timer);

                if (!data.success) {
                    reject(new Error(data.error ?? 'Handshake rejected by host'));
                    return;
                }

                const port = event.ports[0];
                if (!port) {
                    reject(new Error('No MessagePort received in handshake'));
                    return;
                }

                this.port = port;
                this.port.onmessage = this.handleHostMessage.bind(this);
                this._connected = true;
                this._permissions = data.permissions;
                this._context = data.context ?? null;
                this._onConnectCallbacks.forEach(cb => cb());
                this._onConnectCallbacks = [];
                resolve();
            };

            window.addEventListener('message', handler);

            // Notify the host we're ready for handshake
            window.parent.postMessage(
                { type: 'SURDEJ_MIXIN_READY' } satisfies { type: string },
                '*',
            );
        });
    }

    /** Register a callback for when connection is established */
    onConnect(callback: () => void): void {
        if (this._connected) {
            callback();
        } else {
            this._onConnectCallbacks.push(callback);
        }
    }

    private handleHostMessage(event: MessageEvent<MixinResponse>): void {
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

    /** Send a typed action to the Surdej host and await the response. */
    async request<T = unknown>(action: MixinAction): Promise<T> {
        if (!this.port || !this._connected) {
            throw new Error('[SurdejMixinClient] Not connected. Call connect() first.');
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
                    reject(new Error(`[SurdejMixinClient] Timeout for action: ${action.type}`));
                }
            }, REQUEST_TIMEOUT_MS);
        });
    }

    // ─── Bridge helpers ─────────────────────────────────────────

    bridge = {
        getPageInfo: () => this.request<{ url: string; title: string; description?: string }>(
            { type: 'BRIDGE_GET_PAGE_INFO' },
        ),
        getPageText: () => this.request<string>({ type: 'BRIDGE_GET_PAGE_TEXT' }),
        getSelection: () => this.request<string>({ type: 'BRIDGE_GET_SELECTION' }),
        getSnapshot: () => this.request<unknown>({ type: 'BRIDGE_GET_SNAPSHOT' }),
        querySelector: (selector: string) =>
            this.request<unknown>({ type: 'BRIDGE_QUERY_SELECTOR', payload: { selector } }),
        querySelectorAll: (selector: string) =>
            this.request<unknown>({ type: 'BRIDGE_QUERY_SELECTOR_ALL', payload: { selector } }),
        click: (selector: string) =>
            this.request<void>({ type: 'BRIDGE_CLICK', payload: { selector } }),
        fill: (selector: string, value: string) =>
            this.request<void>({ type: 'BRIDGE_FILL', payload: { selector, value } }),
        fetchPage: (url: string) =>
            this.request<unknown>({ type: 'BRIDGE_FETCH_PAGE', payload: { url } }),
    };

    // ─── NoSQL helpers ──────────────────────────────────────────

    nosql = {
        listCollections: (parentId?: string) =>
            this.request<unknown>({ type: 'NOSQL_LIST_COLLECTIONS', payload: { parentId } }),
        getCollection: (id: string) =>
            this.request<unknown>({ type: 'NOSQL_GET_COLLECTION', payload: { id } }),
        listDocuments: (collectionId: string, limit?: number, offset?: number) =>
            this.request<unknown>({
                type: 'NOSQL_LIST_DOCUMENTS',
                payload: { collectionId, limit, offset },
            }),
        getDocument: (id: string) =>
            this.request<unknown>({ type: 'NOSQL_GET_DOCUMENT', payload: { id } }),
        createCollection: (name: string, slug: string, opts?: { description?: string; parentId?: string }) =>
            this.request<unknown>({
                type: 'NOSQL_CREATE_COLLECTION',
                payload: { name, slug, ...opts },
            }),
        createDocument: (collectionId: string, data: unknown) =>
            this.request<unknown>({ type: 'NOSQL_CREATE_DOCUMENT', payload: { collectionId, data } }),
        updateDocument: (id: string, data: unknown) =>
            this.request<unknown>({ type: 'NOSQL_UPDATE_DOCUMENT', payload: { id, data } }),
        deleteDocument: (id: string) =>
            this.request<void>({ type: 'NOSQL_DELETE_DOCUMENT', payload: { id } }),
    };

    // ─── KV helpers ─────────────────────────────────────────────

    kv = {
        get: <T = unknown>(key: string) =>
            this.request<T>({ type: 'KV_GET', payload: { key } }),
        list: (prefix?: string) =>
            this.request<Array<{ key: string; value: unknown }>>({ type: 'KV_LIST', payload: { prefix } }),
        set: (key: string, value: unknown) =>
            this.request<void>({ type: 'KV_SET', payload: { key, value } }),
        delete: (key: string) =>
            this.request<void>({ type: 'KV_DELETE', payload: { key } }),
    };

    // ─── Meta helpers ───────────────────────────────────────────

    getContext(): Promise<MixinContext> {
        return this.request<MixinContext>({ type: 'GET_CONTEXT' });
    }

    ping(): Promise<'pong'> {
        return this.request<'pong'>({ type: 'PING' });
    }
}
