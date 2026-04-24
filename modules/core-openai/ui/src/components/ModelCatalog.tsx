import { useState, useEffect } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { ModelInfo } from '@surdej/module-core-openai-shared';

export function ModelCatalog() {
    const api = useModuleApi();
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        api.getModels().then(res => {
            setModels(res.models);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const categories = ['all', ...new Set(models.map(m => m.category))];
    const filtered = filter === 'all' ? models : models.filter(m => m.category === filter);

    if (loading) return <div className="p-4 text-muted-foreground">Loading models...</div>;

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Model Catalog</h2>

            <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-3 py-1 rounded text-sm border capitalize ${
                            filter === cat ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left p-2">Model</th>
                            <th className="text-left p-2">Category</th>
                            <th className="text-left p-2">Capabilities</th>
                            <th className="text-right p-2">Max Tokens</th>
                            <th className="text-right p-2">Input $/1K</th>
                            <th className="text-right p-2">Output $/1K</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(model => (
                            <tr key={model.id} className={`border-b ${model.deprecated ? 'opacity-50' : ''}`}>
                                <td className="p-2 font-medium">
                                    {model.name}
                                    {model.deprecated && <span className="ml-1 text-xs text-muted-foreground">(deprecated)</span>}
                                </td>
                                <td className="p-2 capitalize">{model.category}</td>
                                <td className="p-2">
                                    <div className="flex flex-wrap gap-1">
                                        {model.capabilities.map(cap => (
                                            <span key={cap} className="px-1.5 py-0.5 bg-muted rounded text-xs">{cap}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-2 text-right">{model.maxTokens?.toLocaleString() ?? '—'}</td>
                                <td className="p-2 text-right">{model.inputCostPer1k != null ? `$${model.inputCostPer1k}` : '—'}</td>
                                <td className="p-2 text-right">{model.outputCostPer1k != null ? `$${model.outputCostPer1k}` : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
