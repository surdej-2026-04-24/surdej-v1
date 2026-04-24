import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { VideoAnalysisResponse } from '@surdej/module-core-openai-shared';

export function VideoAnalysisForm() {
    const api = useModuleApi();
    const [videoUrl, setVideoUrl] = useState('');
    const [prompt, setPrompt] = useState('Analyze this video and describe what is happening.');
    const [model, setModel] = useState<'gpt-4o' | 'gpt-4o-mini'>('gpt-4o');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<VideoAnalysisResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.videoAnalysis({ videoUrl, prompt, model });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to analyze video');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Video Analysis</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="url"
                    placeholder="Video URL..."
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                />
                <textarea
                    placeholder="What do you want to know about this video?"
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
                    disabled={loading || !videoUrl}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Analyzing...' : 'Analyze Video'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="border rounded p-4 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{result.analysis}</p>
                    {result.frameCount && (
                        <p className="text-xs text-muted-foreground">Frames analyzed: {result.frameCount}</p>
                    )}
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
