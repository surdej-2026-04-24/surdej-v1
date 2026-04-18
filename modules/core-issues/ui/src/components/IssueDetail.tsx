import { useState, useEffect, useCallback } from 'react';
import { useIssueApi } from '../hooks/useIssueApi.js';
import type { Issue, IssueEvent } from '@surdej/module-core-issues-shared';

const STATUS_LABELS: Record<string, string> = {
    open: 'Åben', in_progress: 'I gang', closed: 'Lukket',
};

const STATUS_COLORS: Record<string, string> = {
    open: '#3b82f6', in_progress: '#8b5cf6', closed: '#22c55e',
};

const PRIORITY_EMOJI: Record<string, string> = {
    high: '🔴', medium: '🟡', low: '🟢',
};

const EVENT_LABELS: Record<string, string> = {
    created: 'Oprettet', edited: 'Redigeret', status_changed: 'Status ændret',
    priority_changed: 'Prioritet ændret', assigned: 'Tildelt', unassigned: 'Fjernet tildeling',
    label_added: 'Label tilføjet', label_removed: 'Label fjernet',
    commented: 'Kommenteret', archived: 'Arkiveret', restored: 'Gendannet',
    due_date_set: 'Deadline sat',
};

interface Comment {
    id: string;
    issueId: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface IssueDetailProps {
    issueId: string;
    onBack?: () => void;
}

export function IssueDetail({ issueId, onBack }: IssueDetailProps) {
    const api = useIssueApi();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [history, setHistory] = useState<IssueEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [i, c, h] = await Promise.all([
                api.get(issueId),
                api.listComments(issueId),
                api.getHistory(issueId),
            ]);
            setIssue(i);
            setComments(c.items as Comment[]);
            setHistory(h.items as IssueEvent[]);
        } catch (e) {
            console.error('Failed to load issue:', e);
        } finally {
            setLoading(false);
        }
    }, [issueId]);

    useEffect(() => { load(); }, [load]);

    const handleStatusChange = async (newStatus: string) => {
        if (!issue) return;
        try {
            await api.update(issueId, { status: newStatus as any });
            await load();
        } catch (e) {
            alert(`Status ændring fejlede: ${e instanceof Error ? e.message : 'Ukendt fejl'}`);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || sending) return;
        setSending(true);
        try {
            await api.createComment(issueId, { body: commentText, authorId: '00000000-0000-0000-0000-000000000000' });
            setCommentText('');
            await load();
        } catch (e) {
            console.error('Failed to add comment:', e);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div style={{ padding: 24, color: 'var(--muted-foreground)' }}>Indlæser...</div>;
    if (!issue) return <div style={{ padding: 24, color: 'var(--destructive)' }}>Issue ikke fundet</div>;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    {onBack && (
                        <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>←</button>
                    )}
                    <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 9999,
                        color: '#fff', background: STATUS_COLORS[issue.status] ?? '#6b7280', fontWeight: 600,
                    }}>
                        {STATUS_LABELS[issue.status] ?? issue.status}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {PRIORITY_EMOJI[issue.priority]} {issue.priority}
                    </span>
                    {issue.dueDate && (
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                            📅 {new Date(issue.dueDate).toLocaleDateString('da-DK')}
                        </span>
                    )}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{issue.title}</h2>
                {issue.description && (
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {issue.description}
                    </p>
                )}

                {/* Status transition buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {Object.keys(STATUS_LABELS).filter(s => s !== issue.status).map(s => (
                        <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                border: `1px solid ${STATUS_COLORS[s] ?? '#d1d5db'}`,
                                color: STATUS_COLORS[s] ?? '#374151',
                                background: 'transparent', cursor: 'pointer',
                            }}
                        >
                            → {STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>

                {/* Labels */}
                {issue.labelIds.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {issue.labelIds.map(lid => (
                            <span key={lid} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                                background: 'var(--muted, #f3f4f6)', color: 'var(--muted-foreground)',
                            }}>
                                🏷️ {lid.substring(0, 8)}
                            </span>
                        ))}
                    </div>
                )}

                {/* Meta */}
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 8 }}>
                    Oprettet: {new Date(issue.createdAt).toLocaleString('da-DK')}
                    {issue.archivedAt && <span style={{ color: 'var(--destructive)', marginLeft: 12 }}>🗂️ Arkiveret</span>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #e5e7eb)', padding: '0 20px' }}>
                {(['comments', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            border: 'none', background: 'none',
                            borderBottom: activeTab === tab ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
                            color: activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)',
                        }}
                    >
                        {tab === 'comments' ? `💬 Kommentarer (${comments.length})` : `📜 Historik (${history.length})`}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {activeTab === 'comments' && (
                    <div>
                        {comments.length === 0 && (
                            <div style={{ color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                                Ingen kommentarer endnu
                            </div>
                        )}
                        {comments.map(c => (
                            <div key={c.id} style={{
                                marginBottom: 12, padding: 12, borderRadius: 8,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'var(--card, #fff)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
                                    <strong>👤 {c.authorId.substring(0, 8)}…</strong>
                                    <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
                                        {new Date(c.createdAt).toLocaleString('da-DK')}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                            </div>
                        ))}

                        {/* Add comment */}
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 16 }}>
                            <textarea
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                placeholder="Skriv en kommentar… (brug @brugernavn for mentions)"
                                rows={3}
                                style={{
                                    width: '100%', padding: 10, borderRadius: 8,
                                    border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                                    background: 'var(--background)', color: 'var(--foreground)',
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <button
                                    onClick={handleComment}
                                    disabled={sending || !commentText.trim()}
                                    style={{
                                        padding: '6px 16px', borderRadius: 6,
                                        border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff',
                                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                        opacity: sending || !commentText.trim() ? 0.5 : 1,
                                    }}
                                >
                                    {sending ? 'Sender…' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        {history.length === 0 && (
                            <div style={{ color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                                Ingen historik endnu
                            </div>
                        )}
                        {history.map((evt: any) => (
                            <div key={evt.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                marginBottom: 12, padding: '8px 0',
                                borderBottom: '1px solid var(--border, #f3f4f6)',
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', marginTop: 5,
                                    background: 'var(--primary, #3b82f6)',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>
                                        {EVENT_LABELS[evt.eventType] ?? evt.eventType}
                                    </div>
                                    {evt.oldValue && evt.newValue && (
                                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                                            {evt.oldValue} → {evt.newValue}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>
                                        {evt.actorId?.substring(0, 8)}… • {new Date(evt.createdAt).toLocaleString('da-DK')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
