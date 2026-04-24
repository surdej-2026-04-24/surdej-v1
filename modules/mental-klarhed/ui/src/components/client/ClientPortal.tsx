import { useState, useEffect } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';
import { LivshjuletForm } from './LivshjuletForm.js';
import type { ClientPortalState } from '@surdej/module-mental-klarhed-shared';

const SESSION_STATUS_LABELS: Record<string, Record<'da' | 'en', string>> = {
    PENDING: { da: 'Afventer', en: 'Pending' },
    ASSESSMENT_SENT: { da: 'Test tilgængelig', en: 'Assessment available' },
    ASSESSMENT_DONE: { da: 'Test udfyldt', en: 'Assessment submitted' },
    MATERIAL_GENERATED: { da: 'Materiale klar', en: 'Material ready' },
    MATERIAL_SENT: { da: 'Materiale modtaget', en: 'Material received' },
    COMPLETED: { da: 'Afholdt', en: 'Completed' },
};

export function ClientPortal() {
    const api = useMentalKlarhedApi();
    const [state, setState] = useState<ClientPortalState | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAssessment, setShowAssessment] = useState(false);

    useEffect(() => {
        api.getPortalState()
            .then(s => {
                setState(s);
                // Auto-show assessment if pending
                if (s.pendingAssessment) setShowAssessment(true);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-6 text-muted-foreground">Indlæser dit forløb...</div>;
    if (!state) return <div className="p-6 text-destructive">Forløb ikke fundet. Kontakt Asger.</div>;

    const locale = state.locale;

    if (showAssessment && state.pendingAssessment) {
        return (
            <LivshjuletForm
                sessionId={state.pendingAssessment.sessionId}
                sessionNumber={state.pendingAssessment.sessionNumber}
                isFinal={state.pendingAssessment.isFinal}
                locale={locale}
                onCompleted={() => {
                    setShowAssessment(false);
                    // Reload state
                    setLoading(true);
                    api.getPortalState().then(setState).finally(() => setLoading(false));
                }}
            />
        );
    }

    const greeting = locale === 'da'
        ? `Hej ${state.clientName}`
        : `Hi ${state.clientName}`;

    const programmeLabel = locale === 'da' ? 'Dit forløb' : 'Your programme';
    const sessionLabel = locale === 'da' ? 'Session' : 'Session';

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Mental Klarhed</h1>
                <p className="text-muted-foreground text-sm mt-1">{greeting}</p>
            </div>

            {state.pendingAssessment && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                    <p className="font-medium text-sm">
                        {locale === 'da'
                            ? `Din Livshjulet-test til session ${state.pendingAssessment.sessionNumber} er klar`
                            : `Your Life Wheel assessment for session ${state.pendingAssessment.sessionNumber} is ready`}
                    </p>
                    <button
                        onClick={() => setShowAssessment(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
                    >
                        {locale === 'da' ? 'Udfyld nu' : 'Complete now'}
                    </button>
                </div>
            )}

            <div>
                <h2 className="text-base font-medium mb-3">{programmeLabel}</h2>
                <div className="divide-y divide-border border rounded-lg overflow-hidden">
                    {state.programme.sessions.map(session => (
                        <div key={session.id} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    session.status === 'COMPLETED'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    {session.sessionNumber}
                                </span>
                                <span className="text-sm">{sessionLabel} {session.sessionNumber}</span>
                                {session.scheduledAt && (
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(session.scheduledAt).toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB')}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {SESSION_STATUS_LABELS[session.status]?.[locale] ?? session.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
