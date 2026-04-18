/**
 * Workflow Debug Details Page
 *
 * Standalone page designed to open in a new window from the extension debug panel.
 * Shows comprehensive session data: context, steps/stages, all messages across
 * steps, snapshots, form data, and a chronological event log.
 *
 * Auto-refreshes every 3 seconds while the session is active.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router';
import {
    getSessionDebug,
    type WorkflowSessionDebug,
    type SessionMessage,
    type SessionSnapshot,
    type WorkflowTask,
} from './use-case-api';
import {
    Activity, CheckCircle2, XCircle, Clock, Loader2,
    ChevronDown, ChevronRight, Copy, Check, RefreshCw,
    Database, MessageSquare, GitBranch, FileJson, Bug,
    Layers, CircleDot, Camera,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/core/i18n';

export function WorkflowDebugPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { t } = useTranslation();
    const [session, setSession] = useState<WorkflowSessionDebug | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const pageRef = useRef<HTMLDivElement>(null);

    // Capture screenshot + data and copy to clipboard
    const handleCaptureReport = useCallback(async () => {
        if (!session || !pageRef.current) return;

        try {
            // Dynamically import html2canvas-pro
            const { default: html2canvas } = await import('html2canvas-pro');

            // Capture the debug page content area
            const canvas = await html2canvas(pageRef.current, {
                useCORS: true,
                scale: 1,
                backgroundColor: '#ffffff',
            });
            const debugScreenshot = canvas.toDataURL('image/png');

            // Also try to capture the content tab via extension bridge
            let contentScreenshot: string | null = null;
            const hasExtension = document.documentElement.hasAttribute('data-surdej-extension');
            if (hasExtension) {
                try {
                    contentScreenshot = await new Promise<string | null>((resolve) => {
                        const handler = (event: MessageEvent) => {
                            if (event.data?.type === 'SURDEJ_CAPTURE_TAB_RESULT') {
                                window.removeEventListener('message', handler);
                                resolve(event.data.dataUrl ?? null);
                            }
                        };
                        window.addEventListener('message', handler);
                        setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 3000);
                        window.postMessage({ type: 'SURDEJ_CAPTURE_TAB' }, '*');
                    });
                } catch { contentScreenshot = null; }
            }

            // Build structured report
            const report = {
                sessionId: session.id,
                status: session.status,
                useCase: {
                    label: session.useCase.label,
                    slug: session.useCase.slug,
                },
                progress: {
                    currentStep: session.currentStepIdx + 1,
                    totalSteps: session.tasks.length,
                    currentTask: session.tasks[session.currentStepIdx]?.title ?? null,
                },
                formData: session.formData,
                steps: session.tasks.map((task, idx) => ({
                    title: task.title,
                    completed: session.status === 'completed' ? true : idx < session.currentStepIdx,
                    active: idx === session.currentStepIdx && session.status === 'active',
                })),
                capturedAt: new Date().toISOString(),
            };

            // Build HTML for clipboard
            const htmlParts: string[] = [
                `<h2>Workflow Debug Report — ${session.useCase.label}</h2>`,
                `<p><strong>Session:</strong> <code>${session.id}</code> | <strong>Status:</strong> ${session.status} | <strong>Step:</strong> ${session.currentStepIdx + 1}/${session.tasks.length}</p>`,
            ];

            if (contentScreenshot) {
                htmlParts.push(`<h3>Content Page</h3><img src="${contentScreenshot}" style="max-width:100%; border:1px solid #ccc; border-radius:8px;" />`);
            }
            htmlParts.push(`<h3>Debug Inspector</h3><img src="${debugScreenshot}" style="max-width:100%; border:1px solid #ccc; border-radius:8px;" />`);

            if (Object.keys(session.formData).length > 0) {
                htmlParts.push(`<h3>Collected Data</h3><pre>${JSON.stringify(session.formData, null, 2)}</pre>`);
            }

            htmlParts.push(`<details><summary>Full Report JSON</summary><pre>${JSON.stringify(report, null, 2)}</pre></details>`);

            const htmlContent = htmlParts.join('\n');

            // Also build plain text version
            const textParts = [
                `Workflow Debug Report — ${session.useCase.label}`,
                `Session: ${session.id}`,
                `Status: ${session.status}`,
                `Step: ${session.currentStepIdx + 1}/${session.tasks.length}`,
                '',
                'Collected Data:',
                JSON.stringify(session.formData, null, 2),
                '',
                'Full Report:',
                JSON.stringify(report, null, 2),
            ];

            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([htmlContent], { type: 'text/html' }),
                    'text/plain': new Blob([textParts.join('\n')], { type: 'text/plain' }),
                }),
            ]);

            return true;
        } catch (err) {
            console.error('Failed to capture report:', err);
            // Fallback: copy just the JSON data
            const fallback = JSON.stringify({
                sessionId: session.id,
                status: session.status,
                useCase: session.useCase.label,
                formData: session.formData,
                currentStep: session.currentStepIdx + 1,
                totalSteps: session.tasks.length,
            }, null, 2);
            await navigator.clipboard.writeText(fallback);
            return true;
        }
    }, [session]);

    useEffect(() => {
        if (!sessionId) return;
        let mounted = true;

        const fetchData = async () => {
            try {
                const s = await getSessionDebug(sessionId);
                if (mounted) {
                    setSession(s);
                    setError(null);
                    setLastRefresh(new Date());
                    // Stop auto-refresh when session is terminal
                    if (s.status === 'completed' || s.status === 'aborted') {
                        setAutoRefresh(false);
                    }
                }
            } catch (e: unknown) {
                if (mounted) setError(e instanceof Error ? e.message : t('workflow.failedToLoad'));
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(() => {
            if (autoRefresh) fetchData();
        }, 3000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [sessionId, autoRefresh]);

    if (loading && !session) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-xl mx-auto text-center space-y-4">
                    <XCircle className="h-12 w-12 text-destructive mx-auto" />
                    <h1 className="text-xl font-bold">{t('workflow.failedToLoad')}</h1>
                    <p className="text-muted-foreground">{error || t('workflow.sessionNotFound')}</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={pageRef} className="min-h-screen bg-background">
            <DebugHeader session={session} lastRefresh={lastRefresh} autoRefresh={autoRefresh} onToggleAutoRefresh={() => setAutoRefresh(v => !v)} onCaptureReport={handleCaptureReport} />

            <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
                {/* Context cards row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SessionContextCard session={session} />
                    <UseCaseContextCard session={session} />
                    <ProgressCard session={session} />
                </div>

                {/* Main content - two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <StepsPanel tasks={session.tasks} currentStepIdx={session.currentStepIdx} status={session.status} messages={session.messages} />
                        <EventLog messages={session.messages} />
                    </div>
                    <div className="space-y-6">
                        <FormDataPanel formData={session.formData} />
                        <SnapshotsPanel snapshots={session.snapshots} />
                        <RawJsonPanel session={session} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Header ─────────────────────────────────────────────────────

function DebugHeader({ session, lastRefresh, autoRefresh, onToggleAutoRefresh, onCaptureReport }: {
    session: WorkflowSessionDebug;
    lastRefresh: Date;
    autoRefresh: boolean;
    onToggleAutoRefresh: () => void;
    onCaptureReport: () => Promise<boolean | undefined>;
}) {
    const { t } = useTranslation();
    const [capturing, setCapturing] = useState(false);
    const [captured, setCaptured] = useState(false);

    const handleCapture = async () => {
        setCapturing(true);
        try {
            await onCaptureReport();
            setCaptured(true);
            setTimeout(() => setCaptured(false), 2000);
        } finally {
            setCapturing(false);
        }
    };

    return (
        <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
            <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Bug className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold flex items-center gap-2">
                            {t('workflow.debug')}
                            <StatusBadge status={session.status} />
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono">{session.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                        {t('workflow.lastRefresh').replace('{time}', lastRefresh.toLocaleTimeString())}
                    </span>
                    <button
                        onClick={handleCapture}
                        disabled={capturing}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition-colors',
                            captured
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                                : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                    >
                        {capturing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : captured ? (
                            <Check className="h-3 w-3" />
                        ) : (
                            <Camera className="h-3 w-3" />
                        )}
                        {captured ? t('workflow.copied') : 'Capture Report'}
                    </button>
                    <button
                        onClick={onToggleAutoRefresh}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition-colors',
                            autoRefresh
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                                : 'bg-muted/50 border-border text-muted-foreground',
                        )}
                    >
                        <RefreshCw className={cn('h-3 w-3', autoRefresh && 'animate-spin')} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
                        {autoRefresh ? t('workflow.autoRefreshOn') : t('workflow.autoRefreshOff')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        active: { variant: 'default' as const, icon: Activity, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
        completed: { variant: 'secondary' as const, icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
        aborted: { variant: 'destructive' as const, icon: XCircle, className: 'bg-red-500/10 text-red-600 border-red-500/30' },
    }[status] ?? { variant: 'outline' as const, icon: Clock, className: '' };

    const Icon = config.icon;
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border', config.className)}>
            <Icon className="h-3 w-3" />
            {status}
        </span>
    );
}

// ─── Context Cards ──────────────────────────────────────────────

function SessionContextCard({ session }: { session: WorkflowSessionDebug }) {
    const { t } = useTranslation();
    return (
        <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                {t('workflow.sessionContext')}
            </h3>
            <div className="space-y-2 text-xs">
                <InfoRow label={t('workflow.userId')} value={session.userId} mono />
                <InfoRow label={t('workflow.tenant')} value={session.tenantId || t('workflow.global')} mono />
                <InfoRow label={t('workflow.created')} value={new Date(session.createdAt).toLocaleString()} />
                <InfoRow label={t('workflow.updatedField')} value={new Date(session.updatedAt).toLocaleString()} />
                <InfoRow label={t('workflow.messages')} value={String(session.messages.length)} />
                <InfoRow label={t('workflow.snapshots')} value={String(session.snapshots.length)} />
            </div>
        </div>
    );
}

function UseCaseContextCard({ session }: { session: WorkflowSessionDebug }) {
    const { t } = useTranslation();
    return (
        <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                {t('workflow.workflowTemplate')}
            </h3>
            <div className="space-y-2 text-xs">
                <InfoRow label={t('workflow.name')} value={session.useCase.label} />
                <InfoRow label={t('workflow.slug')} value={session.useCase.slug} mono />
                <InfoRow label={t('workflow.mode')} value={session.useCase.workflowMode ? t('workflow.multiStep') : t('workflow.singlePrompt')} />
                {session.useCase.latestVersion && (
                    <>
                        <InfoRow label={t('workflow.modelTier')} value={session.useCase.latestVersion.modelTier} />
                        <InfoRow label={t('workflow.version')} value={`v${session.useCase.latestVersion.version}`} />
                    </>
                )}
                {session.useCase.description && (
                    <div className="pt-1">
                        <span className="text-muted-foreground block mb-0.5">{t('workflow.description')}</span>
                        <p className="text-[11px] text-muted-foreground/80 italic">{session.useCase.description}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProgressCard({ session }: { session: WorkflowSessionDebug }) {
    const { t } = useTranslation();
    const totalSteps = session.tasks.length;
    const completedSteps = session.status === 'completed' ? totalSteps : session.currentStepIdx;
    const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return (
        <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {t('workflow.progress')}
            </h3>
            <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0">
                    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.91549431" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                        <circle cx="18" cy="18" r="15.91549431" fill="none" stroke="currentColor" strokeWidth="2.5"
                            strokeDasharray={`${pct} ${100 - pct}`}
                            className={session.status === 'completed' ? 'text-emerald-500' : session.status === 'aborted' ? 'text-red-500' : 'text-blue-500'}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{pct}%</span>
                    </div>
                </div>
                <div className="space-y-1 text-xs">
                    <div>{t('workflow.stepOf').replace('{current}', String(session.currentStepIdx + 1)).replace('{total}', String(totalSteps))}</div>
                    <div className="text-muted-foreground">{t('workflow.completedCount').replace('{count}', String(completedSteps))}</div>
                    {session.tasks[session.currentStepIdx] && session.status === 'active' && (
                        <div className="text-primary font-medium truncate max-w-[140px]" title={session.tasks[session.currentStepIdx].title}>
                            {session.tasks[session.currentStepIdx].title}
                        </div>
                    )}
                </div>
            </div>
            {/* Step indicator dots */}
            <div className="flex gap-1.5 flex-wrap">
                {session.tasks.map((_, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            'h-2.5 w-2.5 rounded-full border transition-colors',
                            idx < completedSteps
                                ? 'bg-emerald-500 border-emerald-500'
                                : idx === session.currentStepIdx && session.status === 'active'
                                    ? 'bg-blue-500 border-blue-500 animate-pulse'
                                    : 'bg-muted border-muted-foreground/30',
                        )}
                        title={`Step ${idx + 1}: ${session.tasks[idx]?.title}`}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Steps Panel ────────────────────────────────────────────────

function StepsPanel({ tasks, currentStepIdx, status, messages }: {
    tasks: WorkflowTask[];
    currentStepIdx: number;
    status: string;
    messages: SessionMessage[];
}) {
    const { t } = useTranslation();
    const [expandedStep, setExpandedStep] = useState<number | null>(currentStepIdx);
    const completedSteps = status === 'completed' ? tasks.length : currentStepIdx;

    // Group messages by step
    const messagesByStep = useMemo(() => {
        const grouped: Record<number, SessionMessage[]> = {};
        for (const msg of messages) {
            if (!grouped[msg.stepIndex]) grouped[msg.stepIndex] = [];
            grouped[msg.stepIndex].push(msg);
        }
        return grouped;
    }, [messages]);

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <CircleDot className="h-4 w-4" />
                <h2 className="font-semibold text-sm">{t('workflow.stepsStages')}</h2>
                <span className="text-xs text-muted-foreground ml-auto">{t('workflow.stepsCount').replace('{count}', String(tasks.length))}</span>
            </div>
            <div className="divide-y">
                {tasks.map((task, idx) => {
                    const isCompleted = idx < completedSteps;
                    const isActive = idx === currentStepIdx && status === 'active';
                    const isExpanded = expandedStep === idx;
                    const stepMessages = messagesByStep[idx] || [];

                    return (
                        <div key={task.id} className={cn(isActive && 'bg-blue-500/5')}>
                            <button
                                onClick={() => setExpandedStep(isExpanded ? null : idx)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                            >
                                {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : isActive ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                                        <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
                                    </div>
                                ) : (
                                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                )}
                                <span className="text-sm font-medium flex-1">{task.title}</span>
                                <span className="text-[10px] text-muted-foreground">{t('workflow.msgsCount').replace('{count}', String(stepMessages.length))}</span>
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
                                    {/* Task config */}
                                    <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('workflow.systemPrompt')}</label>
                                            <pre className="text-[11px] font-mono bg-background p-2 rounded border max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">
                                                {task.systemPrompt || t('workflow.none')}
                                            </pre>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('workflow.dataSchema')}</label>
                                            <pre className="text-[11px] font-mono bg-background p-2 rounded border max-h-40 overflow-auto text-blue-500 dark:text-blue-400">
                                                {JSON.stringify(task.dataSchema, null, 2)}
                                            </pre>
                                        </div>
                                    </div>

                                    {task.allowedTools.length > 0 && (
                                        <div>
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('workflow.allowedTools')}</label>
                                            <div className="flex flex-wrap gap-1">
                                                {task.allowedTools.map(t => (
                                                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-muted border font-mono">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step messages */}
                                    {stepMessages.length > 0 && (
                                        <div>
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                                {t('workflow.chatMessages').replace('{count}', String(stepMessages.length))}
                                            </label>
                                            <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                                {stepMessages.map((msg) => (
                                                    <div key={msg.id} className="flex gap-2 text-[11px]">
                                                        <span className="text-muted-foreground w-16 shrink-0 text-[10px]">
                                                            {new Date(msg.createdAt).toLocaleTimeString()}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'w-14 justify-center shrink-0 text-[9px] py-0',
                                                                msg.role === 'user'
                                                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800'
                                                                    : 'border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800',
                                                            )}
                                                        >
                                                            {msg.role}
                                                        </Badge>
                                                        <div className="font-mono text-muted-foreground truncate flex-1" title={msg.content}>
                                                            {msg.content.slice(0, 200)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Event Log ──────────────────────────────────────────────────

function EventLog({ messages }: { messages: SessionMessage[] }) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<'all' | 'user' | 'assistant'>('all');
    const [expanded, setExpanded] = useState<string | null>(null);

    const filtered = useMemo(
        () => filter === 'all' ? messages : messages.filter(m => m.role === filter),
        [messages, filter],
    );

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <h2 className="font-semibold text-sm">{t('workflow.eventLogTitle')}</h2>
                <span className="text-xs text-muted-foreground">{t('workflow.totalMessages').replace('{count}', String(messages.length))}</span>
                <div className="ml-auto flex gap-1">
                    {(['all', 'user', 'assistant'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                'px-2 py-0.5 rounded text-[10px] border transition-colors',
                                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                            )}
                        >
                            {f === 'all' ? t('workflow.filterAll') : f === 'user' ? t('workflow.filterUser') : t('workflow.filterAssistant')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
                {filtered.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">{filter !== 'all' ? t('workflow.noMessagesFilter').replace('{role}', filter) : t('workflow.noMessages')}</p>
                ) : (
                    filtered.map((msg) => (
                        <div key={msg.id} className="hover:bg-muted/20 transition-colors">
                            <button
                                onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                                className="w-full px-4 py-2.5 flex items-center gap-3 text-left"
                            >
                                <span className="text-[10px] text-muted-foreground w-16 shrink-0 font-mono">
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'w-16 justify-center shrink-0 text-[10px]',
                                        msg.role === 'user'
                                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800'
                                            : msg.role === 'system'
                                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800'
                                                : 'border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800',
                                    )}
                                >
                                    {msg.role}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                                    {t('workflow.stepN').replace('{n}', String(msg.stepIndex + 1))}
                                </span>
                                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                                    {msg.content.slice(0, 120)}
                                </span>
                                {expanded === msg.id
                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                            </button>
                            {expanded === msg.id && (
                                <div className="px-4 pb-3">
                                    <pre className="text-[11px] font-mono bg-muted/30 p-3 rounded border whitespace-pre-wrap max-h-80 overflow-auto">
                                        {msg.content}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Form Data Panel ────────────────────────────────────────────

function FormDataPanel({ formData }: { formData: Record<string, unknown> }) {
    const { t } = useTranslation();
    const entries = Object.entries(formData);

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                <h2 className="font-semibold text-sm">{t('workflow.formData')}</h2>
                <span className="text-xs text-muted-foreground">{t('workflow.fieldsCount').replace('{count}', String(entries.length))}</span>
            </div>
            <div className="p-4">
                {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-2">{t('workflow.noDataYet')}</p>
                ) : (
                    <div className="space-y-3">
                        {entries.map(([key, value]) => (
                            <div key={key}>
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{key}</span>
                                <div className="mt-0.5 text-xs bg-muted/40 p-2 rounded border break-words font-mono">
                                    {typeof value === 'object'
                                        ? JSON.stringify(value, null, 2)
                                        : typeof value === 'boolean'
                                            ? <span className={value ? 'text-emerald-600' : 'text-red-500'}>{String(value)}</span>
                                            : String(value)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Snapshots Panel ────────────────────────────────────────────

function SnapshotsPanel({ snapshots }: { snapshots: SessionSnapshot[] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                <h2 className="font-semibold text-sm">{t('workflow.contextSnapshots')}</h2>
                <span className="text-xs text-muted-foreground">({snapshots.length})</span>
            </div>
            <div className="divide-y">
                {snapshots.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground italic text-center">{t('workflow.noSnapshots')}</p>
                ) : (
                    snapshots.map((snap) => (
                        <div key={snap.id}>
                            <button
                                onClick={() => setExpanded(expanded === snap.id ? null : snap.id)}
                                className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-muted/30 transition-colors"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className="text-xs font-medium flex-1">{t('workflow.stepCompleted').replace('{n}', String(snap.stepIndex + 1))}</span>
                                <span className="text-[10px] text-muted-foreground">
                                    {new Date(snap.createdAt).toLocaleTimeString()}
                                </span>
                                {expanded === snap.id
                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            </button>
                            {expanded === snap.id && (
                                <div className="px-4 pb-3">
                                    <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded border max-h-40 overflow-auto">
                                        {JSON.stringify(snap.formData, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Raw JSON Panel ─────────────────────────────────────────────

function RawJsonPanel({ session }: { session: WorkflowSessionDebug }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(JSON.stringify(session, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full bg-muted/50 px-4 py-3 flex items-center gap-2 hover:bg-muted/70 transition-colors"
            >
                <Database className="h-4 w-4" />
                <h2 className="font-semibold text-sm flex-1 text-left">{t('workflow.rawJson')}</h2>
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {open && (
                <div className="p-3">
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-muted hover:bg-muted/80 transition-colors"
                        >
                            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copied ? t('workflow.copied') : t('workflow.copy')}
                        </button>
                    </div>
                    <pre className="text-[10px] font-mono bg-muted/30 p-3 rounded border max-h-96 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className={cn('text-right truncate', mono && 'font-mono text-[10px]')} title={value}>{value}</span>
        </div>
    );
}
