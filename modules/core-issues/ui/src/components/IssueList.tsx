import { useState, useEffect, useCallback } from 'react';
import { useIssueApi } from '../hooks/useIssueApi.js';
import type { Issue, IssueFilter } from '@surdej/module-core-issues-shared';

const STATUS_LABELS: Record<string, string> = {
    open: 'Åben', in_progress: 'I gang', closed: 'Lukket',
};

const STATUS_COLORS: Record<string, string> = {
    open: '#3b82f6', in_progress: '#8b5cf6', closed: '#22c55e',
};

const PRIORITY_EMOJI: Record<string, string> = {
    high: '🔴', medium: '🟡', low: '🟢',
};

interface IssueListProps {
    onSelect?: (issueId: string) => void;
}

export function IssueList({ onSelect }: IssueListProps) {
    const api = useIssueApi();
    const [items, setItems] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(async (cursor?: string) => {
        const isLoadMore = !!cursor;
        if (isLoadMore) setLoadingMore(true); else setLoading(true);

        try {
            const filter: Partial<IssueFilter> = { limit: 25 };
            if (statusFilter) filter.status = statusFilter as any;
            if (priorityFilter) filter.priority = priorityFilter as any;
            if (searchQuery) filter.q = searchQuery;
            if (cursor) filter.cursor = cursor as any;

            const res = await api.list(filter);
            if (isLoadMore) {
                setItems(prev => [...prev, ...res.items]);
            } else {
                setItems(res.items);
            }
            setTotal(res.total);
            setNextCursor(res.nextCursor);
        } catch (e) {
            console.error('Failed to load issues:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [statusFilter, priorityFilter, searchQuery]);

    useEffect(() => { load(); }, [load]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Filter bar */}
            <div style={{
                display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                background: 'var(--muted, #f9fafb)',
            }}>
                <input
                    type="text"
                    placeholder="🔍 Søg issues…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 12,
                        background: 'var(--background)', color: 'var(--foreground)',
                    }}
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 12,
                        background: 'var(--background)', color: 'var(--foreground)',
                    }}
                >
                    <option value="">Alle statuser</option>
                    <option value="open">Åben</option>
                    <option value="in_progress">I gang</option>
                    <option value="closed">Lukket</option>
                </select>
                <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value)}
                    style={{
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', fontSize: 12,
                        background: 'var(--background)', color: 'var(--foreground)',
                    }}
                >
                    <option value="">Alle prioriteter</option>
                    <option value="high">Høj</option>
                    <option value="medium">Mellem</option>
                    <option value="low">Lav</option>
                </select>
            </div>

            {/* Total count */}
            <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--muted-foreground)' }}>
                {total} issue{total !== 1 ? 's' : ''} fundet
            </div>

            {/* Issue list */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
                {loading ? (
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 13, padding: 24, textAlign: 'center' }}>
                        Indlæser…
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 13, padding: 24, textAlign: 'center' }}>
                        Ingen issues fundet
                    </div>
                ) : (
                    <>
                        {items.map(item => (
                            <div
                                key={item.id}
                                onClick={() => onSelect?.(item.id)}
                                style={{
                                    padding: '12px 14px', marginBottom: 6, borderRadius: 8,
                                    border: '1px solid var(--border, #e5e7eb)',
                                    cursor: onSelect ? 'pointer' : 'default',
                                    background: item.archivedAt ? 'var(--muted, #f9fafb)' : 'var(--card, #fff)',
                                    opacity: item.archivedAt ? 0.6 : 1,
                                    transition: 'box-shadow 0.15s',
                                }}
                                onMouseEnter={e => { if (onSelect) (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'); }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>{PRIORITY_EMOJI[item.priority] ?? '⚪'}</span>
                                    <h3 style={{
                                        fontSize: 13, fontWeight: 600, margin: 0, flex: 1,
                                        textDecoration: item.archivedAt ? 'line-through' : 'none',
                                    }}>
                                        {item.title}
                                    </h3>
                                    <span style={{
                                        fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                                        color: '#fff', background: STATUS_COLORS[item.status] ?? '#6b7280',
                                        fontWeight: 600,
                                    }}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </span>
                                </div>
                                {item.description && (
                                    <p style={{
                                        fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0 22px',
                                        lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap', maxWidth: 400,
                                    }}>
                                        {item.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: 8, marginTop: 6, marginLeft: 22, fontSize: 10, color: 'var(--muted-foreground)' }}>
                                    {item.dueDate && <span>📅 {new Date(item.dueDate).toLocaleDateString('da-DK')}</span>}
                                    {item.assigneeIds.length > 0 && <span>👥 {item.assigneeIds.length}</span>}
                                    {item.labelIds.length > 0 && <span>🏷️ {item.labelIds.length}</span>}
                                    {item.archivedAt && <span>🗂️ Arkiveret</span>}
                                </div>
                            </div>
                        ))}

                        {/* Load more */}
                        {nextCursor && (
                            <div style={{ textAlign: 'center', padding: 12 }}>
                                <button
                                    onClick={() => load(nextCursor)}
                                    disabled={loadingMore}
                                    style={{
                                        padding: '6px 20px', borderRadius: 6,
                                        border: '1px solid var(--border, #d1d5db)', background: 'transparent',
                                        fontSize: 12, cursor: 'pointer',
                                        opacity: loadingMore ? 0.5 : 1,
                                    }}
                                >
                                    {loadingMore ? 'Indlæser…' : 'Indlæs flere'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
