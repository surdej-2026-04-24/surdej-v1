import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { TokenCountResponse } from '@surdej/module-core-openai-shared';

export function TokenCounterForm() {
    const api = useModuleApi();
    const [text, setText] = useState('');
    const [model, setModel] = useState('gpt-4o');
    const [result, setResult] = useState<TokenCountResponse | null>(null);

    const handleCount = async () => {
        if (!text.trim()) return;
        try {
            const res = await api.countTokens({ text, model });
            setResult(res);
        } catch {
            setResult(null);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Token Counter & Cost Estimator</h2>
            <textarea
                placeholder="Paste text to estimate tokens and cost..."
                value={text}
                onChange={e => { setText(e.target.value); setResult(null); }}
                className="w-full p-2 border rounded min-h-[120px]"
            />
            <div className="flex gap-4 items-center">
                <select value={model} onChange={e => setModel(e.target.value)} className="p-2 border rounded text-sm">
                    {['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini',
                      'text-embedding-3-small', 'text-embedding-3-large', 'whisper-1', 'tts-1'].map(m =>
                        <option key={m} value={m}>{m}</option>
                    )}
                </select>
                <button onClick={handleCount} disabled={!text.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    Estimate
                </button>
                <span className="text-sm text-muted-foreground">{text.length} chars</span>
            </div>

            {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">{result.tokenCount}</p>
                        <p className="text-xs text-muted-foreground">Estimated Tokens</p>
                    </div>
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">${result.estimatedCost.estimatedInputCost.toFixed(6)}</p>
                        <p className="text-xs text-muted-foreground">Input Cost</p>
                    </div>
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">${result.estimatedCost.inputCostPer1k}</p>
                        <p className="text-xs text-muted-foreground">Per 1K Input</p>
                    </div>
                    <div className="border rounded p-3 text-center">
                        <p className="text-2xl font-bold">${result.estimatedCost.outputCostPer1k}</p>
                        <p className="text-xs text-muted-foreground">Per 1K Output</p>
                    </div>
                </div>
            )}
        </div>
    );
}
