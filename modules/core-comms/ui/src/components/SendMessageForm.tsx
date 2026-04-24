import { useState } from 'react';
import {
    SendEmailSchema,
    SendSmsSchema,
} from '@surdej/module-core-comms-shared';
import { useCommsApi } from '../hooks/useCommsApi.js';

type Channel = 'email' | 'sms';

interface Props {
    defaultChannel?: Channel;
    initiatorId: string;
    onSent?: () => void;
}

export function SendMessageForm({ defaultChannel = 'email', initiatorId, onSent }: Props) {
    const api = useCommsApi();
    const [channel, setChannel] = useState<Channel>(defaultChannel);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSaving(true);

        try {
            if (channel === 'email') {
                const parsed = SendEmailSchema.safeParse({
                    to,
                    subject,
                    body,
                    html: true,
                    initiatorId,
                });
                if (!parsed.success) {
                    setError(parsed.error.issues.map((i) => i.message).join(', '));
                    setSaving(false);
                    return;
                }
                const result = await api.sendEmail(parsed.data);
                setSuccess(`Email sendt (${result.communicationId})`);
            } else {
                const parsed = SendSmsSchema.safeParse({
                    to,
                    message: body,
                    initiatorId,
                });
                if (!parsed.success) {
                    setError(parsed.error.issues.map((i) => i.message).join(', '));
                    setSaving(false);
                    return;
                }
                const result = await api.sendSms(parsed.data);
                setSuccess(`SMS sendt (${result.communicationId})`);
            }

            setTo('');
            setSubject('');
            setBody('');
            onSent?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Afsendelse mislykkedes');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 max-w-lg">
            <h2 className="text-lg font-semibold">Send besked</h2>

            {error && <div className="text-destructive text-sm p-2 bg-red-50 rounded">{error}</div>}
            {success && <div className="text-green-700 text-sm p-2 bg-green-50 rounded">{success}</div>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setChannel('email')}
                    className={`px-3 py-1 rounded text-sm ${channel === 'email' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                    Email
                </button>
                <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`px-3 py-1 rounded text-sm ${channel === 'sms' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                    SMS
                </button>
            </div>

            <input
                type={channel === 'email' ? 'email' : 'tel'}
                placeholder={channel === 'email' ? 'Modtager email' : 'Telefonnummer'}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full p-2 border rounded"
                required
            />

            {channel === 'email' && (
                <input
                    type="text"
                    placeholder="Emne"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                />
            )}

            <textarea
                placeholder={channel === 'email' ? 'Besked (HTML tilladt)' : 'SMS besked'}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-2 border rounded"
                rows={channel === 'email' ? 6 : 3}
                required
            />

            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
                {saving ? 'Sender...' : `Send ${channel === 'email' ? 'Email' : 'SMS'}`}
            </button>
        </form>
    );
}
