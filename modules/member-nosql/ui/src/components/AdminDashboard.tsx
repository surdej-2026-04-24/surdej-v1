import { useState, useEffect, useCallback } from 'react';
import { useNosqlApi } from '../hooks/useNosqlApi.js';

interface AdminDashboardProps {
    tenantId?: string;
    onSelectCollection?: (collectionId: string) => void;
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-DK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export function AdminDashboard({ tenantId, onSelectCollection }: AdminDashboardProps) {
    const api = useNosqlApi();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        tenantId: string;
        totalCollections: number;
        generatedAt: string;
        stats: Array<{
            collectionId: string;
            collectionName: string;
            collectionSlug: string;
            documentCount: number;
            activeDocumentCount: number;
            deletedDocumentCount: number;
            latestUpdatedAt: string | null;
        }>;
    } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getAdminStats(tenantId);
            setStats(data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => { load(); }, [load]);

    const totalDocs = stats?.stats.reduce((a, s) => a + s.activeDocumentCount, 0) ?? 0;
    const totalDeleted = stats?.stats.reduce((a, s) => a + s.deletedDocumentCount, 0) ?? 0;

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>NoSQL Store — Admin Overview</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
                        Tenant: <code>{stats?.tenantId ?? tenantId ?? 'default'}</code>
                        {stats && ` · Generated ${formatDate(stats.generatedAt)}`}
                    </p>
                </div>
                <button onClick={load} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'none', cursor: 'pointer' }}>
                    Refresh
                </button>
            </div>

            {error && <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#ef4444', fontSize: 13 }}>Error: {error}</div>}

            {/* Summary cards */}
            {!loading && stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[
                        { label: 'Total Collections', value: stats.totalCollections, icon: '📁' },
                        { label: 'Active Documents', value: totalDocs, icon: '📄' },
                        { label: 'Deleted Documents', value: totalDeleted, icon: '🗑️' },
                    ].map(card => (
                        <div key={card.label} style={{
                            padding: '16px 20px', borderRadius: 12,
                            border: '1px solid var(--border, #e5e7eb)',
                            background: 'var(--background, #fff)',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <span style={{ fontSize: 28 }}>{card.icon}</span>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)' }}>{card.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Collection table */}
            {loading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground, #6b7280)', fontSize: 13 }}>
                    Loading stats…
                </div>
            )}

            {!loading && stats && (
                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'var(--muted, #f9fafb)', textAlign: 'left' }}>
                                {['Collection', 'Slug', 'Active Docs', 'Deleted', 'Last Updated'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid var(--border, #e5e7eb)', fontSize: 12 }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {stats.stats.map(row => (
                                <tr
                                    key={row.collectionId}
                                    onClick={() => onSelectCollection?.(row.collectionId)}
                                    style={{ cursor: onSelectCollection ? 'pointer' : 'default', borderBottom: '1px solid var(--border, #f3f4f6)' }}
                                    onMouseEnter={e => { if (onSelectCollection) e.currentTarget.style.background = 'var(--accent, #f9fafb)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.collectionName}</td>
                                    <td style={{ padding: '10px 14px' }}><code style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>{row.collectionSlug}</code></td>
                                    <td style={{ padding: '10px 14px' }}>{row.activeDocumentCount}</td>
                                    <td style={{ padding: '10px 14px', color: row.deletedDocumentCount > 0 ? '#ef4444' : 'var(--muted-foreground, #6b7280)' }}>
                                        {row.deletedDocumentCount}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--muted-foreground, #6b7280)' }}>
                                        {formatDate(row.latestUpdatedAt)}
                                    </td>
                                </tr>
                            ))}
                            {stats.stats.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground, #6b7280)' }}>
                                        No collections found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
