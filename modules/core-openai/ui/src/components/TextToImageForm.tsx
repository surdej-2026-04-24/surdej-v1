import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { TextToImageResponse } from '@surdej/module-core-openai-shared';

export function TextToImageForm() {
    const api = useModuleApi();
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState<'dall-e-2' | 'dall-e-3' | 'gpt-image-1'>('dall-e-3');
    const [size, setSize] = useState<'1024x1024' | '1024x1792' | '1792x1024'>('1024x1024');
    const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TextToImageResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.textToImage({ prompt, model, size, quality });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Text to Image</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    placeholder="Describe the image you want to generate..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full p-2 border rounded min-h-[100px]"
                    required
                />
                <div className="flex gap-4 flex-wrap">
                    <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded">
                        <option value="dall-e-3">DALL-E 3</option>
                        <option value="dall-e-2">DALL-E 2</option>
                        <option value="gpt-image-1">GPT Image 1</option>
                    </select>
                    <select value={size} onChange={e => setSize(e.target.value as typeof size)} className="p-2 border rounded">
                        <option value="1024x1024">1024x1024</option>
                        <option value="1024x1792">1024x1792 (Portrait)</option>
                        <option value="1792x1024">1792x1024 (Landscape)</option>
                    </select>
                    <select value={quality} onChange={e => setQuality(e.target.value as typeof quality)} className="p-2 border rounded">
                        <option value="standard">Standard</option>
                        <option value="hd">HD</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={loading || !prompt}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Generating...' : 'Generate Image'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="space-y-2">
                    {result.images.map((img, idx) => (
                        <div key={idx} className="border rounded p-2">
                            {img.url && <img src={img.url} alt={`Generated ${idx + 1}`} className="max-w-full rounded" />}
                            {img.revised_prompt && (
                                <p className="text-xs text-muted-foreground mt-1">Revised: {img.revised_prompt}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
