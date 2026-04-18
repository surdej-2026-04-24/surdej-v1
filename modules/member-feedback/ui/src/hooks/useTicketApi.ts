import {
    MODULE_NAME,
    TicketSchema,
    TicketListResponseSchema,
    type Ticket,
    type CreateTicket,
    type UpdateTicket,
    type TransitionTicket,
    type CreateComment,
    type TicketComment,
    type TicketTransition,
    type TicketListResponse,
} from '@surdej/module-member-feedback-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useTicketApi() {
    return {
        list: async (filters?: Record<string, string>): Promise<TicketListResponse> => {
            const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
            const data = await request<unknown>(`/tickets${qs}`);
            return data as TicketListResponse;
        },
        get: async (id: string): Promise<Ticket> => {
            const data = await request<unknown>(`/tickets/${id}`);
            return data as Ticket;
        },
        create: async (input: CreateTicket): Promise<Ticket> => {
            const data = await request<unknown>('/tickets', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return data as Ticket;
        },
        update: async (id: string, input: UpdateTicket): Promise<Ticket> => {
            const data = await request<unknown>(`/tickets/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return data as Ticket;
        },
        transition: async (id: string, input: TransitionTicket): Promise<Ticket> => {
            const data = await request<unknown>(`/tickets/${id}/transition`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return data as Ticket;
        },
        addComment: async (id: string, input: CreateComment): Promise<TicketComment> => {
            const data = await request<unknown>(`/tickets/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return data as TicketComment;
        },
        getComments: async (id: string): Promise<TicketComment[]> => {
            return request<TicketComment[]>(`/tickets/${id}/comments`);
        },
        getTransitions: async (id: string): Promise<TicketTransition[]> => {
            return request<TicketTransition[]>(`/tickets/${id}/transitions`);
        },
        getCustomerView: async (id: string) => {
            return request<unknown>(`/tickets/${id}/customer`);
        },
        getStats: async () => {
            return request<unknown>('/stats');
        },
    };
}
