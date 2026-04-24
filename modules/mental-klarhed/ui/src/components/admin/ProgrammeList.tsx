import { useState, useEffect } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';
import type { ProgrammeListResponse } from '@surdej/module-mental-klarhed-shared';

const STATUS_LABELS: Record<string, string> = {
    INVITED: 'Inviteret',
    ACTIVE: 'Aktiv',
    COMPLETED: 'Afsluttet',
    CANCELLED: 'Annulleret',
};

interface Props {
    onSelect?: (programmeId: string) => void;
    onCreate?: () => void;
}

export function ProgrammeList({ onSelect, onCreate }: Props) {
    const api = useMentalKlarhedApi();
    const [data, setData] = useState<ProgrammeListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.listProgrammes()
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-6 text-muted-foreground">Indlæser forløb...</div>;
    if (error) return <div className="p-6 text-destructive">{error}</div>;

    return (
        <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Mental Klarhed — Forløb</h2>
                <button
                    onClick={onCreate}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
                >
                    + Nyt forløb
                </button>
            </div>

            {!data?.items.length ? (
                <p className="text-muted-foreground text-sm">Ingen forløb endnu.</p>
            ) : (
                <div className="divide-y divide-border border rounded-lg overflow-hidden">
                    {data.items.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelect?.(p.id)}
                            className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between"
                        >
                            <div>
                                <p className="font-medium text-sm">{p.clientName}</p>
                                <p className="text-xs text-muted-foreground">{p.clientEmail}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                    {p.sessions.filter(s => s.status === 'COMPLETED').length}/5 sessioner
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                                    {STATUS_LABELS[p.status] ?? p.status}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
