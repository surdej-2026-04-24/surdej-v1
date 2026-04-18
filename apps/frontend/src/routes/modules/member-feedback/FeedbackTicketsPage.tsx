import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { TicketList, TicketDetail, TicketCreate } from '@surdej/module-member-feedback-ui';
import type { Ticket } from '@surdej/module-member-feedback-shared';
import { useTranslation } from '@/core/i18n';

type View = 'list' | 'detail' | 'create';

export function FeedbackTicketsPage() {
    const { ticketId } = useParams<{ ticketId?: string }>();
    const navigate = useNavigate();
    const [view, setView] = useState<View>(ticketId ? 'detail' : 'list');
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(ticketId ?? null);
    const { t } = useTranslation();

    // Sync URL param
    useEffect(() => {
        if (ticketId && ticketId !== selectedTicketId) {
            setSelectedTicketId(ticketId);
            setView('detail');
        }
    }, [ticketId]);

    const handleSelect = useCallback((ticket: Ticket) => {
        setSelectedTicketId(ticket.id);
        setView('detail');
        navigate(`/modules/member-feedback/tickets/${ticket.id}`, { replace: true });
    }, [navigate]);

    const handleBack = useCallback(() => {
        setView('list');
        setSelectedTicketId(null);
        navigate('/modules/member-feedback/tickets', { replace: true });
    }, [navigate]);

    const handleCreate = useCallback(() => {
        setView('create');
    }, []);

    const handleCreated = useCallback((id: string) => {
        setSelectedTicketId(id);
        setView('detail');
        navigate(`/modules/member-feedback/tickets/${id}`, { replace: true });
    }, [navigate]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top bar */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>
                    🎫
                </div>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('feedbackTickets.title')}</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        {t('feedbackTickets.subtitle')}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {view !== 'list' && (
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid var(--border, #d1d5db)',
                                background: 'var(--background, #fff)',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            {t('feedbackTickets.overview')}
                        </button>
                    )}
                    {view !== 'create' && (
                        <button
                            onClick={handleCreate}
                            style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: 'none',
                                background: 'var(--primary, #3b82f6)',
                                color: '#fff',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            }}
                        >
                            {t('feedbackTickets.newTicket')}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view === 'list' && (
                    <div style={{ flex: 1 }}>
                        <TicketList onSelect={handleSelect} selectedId={selectedTicketId ?? undefined} />
                    </div>
                )}

                {view === 'detail' && selectedTicketId && (
                    <div style={{ flex: 1 }}>
                        <TicketDetail ticketId={selectedTicketId} onBack={handleBack} />
                    </div>
                )}

                {view === 'create' && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <TicketCreate onCreated={handleCreated} />
                    </div>
                )}
            </div>
        </div>
    );
}
