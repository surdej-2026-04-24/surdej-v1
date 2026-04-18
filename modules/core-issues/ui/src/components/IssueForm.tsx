import { useState } from 'react';
import { CreateIssueSchema } from '@surdej/module-core-issues-shared';
import { useIssueApi } from '../hooks/useIssueApi.js';

interface Props {
    onCreated?: () => void;
    defaultTitle?: string;
    defaultDescription?: string;
}

export function IssueForm({ onCreated, defaultTitle, defaultDescription }: Props) {
    const api = useIssueApi();
    const [title, setTitle] = useState(defaultTitle ?? '');
    const [description, setDescription] = useState(defaultDescription ?? '');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [shareWithHappyMates, setShareWithHappyMates] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const result = CreateIssueSchema.safeParse({ title, description, priority });
        if (!result.success) {
            setError(result.error.issues.map(i => i.message).join(', '));
            return;
        }
        setSaving(true);
        try {
            await api.create({ ...result.data, shareWithHappyMates });
            setTitle('');
            setDescription('');
            setPriority('medium');
            setShareWithHappyMates(false);
            onCreated?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Kunne ikke gemme');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
            {error && <div className="text-destructive text-sm">{error}</div>}
            <input
                type="text"
                placeholder="Titel på issue"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-2 border rounded bg-background text-foreground"
                required
            />
            <textarea
                placeholder="Beskrivelse (Markdown understøttet)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 border rounded bg-background text-foreground"
                rows={5}
            />
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="p-2 border rounded bg-background text-foreground"
                >
                    <option value="low">Lav</option>
                    <option value="medium">Medium</option>
                    <option value="high">Høj</option>
                </select>

                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                        type="checkbox"
                        checked={shareWithHappyMates}
                        onChange={e => setShareWithHappyMates(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#f97316]"
                    />
                    <img src="/happy-mates-logo.png" alt="" className="h-5 w-5 rounded-full" />
                    <span>Del med Happy Mates</span>
                </label>
            </div>
            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
                {saving ? 'Gemmer...' : 'Opret Issue'}
            </button>
        </form>
    );
}

