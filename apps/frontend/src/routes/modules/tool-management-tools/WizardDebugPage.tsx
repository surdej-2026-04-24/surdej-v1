/**
 * Workflow Wizard Debug Page
 *
 * Standalone page designed to open in a new window from the wizard (/modules/workflow/new).
 * Shows live wizard state: conversation messages, parsed proposal, streaming status,
 * and raw JSON. Auto-refreshes from broadcast channel while wizard is active.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Bug, MessageSquare, FileJson, Copy, Check,
    Bot, User, ChevronDown, ChevronRight, Loader2,
    Wand2, CircleDot, RefreshCw, ClipboardCopy, Terminal, Database,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

type WizardProposal = {
    slug: string;
    label: string;
    description: string;
    icon: string;
    workflowMode: boolean;
    promptTemplate?: string;
    tools?: string[];
    modelTier?: string;
    tasks?: Array<{
        title: string;
        systemPrompt: string;
        allowedTools: string[];
        dataSchema: Record<string, unknown>;
    }>;
};

interface WizardDebugState {
    messages: Message[];
    proposal: WizardProposal | null;
    streaming: boolean;
    streamingText: string;
    systemPrompt: string | null;
    locale: string | null;
    interactions: Array<{ type: string; content: string; timestamp: number }>;
    simulationData: Record<string, Record<string, string>>;
    sessionDocId: string | null;
    timestamp: number;
}

// Channel name must match NewUseCasePage
const CHANNEL_NAME = 'wizard-debug';

export function WizardDebugPage() {
    const [state, setState] = useState<WizardDebugState | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        systemPrompt: false,
        messages: true,
        proposal: true,
        simulation: true,
        raw: false,
    });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event: MessageEvent<WizardDebugState>) => {
            setState(event.data);
            setLastUpdate(new Date());
        };

        // Request current state from wizard
        channel.postMessage({ type: 'request-state' });

        return () => channel.close();
    }, []);

    const toggleSection = useCallback((key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    if (!state) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Bug className="h-10 w-10 opacity-40" />
                <p className="text-sm">Waiting for wizard data…</p>
                <p className="text-xs opacity-60">
                    Keep the wizard page open at /modules/workflow/new
                </p>
            </div>
        );
    }

    const { messages, proposal, streaming, streamingText, systemPrompt, locale, interactions, simulationData, sessionDocId } = state;

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const copyEntireConversation = async () => {
        const parts: string[] = [];
        if (systemPrompt) parts.push(`[System Prompt]\n${systemPrompt}`);
        messages.forEach((m, i) => {
            if (!m.content.trim()) return;
            parts.push(`[${m.role === 'user' ? 'User' : 'Assistant'} #${i + 1}]\n${m.content}`);
        });
        if (streaming && streamingText) parts.push(`[Streaming]\n${streamingText}`);
        await copyToClipboard(parts.join('\n\n---\n\n'), 'all');
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bug className="h-5 w-5 text-amber-500" />
                    <div>
                        <h1 className="text-sm font-semibold">Wizard Debug</h1>
                        <p className="text-[10px] text-muted-foreground">
                            {messages.length} messages
                            {streaming && ' · streaming…'}
                            {proposal && ` · proposal: ${proposal.slug}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {streaming && (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 text-[10px]">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Streaming
                        </Badge>
                    )}
                    {lastUpdate && (
                        <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 space-y-4">
                {/* ── Context Cards ── */}
                <div className="grid grid-cols-4 gap-3">
                    <ContextCard
                        label="Messages"
                        value={String(messages.length)}
                        detail={`${messages.filter((m) => m.role === 'user').length} user · ${messages.filter((m) => m.role === 'assistant').length} assistant`}
                    />
                    <ContextCard
                        label="Status"
                        value={streaming ? 'Streaming' : proposal ? 'Proposal Ready' : 'Idle'}
                        detail={streaming ? `${streamingText.length} chars buffered` : proposal ? `${proposal.workflowMode ? 'Multi-step' : 'Single-prompt'} workflow` : 'Awaiting input'}
                    />
                    <ContextCard
                        label="Proposal"
                        value={proposal ? proposal.label : '—'}
                        detail={proposal ? `${proposal.slug} · ${proposal.tasks?.length ?? 0} tasks` : 'Not yet generated'}
                    />
                    <ContextCard
                        label="Locale"
                        value={locale ?? '—'}
                        detail={locale === 'da' ? 'Danish' : locale === 'en' ? 'English' : 'Unknown'}
                    />
                </div>

                {/* ── System Prompt ── */}
                {systemPrompt && (
                    <CollapsibleSection
                        title="System Prompt"
                        icon={<Terminal className="h-4 w-4" />}
                        expanded={expandedSections.systemPrompt}
                        onToggle={() => toggleSection('systemPrompt')}
                    >
                        <div className="relative">
                            <CopyButton
                                copied={copiedId === 'system'}
                                onClick={() => copyToClipboard(systemPrompt, 'system')}
                            />
                            <pre className="whitespace-pre-wrap break-words bg-muted/30 rounded p-3 text-[11px] max-h-96 overflow-auto pr-10">
                                {systemPrompt}
                            </pre>
                        </div>
                    </CollapsibleSection>
                )}

                {/* ── Messages ── */}
                <CollapsibleSection
                    title="Conversation"
                    icon={<MessageSquare className="h-4 w-4" />}
                    count={messages.length}
                    expanded={expandedSections.messages}
                    onToggle={() => toggleSection('messages')}
                    action={
                        <button
                            onClick={(e) => { e.stopPropagation(); copyEntireConversation(); }}
                            className="p-1 rounded-md hover:bg-muted transition-colors"
                            title="Copy entire conversation"
                        >
                            {copiedId === 'all'
                                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                : <ClipboardCopy className="h-3.5 w-3.5" />}
                        </button>
                    }
                >
                    <div className="space-y-2">
                        {messages.map((m, i) => {
                            if (!m.content.trim()) return null;
                            const isUser = m.role === 'user';
                            return (
                                <div key={i} className="flex gap-2 text-xs group">
                                    <div className={cn(
                                        'p-1 rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5',
                                        isUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                                    )}>
                                        {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-medium">{isUser ? 'User' : 'Assistant'}</span>
                                            <span className="text-muted-foreground text-[10px]">#{i + 1} · {m.content.length} chars</span>
                                            <button
                                                onClick={() => copyToClipboard(m.content, `msg-${i}`)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
                                                title="Copy message"
                                            >
                                                {copiedId === `msg-${i}`
                                                    ? <Check className="h-3 w-3 text-emerald-500" />
                                                    : <Copy className="h-3 w-3 text-muted-foreground" />}
                                            </button>
                                        </div>
                                        <pre className="whitespace-pre-wrap break-words bg-muted/30 rounded p-2 text-[11px] max-h-60 overflow-auto">
                                            {m.content}
                                        </pre>
                                    </div>
                                </div>
                            );
                        })}

                        {streaming && streamingText && (
                            <div className="flex gap-2 text-xs">
                                <div className="p-1 rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5 bg-blue-500/10 text-blue-500">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-medium text-blue-500">Streaming</span>
                                        <span className="text-muted-foreground text-[10px]">{streamingText.length} chars</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap break-words bg-blue-500/5 border border-blue-500/10 rounded p-2 text-[11px] max-h-60 overflow-auto">
                                        {streamingText}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                {/* ── Proposal ── */}
                {proposal && (
                    <CollapsibleSection
                        title="Parsed Proposal"
                        icon={<Wand2 className="h-4 w-4" />}
                        expanded={expandedSections.proposal}
                        onToggle={() => toggleSection('proposal')}
                    >
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                <InfoRow label="Label" value={proposal.label} />
                                <InfoRow label="Slug" value={proposal.slug} mono />
                                <InfoRow label="Icon" value={proposal.icon || '—'} />
                                <InfoRow label="Model Tier" value={proposal.modelTier || 'medium'} />
                                <InfoRow label="Mode" value={proposal.workflowMode ? 'Multi-step workflow' : 'Single prompt'} />
                                <InfoRow label="Tools" value={proposal.tools?.join(', ') || '—'} />
                            </div>

                            {proposal.description && (
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Description:</span>
                                    <p className="mt-0.5">{proposal.description}</p>
                                </div>
                            )}

                            {proposal.promptTemplate && (
                                <div>
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">System Prompt</span>
                                    <pre className="mt-1 text-[11px] bg-muted/30 rounded p-2 whitespace-pre-wrap max-h-40 overflow-auto">
                                        {proposal.promptTemplate}
                                    </pre>
                                </div>
                            )}

                            {proposal.tasks && proposal.tasks.length > 0 && (
                                <div>
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                                        Tasks ({proposal.tasks.length})
                                    </span>
                                    <div className="space-y-2 mt-1">
                                        {proposal.tasks.map((task, i) => (
                                            <div key={i} className="border rounded-lg p-3 bg-muted/10">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CircleDot className="h-3 w-3 text-primary" />
                                                    <span className="font-medium text-xs">{task.title}</span>
                                                </div>
                                                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-1">
                                                    {task.systemPrompt}
                                                </pre>
                                                {task.allowedTools.length > 0 && (
                                                    <div className="flex gap-1 flex-wrap">
                                                        {task.allowedTools.map((t) => (
                                                            <span key={t} className="text-[9px] font-mono bg-muted px-1 rounded">{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {task.dataSchema && Object.keys(task.dataSchema).length > 0 && (
                                                    <pre className="text-[9px] font-mono bg-muted/30 rounded p-1 mt-1 max-h-20 overflow-auto">
                                                        {JSON.stringify(task.dataSchema, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>
                )}

                {/* ── Simulation Data ── */}
                {(Object.keys(simulationData || {}).length > 0 || (interactions || []).length > 0) && (
                    <CollapsibleSection
                        title="Simulation & Data"
                        icon={<Database className="h-4 w-4" />}
                        count={(interactions || []).length}
                        expanded={expandedSections.simulation}
                        onToggle={() => toggleSection('simulation')}
                    >
                        <div className="space-y-4">
                            {sessionDocId && (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">NoSQL Doc:</span>
                                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{sessionDocId}</code>
                                </div>
                            )}

                            {simulationData && Object.keys(simulationData).length > 0 && (
                                <div>
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Collected Data</span>
                                    <div className="mt-1 space-y-2">
                                        {Object.entries(simulationData).map(([stepKey, fields]) => (
                                            <div key={stepKey} className="border rounded-lg p-2 bg-muted/10">
                                                <div className="text-[10px] font-semibold text-muted-foreground mb-1">{stepKey}</div>
                                                {Object.entries(fields).map(([k, v]) => (
                                                    <div key={k} className="flex gap-2 text-xs">
                                                        <span className="text-muted-foreground font-mono shrink-0">{k}:</span>
                                                        <span className="break-words">{v || '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {interactions && interactions.length > 0 && (
                                <div>
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Interaction Log</span>
                                    <div className="mt-1 space-y-1">
                                        {interactions.map((entry, i) => (
                                            <div key={i} className="flex items-start gap-2 text-[11px]">
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                                    entry.type === 'form-submit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : entry.type === 'simulate-inject' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                    {entry.type}
                                                </span>
                                                <span className="text-muted-foreground text-[9px] shrink-0">
                                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                                </span>
                                                <span className="break-words line-clamp-2">{entry.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>
                )}

                {/* ── Raw JSON ── */}
                <CollapsibleSection
                    title="Raw State"
                    icon={<FileJson className="h-4 w-4" />}
                    expanded={expandedSections.raw}
                    onToggle={() => toggleSection('raw')}
                >
                    <CopyableJson data={state} />
                </CollapsibleSection>
            </div>
        </div>
    );
}

// ─── Helper Components ─────────────────────────────────────────

function ContextCard({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="border rounded-lg p-3 bg-card">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
            <div className="font-semibold text-sm truncate">{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{detail}</div>
        </div>
    );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <span className="text-muted-foreground">{label}: </span>
            <span className={mono ? 'font-mono' : ''}>{value}</span>
        </div>
    );
}

function CollapsibleSection({
    title, icon, count, expanded, onToggle, children, action,
}: {
    title: string;
    icon: React.ReactNode;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 text-left text-sm font-medium transition-colors"
            >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {icon}
                {title}
                {count !== undefined && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>
                )}
                {action && <span className={count !== undefined ? '' : 'ml-auto'}>{action}</span>}
            </button>
            {expanded && <div className="p-4 border-t">{children}</div>}
        </div>
    );
}

function CopyableJson({ data }: { data: unknown }) {
    const [copied, setCopied] = useState(false);
    const json = JSON.stringify(data, null, 2);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(json);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background border hover:bg-muted transition-colors"
                title="Copy JSON"
            >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <pre className="text-[10px] font-mono bg-muted/20 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {json}
            </pre>
        </div>
    );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-background border hover:bg-muted transition-colors"
            title="Copy"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}
