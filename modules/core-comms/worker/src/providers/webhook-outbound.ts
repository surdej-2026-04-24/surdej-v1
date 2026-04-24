export interface OutboundWebhookMessage {
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    payload: Record<string, unknown>;
}

export interface WebhookResult {
    success: boolean;
    statusCode?: number;
    error?: string;
    response?: Record<string, unknown>;
}

export async function sendWebhook(msg: OutboundWebhookMessage): Promise<WebhookResult> {
    try {
        const res = await fetch(msg.url, {
            method: msg.method ?? 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...msg.headers,
            },
            body: JSON.stringify(msg.payload),
            signal: AbortSignal.timeout(30_000),
        });

        const statusCode = res.status;

        if (res.ok) {
            let responseBody: Record<string, unknown> = {};
            try {
                responseBody = (await res.json()) as Record<string, unknown>;
            } catch {
                // response may not be JSON
            }
            return { success: true, statusCode, response: responseBody };
        }

        const errorBody = await res.text();
        return {
            success: false,
            statusCode,
            error: `Webhook returned ${statusCode}: ${errorBody}`,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown webhook error',
        };
    }
}
