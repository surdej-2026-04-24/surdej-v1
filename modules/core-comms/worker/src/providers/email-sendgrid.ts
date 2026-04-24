const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? '';

export interface EmailMessage {
    to: string | string[];
    subject: string;
    body: string;
    html?: boolean;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    response?: Record<string, unknown>;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
    if (!SENDGRID_API_KEY) {
        return { success: false, error: 'SENDGRID_API_KEY not configured' };
    }

    const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];

    const payload = {
        personalizations: [
            {
                to: recipients.map((email) => ({ email })),
            },
        ],
        from: { email: SENDGRID_FROM_EMAIL },
        subject: msg.subject,
        content: [
            {
                type: msg.html !== false ? 'text/html' : 'text/plain',
                value: msg.body,
            },
        ],
    };

    try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (res.ok || res.status === 202) {
            const messageId = res.headers.get('x-message-id') ?? undefined;
            return { success: true, messageId };
        }

        const errorBody = await res.text();
        return {
            success: false,
            error: `SendGrid ${res.status}: ${errorBody}`,
            response: { status: res.status, body: errorBody },
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown SendGrid error',
        };
    }
}
