import { useState, useEffect, useCallback } from 'react';
import type { DocumentVersion } from '@surdej/module-member-nosql-shared';
import { useNosqlApi } from '../hooks/useNosqlApi.js';

interface VersionHistoryProps {
    documentId: string;
    currentVersion: number;
    onBack?: () => void;
    onRestored?: () => void;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-DK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export function VersionHistory({ documentId, currentVersion, onBack, onRestored }: VersionHistoryProps) {
    const api = useNosqlApi();
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<(DocumentVersion & { isCurrent?: boolean }) | null>(null);
    const [restoring, setRestoring] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getDocumentVersions(documentId);
            setVersions(res.versions);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    useEffect(() => { load(); }, [load]);

    const handleRestore = async (version: number) => {
        if (!confirm(`Restore document to version ${version}? The current state will be saved as a new version.`)) return;
        setRestoring(true);
        try {
            await api.restoreDocumentVersion(documentId, version);
            onRestored?.();
        } catch (err) {
            setError(String(err));
        } finally {
            setRestoring(false);
        }
    };

    const loadVersion = async (version: number) => {
        try {
            const snap = await api.getDocumentVersion(documentId, version);
            setSelectedVersion(snap);
        } catch (err) {
            setError(String(err));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border, #e5e7eb)', flexShrink: 0 }}>
                {onBack && (
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground, #6b7280)' }}>
                        ←
                    </button>
                )}
                <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Version History</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>
                        Current: v{currentVersion} · {versions.length} snapshot{versions.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Version list */}
                <div style={{ width: 240, borderRight: '1px solid var(--border, #e5e7eb)', overflow: 'auto', flexShrink: 0 }}>
                    {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>Loading…</div>}
                    {error && <div style={{ padding: 16, fontSize: 13, color: '#ef4444' }}>Error: {error}</div>}

                    {/* Current version entry */}
                    {!loading && (
                        <div
                            onClick={() => loadVersion(currentVersion)}
                            style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid var(--border, #f3f4f6)',
                                cursor: 'pointer',
                                background: selectedVersion?.version === currentVersion ? 'var(--accent, #f3f4f6)' : 'transparent',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>v{currentVersion}</span>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: '#dcfce7', color: '#16a34a' }}>current</span>
                            </div>
                        </div>
                    )}

                    {versions.map(v => (
                        <div
                            key={v.id}
                            onClick={() => setSelectedVersion(v)}
                            style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid var(--border, #f3f4f6)',
                                cursor: 'pointer',
                                background: selectedVersion?.id === v.id ? 'var(--accent, #f3f4f6)' : 'transparent',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>v{v.version}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)', marginTop: 2 }}>
                                {formatDate(v.createdAt)}
                            </div>
                            {v.createdBy && (
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>
                                    by {v.createdBy}
                                </div>
                            )}
                        </div>
                    ))}

                    {!loading && versions.length === 0 && (
                        <div style={{ padding: 16, fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
                            No previous versions saved yet.
                        </div>
                    )}
                </div>

                {/* Version preview */}
                <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedVersion ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>Snapshot v{selectedVersion.version}</span>
                                    <span style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', marginLeft: 8 }}>
                                        {formatDate(selectedVersion.createdAt)}
                                    </span>
                                </div>
                                {selectedVersion.version !== currentVersion && (
                                    <button
                                        onClick={() => handleRestore(selectedVersion.version)}
                                        disabled={restoring}
                                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff', cursor: restoring ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                                    >
                                        {restoring ? 'Restoring…' : 'Restore this version'}
                                    </button>
                                )}
                            </div>
                            <pre style={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                padding: 14,
                                borderRadius: 8,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'var(--muted, #f9fafb)',
                                overflow: 'auto',
                                margin: 0,
                                flex: 1,
                            }}>
                                {JSON.stringify(selectedVersion.data, null, 2)}
                            </pre>
                        </>
                    ) : (
                        <div style={{ color: 'var(--muted-foreground, #6b7280)', fontSize: 13, padding: 8 }}>
                            Select a version on the left to preview its data.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
