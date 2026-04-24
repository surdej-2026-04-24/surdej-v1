import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { ImageToTextResponse } from '@surdej/module-core-openai-shared';

export function ImageToTextForm() {
    const api = useModuleApi();
    const [imageUrl, setImageUrl] = useState('');
    const [prompt, setPrompt] = useState('Describe this image in detail.');
    const [model, setModel] = useState<'gpt-4o' | 'gpt-4o-mini'>('gpt-4o');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImageToTextResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.imageToText({ imageUrl, prompt, model });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to analyze image');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Image to Text (Vision)</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="url"
                    placeholder="Image URL..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                />
                <textarea
                    placeholder="What do you want to know about this image?"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full p-2 border rounded"
                    rows={2}
                />
                <div className="flex gap-4">
                    <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={loading || !imageUrl}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Analyzing...' : 'Analyze Image'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="border rounded p-4 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{result.description}</p>
                    {result.usage && (
                        <p className="text-xs text-muted-foreground">
                            Tokens: {result.usage.totalTokens} (prompt: {result.usage.promptTokens}, completion: {result.usage.completionTokens})
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
