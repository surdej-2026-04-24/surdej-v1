import { useState, useEffect, useCallback } from 'react';
import type { Document } from '@surdej/module-member-nosql-shared';
import { useNosqlApi } from '../hooks/useNosqlApi.js';

interface DocumentDetailProps {
    documentId: string;
    onBack?: () => void;
    onShowVersions?: () => void;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-DK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function JsonEditor({
    value,
    onChange,
    readOnly,
}: {
    value: Record<string, unknown>;
    onChange?: (val: Record<string, unknown>) => void;
    readOnly?: boolean;
}) {
    const [text, setText] = useState(JSON.stringify(value, null, 2));
    const [parseError, setParseError] = useState<string | null>(null);

    useEffect(() => {
        setText(JSON.stringify(value, null, 2));
    }, [value]);

    const handleChange = (raw: string) => {
        setText(raw);
        try {
            const parsed = JSON.parse(raw);
            setParseError(null);
            onChange?.(parsed);
        } catch {
            setParseError('Invalid JSON');
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <textarea
                value={text}
                readOnly={readOnly}
                onChange={e => handleChange(e.target.value)}
                style={{
                    width: '100%',
                    minHeight: 320,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    padding: 12,
                    border: parseError ? '1px solid #ef4444' : '1px solid var(--border, #e5e7eb)',
                    borderRadius: 8,
                    resize: 'vertical',
                    background: readOnly ? 'var(--muted, #f9fafb)' : 'var(--background, #fff)',
                    color: 'var(--foreground)',
                    boxSizing: 'border-box',
                }}
                spellCheck={false}
            />
            {parseError && (
                <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: '#ef4444' }}>
                    {parseError}
                </span>
            )}
        </div>
    );
}

export function DocumentDetail({ documentId, onBack, onShowVersions }: DocumentDetailProps) {
    const api = useNosqlApi();
    const [doc, setDoc] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<Record<string, unknown>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getDocument(documentId);
            setDoc(data);
            setEditedData(data.data as Record<string, unknown>);
            setIsDirty(false);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!doc) return;
        setSaving(true);
        try {
            const updated = await api.updateDocument(doc.id, { data: editedData });
            setDoc(updated);
            setEditedData(updated.data as Record<string, unknown>);
            setIsDirty(false);
            setMode('view');
        } catch (err) {
            setError(String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!doc || !confirm('Soft-delete this document?')) return;
        setDeleting(true);
        try {
            await api.deleteDocument(doc.id);
            await load();
        } catch (err) {
            setError(String(err));
        } finally {
            setDeleting(false);
        }
    };

    const handleRestore = async () => {
        if (!doc) return;
        try {
            const restored = await api.restoreDocument(doc.id);
            setDoc(restored);
        } catch (err) {
            setError(String(err));
        }
    };

    if (loading) return <div style={{ padding: 24, color: 'var(--muted-foreground, #6b7280)', fontSize: 13 }}>Loading…</div>;
    if (error) return <div style={{ padding: 16, color: '#ef4444', fontSize: 13 }}>Error: {error}</div>;
    if (!doc) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 16px', borderBottom: '1px solid var(--border, #e5e7eb)',
                flexShrink: 0,
            }}>
                {onBack && (
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground, #6b7280)' }}>
                        ←
                    </button>
                )}
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)' }}>{doc.id}</code>
                        {doc.deletedAt && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: '#fee2e2', color: '#ef4444' }}>
                                DELETED
                            </span>
                        )}
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'var(--accent, #f3f4f6)', color: 'var(--muted-foreground, #6b7280)' }}>
                            v{doc.version}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)', marginTop: 2 }}>
                        Updated {formatDate(doc.updatedAt)}
                        {doc.updatedBy && ` by ${doc.updatedBy}`}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {onShowVersions && (
                        <button onClick={onShowVersions} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'none', cursor: 'pointer' }}>
                            Versions
                        </button>
                    )}
                    {doc.deletedAt ? (
                        <button onClick={handleRestore} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                            Restore
                        </button>
                    ) : (
                        <>
                            {mode === 'view' ? (
                                <button onClick={() => setMode('edit')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'none', cursor: 'pointer' }}>
                                    Edit
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => { setMode('view'); setEditedData(doc.data as Record<string, unknown>); setIsDirty(false); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'none', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !isDirty}
                                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: isDirty ? 'var(--primary, #3b82f6)' : 'var(--muted, #e5e7eb)', color: isDirty ? '#fff' : 'var(--muted-foreground, #6b7280)', cursor: isDirty ? 'pointer' : 'not-allowed', fontWeight: 500 }}
                                    >
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                            >
                                {deleting ? '…' : 'Delete'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Metadata strip */}
            <div style={{ display: 'flex', gap: 24, padding: '8px 16px', fontSize: 11, borderBottom: '1px solid var(--border, #e5e7eb)', color: 'var(--muted-foreground, #6b7280)', background: 'var(--muted, #f9fafb)', flexShrink: 0 }}>
                <span>Created: {formatDate(doc.createdAt)}{doc.createdBy ? ` by ${doc.createdBy}` : ''}</span>
                <span>Version: {doc.version}</span>
                <span>Collection: {doc.collectionId.slice(0, 8)}…</span>
            </div>

            {/* JSON editor */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <JsonEditor
                    value={editedData}
                    readOnly={mode === 'view'}
                    onChange={(val) => { setEditedData(val); setIsDirty(true); }}
                />
            </div>
        </div>
    );
}
