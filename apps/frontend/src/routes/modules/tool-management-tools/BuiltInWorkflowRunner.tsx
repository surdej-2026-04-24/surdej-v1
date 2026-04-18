/**
 * BuiltInWorkflowRunner — Detail page for built-in (curated) workflows.
 *
 * Mirrors UseCaseDetailPage layout: header with "Start Session" button,
 * tabs showing workflow steps overview with designed forms per step,
 * suggested URLs, and step descriptions.
 *
 * Route: /modules/workflow/builtin/:workflowId
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ensureBuiltInWorkflow } from './use-case-api';
import {
    ArrowLeft,
    ExternalLink,
    Circle,
    AlertCircle,
    ChevronDown,
    Sparkles,
    Building2,
    Globe,
    FileSearch,
    FileText,
    Upload,
    Search,
    Network,
    Puzzle,
    Check,
    Info,
} from 'lucide-react';
import { getBuiltInWorkflow, type BuiltInStep } from './built-in-workflows';

// ─── Step icon resolver ─────────────────────────────────────────

const STEP_ICONS: Record<string, React.FC<{ className?: string }>> = {
    'find-ejendom': Globe,
    'seller-homepage': Building2,
    'dublet-check': Search,
    'download-prospect': FileText,
    'upload-sharepoint': Upload,
    'analyse-pdf': FileSearch,
};

function StepIcon({ stepId, className }: { stepId: string; className?: string }) {
    const Icon = STEP_ICONS[stepId] || Circle;
    return <Icon className={className} />;
}

// ─── Main Component ─────────────────────────────────────────────

export function BuiltInWorkflowRunner() {
    const { workflowId } = useParams<{ workflowId: string }>();
    const navigate = useNavigate();
    const workflow = getBuiltInWorkflow(workflowId ?? '');

    const [sessionLaunched, setSessionLaunched] = useState(false);
    const [sidebarHint, setSidebarHint] = useState(false);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [provisioning, setProvisioning] = useState(false);
    const [hasExtension, setHasExtension] = useState(
        () => document.documentElement.hasAttribute('data-surdej-extension'),
    );

    useEffect(() => {
        if (document.documentElement.hasAttribute('data-surdej-extension')) {
            setHasExtension(true);
            return;
        }
        const observer = new MutationObserver(() => {
            if (document.documentElement.hasAttribute('data-surdej-extension')) {
                setHasExtension(true);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surdej-extension'] });
        return () => observer.disconnect();
    }, []);

    if (!workflow) {
        return (
            <div className="p-6">
                <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm">
                    Workflow not found
                </div>
            </div>
        );
    }

    const handleStartSession = async () => {
        setProvisioning(true);
        try {
            // Ensure the built-in workflow exists in DB and get its UUID
            const { id: dbId } = await ensureBuiltInWorkflow(workflow.slug);

            if (hasExtension) {
                const handler = (e: MessageEvent) => {
                    if (e.data?.type === 'SURDEJ_SIDEBAR_ACK' && e.data.ok) {
                        window.removeEventListener('message', handler);
                        if (e.data.panelOpened) {
                            setSessionLaunched(true);
                            setTimeout(() => setSessionLaunched(false), 2000);
                        } else {
                            setSidebarHint(true);
                            setTimeout(() => setSidebarHint(false), 5000);
                        }
                    }
                };
                window.addEventListener('message', handler);
                setTimeout(() => window.removeEventListener('message', handler), 3000);
                window.postMessage({ type: 'SURDEJ_OPEN_SIDEBAR', useCase: dbId }, '*');
            } else {
                window.open(
                    `/extension?useCase=${encodeURIComponent(dbId)}`,
                    '_blank',
                    'width=420,height=800',
                );
            }
        } catch (err) {
            console.error('Failed to provision built-in workflow:', err);
        } finally {
            setProvisioning(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header — matches UseCaseDetailPage */}
            <div className="px-6 py-4 border-b shrink-0">
                <div className="flex items-start gap-3">
                    <button
                        onClick={() => navigate('/modules/workflow/directory')}
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors mt-0.5"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-semibold truncate">{workflow.label}</h1>

                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                                Indbygget
                            </span>

                            {/* Start Session button */}
                            <button
                                onClick={handleStartSession}
                                disabled={provisioning}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ml-auto ${
                                    sessionLaunched
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : provisioning
                                        ? 'bg-muted text-muted-foreground cursor-wait'
                                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                                }`}
                                title={hasExtension ? 'Open in browser extension side panel' : 'Start a new workflow session in a popup window'}
                            >
                                {sessionLaunched ? (
                                    <>
                                        <Check className="h-3 w-3" />
                                        Opened in Extension
                                    </>
                                ) : provisioning ? (
                                    'Provisioning…'
                                ) : (
                                    <>
                                        {hasExtension ? <Puzzle className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                                        Start Session
                                    </>
                                )}
                            </button>
                        </div>

                        {sidebarHint && (
                            <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in slide-in-from-top-2">
                                <Puzzle className="h-3.5 w-3.5 shrink-0" />
                                Session ready — click the Surdej extension icon in your toolbar to open the side panel
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                            <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {workflow.slug}
                            </code>
                            <span className="text-xs text-muted-foreground truncate">— {workflow.description}</span>
                        </div>

                        {/* Tags */}
                        <div className="flex items-center gap-1.5 mt-2">
                            {workflow.tags.map((tag) => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 mt-4">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors bg-primary/10 text-primary font-medium">
                        <Network className="h-3.5 w-3.5" />
                        Workflow Steps
                        <span className="text-[10px] px-1.5 rounded bg-primary/20">
                            {workflow.steps.length}
                        </span>
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50">
                        <Info className="h-3.5 w-3.5" />
                        Overview
                    </button>
                </div>
            </div>

            {/* Content — Workflow Steps */}
            <div className="flex-1 overflow-auto p-6">
                <div className="space-y-3 max-w-3xl">
                    {workflow.steps.map((step, idx) => (
                        <StepCard
                            key={step.id}
                            step={step}
                            index={idx}
                            isLast={idx === workflow.steps.length - 1}
                            expanded={expandedStep === step.id}
                            onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Step Card ──────────────────────────────────────────────────

function StepCard({
    step,
    index,
    isLast,
    expanded,
    onToggle,
}: {
    step: BuiltInStep;
    index: number;
    isLast: boolean;
    expanded: boolean;
    onToggle: () => void;
}) {
    const requiredFields = step.fields.filter((f) => f.required);
    const optionalFields = step.fields.filter((f) => !f.required);
    const aiFields = step.fields.filter((f) => f.aiExtracted);

    return (
        <div className="relative">
            {/* Connecting line */}
            {!isLast && (
                <div className="absolute left-[22px] top-[52px] bottom-[-12px] w-px bg-border" />
            )}

            <div
                className="border rounded-lg hover:shadow-sm transition-all cursor-pointer bg-background"
                onClick={onToggle}
            >
                {/* Step header */}
                <div className="flex items-center gap-3 p-4">
                    <div className="w-[28px] h-[28px] rounded-lg bg-primary/10 flex items-center justify-center shrink-0 z-10">
                        <StepIcon stepId={step.id} className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Trin {index + 1}
                            </span>
                            <span className="font-medium text-sm truncate">{step.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>
                    </div>

                    {/* Meta badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {step.suggestedUrl && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium">
                                URL
                            </span>
                        )}
                        {step.fields.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {step.fields.length} fields
                            </span>
                        )}
                        {aiFields.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-medium flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" />
                                AI
                            </span>
                        )}
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                    <div className="px-4 pb-4 border-t pt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Suggested URL */}
                        {step.suggestedUrl && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-medium w-20 shrink-0">Navigér til:</span>
                                <a
                                    href={step.suggestedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {step.suggestedUrlLabel || step.suggestedUrl}
                                </a>
                            </div>
                        )}

                        {/* Instruction */}
                        {step.instruction && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 dark:text-amber-300">{step.instruction}</p>
                            </div>
                        )}

                        {/* User hint */}
                        {step.userHint && (
                            <p className="text-xs text-muted-foreground italic">{step.userHint}</p>
                        )}

                        {/* Required fields */}
                        {requiredFields.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Påkrævede felter ({requiredFields.length})
                                </h4>
                                <div className="space-y-1.5">
                                    {requiredFields.map((f) => (
                                        <FieldPreview key={f.key} field={f} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Optional fields */}
                        {optionalFields.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Valgfrie felter ({optionalFields.length})
                                </h4>
                                <div className="space-y-1.5">
                                    {optionalFields.map((f) => (
                                        <FieldPreview key={f.key} field={f} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI tools */}
                        {step.allowedTools && step.allowedTools.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-medium">Tools:</span>
                                {step.allowedTools.map((tool) => (
                                    <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                        {tool}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* System prompt preview */}
                        <details className="text-[10px]">
                            <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-medium">
                                System prompt
                            </summary>
                            <pre className="mt-1.5 p-2 rounded bg-muted/40 text-[10px] whitespace-pre-wrap break-words text-muted-foreground font-mono">
                                {step.systemPrompt}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Field Preview (read-only) ──────────────────────────────────

function FieldPreview({ field }: { field: { key: string; label: string; type: string; description?: string; required?: boolean; aiExtracted?: boolean } }) {
    return (
        <div className="flex items-center gap-2 text-xs">
            {field.required ? (
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
            ) : (
                <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            )}
            <span className="font-medium min-w-[120px]">{field.label}</span>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">{field.type}</span>
            {field.aiExtracted && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />
                    auto
                </span>
            )}
            {field.description && (
                <span className="text-muted-foreground truncate">{field.description}</span>
            )}
        </div>
    );
}
