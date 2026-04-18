import { useState, useEffect, useCallback } from 'react';
import { useTicketApi } from '../hooks/useTicketApi.js';
import type { Ticket, TicketComment, TicketTransition, AiAnalysis, TicketStatus } from '@surdej/module-member-feedback-shared';
import { VALID_TRANSITIONS } from '@surdej/module-member-feedback-shared';

const STATUS_LABELS: Record<string, string> = {
    new: 'Ny', open: 'Åben', in_progress: 'I gang',
    waiting_customer: 'Afventer kunde', waiting_internal: 'Afventer intern',
    resolved: 'Løst', closed: 'Lukket', reopened: 'Genåbnet',
};

const STATUS_COLORS: Record<string, string> = {
    new: '#3b82f6', open: '#f59e0b', in_progress: '#8b5cf6',
    waiting_customer: '#ec4899', waiting_internal: '#f97316',
    resolved: '#22c55e', closed: '#6b7280', reopened: '#ef4444',
};

interface TicketDetailProps {
    ticketId: string;
    onBack?: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
    const api = useTicketApi();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [transitions, setTransitions] = useState<TicketTransition[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'comments' | 'history' | 'ai'>('comments');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, c, tr] = await Promise.all([
                api.get(ticketId),
                api.getComments(ticketId),
                api.getTransitions(ticketId),
            ]);
            setTicket(t);
            setComments(c);
            setTransitions(tr);
        } catch (e) {
            console.error('Failed to load ticket:', e);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);

    const handleTransition = async (toStatus: TicketStatus) => {
        if (!ticket) return;
        const reason = prompt(`Årsag for overgang til "${STATUS_LABELS[toStatus]}"?`);
        try {
            await api.transition(ticketId, { toStatus, reason: reason ?? undefined });
            await load();
        } catch (e) {
            alert(`Transition fejlede: ${e instanceof Error ? e.message : 'Ukendt fejl'}`);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || sending) return;
        setSending(true);
        try {
            await api.addComment(ticketId, { content: commentText, isInternal });
            setCommentText('');
            setIsInternal(false);
            await load();
        } catch (e) {
            console.error('Failed to add comment:', e);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div style={{ padding: 24, color: 'var(--muted-foreground)' }}>Indlæser...</div>;
    if (!ticket) return <div style={{ padding: 24, color: 'var(--destructive)' }}>Ticket ikke fundet</div>;

    const ai = ticket.aiAnalysis as AiAnalysis | undefined;
    const allowedTransitions = VALID_TRANSITIONS[ticket.status as TicketStatus] ?? [];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    {onBack && (
                        <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>←</button>
                    )}
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                        {ticket.ticketNumber}
                    </span>
                    <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 9999,
                        color: '#fff', background: STATUS_COLORS[ticket.status] ?? '#6b7280', fontWeight: 600,
                    }}>
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{ticket.title}</h2>
                {ticket.description && (
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', margin: 0, lineHeight: 1.5 }}>
                        {ticket.description}
                    </p>
                )}

                {/* Meta row */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                    <span>📋 {ticket.category}</span>
                    <span>🔥 {ticket.priority}</span>
                    <span>👤 {ticket.reporterName ?? ticket.reporterEmail ?? ticket.reporterId}</span>
                    {ticket.assigneeName && <span>→ {ticket.assigneeName}</span>}
                    {ticket.feedbackSessionId && (
                        <a href={`/feedback/${ticket.feedbackSessionId}`} style={{ color: 'var(--primary, #3b82f6)', textDecoration: 'none' }}>
                            🔗 Feedback Session
                        </a>
                    )}
                </div>

                {/* Transition buttons */}
                {allowedTransitions.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                        {allowedTransitions.map(s => (
                            <button
                                key={s}
                                onClick={() => handleTransition(s)}
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
                )}

                {/* Customer link */}
                {ticket.customerUrl && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
                        🔗 Kundelink: <code style={{ background: 'var(--muted, #f3f4f6)', padding: '2px 6px', borderRadius: 4 }}>
                            {ticket.customerUrl}
                        </code>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #e5e7eb)', padding: '0 20px' }}>
                {(['comments', 'history', 'ai'] as const).map(tab => (
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
                        {tab === 'comments' ? `💬 Kommentarer (${comments.length})` :
                            tab === 'history' ? `📜 Historik (${transitions.length})` :
                                '🤖 AI Analyse'}
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
                                marginBottom: 12, padding: 12,
                                borderRadius: 8,
                                border: `1px solid ${c.isInternal ? '#fde68a' : 'var(--border, #e5e7eb)'}`,
                                background: c.isInternal ? '#fefce8' : 'var(--card, #fff)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
                                    <strong>{c.authorName ?? c.authorEmail ?? 'System'}</strong>
                                    {c.isInternal && <span style={{ color: '#b45309', fontSize: 10, fontWeight: 600 }}>INTERN</span>}
                                    <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
                                        {new Date(c.createdAt).toLocaleString('da-DK')}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                            </div>
                        ))}

                        {/* Add comment */}
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 16 }}>
                            <textarea
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                placeholder="Skriv en kommentar..."
                                rows={3}
                                style={{
                                    width: '100%', padding: 10, borderRadius: 8,
                                    border: '1px solid var(--border, #d1d5db)', fontSize: 13,
                                    resize: 'vertical', fontFamily: 'inherit',
                                    background: 'var(--background, #fff)', color: 'var(--foreground, #111827)',
                                }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isInternal}
                                        onChange={e => setIsInternal(e.target.checked)}
                                    />
                                    Intern note (ikke synlig for kunden)
                                </label>
                                <button
                                    onClick={handleComment}
                                    disabled={sending || !commentText.trim()}
                                    style={{
                                        marginLeft: 'auto', padding: '6px 16px', borderRadius: 6,
                                        border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff',
                                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                        opacity: sending || !commentText.trim() ? 0.5 : 1,
                                    }}
                                >
                                    {sending ? 'Sender...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        {transitions.map(t => (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                marginBottom: 12, padding: '8px 0',
                                borderBottom: '1px solid var(--border, #f3f4f6)',
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', marginTop: 5,
                                    background: STATUS_COLORS[t.toStatus] ?? '#6b7280',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>
                                        {STATUS_LABELS[t.fromStatus]} → {STATUS_LABELS[t.toStatus]}
                                    </div>
                                    {t.reason && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{t.reason}</div>}
                                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>
                                        {t.changedByName ?? 'System'} • {new Date(t.createdAt).toLocaleString('da-DK')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div>
                        {!ai ? (
                            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted-foreground)' }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                                <div style={{ fontSize: 13 }}>Ingen AI-analyse tilgængelig</div>
                                <div style={{ fontSize: 11, marginTop: 4 }}>Analysen genereres automatisk ved oprettelse og statusskift</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <AiCard label="Sentiment" value={ai.sentiment} emoji={
                                    ai.sentiment === 'positive' ? '😊' : ai.sentiment === 'negative' ? '😟' : ai.sentiment === 'frustrated' ? '😤' : '😐'
                                } />
                                <AiCard label="Urgency" value={ai.urgency} emoji={
                                    ai.urgency === 'critical' ? '🔴' : ai.urgency === 'high' ? '🟠' : ai.urgency === 'medium' ? '🟡' : '🟢'
                                } />
                                <AiCard label="Foreslået kategori" value={ai.suggestedCategory} emoji="📂" />
                                <AiCard label="Foreslået prioritet" value={ai.suggestedPriority} emoji="🎯" />
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <AiCard label="Foreslået routing" value={ai.suggestedRoute} emoji="🔀" />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{
                                        padding: 16, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
                                        background: 'var(--card, #fff)',
                                    }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                                            💡 Foreslået næste svar
                                        </div>
                                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                            {ai.nextBestAnswer}
                                        </div>
                                        <button
                                            onClick={() => { setCommentText(ai.nextBestAnswer); setActiveTab('comments'); }}
                                            style={{
                                                marginTop: 8, padding: '4px 10px', borderRadius: 6,
                                                border: '1px solid var(--primary, #3b82f6)',
                                                color: 'var(--primary, #3b82f6)',
                                                background: 'transparent', fontSize: 11, cursor: 'pointer',
                                            }}
                                        >
                                            Brug som kommentar ↗
                                        </button>
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{
                                        padding: 12, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
                                        background: 'var(--card, #fff)',
                                    }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                                            📝 Opsummering
                                        </div>
                                        <div style={{ fontSize: 13 }}>{ai.summary}</div>
                                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {ai.keywords.map(kw => (
                                                <span key={kw} style={{
                                                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                                    background: 'var(--muted, #f3f4f6)', color: 'var(--muted-foreground)',
                                                }}>
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted-foreground)' }}>
                                            Confidence: {(ai.confidence * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AiCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
    return (
        <div style={{
            padding: 12, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--card, #fff)',
        }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16 }}>{emoji} <span style={{ fontWeight: 500 }}>{value}</span></div>
        </div>
    );
}
