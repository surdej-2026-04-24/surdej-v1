import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { PlaygroundResponse } from '@surdej/module-core-openai-shared';

export function PlaygroundForm() {
    const api = useModuleApi();
    const [prompt, setPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [model, setModel] = useState('gpt-4o');
    const [temperature, setTemperature] = useState(1);
    const [maxTokens, setMaxTokens] = useState(4096);
    const [topP, setTopP] = useState(1);
    const [frequencyPenalty, setFrequencyPenalty] = useState(0);
    const [presencePenalty, setPresencePenalty] = useState(0);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PlaygroundResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.playground({
                prompt, systemPrompt: systemPrompt || undefined, model,
                maxTokens, temperature, topP, frequencyPenalty, presencePenalty,
            });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Prompt Playground</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium block mb-1">System Prompt (optional)</label>
                    <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="w-full p-2 border rounded" rows={2} placeholder="You are a helpful assistant..." />
                </div>
                <div>
                    <label className="text-sm font-medium block mb-1">User Prompt</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full p-2 border rounded min-h-[100px]" required placeholder="Enter your prompt..." />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-muted-foreground">Model</label>
                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 border rounded text-sm">
                            {['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini'].map(m =>
                                <option key={m} value={m}>{m}</option>
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Temperature: {temperature}</label>
                        <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Max Tokens</label>
                        <input type="number" min="1" max="128000" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Top P: {topP}</label>
                        <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Freq Penalty: {frequencyPenalty}</label>
                        <input type="range" min="-2" max="2" step="0.1" value={frequencyPenalty} onChange={e => setFrequencyPenalty(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Pres Penalty: {presencePenalty}</label>
                        <input type="range" min="-2" max="2" step="0.1" value={presencePenalty} onChange={e => setPresencePenalty(Number(e.target.value))} className="w-full" />
                    </div>
                </div>

                <button type="submit" disabled={loading || !prompt} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Running...' : 'Execute'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="border rounded p-4 space-y-2">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Model: {result.model}</span>
                        <span>Latency: {result.latencyMs}ms</span>
                        {result.usage && <span>Tokens: {result.usage.totalTokens}</span>}
                        {result.finishReason && <span>Finish: {result.finishReason}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{result.response}</p>
                </div>
            )}
        </div>
    );
}
