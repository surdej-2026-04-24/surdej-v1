import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { BenchmarkResponse } from '@surdej/module-core-openai-shared';

const AVAILABLE_MODELS = [
    'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini',
];

export function BenchmarkForm() {
    const api = useModuleApi();
    const [prompt, setPrompt] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-4o', 'gpt-4o-mini']);
    const [runs, setRuns] = useState(1);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<BenchmarkResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toggleModel = (model: string) => {
        setSelectedModels(prev =>
            prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedModels.length < 2) { setError('Select at least 2 models'); return; }
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.benchmark({ prompt, models: selectedModels, runs });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Benchmark failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Model Benchmark</h2>
            <p className="text-sm text-muted-foreground">Compare models side-by-side on the same prompt.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    placeholder="Enter a prompt to benchmark across models..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full p-2 border rounded min-h-[80px]"
                    required
                />

                <div>
                    <label className="text-sm font-medium mb-2 block">Models (select 2+):</label>
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_MODELS.map(model => (
                            <button
                                key={model}
                                type="button"
                                onClick={() => toggleModel(model)}
                                className={`px-3 py-1 rounded text-sm border ${
                                    selectedModels.includes(model)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background hover:bg-muted'
                                }`}
                            >
                                {model}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <label className="text-sm">Runs per model:</label>
                    <select value={runs} onChange={e => setRuns(Number(e.target.value))} className="p-2 border rounded">
                        {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading || !prompt || selectedModels.length < 2}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Running benchmark...' : 'Run Benchmark'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="space-y-4">
                    <h3 className="font-medium">Results</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2">Model</th>
                                    <th className="text-right p-2">Latency</th>
                                    <th className="text-right p-2">Tokens</th>
                                    <th className="text-right p-2">Est. Cost</th>
                                    <th className="text-left p-2">Response</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.results.map((r, idx) => (
                                    <tr key={idx} className="border-b">
                                        <td className="p-2 font-medium">{r.model}</td>
                                        <td className="p-2 text-right">{r.error ? '—' : `${r.latencyMs}ms`}</td>
                                        <td className="p-2 text-right">{r.tokensUsed?.totalTokens ?? '—'}</td>
                                        <td className="p-2 text-right">{r.estimatedCost ? `$${r.estimatedCost.toFixed(6)}` : '—'}</td>
                                        <td className="p-2 text-muted-foreground truncate max-w-xs">
                                            {r.error ? <span className="text-destructive">{r.error}</span> : r.response.slice(0, 150)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Expandable full responses */}
                    <details className="border rounded p-2">
                        <summary className="text-sm font-medium cursor-pointer">Full Responses</summary>
                        <div className="space-y-3 mt-2">
                            {result.results.filter(r => !r.error).map((r, idx) => (
                                <div key={idx} className="border rounded p-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">{r.model}</p>
                                    <p className="text-sm whitespace-pre-wrap">{r.response}</p>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}
