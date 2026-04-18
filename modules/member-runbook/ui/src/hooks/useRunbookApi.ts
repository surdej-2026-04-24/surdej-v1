/**
 * Hook: useRunbookApi
 *
 * Fetch helper that routes through the core API gateway.
 * All requests go to `/api/module/member-runbook/...`.
 */

import {
    MODULE_NAME,
    RunbookListResponseSchema,
    RunbookSchema,
    FlyerLayoutListResponseSchema,
    type Runbook,
    type RunbookListResponse,
    type FlyerLayoutListResponse,
    type CreateRunbook,
    type UpdateRunbook,
} from '@surdej/module-member-runbook-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export function useRunbookApi() {
    return {
        // ── Runbooks ───────────────────────────────────────────

        /** List runbooks with pagination, filter by prefix/status/tag */
        async listRunbooks(opts?: {
            page?: number;
            pageSize?: number;
            prefix?: string;
            status?: string;
            tag?: string;
            search?: string;
        }): Promise<RunbookListResponse> {
            const params = new URLSearchParams();
            if (opts?.page) params.set('page', String(opts.page));
            if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
            if (opts?.prefix) params.set('prefix', opts.prefix);
            if (opts?.status) params.set('status', opts.status);
            if (opts?.tag) params.set('tag', opts.tag);
            if (opts?.search) params.set('search', opts.search);
            const q = params.toString();
            const data = await fetchJson(`${BASE}/runbooks${q ? `?${q}` : ''}`);
            return RunbookListResponseSchema.parse(data);
        },

        /** Get a single runbook by ID */
        async getRunbook(id: string): Promise<Runbook> {
            const data = await fetchJson(`${BASE}/runbooks/${id}`);
            return RunbookSchema.parse(data);
        },

        /** Get a runbook by its slug */
        async getRunbookBySlug(slug: string): Promise<Runbook> {
            const data = await fetchJson(`${BASE}/runbooks/slug/${slug}`);
            return RunbookSchema.parse(data);
        },

        /** Create a new runbook */
        async createRunbook(input: CreateRunbook): Promise<Runbook> {
            const data = await fetchJson(`${BASE}/runbooks`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return RunbookSchema.parse(data);
        },

        /** Update a runbook */
        async updateRunbook(id: string, input: UpdateRunbook): Promise<Runbook> {
            const data = await fetchJson(`${BASE}/runbooks/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return RunbookSchema.parse(data);
        },

        /** Delete a runbook */
        async deleteRunbook(id: string): Promise<void> {
            await fetchJson(`${BASE}/runbooks/${id}`, { method: 'DELETE' });
        },

        // ── Flyer ──────────────────────────────────────────────

        /** Get the flyer HTML for a runbook (returns URL to open in new tab) */
        getFlyerUrl(id: string, layoutId?: string): string {
            const params = layoutId ? `?layoutId=${layoutId}` : '';
            return `${BASE}/runbooks/${id}/flyer${params}`;
        },

        // ── Layouts ────────────────────────────────────────────

        /** List all flyer layouts */
        async listLayouts(): Promise<FlyerLayoutListResponse> {
            const data = await fetchJson(`${BASE}/layouts`);
            return FlyerLayoutListResponseSchema.parse(data);
        },

        // ── Import ─────────────────────────────────────────────

        /** Import runbooks from .surdej/agents/workflows/ */
        async importFromAgents(): Promise<{ imported: string[]; skipped: string[]; total: number }> {
            return fetchJson(`${BASE}/runbooks/import-from-agents`, { method: 'POST' });
        },
    };
}
