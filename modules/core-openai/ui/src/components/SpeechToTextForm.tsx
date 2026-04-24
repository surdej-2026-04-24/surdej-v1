import { useState } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { SpeechToTextResponse } from '@surdej/module-core-openai-shared';

export function SpeechToTextForm() {
    const api = useModuleApi();
    const [audioUrl, setAudioUrl] = useState('');
    const [language, setLanguage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SpeechToTextResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setLoading(true);
        try {
            const res = await api.speechToText({
                audioUrl,
                language: language || undefined,
                responseFormat: 'verbose_json',
            });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Speech to Text (Whisper)</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="url"
                    placeholder="Audio file URL (mp3, wav, m4a, etc.)..."
                    value={audioUrl}
                    onChange={e => setAudioUrl(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                />
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Language (optional, e.g. en, da, de)"
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="p-2 border rounded"
                    />
                </div>
                <button type="submit" disabled={loading || !audioUrl} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Transcribing...' : 'Transcribe'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {result && (
                <div className="border rounded p-4 space-y-2">
                    {result.duration && <p className="text-xs text-muted-foreground">Duration: {result.duration.toFixed(1)}s</p>}
                    <p className="text-sm whitespace-pre-wrap">{result.text}</p>
                    {result.segments && result.segments.length > 0 && (
                        <details className="mt-2">
                            <summary className="text-sm font-medium cursor-pointer">Segments ({result.segments.length})</summary>
                            <div className="mt-2 space-y-1">
                                {result.segments.map((seg, idx) => (
                                    <div key={idx} className="text-xs flex gap-2">
                                        <span className="text-muted-foreground w-24">[{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s]</span>
                                        <span>{seg.text}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
