import { useState, useEffect } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { AiJob } from '@surdej/module-core-openai-shared';

export function AiJobList() {
    const api = useModuleApi();
    const [items, setItems] = useState<AiJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.listJobs().then(res => {
            setItems(res.items);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;
    if (items.length === 0) return <div className="p-4 text-muted-foreground">No AI jobs yet.</div>;

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
    };

    return (
        <div className="space-y-2 p-4">
            <h2 className="text-lg font-semibold mb-4">AI Job History</h2>
            {items.map(item => (
                <div key={item.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                        <span className="font-medium capitalize">{item.type.replace(/-/g, ' ')}</span>
                        {item.prompt && (
                            <p className="text-sm text-muted-foreground truncate max-w-md">{item.prompt}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{item.model} &middot; {new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[item.status] ?? ''}`}>
                        {item.status}
                    </span>
                </div>
            ))}
        </div>
    );
}
