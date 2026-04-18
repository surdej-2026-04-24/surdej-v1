/**
 * API Client
 *
 * Base URL resolution priority:
 *   1. ?api=<url> query parameter (persisted to sessionStorage)
 *   2. sessionStorage 'surdej_api_url' (from a previous ?api= visit)
 *   3. VITE_API_URL env variable (baked in at build time)
 *   4. '/api' fallback (same-origin proxy)
 *
 * All callers use paths relative to the base, e.g. api.get('/auth/me').
 *
 * Tenant isolation:
 *   - Every request sends X-Tenant-Id when a tenant is active.
 *   - switchTenant() bumps the version counter, causing components to re-fetch.
 */

const SESSION_KEY = 'surdej_api_url';

function resolveApiBaseUrl(): string {
    // 1. Check query parameter
    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('api');
        if (fromQuery) {
            sessionStorage.setItem(SESSION_KEY, fromQuery);
            // Clean the URL so the param doesn't linger
            const url = new URL(window.location.href);
            url.searchParams.delete('api');
            window.history.replaceState({}, '', url.toString());
            return fromQuery;
        }
    } catch {
        // SSR or no window — fall through
    }

    // 2. Check sessionStorage
    try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) return stored;
    } catch {
        // sessionStorage unavailable — fall through
    }

    // 3. Build-time env / fallback
    return import.meta.env.VITE_API_URL || '/api';
}

/** Mutable BASE_URL — read via getBaseUrl() for live value */
export let BASE_URL = resolveApiBaseUrl();

/** Get the current API base URL (always reflects the latest switch) */
export function getBaseUrl(): string {
    return BASE_URL;
}

/**
 * Known API endpoints from surdej.yaml — shown in footer selector for SUPER_ADMIN.
 * These are hardcoded from the manifest so no API call is needed.
 */
export const KNOWN_API_ENDPOINTS: { label: string; url: string }[] = [
    { label: 'Local Dev', url: 'http://localhost:5001/api' },
];

/** Event name dispatched when the API endpoint changes */
export const API_ENDPOINT_CHANGED_EVENT = 'surdej:api-endpoint-changed';

/**
 * Switch the API base URL at runtime.
 * Persists to sessionStorage, updates the live BASE_URL, and fires a custom event.
 * Callers should reload auth state after switching.
 */
export function switchApiEndpoint(newUrl: string): void {
    // Normalize: remove trailing slash
    const url = newUrl.replace(/\/+$/, '');
    sessionStorage.setItem(SESSION_KEY, url);
    BASE_URL = url;
    window.dispatchEvent(new CustomEvent(API_ENDPOINT_CHANGED_EVENT, { detail: { url } }));
}

/** Clear the custom endpoint, reverting to the build-time default */
export function clearApiEndpoint(): void {
    sessionStorage.removeItem(SESSION_KEY);
    BASE_URL = import.meta.env.VITE_API_URL || '/api';
    window.dispatchEvent(new CustomEvent(API_ENDPOINT_CHANGED_EVENT, { detail: { url: BASE_URL } }));
}

class ApiClient {
    private token: string | null = null;
    private _tenantId: string | null = null;

    /** Monotonically increasing counter — bumped on tenant switch.
     *  Components can include this in useEffect deps to re-fetch. */
    tenantVersion = 0;

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    /** Called by TenantContext when active tenant changes */
    setTenantId(tenantId: string | null) {
        if (this._tenantId !== tenantId) {
            this._tenantId = tenantId;
            this.tenantVersion++;
        }
    }

    getTenantId(): string | null {
        return this._tenantId;
    }

    private headers(): HeadersInit {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        if (this._tenantId) h['X-Tenant-Id'] = this._tenantId;
        return h;
    }

    private headersNoBody(): HeadersInit {
        const h: Record<string, string> = {};
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        if (this._tenantId) h['X-Tenant-Id'] = this._tenantId;
        return h;
    }

    private opts(): RequestInit {
        // Include credentials for cross-origin cookie/token scenarios
        return { credentials: 'include' as const };
    }

    async get<T>(path: string): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: this.headers(),
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }

    async post<T>(path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: body !== undefined ? this.headers() : this.headersNoBody(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }

    async put<T>(path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: body !== undefined ? this.headers() : this.headersNoBody(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }

    async patch<T>(path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'PATCH',
            headers: body !== undefined ? this.headers() : this.headersNoBody(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }

    async del<T>(path: string): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: this.headersNoBody(),
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }

    /** GET that returns raw text (e.g. YAML download) */
    async getRaw(path: string): Promise<string> {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: this.headers(),
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.text();
    }

    /** POST with JSON body, returns JSON (for import endpoints) */
    async postJson<T>(path: string, body: unknown): Promise<T> {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
            ...this.opts(),
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        return res.json();
    }
}

export class ApiError extends Error {
    constructor(public status: number, public body: string) {
        super(`API ${status}: ${body}`);
        this.name = 'ApiError';
    }
}

export const api = new ApiClient();
