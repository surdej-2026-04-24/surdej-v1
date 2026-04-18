import { useState, useEffect } from 'react';
import { useModuleApi } from '../hooks/useModuleApi.js';
import type { Tool } from '@surdej/module-tool-management-tools-shared';

export function ToolList() {
    const api = useModuleApi();
    const [items, setItems] = useState<Tool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        api.list()
            .then((res) => {
                setItems(res.items);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to load tools');
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    const handleToggle = async (id: string) => {
        try {
            const updated = await api.toggle(id);
            setItems((prev) => prev.map((t) => (t.id === id ? updated : t)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle tool');
        }
    };

    if (loading) {
        return <div className="p-4 text-muted-foreground">Loading tools...</div>;
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="text-destructive text-sm mb-2">{error}</div>
                <button onClick={load} className="text-xs text-primary hover:underline">
                    Retry
                </button>
            </div>
        );
    }

    if (items.length === 0) {
        return <div className="p-4 text-muted-foreground">No tools registered yet.</div>;
    }

    return (
        <div className="space-y-2 p-4">
            {items.map((tool) => (
                <div
                    key={tool.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{tool.label}</h3>
                            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
                                {tool.name}
                            </span>
                            {tool.isBuiltIn && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                                    built-in
                                </span>
                            )}
                        </div>
                        {tool.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {tool.description}
                            </p>
                        )}
                        {tool.useCases.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {tool.useCases.map((uc) => (
                                    <span
                                        key={uc}
                                        className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded"
                                    >
                                        {uc}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle(tool.id)}
                        className={`ml-3 shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                            tool.isEnabled
                                ? 'bg-primary'
                                : 'bg-muted-foreground/30'
                        }`}
                        title={tool.isEnabled ? 'Disable tool' : 'Enable tool'}
                        aria-label={tool.isEnabled ? `Disable ${tool.label}` : `Enable ${tool.label}`}
                    >
                        <span
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                tool.isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                        />
                    </button>
                </div>
            ))}
        </div>
    );
}
