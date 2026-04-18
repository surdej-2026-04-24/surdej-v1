/**
 * Core Issues — Dashboard page
 * Shows summary stats, recent issues, and quick actions.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useIssueApi } from '@surdej/module-core-issues-ui';
import type { Issue } from '@surdej/module-core-issues-shared';

export function IssuesDashboard() {
    const api = useIssueApi();
    const navigate = useNavigate();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.list({ limit: 100, includeArchived: false })
            .then(res => setIssues(res.items))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const open = issues.filter(i => i.status === 'open');
    const inProgress = issues.filter(i => i.status === 'in_progress');
    const closed = issues.filter(i => i.status === 'closed');
    const highPriority = issues.filter(i => i.priority === 'high' && i.status !== 'closed');

    const stats = [
        { label: 'Åbne', value: open.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { label: 'I gang', value: inProgress.length, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        { label: 'Lukket', value: closed.length, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        { label: 'Kritiske', value: highPriority.length, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    ];

    const recent = issues
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

    const statusBadge = (s: string) => {
        const map: Record<string, { label: string; color: string; bg: string }> = {
            open: { label: 'Åben', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
            in_progress: { label: 'I gang', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
            closed: { label: 'Lukket', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        };
        const v = map[s] ?? { label: s, color: '#6b7280', bg: '#f3f4f6' };
        return (
            <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                color: v.color, background: v.bg,
            }}>
                {v.label}
            </span>
        );
    };

    const priorityDot = (p: string) => {
        const colors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
        return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colors[p] ?? '#6b7280' }} />;
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h2>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: '4px 0 0' }}>
                    Overblik over alle issues
                </p>
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        padding: '16px 20px', borderRadius: 12,
                        border: '1px solid var(--border, #e5e7eb)',
                        background: 'var(--card, #fff)',
                    }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{loading ? '—' : s.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                <button
                    onClick={() => navigate('/modules/core-issues/new')}
                    style={{
                        padding: '8px 18px', borderRadius: 8,
                        border: 'none', background: 'var(--primary, #6366f1)', color: '#fff',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                >
                    + Ny Issue
                </button>
                <button
                    onClick={() => navigate('/modules/core-issues/issues')}
                    style={{
                        padding: '8px 18px', borderRadius: 8,
                        border: '1px solid var(--border, #d1d5db)', background: 'var(--background, #fff)',
                        fontSize: 13, cursor: 'pointer',
                    }}
                >
                    Se alle issues
                </button>
                <button
                    onClick={() => navigate('/modules/core-issues/labels')}
                    style={{
                        padding: '8px 18px', borderRadius: 8,
                        border: '1px solid var(--border, #d1d5db)', background: 'var(--background, #fff)',
                        fontSize: 13, cursor: 'pointer',
                    }}
                >
                    🏷️ Administrer labels
                </button>
            </div>

            {/* Recent issues */}
            <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Senest opdateret</h3>
                {loading ? (
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Indlæser…</div>
                ) : recent.length === 0 ? (
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', padding: 32 }}>
                        Ingen issues endnu — opret den første!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {recent.map(issue => (
                            <button
                                key={issue.id}
                                onClick={() => navigate(`/modules/core-issues/issues/${issue.id}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px', borderRadius: 8,
                                    border: '1px solid var(--border, #e5e7eb)',
                                    background: 'var(--card, #fff)',
                                    cursor: 'pointer', textAlign: 'left', width: '100%',
                                    transition: 'box-shadow 0.15s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                {priorityDot(issue.priority)}
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{issue.title}</span>
                                {statusBadge(issue.status)}
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)' }}>
                                    {new Date(issue.updatedAt).toLocaleDateString('da-DK')}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
