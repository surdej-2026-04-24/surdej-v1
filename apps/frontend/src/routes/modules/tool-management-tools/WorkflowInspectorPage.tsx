import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { getSession, type WorkflowSession } from './use-case-api';
import { useTranslation } from '@/core/i18n';
import { Activity, CheckCircle2, ChevronRight, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function WorkflowInspectorPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { t } = useTranslation();
    const [session, setSession] = useState<WorkflowSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!sessionId) return;

        // Auto-refresh the inspector periodically
        const fetchSession = async () => {
            try {
                const s = await getSession(sessionId);
                if (isMounted) {
                    setSession(s);
                    setError(null);
                }
            } catch (e: any) {
                if (isMounted) setError(e.message || 'Failed to load session');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchSession();
        const interval = setInterval(fetchSession, 3000); // refresh every 3 seconds
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [sessionId]);

    if (loading && !session) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="p-8 text-red-500">
                <h2 className="text-xl font-bold mb-4">{t('workflow.inspectorError')}</h2>
                <p>{error || t('workflow.sessionNotFound')}</p>
            </div>
        );
    }

    const completedSteps = session.status === 'completed' ? session.tasks.length : session.currentStepIdx;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        {t('workflow.inspector')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{t('workflow.sessionIdLabel')} {session.id}</p>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant={session.status === 'active' ? 'default' : session.status === 'completed' ? 'secondary' : 'destructive'} className="text-xs uppercase tracking-wider">
                        {session.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {/* Workflow Tasks */}
                    <div className="bg-card border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                            <List className="h-4 w-4" />
                            <h2 className="font-semibold text-sm">{t('workflow.definitionProgress')}</h2>
                        </div>
                        <div className="p-0">
                            {session.tasks.map((task, idx) => {
                                const isCompleted = idx < completedSteps;
                                const isActive = idx === session.currentStepIdx && session.status !== 'completed';
                                
                                return (
                                    <div key={task.id} className={`p-4 border-b last:border-0 flex gap-4 ${isActive ? 'bg-primary/5' : ''}`}>
                                        <div className="mt-1">
                                            {isCompleted ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            ) : isActive ? (
                                                <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                                                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                                                </div>
                                            ) : (
                                                <div className="h-5 w-5 rounded-full border-2 border-muted" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-sm">{task.title}</h3>
                                            <div className="mt-2 space-y-3">
                                                <div>
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('workflow.systemPrompt')}</span>
                                                    <div className="text-xs font-mono bg-muted/40 p-2 rounded whitespace-pre-wrap text-muted-foreground border">
                                                        {task.systemPrompt || t('workflow.none')}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('workflow.schema')}</span>
                                                    <pre className="text-xs font-mono bg-muted/40 p-2 rounded text-blue-500 dark:text-blue-400 overflow-x-auto border">
                                                        {JSON.stringify(task.dataSchema, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Raw Messages Overview */}
                    <div className="bg-card border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 border-b">
                            <h2 className="font-semibold text-sm">{t('workflow.eventLog').replace('{count}', String(session.messages.length))}</h2>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {session.messages.length === 0 ? (
                                <p className="p-4 text-sm text-muted-foreground">{t('workflow.noEvents')}</p>
                            ) : (
                                session.messages.map((msg, idx) => (
                                    <div key={msg.id || idx} className="p-3 text-xs flex gap-3 hover:bg-muted/20">
                                        <span className="text-muted-foreground w-12 shrink-0">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                        <Badge variant="outline" className={`w-16 justify-center shrink-0 ${msg.role === 'user' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20' : 'border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20'}`}>
                                            {msg.role}
                                        </Badge>
                                        <div className="truncate font-mono text-[11px] text-muted-foreground flex-1">
                                            {msg.content}
                                        </div>
                                        <div className="shrink-0 text-muted-foreground">
                                            {t('workflow.stepN').replace('{n}', String(msg.stepIndex + 1))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Live State Dictionary */}
                    <div className="bg-card border rounded-lg overflow-hidden sticky top-8">
                        <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                            <h2 className="font-semibold text-sm">{t('workflow.sessionState')}</h2>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{t('workflow.live')}</span>
                        </div>
                        <div className="p-4">
                            {Object.keys(session.formData).length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">{t('workflow.noDataCollected')}</p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(session.formData).map(([key, value]) => (
                                        <div key={key}>
                                            <span className="text-xs font-semibold text-muted-foreground">{key}</span>
                                            <div className="mt-1 text-sm bg-muted/40 p-2 rounded border break-words">
                                                {typeof value === 'object' ? (
                                                    <pre className="text-xs font-mono">{JSON.stringify(value, null, 2)}</pre>
                                                ) : typeof value === 'boolean' ? (
                                                    <span className={`px-1.5 py-0.5 rounded text-xs ${value ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                        {value ? 'true' : 'false'}
                                                    </span>
                                                ) : (
                                                    String(value)
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
