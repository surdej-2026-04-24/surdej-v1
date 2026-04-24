import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { ImageToImageResponse } from '@surdej/module-core-openai-shared';

export function ImageToImageForm() {
    const api = useModuleApi();
    const [imageUrl, setImageUrl] = useState('');
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState<'dall-e-2' | 'gpt-image-1'>('gpt-image-1');
    const [size, setSize] = useState<'256x256' | '512x512' | '1024x1024'>('1024x1024');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImageToImageResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.imageToImage({ imageUrl, prompt, model, size });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to edit image');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Image to Image (Edit)</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="url"
                    placeholder="Source image URL..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                />
                <textarea
                    placeholder="Describe the edit you want to make..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full p-2 border rounded"
                    rows={3}
                    required
                />
                <div className="flex gap-4">
                    <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded">
                        <option value="gpt-image-1">GPT Image 1</option>
                        <option value="dall-e-2">DALL-E 2</option>
                    </select>
                    <select value={size} onChange={e => setSize(e.target.value as typeof size)} className="p-2 border rounded">
                        <option value="1024x1024">1024x1024</option>
                        <option value="512x512">512x512</option>
                        <option value="256x256">256x256</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={loading || !imageUrl || !prompt}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Editing...' : 'Edit Image'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="space-y-2">
                    {result.images.map((img, idx) => (
                        <div key={idx} className="border rounded p-2">
                            {img.url && <img src={img.url} alt={`Edited ${idx + 1}`} className="max-w-full rounded" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
