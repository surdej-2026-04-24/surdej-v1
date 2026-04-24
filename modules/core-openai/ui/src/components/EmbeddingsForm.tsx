import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';

export function EmbeddingsForm() {
    const api = useModuleApi();
    const [input, setInput] = useState('');
    const [model, setModel] = useState<'text-embedding-3-small' | 'text-embedding-3-large'>('text-embedding-3-small');
    const [dimensions, setDimensions] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ dimensions: number; tokens: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.embeddings({
                input,
                model,
                dimensions: dimensions ? Number(dimensions) : undefined,
            });
            setResult({
                dimensions: res.embeddings[0]?.values.length ?? 0,
                tokens: res.usage.totalTokens,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Embedding failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Embeddings Generator</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    placeholder="Enter text to generate embeddings for..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="w-full p-2 border rounded min-h-[80px]"
                    required
                />
                <div className="flex gap-4 items-center">
                    <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded text-sm">
                        <option value="text-embedding-3-small">Embedding 3 Small</option>
                        <option value="text-embedding-3-large">Embedding 3 Large</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Dimensions (optional)"
                        value={dimensions}
                        onChange={e => setDimensions(e.target.value ? Number(e.target.value) : '')}
                        className="p-2 border rounded text-sm w-40"
                        min="1"
                        max="3072"
                    />
                </div>
                <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Generating...' : 'Generate Embeddings'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">{result.dimensions}</p>
                        <p className="text-xs text-muted-foreground">Vector Dimensions</p>
                    </div>
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">{result.tokens}</p>
                        <p className="text-xs text-muted-foreground">Tokens Used</p>
                    </div>
                </div>
            )}
        </div>
    );
}
