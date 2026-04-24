import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { ModerationResponse } from '@surdej/module-core-openai-shared';

export function ModerationForm() {
    const api = useModuleApi();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ModerationResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.moderation({ input });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Moderation check failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Content Moderation</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    placeholder="Enter content to check against moderation policies..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="w-full p-2 border rounded min-h-[100px]"
                    required
                />
                <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Checking...' : 'Check Content'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && result.results.map((r, idx) => (
                <div key={idx} className="border rounded p-4 space-y-3">
                    <div className={`flex items-center gap-2 text-lg font-semibold ${r.flagged ? 'text-destructive' : 'text-green-600'}`}>
                        {r.flagged ? '⚠️ Flagged' : '✅ Clean'}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(r.categories).map(([cat, flagged]) => (
                            <div key={cat} className={`p-2 rounded text-xs ${flagged ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-muted text-muted-foreground'}`}>
                                <p className="font-medium">{cat.replace(/\//g, ' / ')}</p>
                                <p>{((r.categoryScores[cat] ?? 0) * 100).toFixed(1)}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
