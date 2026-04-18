import { MODULE_NAME } from '@surdej/module-member-nosql-shared';
import type {
    Collection,
    CreateCollection,
    UpdateCollection,
    Document,
    CreateDocument,
    UpdateDocument,
    DocumentVersion,
} from '@surdej/module-member-nosql-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useNosqlApi() {
    return {
        // ─── Collections ──────────────────────────────────────────
        listCollections: async (opts?: { parentId?: string; tenantId?: string }) => {
            const qs = new URLSearchParams();
            if (opts?.parentId) qs.set('parentId', opts.parentId);
            if (opts?.tenantId) qs.set('tenantId', opts.tenantId);
            return request<{ items: Collection[]; total: number }>(`/collections?${qs}`);
        },

        getCollectionTree: async (tenantId?: string) => {
            const qs = tenantId ? `?tenantId=${tenantId}` : '';
            return request<Collection[]>(`/collections/tree${qs}`);
        },

        getCollection: async (id: string) => {
            return request<Collection>(`/collections/${id}`);
        },

        createCollection: async (input: CreateCollection, opts?: { tenantId?: string; userId?: string }) => {
            const qs = new URLSearchParams();
            if (opts?.tenantId) qs.set('tenantId', opts.tenantId);
            if (opts?.userId) qs.set('userId', opts.userId);
            return request<Collection>(`/collections?${qs}`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        updateCollection: async (id: string, input: UpdateCollection, opts?: { userId?: string }) => {
            const qs = opts?.userId ? `?userId=${opts.userId}` : '';
            return request<Collection>(`/collections/${id}${qs}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
        },

        deleteCollection: async (id: string) => {
            await fetch(`${BASE}/collections/${id}`, { method: 'DELETE' });
        },

        // ─── Documents ────────────────────────────────────────────
        listDocuments: async (
            collectionId: string,
            opts?: { tenantId?: string; limit?: number; offset?: number; includeDeleted?: boolean }
        ) => {
            const qs = new URLSearchParams();
            if (opts?.tenantId) qs.set('tenantId', opts.tenantId);
            if (opts?.limit) qs.set('limit', String(opts.limit));
            if (opts?.offset) qs.set('offset', String(opts.offset));
            if (opts?.includeDeleted) qs.set('includeDeleted', 'true');
            return request<{ items: Document[]; total: number; limit: number; offset: number }>(
                `/collections/${collectionId}/documents?${qs}`
            );
        },

        getDocument: async (id: string) => {
            return request<Document>(`/documents/${id}`);
        },

        createDocument: async (
            collectionId: string,
            input: CreateDocument,
            opts?: { tenantId?: string; userId?: string }
        ) => {
            const qs = new URLSearchParams();
            if (opts?.tenantId) qs.set('tenantId', opts.tenantId);
            if (opts?.userId) qs.set('userId', opts.userId);
            return request<Document>(`/collections/${collectionId}/documents?${qs}`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        updateDocument: async (id: string, input: UpdateDocument, opts?: { userId?: string }) => {
            const qs = opts?.userId ? `?userId=${opts.userId}` : '';
            return request<Document>(`/documents/${id}${qs}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
        },

        deleteDocument: async (id: string) => {
            await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' });
        },

        restoreDocument: async (id: string) => {
            return request<Document>(`/documents/${id}/restore`, { method: 'POST' });
        },

        // ─── Versions ─────────────────────────────────────────────
        getDocumentVersions: async (id: string) => {
            return request<{ documentId: string; currentVersion: number; versions: DocumentVersion[] }>(
                `/documents/${id}/versions`
            );
        },

        getDocumentVersion: async (id: string, version: number) => {
            return request<DocumentVersion & { isCurrent: boolean }>(`/documents/${id}/versions/${version}`);
        },

        restoreDocumentVersion: async (id: string, version: number, opts?: { userId?: string }) => {
            const qs = opts?.userId ? `?userId=${opts.userId}` : '';
            return request<Document>(`/documents/${id}/versions/${version}/restore${qs}`, { method: 'POST' });
        },

        // ─── Admin ────────────────────────────────────────────────
        getAdminStats: async (tenantId?: string) => {
            const qs = tenantId ? `?tenantId=${tenantId}` : '';
            return request<{
                tenantId: string;
                totalCollections: number;
                stats: Array<{
                    collectionId: string;
                    collectionName: string;
                    collectionSlug: string;
                    documentCount: number;
                    activeDocumentCount: number;
                    deletedDocumentCount: number;
                    latestUpdatedAt: string | null;
                }>;
                generatedAt: string;
            }>(`/admin/stats${qs}`);
        },
    };
}
