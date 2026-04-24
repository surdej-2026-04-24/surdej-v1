import { useState, useEffect } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';
import { LivshjuletChart } from '../client/LivshjuletChart.js';
import { LIVSHJULET_DIMENSIONS, type Programme, type Assessment, type LivshjuletScores } from '@surdej/module-mental-klarhed-shared';

const PROGRAMME_STATUS_LABELS: Record<string, string> = {
    INVITED: 'Inviteret',
    ACTIVE: 'Aktiv',
    COMPLETED: 'Afsluttet',
    CANCELLED: 'Annulleret',
};

const PROGRAMME_STATUS_COLORS: Record<string, string> = {
    INVITED: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-700',
    CANCELLED: 'bg-red-100 text-red-700',
};

const SESSION_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Afventer',
    ASSESSMENT_SENT: 'Test sendt',
    ASSESSMENT_DONE: 'Test udfyldt',
    MATERIAL_GENERATED: 'Materiale klar',
    MATERIAL_SENT: 'Sendt til klient',
    COMPLETED: 'Afholdt',
};

const SESSION_STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-muted text-muted-foreground',
    ASSESSMENT_SENT: 'bg-blue-100 text-blue-800',
    ASSESSMENT_DONE: 'bg-violet-100 text-violet-800',
    MATERIAL_GENERATED: 'bg-amber-100 text-amber-800',
    MATERIAL_SENT: 'bg-orange-100 text-orange-800',
    COMPLETED: 'bg-green-100 text-green-800',
};

interface Props {
    programmeId: string;
    onBack?: () => void;
    onShowMaterial?: (sessionNumber: number) => void;
}

function ScoreGrid({ scores }: { scores: LivshjuletScores }) {
    return (
        <div className="grid grid-cols-4 gap-1.5 mt-2">
            {LIVSHJULET_DIMENSIONS.map(dim => {
                const score = scores[dim.key as keyof LivshjuletScores];
                const pct = (score / 10) * 100;
                const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-400';
                return (
                    <div key={dim.key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{dim.da}</span>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-medium tabular-nums">{score}/10</span>
                    </div>
                );
            })}
        </div>
    );
}

export function ProgrammeDetail({ programmeId, onBack, onShowMaterial }: Props) {
    const api = useMentalKlarhedApi();
    const [programme, setProgramme] = useState<Programme | null>(null);
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [expandedChart, setExpandedChart] = useState<string | null>(null);

    const reload = () => {
        setLoading(true);
        Promise.all([
            api.getProgramme(programmeId),
            api.getAssessments(programmeId),
        ]).then(([prog, ass]) => {
            setProgramme(prog);
            setAssessments(ass);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, [programmeId]);

    const sendAssessment = async (sessionNumber: number) => {
        setActionLoading(`send-${sessionNumber}`);
        try {
            await api.sendAssessmentLink(programmeId, sessionNumber);
            reload();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Fejl');
        } finally {
            setActionLoading(null);
        }
    };

    const sendMaterial = async (sessionNumber: number) => {
        setActionLoading(`material-${sessionNumber}`);
        try {
            await api.sendMaterial(programmeId, sessionNumber);
            reload();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Fejl');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-6 text-muted-foreground">Indlæser...</div>;
    if (!programme) return <div className="p-6 text-destructive">Forløb ikke fundet</div>;

    const initialAssessment = assessments.find(a => a.isInitial);
    const completedSessions = programme.sessions.filter(s => s.status === 'COMPLETED').length;
    const progressPct = (completedSessions / programme.sessions.length) * 100;

    return (
        <div className="p-6 space-y-6 max-w-2xl">
            {/* Header */}
            <div className="flex items-start gap-3">
                <button onClick={onBack} className="mt-1 text-sm text-muted-foreground hover:text-foreground shrink-0">
                    ← Tilbage
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold">{programme.clientName}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROGRAMME_STATUS_COLORS[programme.status] ?? 'bg-muted'}`}>
                            {PROGRAMME_STATUS_LABELS[programme.status] ?? programme.status}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{programme.clientEmail}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        {programme.startedAt && (
                            <span>Startet {new Date(programme.startedAt).toLocaleDateString('da-DK')}</span>
                        )}
                        {programme.completedAt && (
                            <span>Afsluttet {new Date(programme.completedAt).toLocaleDateString('da-DK')}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Fremskridt</span>
                    <span>{completedSessions} / {programme.sessions.length} sessioner afholdt</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Initial assessment overview */}
            {initialAssessment && (
                <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Initialt Livshjulet</span>
                        <button
                            onClick={() => setExpandedChart(expandedChart === 'initial' ? null : 'initial')}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {expandedChart === 'initial' ? 'Skjul graf' : 'Vis radar-graf'}
                        </button>
                    </div>
                    <ScoreGrid scores={initialAssessment.scores} />
                    {expandedChart === 'initial' && (
                        <LivshjuletChart scores={initialAssessment.scores} locale="da" />
                    )}
                </div>
            )}

            {/* Sessions */}
            <div className="space-y-3">
                {programme.sessions.map(session => {
                    const sessionAssessment = assessments.find(a => a.sessionId === session.id);
                    const chartKey = `session-${session.id}`;

                    return (
                        <div key={session.id} className="border rounded-lg p-4 space-y-3">
                            {/* Session header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-sm">Session {session.sessionNumber}</span>
                                    {session.scheduledAt && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {new Date(session.scheduledAt).toLocaleDateString('da-DK')}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SESSION_STATUS_COLORS[session.status] ?? 'bg-muted'}`}>
                                    {SESSION_STATUS_LABELS[session.status] ?? session.status}
                                </span>
                            </div>

                            {/* Assessment scores */}
                            {sessionAssessment && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Livshjulet udfyldt {sessionAssessment.completedAt
                                                ? new Date(sessionAssessment.completedAt).toLocaleDateString('da-DK')
                                                : ''}
                                        </span>
                                        <button
                                            onClick={() => setExpandedChart(expandedChart === chartKey ? null : chartKey)}
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            {expandedChart === chartKey ? 'Skjul graf' : 'Vis radar-graf'}
                                        </button>
                                    </div>
                                    <ScoreGrid scores={sessionAssessment.scores} />
                                    {expandedChart === chartKey && (
                                        <LivshjuletChart
                                            scores={sessionAssessment.scores}
                                            comparisonScores={initialAssessment?.scores}
                                            locale="da"
                                        />
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 flex-wrap">
                                {session.status === 'PENDING' && (
                                    <button
                                        onClick={() => sendAssessment(session.sessionNumber)}
                                        disabled={actionLoading === `send-${session.sessionNumber}`}
                                        className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                                    >
                                        {actionLoading === `send-${session.sessionNumber}` ? '...' : 'Send Livshjulet-test'}
                                    </button>
                                )}

                                {session.status === 'MATERIAL_GENERATED' && (
                                    <>
                                        <button
                                            onClick={() => onShowMaterial?.(session.sessionNumber)}
                                            className="text-xs px-3 py-1.5 border rounded hover:bg-muted"
                                        >
                                            Gennemse materiale
                                        </button>
                                        <button
                                            onClick={() => sendMaterial(session.sessionNumber)}
                                            disabled={actionLoading === `material-${session.sessionNumber}`}
                                            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                                        >
                                            {actionLoading === `material-${session.sessionNumber}` ? '...' : 'Send til klient'}
                                        </button>
                                    </>
                                )}

                                {(session.status === 'MATERIAL_SENT' || (session.status === 'COMPLETED' && session.hasMaterial)) && (
                                    <button
                                        onClick={() => onShowMaterial?.(session.sessionNumber)}
                                        className="text-xs px-3 py-1.5 border rounded hover:bg-muted"
                                    >
                                        Se sendt materiale
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
