/**
 * Workflow Favorites — Landing page for /modules/workflow
 *
 * Shows the user's recent workflow sessions and favorite (frequently-used) workflows.
 * The "Directory" link leads to the full browsable catalog.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
    Workflow, Star, ArrowRight, Activity, Clock, BookOpen,
    Play, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fetchActiveUseCases, type ActiveUseCase } from './use-case-api';
import { useTranslation } from '@/core/i18n';

type ActiveUseCaseWithTags = ActiveUseCase & { workflowTags?: { label: string; color: string }[] };

interface WorkflowSession {
    id: string;
    useCaseId: string;
    userId: string;
    status: string;
    currentStepIdx: number;
    updatedAt: string;
    useCase: { label: string; icon: string };
}

export function WorkflowFavoritesPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<WorkflowSession[]>([]);
    const [workflows, setWorkflows] = useState<ActiveUseCaseWithTags[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [sessionsRes, wfList] = await Promise.all([
                    api.get<{ items: WorkflowSession[] }>('/modules/tool-management-tools/sessions'),
                    fetchActiveUseCases(),
                ]);
                if (cancelled) return;
                setSessions(sessionsRes.items);
                setWorkflows(wfList.filter((w) => w.workflowMode));
            } catch {
                // fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const activeSessions = sessions.filter((s) => s.status === 'active');
    const recentSessions = sessions.slice(0, 5);

    // Determine "favorites": workflows the user has used most (by session count)
    const usageCounts = new Map<string, number>();
    for (const s of sessions) {
        usageCounts.set(s.useCaseId, (usageCounts.get(s.useCaseId) ?? 0) + 1);
    }
    const favoriteWorkflows = [...workflows]
        .sort((a, b) => (usageCounts.get(b.id) ?? 0) - (usageCounts.get(a.id) ?? 0))
        .slice(0, 6);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm animate-pulse">
                {t('common.loading')}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">{t('workflow.title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('workflow.totalSessions').replace('{active}', String(activeSessions.length)).replace('{total}', String(sessions.length))}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/modules/workflow/directory')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                >
                    <BookOpen className="h-3.5 w-3.5" />
                    {t('workflow.browseDirectory')}
                </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-8">
                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-4 w-4 text-blue-500" />
                            <h2 className="text-sm font-semibold">{t('workflow.activeWorkflows')}</h2>
                        </div>
                        <div className="space-y-2">
                            {activeSessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => navigate(`/modules/workflow/inspector/${session.id}`)}
                                    className="flex items-center gap-4 px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group"
                                >
                                    <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Play className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-sm">{session.useCase?.label || t('workflow.workflow')}</span>
                                        <p className="text-xs text-muted-foreground">
                                            {t('workflow.stepOf').replace('{current}', String(session.currentStepIdx + 1))} · {t('workflow.updated').replace('{date}', new Date(session.updatedAt).toLocaleString('da-DK'))}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Favorite Workflows */}
                {favoriteWorkflows.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm font-semibold">{t('workflow.favoriteWorkflows')}</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {favoriteWorkflows.map((wf) => {
                                const count = usageCounts.get(wf.id) ?? 0;
                                return (
                                    <div
                                        key={wf.id}
                                        onClick={() => navigate(`/modules/workflow/${wf.id}`)}
                                        className="flex flex-col gap-2 px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Workflow className="h-4 w-4 text-primary shrink-0" />
                                            <span className="font-medium text-sm truncate">{wf.label}</span>
                                        </div>
                                        {wf.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">{wf.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-auto">
                                            {count > 0 && <span>{t('workflow.sessionCount').replace('{count}', String(count))}</span>}
                                            {wf.workflowTags && wf.workflowTags.length > 0 && (
                                                <div className="flex gap-1 flex-wrap">
                                                    {wf.workflowTags.map((t) => (
                                                        <span
                                                            key={t.label}
                                                            className="px-1.5 py-0.5 rounded-full text-white"
                                                            style={{ backgroundColor: t.color }}
                                                        >
                                                            {t.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Recent Sessions */}
                {recentSessions.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-semibold">{t('workflow.recentSessions')}</h2>
                            </div>
                            <button
                                onClick={() => navigate('/modules/workflow/sessions')}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                View all <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {recentSessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => navigate(`/modules/workflow/inspector/${session.id}`)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors cursor-pointer text-sm"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${session.status === 'active' ? 'bg-blue-500' : session.status === 'completed' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                    <span className="flex-1 truncate">{session.useCase?.label || t('workflow.workflow')}</span>
                                    <span className="text-xs text-muted-foreground">{new Date(session.updatedAt).toLocaleDateString('da-DK')}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {workflows.length === 0 && sessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <Workflow className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm">{t('workflow.noWorkflows')}</p>
                        <button
                            onClick={() => navigate('/modules/workflow/directory')}
                            className="mt-2 text-sm text-primary hover:underline"
                        >
                            {t('workflow.browseWorkflowDirectory')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
