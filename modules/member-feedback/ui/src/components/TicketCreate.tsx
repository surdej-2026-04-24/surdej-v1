import { useState } from 'react';
import { CreateTicketSchema } from '@surdej/module-member-feedback-shared';
import { useTicketApi } from '../hooks/useTicketApi.js';

interface Props {
    onCreated?: (ticketId: string) => void;
    feedbackSessionId?: string;
    initialTitle?: string;
    initialDescription?: string;
}

export function TicketCreate({ onCreated, feedbackSessionId, initialTitle, initialDescription }: Props) {
    const api = useTicketApi();
    const [title, setTitle] = useState(initialTitle ?? '');
    const [description, setDescription] = useState(initialDescription ?? '');
    const [category, setCategory] = useState('general');
    const [priority, setPriority] = useState('medium');
    const [tags, setTags] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const result = CreateTicketSchema.safeParse({
            title,
            description: description || undefined,
            category,
            priority,
            feedbackSessionId,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        });

        if (!result.success) {
            setError(result.error.issues.map(i => i.message).join(', '));
            return;
        }

        setSaving(true);
        try {
            const ticket = await api.create(result.data);
            setTitle('');
            setDescription('');
            setTags('');
            onCreated?.(ticket.id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('Failed to fetch')) {
                setError('Feedback-tjenesten er ikke tilgængelig lige nu. Prøv igen senere.');
            } else {
                setError(msg || 'Kunne ikke oprette ticket');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ padding: 20, maxWidth: 600 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>🎫 Ny Feedback Ticket</h2>

            {error && (
                <div style={{
                    padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12,
                }}>
                    {error}
                </div>
            )}

            {feedbackSessionId && (
                <div style={{
                    padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 12,
                }}>
                    🔗 Linket til feedback session
                </div>
            )}

            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Titel *</label>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Kort beskrivelse af problemet"
                    required
                    style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                        background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                    }}
                />
            </div>

            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Beskrivelse</label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Detaljeret beskrivelse..."
                    rows={5}
                    style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                        resize: 'vertical', fontFamily: 'inherit',
                        background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                    }}
                />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Kategori</label>
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 10px', borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                            background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                        }}
                    >
                        <option value="general">Generelt</option>
                        <option value="bug">Fejl / Bug</option>
                        <option value="feature_request">Ønske / Feature</option>
                        <option value="question">Spørgsmål</option>
                        <option value="complaint">Klage</option>
                        <option value="security">Sikkerhed</option>
                        <option value="performance">Performance</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Prioritet</label>
                    <select
                        value={priority}
                        onChange={e => setPriority(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 10px', borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                            background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                        }}
                    >
                        <option value="low">Lav</option>
                        <option value="medium">Medium</option>
                        <option value="high">Høj</option>
                        <option value="critical">Kritisk</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Tags (kommasepareret)</label>
                <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="f.eks. ui, performance, login"
                    style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                        background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                    }}
                />
            </div>

            <button
                type="submit"
                disabled={saving}
                style={{
                    padding: '8px 20px', borderRadius: 6, border: 'none',
                    background: 'var(--primary, #3b82f6)', color: '#fff',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    opacity: saving ? 0.5 : 1,
                }}
            >
                {saving ? 'Opretter...' : '✓ Opret Ticket'}
            </button>
        </form>
    );
}
