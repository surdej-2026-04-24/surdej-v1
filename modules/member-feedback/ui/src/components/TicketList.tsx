import { useState, useEffect, useCallback } from 'react';
import { useTicketApi } from '../hooks/useTicketApi.js';
import type { Ticket, TicketStatus, TicketPriority } from '@surdej/module-member-feedback-shared';

const STATUS_LABELS: Record<string, string> = {
    new: 'Ny',
    open: 'Åben',
    in_progress: 'I gang',
    waiting_customer: 'Afventer kunde',
    waiting_internal: 'Afventer intern',
    resolved: 'Løst',
    closed: 'Lukket',
    reopened: 'Genåbnet',
};

const STATUS_COLORS: Record<string, string> = {
    new: '#3b82f6',
    open: '#f59e0b',
    in_progress: '#8b5cf6',
    waiting_customer: '#ec4899',
    waiting_internal: '#f97316',
    resolved: '#22c55e',
    closed: '#6b7280',
    reopened: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#3b82f6',
    low: '#6b7280',
};

interface TicketListProps {
    onSelect?: (ticket: Ticket) => void;
    selectedId?: string;
}

export function TicketList({ onSelect, selectedId }: TicketListProps) {
    const api = useTicketApi();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');

    const loadTickets = useCallback(async () => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            if (statusFilter) filters.status = statusFilter;
            if (priorityFilter) filters.priority = priorityFilter;
            const res = await api.list(filters);
            setTickets(res.items);
        } catch (e) {
            console.error('Failed to load tickets:', e);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, priorityFilter]);

    useEffect(() => { loadTickets(); }, [loadTickets]);

    const statusCounts = tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Filters */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', gap: 8 }}>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', fontSize: 12, background: 'var(--background, #fff)', color: 'var(--foreground, #111827)' }}
                >
                    <option value="">Alle status</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v} {statusCounts[k] ? `(${statusCounts[k]})` : ''}</option>
                    ))}
                </select>
                <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', fontSize: 12, background: 'var(--background, #fff)', color: 'var(--foreground, #111827)' }}
                >
                    <option value="">Alle prioriteter</option>
                    <option value="critical">Kritisk</option>
                    <option value="high">Høj</option>
                    <option value="medium">Medium</option>
                    <option value="low">Lav</option>
                </select>
                <button
                    onClick={loadTickets}
                    style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', fontSize: 12, cursor: 'pointer', background: 'var(--background, #fff)', color: 'var(--foreground, #111827)' }}
                >
                    ↻ Opdater
                </button>
            </div>

            {/* Ticket list */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {loading && <div style={{ padding: 16, color: 'var(--muted-foreground, #9ca3af)', fontSize: 13 }}>Indlæser tickets...</div>}
                {!loading && tickets.length === 0 && (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground, #9ca3af)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
                        <div style={{ fontSize: 13 }}>Ingen tickets endnu</div>
                    </div>
                )}
                {tickets.map(ticket => (
                    <div
                        key={ticket.id}
                        onClick={() => onSelect?.(ticket)}
                        style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border, #f3f4f6)',
                            cursor: 'pointer',
                            background: selectedId === ticket.id ? 'var(--accent, #f0f4ff)' : 'transparent',
                            transition: 'background 150ms',
                        }}
                        onMouseEnter={e => { if (selectedId !== ticket.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--muted, #f9fafb)'; }}
                        onMouseLeave={e => { if (selectedId !== ticket.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: 'var(--muted-foreground, #6b7280)',
                                fontWeight: 600,
                            }}>
                                {ticket.ticketNumber}
                            </span>
                            <span style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 9999,
                                color: '#fff',
                                background: STATUS_COLORS[ticket.status] ?? '#6b7280',
                                fontWeight: 600,
                            }}>
                                {STATUS_LABELS[ticket.status] ?? ticket.status}
                            </span>
                            <span style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 9999,
                                color: '#fff',
                                background: PRIORITY_COLORS[ticket.priority] ?? '#6b7280',
                                fontWeight: 600,
                                marginLeft: 'auto',
                            }}>
                                {ticket.priority}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{ticket.title}</div>
                        {ticket.aiAnalysis && (
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground, #9ca3af)', display: 'flex', gap: 8 }}>
                                <span>🤖 {(ticket.aiAnalysis as any).suggestedRoute}</span>
                                <span>• {(ticket.aiAnalysis as any).sentiment}</span>
                            </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--muted-foreground, #9ca3af)', marginTop: 4 }}>
                            {new Date(ticket.createdAt).toLocaleString('da-DK')}
                            {ticket.reporterName && <span> • {ticket.reporterName}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
