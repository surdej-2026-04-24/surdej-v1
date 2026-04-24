const SMSGATE_BASE_URL = process.env.SMSGATE_BASE_URL ?? '';
const SMSGATE_USERNAME = process.env.SMSGATE_USERNAME ?? '';
const SMSGATE_PASSWORD = process.env.SMSGATE_PASSWORD ?? '';
const SMSGATE_DEVICE_ID = process.env.SMSGATE_DEVICE_ID ?? '';

export interface SmsMessage {
    to: string;
    message: string;
}

export interface SmsResult {
    success: boolean;
    messageId?: string;
    error?: string;
    response?: Record<string, unknown>;
}

export async function sendSms(msg: SmsMessage): Promise<SmsResult> {
    if (!SMSGATE_BASE_URL || !SMSGATE_USERNAME) {
        return { success: false, error: 'SMSGate credentials not configured' };
    }

    const credentials = Buffer.from(
        `${SMSGATE_USERNAME}:${SMSGATE_PASSWORD}`,
    ).toString('base64');

    const payload = {
        message: msg.message,
        phoneNumbers: [msg.to],
    };

    try {
        const res = await fetch(`${SMSGATE_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/json',
                ...(SMSGATE_DEVICE_ID
                    ? { 'X-Device-ID': SMSGATE_DEVICE_ID }
                    : {}),
            },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const data = (await res.json()) as Record<string, unknown>;
            return {
                success: true,
                messageId: String(data.id ?? ''),
                response: data,
            };
        }

        const errorBody = await res.text();
        return {
            success: false,
            error: `SMSGate ${res.status}: ${errorBody}`,
            response: { status: res.status, body: errorBody },
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown SMSGate error',
        };
    }
}
