/**
 * API Tracer Store
 *
 * Intercepts all fetch() calls to /api/* endpoints and records them
 * for display in the Tracer Panel. Uses a Zustand store for state.
 *
 * The tracer can be toggled on/off from the footer.
 * When enabled, it captures method, URL, status, duration, request/response bodies.
 */

import { create } from 'zustand';

export interface TracedRequest {
    id: string;
    method: string;
    url: string;
    /** Relative path (e.g. /health) */
    path: string;
    status: number | null;
    statusText: string;
    /** Duration in ms */
    duration: number;
    timestamp: number;
    /** Request headers sent */
    requestHeaders?: Record<string, string>;
    /** Request body (if JSON) */
    requestBody?: unknown;
    /** Response headers received */
    responseHeaders?: Record<string, string>;
    /** Response body (if JSON) */
    responseBody?: unknown;
    /** The browser page URL at the time of the request */
    pageUrl?: string;
    /** Error message if fetch itself failed */
    error?: string;
    /** Whether the request is still in-flight */
    pending: boolean;
}

interface TracerState {
    /** Whether the tracer is enabled (intercepting calls) */
    enabled: boolean;
    /** Whether the tracer panel is open */
    panelOpen: boolean;
    /** List of traced requests (newest first) */
    requests: TracedRequest[];
    /** Max requests to keep */
    maxRequests: number;

    toggleEnabled: () => void;
    togglePanel: () => void;
    setPanelOpen: (open: boolean) => void;
    addRequest: (req: TracedRequest) => void;
    updateRequest: (id: string, updates: Partial<TracedRequest>) => void;
    clearRequests: () => void;
}

export const useTracerStore = create<TracerState>((set) => ({
    enabled: true,
    panelOpen: false,
    requests: [],
    maxRequests: 100,

    toggleEnabled: () => set((s) => {
        const next = !s.enabled;
        // Auto-open panel when enabling
        return { enabled: next, panelOpen: next ? true : s.panelOpen };
    }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    setPanelOpen: (open) => set({ panelOpen: open }),
    addRequest: (req) =>
        set((s) => ({
            requests: [req, ...s.requests].slice(0, s.maxRequests),
        })),
    updateRequest: (id, updates) =>
        set((s) => ({
            requests: s.requests.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
    clearRequests: () => set({ requests: [] }),
}));

// ─── Fetch Interceptor ─────────────────────────────────────────

let interceptorInstalled = false;
const originalFetch = window.fetch.bind(window);

export function installTracerInterceptor() {
    if (interceptorInstalled) return;
    interceptorInstalled = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const store = useTracerStore.getState();

        // Determine URL string
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : input instanceof Request
                    ? input.url
                    : String(input);

        // Only trace /api calls
        if (!store.enabled || !url.includes('/api')) {
            return originalFetch(input, init);
        }

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const method = init?.method?.toUpperCase() ?? 'GET';
        const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
        const startTime = performance.now();

        // Parse request body if present
        let requestBody: unknown;
        if (init?.body && typeof init.body === 'string') {
            try { requestBody = JSON.parse(init.body); } catch { requestBody = init.body; }
        }

        // Capture request headers
        const requestHeaders: Record<string, string> = {};
        if (init?.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((v, k) => { requestHeaders[k] = v; });
            } else if (Array.isArray(init.headers)) {
                init.headers.forEach(([k, v]) => { requestHeaders[k] = v; });
            } else {
                Object.entries(init.headers).forEach(([k, v]) => { if (v) requestHeaders[k] = v; });
            }
        }

        // Add pending request
        store.addRequest({
            id,
            method,
            url,
            path,
            status: null,
            statusText: '',
            duration: 0,
            timestamp: Date.now(),
            pageUrl: window.location.href,
            requestHeaders,
            requestBody,
            pending: true,
        });

        try {
            const res = await originalFetch(input, init);
            const duration = Math.round(performance.now() - startTime);

            // Clone response to read body without consuming it
            const cloned = res.clone();
            let responseBody: unknown;
            try {
                const text = await cloned.text();
                try { responseBody = JSON.parse(text); } catch { responseBody = text; }
            } catch {
                responseBody = '[unable to read body]';
            }

            // Capture response headers
            const responseHeaders: Record<string, string> = {};
            res.headers.forEach((v, k) => { responseHeaders[k] = v; });

            useTracerStore.getState().updateRequest(id, {
                status: res.status,
                statusText: res.statusText,
                duration,
                responseHeaders,
                responseBody,
                pending: false,
            });

            return res;
        } catch (err) {
            const duration = Math.round(performance.now() - startTime);
            useTracerStore.getState().updateRequest(id, {
                status: 0,
                statusText: 'Network Error',
                duration,
                error: err instanceof Error ? err.message : String(err),
                pending: false,
            });
            throw err;
        }
    };
}
