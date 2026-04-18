import { useState, useEffect } from 'react';
import { useIssueApi } from '../hooks/useIssueApi.js';
import type { Label } from '@surdej/module-core-issues-shared';

interface LabelManagerProps {
    onClose?: () => void;
}

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280',
];

/**
 * Admin label manager — create, edit, delete labels with color picker.
 */
export function LabelManager({ onClose }: LabelManagerProps) {
    const api = useIssueApi();
    const [labels, setLabels] = useState<Label[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const res = await api.listLabels();
            setLabels(res.items);
        } catch (e) {
            console.error('Failed to load labels:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setColor('#3b82f6');
        setDescription('');
    };

    const startEdit = (label: Label) => {
        setEditingId(label.id);
        setName(label.name);
        setColor(label.color);
        setDescription(label.description ?? '');
    };

    const handleSave = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        try {
            if (editingId) {
                await api.updateLabel(editingId, { name, color, description: description || undefined });
            } else {
                await api.createLabel({ name, color, description: description || undefined });
            }
            resetForm();
            await load();
        } catch (e) {
            alert(`Fejl: ${e instanceof Error ? e.message : 'Ukendt fejl'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Slet denne label?')) return;
        try {
            await api.deleteLabel(id);
            await load();
        } catch (e) {
            alert(`Sletning fejlede: ${e instanceof Error ? e.message : 'Ukendt fejl'}`);
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>🏷️ Administrer Labels</h3>
                {onClose && (
                    <button onClick={onClose} style={{
                        border: 'none', background: 'none', cursor: 'pointer', fontSize: 16,
                    }}>✕</button>
                )}
            </div>

            {/* Form */}
            <div style={{
                padding: 16, marginBottom: 16, borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--card, #fff)',
            }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Label navn"
                        style={{
                            flex: 1, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                        }}
                    />
                    <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Beskrivelse (valgfri)"
                        style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                        }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                    {PRESET_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            style={{
                                width: 24, height: 24, borderRadius: 6, border: color === c ? '2px solid #000' : '2px solid transparent',
                                background: c, cursor: 'pointer',
                            }}
                        />
                    ))}
                    <input
                        type="color"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        style={{ marginLeft: 8, width: 32, height: 24, cursor: 'pointer' }}
                    />
                </div>

                {/* Preview */}
                {name && (
                    <div style={{ marginBottom: 8 }}>
                        <span style={{
                            display: 'inline-block', fontSize: 11, padding: '2px 10px', borderRadius: 9999,
                            background: color, color: '#fff', fontWeight: 600,
                        }}>
                            {name}
                        </span>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        style={{
                            padding: '6px 16px', borderRadius: 6,
                            border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            opacity: saving || !name.trim() ? 0.5 : 1,
                        }}
                    >
                        {saving ? 'Gemmer…' : editingId ? 'Opdater' : 'Opret'}
                    </button>
                    {editingId && (
                        <button onClick={resetForm} style={{
                            padding: '6px 16px', borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)', background: 'transparent',
                            fontSize: 12, cursor: 'pointer',
                        }}>
                            Annuller
                        </button>
                    )}
                </div>
            </div>

            {/* Existing labels */}
            {loading ? (
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Indlæser…</div>
            ) : labels.length === 0 ? (
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                    Ingen labels oprettet endnu
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {labels.map(label => (
                        <div key={label.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                            borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
                        }}>
                            <span style={{
                                display: 'inline-block', fontSize: 11, padding: '2px 10px', borderRadius: 9999,
                                background: label.color, color: '#fff', fontWeight: 600,
                            }}>
                                {label.name}
                            </span>
                            {label.description && (
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flex: 1 }}>{label.description}</span>
                            )}
                            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                                <button
                                    onClick={() => startEdit(label)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}
                                >✏️</button>
                                <button
                                    onClick={() => handleDelete(label.id)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}
                                >🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
