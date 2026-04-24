import { useState, useEffect } from 'react';
import { useCommsApi } from '../hooks/useCommsApi.js';
import type { Communication } from '@surdej/module-core-comms-shared';

const CHANNEL_LABELS: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    webhook_outbound: 'Webhook (ud)',
    webhook_inbound: 'Webhook (ind)',
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    bounced: 'bg-orange-100 text-orange-800',
    received: 'bg-purple-100 text-purple-800',
};

export function CommunicationLog() {
    const api = useCommsApi();
    const [items, setItems] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        const params: Record<string, string> = {};
        if (filter) params.channel = filter;

        api.listCommunications(params)
            .then((res) => {
                setItems(res.items);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [filter]);

    if (loading) return <div className="p-4 text-muted-foreground">Indlæser...</div>;

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Kommunikationslog</h2>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="ml-auto p-1 border rounded text-sm"
                >
                    <option value="">Alle kanaler</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="webhook_outbound">Webhook (ud)</option>
                    <option value="webhook_inbound">Webhook (ind)</option>
                </select>
            </div>

            {items.length === 0 ? (
                <div className="text-muted-foreground">Ingen kommunikation endnu.</div>
            ) : (
                <div className="border rounded-lg divide-y">
                    {items.map((item) => (
                        <div key={item.id} className="p-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground">
                                        {CHANNEL_LABELS[item.channel] ?? item.channel}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? 'bg-gray-100'}`}>
                                        {item.status}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.direction === 'outbound' ? '→' : '←'}
                                    </span>
                                </div>
                                {item.subject && (
                                    <div className="font-medium text-sm mt-1 truncate">{item.subject}</div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                    {item.recipient && <span>Til: {item.recipient}</span>}
                                    {item.sender && <span className="ml-2">Fra: {item.sender}</span>}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Initiator: {item.initiatorId} ({item.initiatorType ?? 'user'})
                                </div>
                                {item.errorMessage && (
                                    <div className="text-xs text-red-600 mt-1">{item.errorMessage}</div>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(item.createdAt).toLocaleString('da-DK')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
