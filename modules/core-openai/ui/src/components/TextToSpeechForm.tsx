import { useState, useRef } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';

export function TextToSpeechForm() {
    const api = useModuleApi();
    const [input, setInput] = useState('');
    const [model, setModel] = useState<'tts-1' | 'tts-1-hd'>('tts-1');
    const [voice, setVoice] = useState<'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer'>('alloy');
    const [speed, setSpeed] = useState(1);
    const [loading, setLoading] = useState(false);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setAudioSrc(null);
        setLoading(true);
        try {
            const res = await api.textToSpeech({ input, model, voice, speed });
            const src = `data:${res.contentType};base64,${res.audioBase64}`;
            setAudioSrc(src);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'TTS failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Text to Speech</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    placeholder="Enter text to convert to speech (max 4096 chars)..."
                    value={input}
                    onChange={e => setInput(e.target.value.slice(0, 4096))}
                    className="w-full p-2 border rounded min-h-[100px]"
                    required
                />
                <p className="text-xs text-muted-foreground text-right">{input.length}/4096</p>

                <div className="flex gap-4 flex-wrap items-center">
                    <select value={voice} onChange={e => setVoice(e.target.value as typeof voice)} className="p-2 border rounded text-sm">
                        {['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'].map(v =>
                            <option key={v} value={v}>{v}</option>
                        )}
                    </select>
                    <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded text-sm">
                        <option value="tts-1">TTS-1</option>
                        <option value="tts-1-hd">TTS-1 HD</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Speed: {speed}x</label>
                        <input type="range" min="0.25" max="4" step="0.25" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
                    </div>
                </div>

                <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Generating...' : 'Generate Speech'}
                </button>
            </form>

            {error && <div className="text-destructive text-sm">{error}</div>}

            {audioSrc && (
                <div className="border rounded p-4">
                    <audio ref={audioRef} controls src={audioSrc} className="w-full" />
                </div>
            )}
        </div>
    );
}
