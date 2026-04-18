import {
    MODULE_NAME,
    IssueSchema,
    PaginatedIssueListSchema,
    CommentSchema,
    LabelSchema,
    type Issue,
    type CreateIssue,
    type UpdateIssue,
    type PaginatedIssueList,
    type IssueFilter,
    type Comment,
    type CreateComment,
    type Label,
    type CreateLabel,
    type UpdateLabel,
    type AssignIssue,
} from '@surdej/module-core-issues-shared';
import { z } from 'zod';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useIssueApi() {
    return {
        // Issues
        list: async (filter?: Partial<IssueFilter>): Promise<PaginatedIssueList> => {
            const params = new URLSearchParams();
            if (filter) {
                Object.entries(filter).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) params.set(k, String(v));
                });
            }
            const qs = params.toString();
            const data = await request<unknown>(`/${qs ? `?${qs}` : ''}`);
            return PaginatedIssueListSchema.parse(data);
        },
        get: async (id: string): Promise<Issue> => {
            const data = await request<unknown>(`/${id}`);
            return IssueSchema.parse(data);
        },
        create: async (input: CreateIssue): Promise<Issue> => {
            const data = await request<unknown>('/', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return IssueSchema.parse(data);
        },
        update: async (id: string, input: UpdateIssue): Promise<Issue> => {
            const data = await request<unknown>(`/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return IssueSchema.parse(data);
        },
        archive: async (id: string): Promise<void> => {
            await request(`/${id}`, { method: 'DELETE' });
        },
        restore: async (id: string): Promise<Issue> => {
            const data = await request<unknown>(`/${id}/restore`, { method: 'POST' });
            return IssueSchema.parse(data);
        },
        assign: async (id: string, input: AssignIssue): Promise<Issue> => {
            const data = await request<unknown>(`/${id}/assign`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return IssueSchema.parse(data);
        },

        // Comments
        listComments: async (issueId: string): Promise<{ items: Comment[]; total: number }> => {
            const data = await request<unknown>(`/${issueId}/comments`);
            return z.object({ items: z.array(CommentSchema), total: z.number() }).parse(data);
        },
        createComment: async (issueId: string, input: Omit<CreateComment, 'issueId'>): Promise<Comment> => {
            const data = await request<unknown>(`/${issueId}/comments`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return CommentSchema.parse(data);
        },

        // Labels
        listLabels: async (): Promise<{ items: Label[]; total: number }> => {
            const data = await request<unknown>('/labels');
            return z.object({ items: z.array(LabelSchema), total: z.number() }).parse(data);
        },
        createLabel: async (input: CreateLabel): Promise<Label> => {
            const data = await request<unknown>('/labels', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return LabelSchema.parse(data);
        },
        updateLabel: async (id: string, input: UpdateLabel): Promise<Label> => {
            const data = await request<unknown>(`/labels/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return LabelSchema.parse(data);
        },
        deleteLabel: async (id: string): Promise<void> => {
            await request(`/labels/${id}`, { method: 'DELETE' });
        },

        // History
        getHistory: async (issueId: string) => {
            return request<{ items: unknown[]; total: number }>(`/${issueId}/history`);
        },
    };
}
