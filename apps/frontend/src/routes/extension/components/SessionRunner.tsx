/**
 * SessionRunner — Workflow session orchestrator.
 *
 * Manages the full lifecycle of a workflow session:
 * - Starts or resumes a session
 * - Delegates to WorkflowHeader, SessionChat, and DynamicForm
 * - Handles advance, revert, abort, and complete actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw, Lightbulb, Bug, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowHeader } from './WorkflowHeader';
import { DynamicForm } from './DynamicForm';
import { SessionChat } from './SessionChat';
import { useExtensionDebug } from '@/core/extension/ExtensionDebugContext';
import { getBuiltInStepUrl } from '../../modules/tool-management-tools/built-in-workflows';
import {
    startSession,
    getSession,
    advanceSession,
    revertSession,
    updateSessionForm,
    abortSession,
    type WorkflowSession,
} from '../../modules/tool-management-tools/use-case-api';

export function SessionRunner({
    useCaseId,
    workflowLabel,
    onComplete,
    onAbort,
    onSessionChange,
}: {
    useCaseId: string;
    workflowLabel?: string;
    onComplete?: () => void;
    onAbort?: () => void;
    onSessionChange?: (sessionId: string | null) => void;
}) {
    const [session, setSession] = useState<WorkflowSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const { enabled: debugEnabled } = useExtensionDebug();

    // Start or resume session
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        startSession(useCaseId)
            .then((s) => {
                if (active) {
                    setSession(s);
                    onSessionChange?.(s.id);
                    setLoading(false);
                }
            })
            .catch((e) => {
                if (active) {
                    setError(e.message || 'Failed to start workflow session');
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [useCaseId]);

    // Refresh session state from server
    const refreshSession = useCallback(async () => {
        if (!session) return;
        try {
            const s = await getSession(session.id);
            setSession(s);
            onSessionChange?.(s.id);
        } catch (e) {
            console.error('Failed to refresh session:', e);
        }
    }, [session?.id]);

    // Form field change — optimistic local update + async persist
    const handleFormChange = useCallback(
        async (key: string, val: string) => {
            if (!session) return;

            // Optimistic
            setSession((prev) =>
                prev
                    ? {
                          ...prev,
                          formData: { ...prev.formData, [key]: val },
                      }
                    : null,
            );

            // Persist (fire-and-forget)
            updateSessionForm(session.id, { [key]: val }).catch((e) =>
                console.error('Failed to persist form field:', e),
            );
        },
        [session?.id],
    );

    // Advance to next step
    const handleAdvance = useCallback(async () => {
        if (!session) return;
        setActionLoading(true);
        try {
            const res = await advanceSession(session.id);
            if (res.completed) {
                // Refresh to get completed status
                const s = await getSession(session.id);
                setSession(s);
            } else {
                await refreshSession();
            }
        } catch (e: any) {
            console.error('Failed to advance:', e);
            // Show error but don't crash
            alert(e.message || 'Cannot advance — check required fields');
        } finally {
            setActionLoading(false);
        }
    }, [session?.id, refreshSession]);

    // Revert to a specific step
    const handleRevert = useCallback(
        async (targetStepIdx?: number) => {
            if (!session) return;
            const target = targetStepIdx ?? session.currentStepIdx - 1;
            if (target < 0) return;

            setActionLoading(true);
            try {
                await revertSession(session.id, target);
                await refreshSession();
            } catch (e) {
                console.error('Failed to revert:', e);
            } finally {
                setActionLoading(false);
            }
        },
        [session?.id, refreshSession],
    );

    // Abort the session
    const handleAbort = useCallback(async () => {
        if (!session) return;
        if (!confirm('Abort this workflow? All progress will be lost.')) return;

        try {
            await abortSession(session.id);
            setSession(null);
            onSessionChange?.(null);
            onAbort?.();
        } catch (e) {
            console.error('Failed to abort:', e);
        }
    }, [session?.id, onAbort]);

    // ─── Loading state ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center flex-col gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Starting workflow...</span>
            </div>
        );
    }

    // ─── Error state ───────────────────────────────────────────────
    if (error || !session) {
        return (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center">
                    <XCircle className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold">Failed to start workflow</h3>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
                <Button size="sm" variant="outline" onClick={onAbort}>
                    Close
                </Button>
            </div>
        );
    }

    // ─── Completed state ───────────────────────────────────────────
    if (session.status === 'completed') {
        return (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center p-6">
                <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 text-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                    <h2 className="text-base font-semibold">Workflow Complete</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        All {session.tasks.length} steps have been completed.
                    </p>
                </div>

                {/* Summary of collected data */}
                {Object.keys(session.formData).length > 0 && (
                    <div className="w-full max-w-xs text-left">
                        <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                Collected data ({Object.keys(session.formData).length} fields)
                            </summary>
                            <div className="mt-2 p-3 rounded-lg bg-muted/40 space-y-1.5 font-mono text-[10px]">
                                {Object.entries(session.formData).map(([key, val]) => (
                                    <div key={key} className="flex gap-2">
                                        <span className="text-muted-foreground shrink-0">{key}:</span>
                                        <span className="truncate">{String(val)}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>
                )}

                <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => {
                        // restart
                        setSession(null);
                        onSessionChange?.(null);
                        setLoading(true);
                        startSession(useCaseId).then(s => {
                            setSession(s);
                            onSessionChange?.(s.id);
                            setLoading(false);
                        });
                    }}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Start Again
                    </Button>
                    <Button size="sm" onClick={onComplete}>
                        Done
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Active session ────────────────────────────────────────────
    // ─── Active session ────────────────────────────────────────────
    const currentTask = session.tasks[session.currentStepIdx];
    if (!currentTask) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Error: no task at index {session.currentStepIdx}
            </div>
        );
    }

    const isLastStep = session.currentStepIdx === session.tasks.length - 1;
    const stepUrl = getBuiltInStepUrl(currentTask.taskId);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <WorkflowHeader
                tasks={session.tasks}
                currentStepIdx={session.currentStepIdx}
                workflowLabel={workflowLabel}
                onRevertToStep={handleRevert}
            />

            {debugEnabled && (
                <WorkflowDebugBar
                    sessionId={session.id}
                    currentTask={currentTask}
                    formData={session.formData}
                    stepIdx={session.currentStepIdx}
                    totalSteps={session.tasks.length}
                />
            )}

            {currentTask.userHint && (
                <div className="shrink-0 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">{currentTask.userHint}</p>
                        {stepUrl && (
                            <a
                                href={stepUrl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-1 rounded-md w-fit"
                            >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                {stepUrl.label || stepUrl.url}
                            </a>
                        )}
                    </div>
                </div>
            )}

            {!currentTask.userHint && stepUrl && (
                <div className="shrink-0 px-3 py-2 border-b border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/80 dark:bg-emerald-950/20">
                    <a
                        href={stepUrl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-1 rounded-md"
                    >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {stepUrl.label || stepUrl.url}
                    </a>
                </div>
            )}

            <SessionChat
                sessionId={session.id}
                stepIndex={session.currentStepIdx}
                currentTaskTitle={currentTask.title}
                initialMessages={session.messages}
                onDataUpdated={refreshSession}
            />

            <DynamicForm
                schema={currentTask.dataSchema}
                formData={session.formData}
                onChange={handleFormChange}
                onAdvance={handleAdvance}
                onRevert={() => handleRevert()}
                canRevert={session.currentStepIdx > 0}
                isAdvancing={actionLoading}
                isLastStep={isLastStep}
            />
        </div>
    );
}

// ─── Debug bar for workflow sessions ────────────────────────────

function WorkflowDebugBar({
    sessionId,
    currentTask,
    formData,
    stepIdx,
    totalSteps,
}: {
    sessionId: string;
    currentTask: any;
    formData: Record<string, any>;
    stepIdx: number;
    totalSteps: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeSection, setActiveSection] = useState<'prompt' | 'schema' | 'data'>('data');

    const copySessionId = () => {
        navigator.clipboard.writeText(sessionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const filledFields = Object.keys(formData).filter(k => formData[k] !== undefined && formData[k] !== null && formData[k] !== '');
    const schema = currentTask.dataSchema;
    const requiredFields: string[] = schema?.required || [];
    const totalFields = Object.keys(schema?.properties || {}).length;
    const missingRequired = requiredFields.filter(k => !formData[k] || formData[k] === '');

    return (
        <div className="shrink-0 border-b border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20">
            {/* Header */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
            >
                <Bug className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="font-semibold text-amber-700 dark:text-amber-400">DEBUG</span>
                <span className="text-amber-600/70 dark:text-amber-500/70 font-mono truncate">{sessionId.slice(0, 8)}…</span>
                <span className="ml-auto text-amber-600/70 dark:text-amber-500/70">
                    {filledFields.length}/{totalFields} fields
                    {missingRequired.length > 0 && <span className="text-red-500 ml-1">({missingRequired.length} req missing)</span>}
                </span>
                {expanded ? <ChevronUp className="h-3 w-3 text-amber-500 shrink-0" /> : <ChevronDown className="h-3 w-3 text-amber-500 shrink-0" />}
            </button>

            {expanded && (
                <div className="px-3 pb-2 space-y-2">
                    {/* Session info */}
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-amber-600 dark:text-amber-400">Session:</span>
                        <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-[9px] truncate flex-1">{sessionId}</code>
                        <button onClick={copySessionId} className="p-0.5 hover:bg-amber-200/50 rounded shrink-0">
                            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-amber-500" />}
                        </button>
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">
                        Step {stepIdx + 1}/{totalSteps} — <span className="font-medium">{currentTask.title}</span>
                        {currentTask.taskId && <span className="ml-1 font-mono opacity-60">({currentTask.taskId})</span>}
                    </div>

                    {/* Section tabs */}
                    <div className="flex gap-1 border-b border-amber-200 dark:border-amber-800/30 pb-1">
                        {(['data', 'schema', 'prompt'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveSection(s)}
                                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                                    activeSection === s
                                        ? 'bg-amber-200 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300 font-medium'
                                        : 'text-amber-600/70 dark:text-amber-500/60 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                                }`}
                            >
                                {s === 'data' ? `Form Data (${filledFields.length})` : s === 'schema' ? `Schema (${totalFields})` : 'System Prompt'}
                            </button>
                        ))}
                    </div>

                    {/* Section content */}
                    <div className="max-h-[200px] overflow-auto">
                        {activeSection === 'data' && (
                            <pre className="font-mono text-[10px] bg-amber-100/50 dark:bg-amber-900/20 p-2 rounded whitespace-pre-wrap break-all">
                                {JSON.stringify(formData, null, 2)}
                            </pre>
                        )}
                        {activeSection === 'schema' && (
                            <pre className="font-mono text-[10px] bg-amber-100/50 dark:bg-amber-900/20 p-2 rounded whitespace-pre-wrap break-all">
                                {JSON.stringify(schema, null, 2)}
                            </pre>
                        )}
                        {activeSection === 'prompt' && (
                            <pre className="font-mono text-[10px] bg-amber-100/50 dark:bg-amber-900/20 p-2 rounded whitespace-pre-wrap break-words">
                                {currentTask.systemPrompt || '(empty)'}
                            </pre>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
