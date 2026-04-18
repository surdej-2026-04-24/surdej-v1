/**
 * Hook: useModuleApi
 *
 * Fetch helper that routes through the core API gateway.
 * All requests go to `/api/module/member-example/...`.
 */

import {
    MODULE_NAME,
    ExampleItemListResponseSchema,
    ExampleItemSchema,
    type ExampleItem,
    type ExampleItemListResponse,
    type CreateExampleItem,
    type UpdateExampleItem,
} from '@surdej/module-member-example-shared';

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

export function useModuleApi() {
    return {
        /** List items with pagination. */
        async list(page = 1, pageSize = 20): Promise<ExampleItemListResponse> {
            const data = await fetchJson(`${BASE}?page=${page}&pageSize=${pageSize}`);
            return ExampleItemListResponseSchema.parse(data);
        },

        /** Get a single item by ID. */
        async get(id: string): Promise<ExampleItem> {
            const data = await fetchJson(`${BASE}/${id}`);
            return ExampleItemSchema.parse(data);
        },

        /** Create a new item. */
        async create(input: CreateExampleItem): Promise<ExampleItem> {
            const data = await fetchJson(BASE, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return ExampleItemSchema.parse(data);
        },

        /** Update an existing item. */
        async update(id: string, input: UpdateExampleItem): Promise<ExampleItem> {
            const data = await fetchJson(`${BASE}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return ExampleItemSchema.parse(data);
        },

        /** Delete an item. */
        async remove(id: string): Promise<void> {
            await fetchJson(`${BASE}/${id}`, { method: 'DELETE' });
        },
    };
}
