import {
    MODULE_NAME,
    CommunicationSchema,
    CommunicationListResponseSchema,
    type Communication,
    type CommunicationListResponse,
    type SendEmail,
    type SendSms,
    type SendWebhook,
} from '@surdej/module-core-comms-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useCommsApi() {
    return {
        // ─── Communications Log ────────────────────────────────
        listCommunications: async (params?: Record<string, string>): Promise<CommunicationListResponse> => {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            const data = await request<unknown>(`/communications${qs}`);
            return CommunicationListResponseSchema.parse(data);
        },

        getCommunication: async (id: string): Promise<Communication> => {
            const data = await request<unknown>(`/communications/${id}`);
            return CommunicationSchema.parse(data);
        },

        // ─── Send Operations ───────────────────────────────────
        sendEmail: async (input: SendEmail): Promise<{ communicationId: string; status: string }> => {
            return request('/send/email', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        sendSms: async (input: SendSms): Promise<{ communicationId: string; status: string }> => {
            return request('/send/sms', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        sendWebhook: async (input: SendWebhook): Promise<{ communicationId: string; status: string }> => {
            return request('/send/webhook', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        // ─── Webhook Endpoints ─────────────────────────────────
        listWebhookEndpoints: async () => {
            return request<{ items: unknown[]; total: number }>('/webhooks/endpoints');
        },

        createWebhookEndpoint: async (input: { name: string; description?: string; secret?: string }) => {
            return request('/webhooks/endpoints', {
                method: 'POST',
                body: JSON.stringify(input),
            });
        },

        deleteWebhookEndpoint: async (id: string) => {
            return request(`/webhooks/endpoints/${id}`, { method: 'DELETE' });
        },

        // ─── Webhook Events ────────────────────────────────────
        listWebhookEvents: async (params?: Record<string, string>) => {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            return request<{ items: unknown[]; total: number }>(`/webhooks/events${qs}`);
        },
    };
}
