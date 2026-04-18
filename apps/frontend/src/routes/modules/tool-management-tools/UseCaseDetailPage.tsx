/**
 * Use Case Detail — Management page
 *
 * Full management view for a single use case: overview, versions, test cases,
 * attachments, and test runner.
 * Accessible at /modules/tool-management-tools/use-cases/:useCaseId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    ArrowLeft, Layers, FlaskConical, Play, Plus, Save, Trash2,
    ChevronDown, ChevronRight, Paperclip, FileUp,
    CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Check,
    Info, Copy, ToggleLeft, ToggleRight, Pencil, RotateCcw,
    Calendar, Hash, Tag, Cpu, Wrench, FileText, Eye, ExternalLink, Puzzle,
    // Form Icons
    Sparkles, Megaphone, FileSearch, Building2, SearchCheck, Bot,
    Search, Code, Lightbulb, PenTool, Wand2, Network,
    Scale, BookOpen, Globe, Zap, MessageSquare, Settings, Database
} from 'lucide-react';
import { WorkflowTasksTab } from './WorkflowTasksTab';
import { WorkflowTagPicker } from './WorkflowTagPicker';
import {
    fetchUseCase, createVersion, updateUseCase, deleteUseCase,
    createTestCase, updateTestCase, suggestTestCases,
    deleteTestCase, uploadAttachment, deleteAttachment, getAttachmentUrl,
    runTests, fetchTestRuns,
    type UseCaseListItem, type TestRunResult, type TestRunSummary,
} from './use-case-api';
import { useTranslation } from '@/core/i18n';

// ─── Types ─────────────────────────────────────────────────────

type UseCaseDetail = Awaited<ReturnType<typeof fetchUseCase>>;
type Version = UseCaseDetail['versions'][number];
type TestCase = UseCaseDetail['testCases'][number];

const USE_CASE_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Sparkles, Megaphone, FileSearch, Building2, SearchCheck, Bot,
    FlaskConical, Scale, Wrench, BookOpen, Globe, Layers, Zap, FileText,
    MessageSquare, Settings, Database, Search, Code, Lightbulb, PenTool, Wand2, Puzzle,
};

const MODEL_TIERS = [
    { value: 'low', label: 'Low — gpt-4o-mini' },
    { value: 'medium', label: 'Medium — gpt-5.2-chat' },
    { value: 'high', label: 'High — gpt-5.4-pro' },
    { value: 'reasoning', label: 'Reasoning — o3' },
];

function tierLabel(value: string) {
    return MODEL_TIERS.find((t) => t.value === value)?.label ?? value;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    passed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Passed' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
    error: { icon: AlertCircle, color: 'text-amber-500', label: 'Error' },
    running: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
    pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
};

// ─── Main Component ────────────────────────────────────────────

export function UseCaseDetailPage() {
    const { useCaseId } = useParams<{ useCaseId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [useCase, setUseCase] = useState<UseCaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'tests' | 'runner' | 'workflow'>('overview');
    const [sessionLaunched, setSessionLaunched] = useState(false);
    const [sidebarHint, setSidebarHint] = useState(false);
    const [hasExtension, setHasExtension] = useState(
        () => document.documentElement.hasAttribute('data-surdej-extension'),
    );

    useEffect(() => {
        // Check immediately
        if (document.documentElement.hasAttribute('data-surdej-extension')) {
            setHasExtension(true);
            return;
        }
        // Content script may load after React — watch for the attribute
        const observer = new MutationObserver(() => {
            if (document.documentElement.hasAttribute('data-surdej-extension')) {
                setHasExtension(true);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surdej-extension'] });
        return () => observer.disconnect();
    }, []);

    const load = useCallback(async () => {
        if (!useCaseId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchUseCase(useCaseId);
            setUseCase(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load use case');
        } finally {
            setLoading(false);
        }
    }, [useCaseId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
            </div>
        );
    }

    if (error || !useCase) {
        return (
            <div className="p-6">
                <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm">
                    {error ?? t('workflow.useCaseNotFound')}
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview' as const, label: t('workflow.overview'), icon: Info },
        { id: 'versions' as const, label: t('workflow.versions'), icon: Layers, count: useCase.versions.length },
        { id: 'tests' as const, label: t('workflow.testCases'), icon: FlaskConical, count: useCase.testCases.length },
        ...(useCase.workflowMode ? [{ id: 'workflow' as const, label: t('workflow.workflowTasks'), icon: Network, count: useCase.tasks?.length ?? 0 }] : []),
        { id: 'runner' as const, label: t('workflow.testRunner'), icon: Play },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="px-6 py-4 border-b shrink-0">
                <div className="flex items-start gap-3">
                    <button
                        onClick={() => navigate('/modules/workflow')}
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors mt-0.5"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold truncate">{useCase.label}</h1>
                            {useCase.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                    {t('workflow.inactive')}
                                </span>
                            )}
                            {useCase.isBuiltIn && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                                    built-in
                                </span>
                            )}
                            <button
                                onClick={() => navigate(`/modules/workflow/${useCase.id}/edit`)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors bg-muted text-muted-foreground hover:bg-muted/80 ml-auto"
                                title="Edit this workflow using the AI wizard"
                            >
                                <Wand2 className="h-3 w-3" />
                                Edit in Wizard
                            </button>
                            <button
                                onClick={() => {
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
                                        window.postMessage({ type: 'SURDEJ_OPEN_SIDEBAR', useCase: useCase.id }, '*');
                                    } else {
                                        window.open(`/extension?useCase=${encodeURIComponent(useCase.id)}`, '_blank', 'width=420,height=800');
                                    }
                                }}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                                    sessionLaunched
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                                }`}
                                title={hasExtension ? 'Open in browser extension side panel' : 'Start a new workflow session in a popup window'}
                            >
                                {sessionLaunched ? (
                                    <>
                                        <Check className="h-3 w-3" />
                                        Opened in Extension
                                    </>
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
                                {useCase.slug}
                            </code>
                            {useCase.description && (
                                <span className="text-xs text-muted-foreground truncate">— {useCase.description}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-4">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                                    active
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                                {'count' in tab && tab.count != null && (
                                    <span className={`text-[10px] px-1.5 rounded ${active ? 'bg-primary/20' : 'bg-muted'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'overview' && (
                    <OverviewTab useCase={useCase} onRefresh={load} />
                )}
                {activeTab === 'versions' && (
                    <VersionsTab useCase={useCase} onRefresh={load} />
                )}
                {activeTab === 'tests' && (
                    <TestCasesTab useCase={useCase} onRefresh={load} />
                )}
                {activeTab === 'workflow' && (
                    <WorkflowTasksTab useCase={useCase} onRefresh={load} />
                )}
                {activeTab === 'runner' && (
                    <TestRunnerTab useCase={useCase} />
                )}
            </div>
        </div>
    );
}

// ─── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ useCase, onRefresh }: { useCase: UseCaseDetail; onRefresh: () => void }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(useCase.label);
    const [description, setDescription] = useState(useCase.description ?? '');
    const [icon, setIcon] = useState(useCase.icon ?? '');
    const [saving, setSaving] = useState(false);

    const latestVersion = useCase.versions[0] ?? null;

    const [editingPrompt, setEditingPrompt] = useState(false);
    const [draftPrompt, setDraftPrompt] = useState('');
    const [savingPrompt, setSavingPrompt] = useState(false);

    const toggleActive = async () => {
        setToggling(true);
        try {
            await updateUseCase(useCase.id, { isActive: !useCase.isActive });
            onRefresh();
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('workflow.deleteUseCaseConfirm').replace('{name}', useCase.label))) return;
        setDeleting(true);
        try {
            await deleteUseCase(useCase.id);
            navigate('/modules/workflow');
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            await updateUseCase(useCase.id, {
                label: label || undefined,
                description: description || undefined,
                icon: icon || undefined,
            });
            setEditing(false);
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrompt = async () => {
        if (!latestVersion) return;
        setSavingPrompt(true);
        try {
            await createVersion(useCase.id, {
                promptTemplate: draftPrompt,
                tools: latestVersion.tools,
                modelTier: latestVersion.modelTier as 'low' | 'medium' | 'high' | 'reasoning',
                changelog: 'Updated system prompt from overview',
            });
            setEditingPrompt(false);
            onRefresh();
        } finally {
            setSavingPrompt(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            {/* ── Details Card ── */}
            <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        {t('workflow.details')}
                    </h2>
                    <div className="flex items-center gap-1">
                        {!editing ? (
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-muted/50 transition-colors"
                            >
                                <Pencil className="h-3 w-3" />
                                {t('common.edit')}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="px-2.5 py-1 text-xs border rounded-md hover:bg-muted/50"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                                >
                                    <Save className="h-3 w-3" />
                                    {saving ? t('workflow.saving') : t('common.save')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    {editing ? (
                        /* Edit mode */
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">{t('workflow.label')}</label>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">{t('workflow.description')}</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border rounded-md bg-background resize-y"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-2">{t('workflow.icon')}</label>
                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                    {Object.entries(USE_CASE_ICON_MAP).map(([name, IconComp]) => {
                                        const isSelected = icon === name;
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => setIcon(name)}
                                                className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                                                    isSelected 
                                                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' 
                                                        : 'border-border/60 hover:bg-muted/50 hover:border-primary/40 text-muted-foreground'
                                                }`}
                                                title={name}
                                            >
                                                <IconComp className="h-5 w-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Read mode — grid layout */
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            <DetailRow icon={Tag} label={t('workflow.slug')} value={useCase.slug} mono />
                            <DetailRow icon={FileText} label={t('workflow.label')} value={useCase.label} />
                            <DetailRow icon={Info} label={t('workflow.description')} value={useCase.description || '—'} span2 />
                            <DetailRow icon={Eye} label={t('workflow.icon')} value={
                                <div className="flex items-center gap-2">
                                    {useCase.icon && USE_CASE_ICON_MAP[useCase.icon] ? (() => {
                                        const IconComp = USE_CASE_ICON_MAP[useCase.icon];
                                        return (
                                            <>
                                                <IconComp className="h-4 w-4" />
                                                <span>{useCase.icon}</span>
                                            </>
                                        );
                                    })() : (
                                        <span>{useCase.icon || 'None'}</span>
                                    )}
                                </div>
                            } />
                            <DetailRow
                                icon={useCase.isActive ? ToggleRight : ToggleLeft}
                                label={t('common.status')}
                                value={useCase.isActive ? t('workflow.active') : t('workflow.inactive')}
                                valueColor={useCase.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
                            />
                            <DetailRow icon={Calendar} label={t('workflow.created')} value={new Date(useCase.createdAt).toLocaleString()} />
                            <DetailRow icon={Calendar} label={t('workflow.updatedField')} value={new Date(useCase.updatedAt).toLocaleString()} />
                            <DetailRow icon={Hash} label={t('workflow.id')} value={useCase.id} mono />
                            <DetailRow icon={Layers} label={t('workflow.versions')} value={String(useCase.versions.length)} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tags Card ── */}
            <div className="border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        {t('workflow.tags')}
                    </h2>
                </div>
                <div className="p-5">
                    <WorkflowTagPicker useCaseId={useCase.id} />
                </div>
            </div>

            {/* ── Latest Version Card ── */}
            {latestVersion && (
                <div className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            {t('workflow.activeVersion')}
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                                v{latestVersion.version}
                            </span>
                        </h2>
                        <button
                            onClick={() => {/* parent already has tab */}}
                            className="text-xs text-primary hover:underline"
                        >
                            {t('workflow.viewAllVersions')}
                        </button>
                    </div>
                    <div className="p-5 space-y-3">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            <DetailRow icon={Cpu} label={t('workflow.modelTier')} value={tierLabel(latestVersion.modelTier)} />
                            <DetailRow icon={Calendar} label={t('workflow.created')} value={new Date(latestVersion.createdAt).toLocaleString()} />
                        </div>
                        {latestVersion.tools.length > 0 && (
                            <div>
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.tools')}</span>
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                    {latestVersion.tools.map((t) => (
                                        <span key={t} className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-mono">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.systemPrompt')}</span>
                                {!editingPrompt ? (
                                    <button
                                        onClick={() => {
                                            setDraftPrompt(latestVersion.promptTemplate);
                                            setEditingPrompt(true);
                                        }}
                                        className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        {t('common.edit')}
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingPrompt(false)}
                                            className="text-[10px] text-muted-foreground hover:text-foreground"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            onClick={handleSavePrompt}
                                            disabled={savingPrompt || !draftPrompt}
                                            className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {savingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                            {savingPrompt ? t('workflow.saving') : t('common.save')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {editingPrompt ? (
                                <textarea
                                    value={draftPrompt}
                                    onChange={(e) => setDraftPrompt(e.target.value)}
                                    rows={8}
                                    className="mt-1 w-full p-3 bg-background rounded-lg text-xs font-mono border resize-y focus:ring-1 focus:ring-primary/50 outline-none"
                                />
                            ) : (
                                <pre className="mt-1 p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed border">
                                    {latestVersion.promptTemplate}
                                </pre>
                            )}
                        </div>
                        {latestVersion.changelog && (
                            <div>
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.changelog')}</span>
                                <p className="text-xs text-muted-foreground mt-1">{latestVersion.changelog}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Actions Card ── */}
            <div className="border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        {t('workflow.actions')}
                    </h2>
                </div>
                <div className="p-5 flex flex-wrap gap-3">
                    <button
                        onClick={toggleActive}
                        disabled={toggling}
                        className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                            useCase.isActive
                                ? 'hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-700'
                                : 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-700'
                        }`}
                    >
                        {useCase.isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        {toggling ? t('workflow.updating') : useCase.isActive ? t('workflow.deactivate') : t('workflow.activate')}
                    </button>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(useCase.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                        <Copy className="h-4 w-4" />
                        {t('workflow.copyId')}
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        {deleting ? t('workflow.deleting') : t('workflow.deleteUseCase')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailRow({
    icon: Icon,
    label,
    value,
    mono,
    span2,
    valueColor,
}: {
    icon: React.FC<{ className?: string }>;
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    span2?: boolean;
    valueColor?: string;
}) {
    return (
        <div className={span2 ? 'col-span-2' : ''}>
            <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-sm truncate ${mono ? 'font-mono text-[12px]' : ''} ${valueColor ?? ''}`}>
                {value}
            </p>
        </div>
    );
}

// ─── Versions Tab ──────────────────────────────────────────────

function VersionsTab({ useCase, onRefresh }: { useCase: UseCaseDetail; onRefresh: () => void }) {
    const { t } = useTranslation();
    const [showNewForm, setShowNewForm] = useState(false);
    const [prompt, setPrompt] = useState(useCase.versions[0]?.promptTemplate ?? '');
    const [tools, setTools] = useState(useCase.versions[0]?.tools.join(', ') ?? '');
    const [tier, setTier] = useState(useCase.versions[0]?.modelTier ?? 'medium');
    const [changelog, setChangelog] = useState('');
    const [saving, setSaving] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createVersion(useCase.id, {
                promptTemplate: prompt,
                tools: tools ? tools.split(',').map((t) => t.trim()).filter(Boolean) : [],
                modelTier: tier as 'low' | 'medium' | 'high' | 'reasoning',
                changelog: changelog || undefined,
            });
            setShowNewForm(false);
            setChangelog('');
            onRefresh();
        } catch {
            // error shown via parent
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async (version: Version) => {
        if (!confirm(`Restore Version ${version.version}? This will create a new version with the same configuration.`)) return;
        setRestoringId(version.id);
        try {
            await createVersion(useCase.id, {
                promptTemplate: version.promptTemplate,
                tools: version.tools,
                modelTier: version.modelTier as 'low' | 'medium' | 'high' | 'reasoning',
                changelog: `Restored from Version ${version.version}`,
            });
            onRefresh();
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('workflow.versionHistory').replace('{count}', String(useCase.versions.length))}
                </h2>
                <button
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {t('workflow.newVersion')}
                </button>
            </div>

            {/* New version form */}
            {showNewForm && (
                <form onSubmit={handleCreate} className="p-4 border rounded-xl bg-muted/20 space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.systemPromptTemplate')}</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={5}
                            required
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background font-mono resize-y"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">{t('workflow.toolsCommaSeparated')}</label>
                            <input
                                type="text"
                                value={tools}
                                onChange={(e) => setTools(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">{t('workflow.modelTier')}</label>
                            <select
                                value={tier}
                                onChange={(e) => setTier(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                            >
                                {MODEL_TIERS.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.changelog')}</label>
                        <input
                            type="text"
                            value={changelog}
                            onChange={(e) => setChangelog(e.target.value)}
                            placeholder={t('workflow.changelogPlaceholder')}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowNewForm(false)} className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted/50">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" disabled={saving || !prompt} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50">
                            <Save className="h-3 w-3" />
                            {saving ? t('workflow.saving') : t('workflow.createVersion')}
                        </button>
                    </div>
                </form>
            )}

            {/* Version list — timeline style */}
            <div className="relative">
                {/* Timeline line */}
                {useCase.versions.length > 1 && (
                    <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />
                )}

                <div className="space-y-3">
                    {useCase.versions.map((v, idx) => (
                        <VersionCard
                            key={v.id}
                            version={v}
                            isLatest={idx === 0}
                            isRestoring={restoringId === v.id}
                            onRestore={() => handleRestore(v)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function VersionCard({
    version,
    isLatest,
    isRestoring,
    onRestore,
}: {
    version: Version;
    isLatest: boolean;
    isRestoring: boolean;
    onRestore: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="relative flex gap-3">
            {/* Timeline dot */}
            <div className={`relative z-10 mt-3 w-[10px] h-[10px] rounded-full border-2 shrink-0 ${
                isLatest
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-muted-foreground/40 bg-background'
            }`} />

            <div className="flex-1 border rounded-xl overflow-hidden">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="text-sm font-medium">Version {version.version}</span>
                    {isLatest && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                            {t('workflow.latest')}
                        </span>
                    )}
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {tierLabel(version.modelTier)}
                    </span>
                    {version.changelog && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            — {version.changelog}
                        </span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[10px] text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                    </span>
                </button>
                {expanded && (
                    <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
                        <div className="mt-3">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.systemPrompt')}</label>
                            <pre className="mt-1 p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed border">
                                {version.promptTemplate}
                            </pre>
                        </div>
                        {version.tools.length > 0 && (
                            <div>
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.tools')}</label>
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                    {version.tools.map((t) => (
                                        <span key={t} className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-mono">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {version.changelog && (
                            <div>
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.changelog')}</label>
                                <p className="text-xs text-muted-foreground mt-1">{version.changelog}</p>
                            </div>
                        )}
                        {/* Restore button — only for non-latest versions */}
                        {!isLatest && (
                            <div className="pt-2 border-t">
                                <button
                                    onClick={onRestore}
                                    disabled={isRestoring}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                                >
                                    {isRestoring ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-3 w-3" />
                                    )}
                                    {isRestoring ? t('workflow.saving') : t('workflow.restoreVersion')}
                                </button>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {t('workflow.restoreVersionHelp')}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Test Cases Tab ────────────────────────────────────────────

function TestCasesTab({ useCase, onRefresh }: { useCase: UseCaseDetail; onRefresh: () => void }) {
    const { t } = useTranslation();
    const [showNewForm, setShowNewForm] = useState(false);
    const [name, setName] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [evalPrompt, setEvalPrompt] = useState('');
    const [expectedBehavior, setExpectedBehavior] = useState('');
    const [saving, setSaving] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createTestCase(useCase.id, {
                name,
                userPrompt,
                evaluationPrompt: evalPrompt,
                expectedBehavior: expectedBehavior || undefined,
            });
            setShowNewForm(false);
            setName('');
            setUserPrompt('');
            setEvalPrompt('');
            setExpectedBehavior('');
            onRefresh();
        } catch {
            // handled by parent
        } finally {
            setSaving(false);
        }
    };

    const [suggesting, setSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const handleSuggest = async () => {
        setSuggesting(true);
        try {
            const results = await suggestTestCases(useCase.id);
            setSuggestions(results);
            setShowNewForm(false);
        } catch (err) {
            console.error("Failed to suggest tests", err);
        } finally {
            setSuggesting(false);
        }
    };

    const handleAcceptSuggestion = async (s: any, idx: number) => {
        try {
            await createTestCase(useCase.id, s);
            setSuggestions((prev) => prev.filter((_, i) => i !== idx));
            onRefresh();
        } catch (err) {
            console.error("Failed to create test case", err);
        }
    };

    return (
        <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('workflow.testCasesCount').replace('{count}', String(useCase.testCases.length))}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSuggest}
                        disabled={suggesting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md hover:bg-purple-500/20 disabled:opacity-50"
                    >
                        {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {suggesting ? t('workflow.analyzing') : t('workflow.suggestTests')}
                    </button>
                    <button
                        onClick={() => { setShowNewForm(!showNewForm); setSuggestions([]); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('workflow.newTestCase')}
                    </button>
                </div>
            </div>

            {/* AI Suggestions List */}
            {suggestions.length > 0 && (
                <div className="p-4 border rounded-xl bg-purple-500/5 border-purple-500/20 space-y-4">
                    <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> {t('workflow.aiSuggestions')}
                    </h3>
                    <div className="space-y-3">
                        {suggestions.map((s, idx) => (
                            <div key={idx} className="p-3 bg-card border rounded-lg shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-sm">{s.name}</h4>
                                    <button 
                                        onClick={() => handleAcceptSuggestion(s, idx)}
                                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                                    >
                                        {t('workflow.acceptCreate')}
                                    </button>
                                </div>
                                <div className="space-y-2 mt-2">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase">Prompt:</span>
                                        <p className="text-xs font-mono bg-muted/30 p-1.5 rounded">{s.userPrompt}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase">Evaluation:</span>
                                        <p className="text-xs font-mono bg-blue-500/5 text-blue-800 dark:text-blue-300 p-1.5 rounded">{s.evaluationPrompt}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New test case form */}
            {showNewForm && (
                <form onSubmit={handleCreate} className="p-4 border rounded-xl bg-muted/20 space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.testName')}</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('workflow.testNamePlaceholder')}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.userPrompt')}</label>
                        <textarea
                            required
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder={t('workflow.userPromptPlaceholder')}
                            rows={3}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background font-mono resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.evaluationPrompt')}</label>
                        <textarea
                            required
                            value={evalPrompt}
                            onChange={(e) => setEvalPrompt(e.target.value)}
                            placeholder={t('workflow.evaluationPromptHelp')}
                            rows={3}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background font-mono resize-y"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('workflow.evaluationPromptDesc')}
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.expectedBehavior')}</label>
                        <input
                            type="text"
                            value={expectedBehavior}
                            onChange={(e) => setExpectedBehavior(e.target.value)}
                            placeholder={t('workflow.expectedBehaviorPlaceholder')}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowNewForm(false)} className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted/50">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" disabled={saving || !name || !userPrompt || !evalPrompt} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50">
                            <Save className="h-3 w-3" />
                            {saving ? t('workflow.saving') : t('workflow.createTestCase')}
                        </button>
                    </div>
                </form>
            )}

            {/* Test case list */}
            <div className="space-y-2">
                {useCase.testCases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        {t('workflow.noTestCases')}
                    </div>
                ) : (
                    useCase.testCases.map((tc) => (
                        <TestCaseCard key={tc.id} testCase={tc} useCaseId={useCase.id} onRefresh={onRefresh} />
                    ))
                )}
            </div>
        </div>
    );
}

function TestCaseCard({ testCase, useCaseId, onRefresh }: { testCase: TestCase; useCaseId: string; onRefresh: () => void }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(t('workflow.deleteTestCaseConfirm').replace('{name}', testCase.name))) return;
        setDeleting(true);
        try {
            await deleteTestCase(useCaseId, testCase.id);
            onRefresh();
        } finally {
            setDeleting(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await uploadAttachment(useCaseId, testCase.id, file);
            onRefresh();
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteAttachment = async (attId: string) => {
        await deleteAttachment(attId);
        onRefresh();
    };

    return (
        <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(!expanded)} className="shrink-0">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <span className="text-sm font-medium flex-1">{testCase.name}</span>
                {testCase.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {testCase.attachments.length}
                    </span>
                )}
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                    title="Delete test case"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
                    <div className="mt-3">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.userPrompt')}</label>
                        <pre className="mt-1 p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap border">
                            {testCase.userPrompt}
                        </pre>
                    </div>
                    <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.evaluationPrompt')}</label>
                        <pre className="mt-1 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg text-xs font-mono whitespace-pre-wrap">
                            {testCase.evaluationPrompt}
                        </pre>
                    </div>
                    {testCase.expectedBehavior && (
                        <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.expectedBehavior')}</label>
                            <p className="text-xs text-muted-foreground mt-1">{testCase.expectedBehavior}</p>
                        </div>
                    )}

                    {/* Attachments */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">
                                {t('workflow.attachments').replace('{count}', String(testCase.attachments.length))}
                            </label>
                            <label className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary hover:underline cursor-pointer">
                                <FileUp className="h-3 w-3" />
                                {uploading ? t('workflow.uploading') : t('workflow.uploadFile')}
                                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                            </label>
                        </div>
                        {testCase.attachments.length > 0 && (
                            <div className="space-y-1 mt-1">
                                {testCase.attachments.map((att) => (
                                    <div key={att.id} className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs">
                                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <a
                                            href={getAttachmentUrl(att.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary hover:underline flex-1 truncate"
                                        >
                                            {att.filename}
                                        </a>
                                        <span className="text-muted-foreground text-[10px]">
                                            {(att.sizeBytes / 1024).toFixed(1)} KB
                                        </span>
                                        <button
                                            onClick={() => handleDeleteAttachment(att.id)}
                                            className="p-0.5 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Test Runner Tab ───────────────────────────────────────────

function TestRunnerTab({ useCase }: { useCase: UseCaseDetail }) {
    const { t } = useTranslation();
    const [selectedVersion, setSelectedVersion] = useState(useCase.versions[0]?.id ?? '');
    const [overrideTier, setOverrideTier] = useState('');
    const [running, setRunning] = useState(false);
    const [summary, setSummary] = useState<TestRunSummary | null>(null);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRun = async () => {
        if (!selectedVersion) return;
        setRunning(true);
        setError(null);
        setSummary(null);
        try {
            const result = await runTests(useCase.id, {
                versionId: selectedVersion,
                modelTier: (overrideTier || undefined) as 'low' | 'medium' | 'high' | 'reasoning' | undefined,
            });
            setSummary(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test run failed');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('workflow.testRunner')}
            </h2>

            {/* Configuration */}
            <div className="p-4 border rounded-xl bg-muted/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.versionToTest')}</label>
                        <select
                            value={selectedVersion}
                            onChange={(e) => setSelectedVersion(e.target.value)}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                        >
                            {useCase.versions.map((v) => (
                                <option key={v.id} value={v.id}>
                                    Version {v.version} — {tierLabel(v.modelTier)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">{t('workflow.overrideModelTier')}</label>
                        <select
                            value={overrideTier}
                            onChange={(e) => setOverrideTier(e.target.value)}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-background"
                        >
                            <option value="">{t('workflow.useVersionDefault')}</option>
                            {MODEL_TIERS.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                        {t('workflow.testsWillExecute').replace('{count}', String(useCase.testCases.length))}
                    </p>
                    <button
                        onClick={handleRun}
                        disabled={running || !selectedVersion || useCase.testCases.length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {running ? t('workflow.runningTests') : t('workflow.runAllTests')}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {error}
                </div>
            )}

            {/* Results */}
            {summary && (
                <div className="space-y-4">
                    {/* Summary bar */}
                    <div className="flex items-center gap-4 p-4 border rounded-xl">
                        <div className="flex items-center gap-6 text-sm">
                            <span className="font-medium">{t('workflow.testsCount').replace('{count}', String(summary.totalTests))}</span>
                            <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {summary.passed} {t('workflow.passed')}
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                                <XCircle className="h-4 w-4" />
                                {summary.failed} {t('workflow.failed')}
                            </span>
                            {summary.errors > 0 && (
                                <span className="flex items-center gap-1 text-amber-500">
                                    <AlertCircle className="h-4 w-4" />
                                    {summary.errors} {t('workflow.errors')}
                                </span>
                            )}
                        </div>
                        <div className="flex-1" />
                        <div className="w-48 h-2 bg-muted rounded-full overflow-hidden flex">
                            {summary.passed > 0 && (
                                <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${(summary.passed / summary.totalTests) * 100}%` }}
                                />
                            )}
                            {summary.failed > 0 && (
                                <div
                                    className="bg-red-500 h-full"
                                    style={{ width: `${(summary.failed / summary.totalTests) * 100}%` }}
                                />
                            )}
                            {summary.errors > 0 && (
                                <div
                                    className="bg-amber-500 h-full"
                                    style={{ width: `${(summary.errors / summary.totalTests) * 100}%` }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Individual results */}
                    <div className="space-y-2">
                        {summary.runs.map((run) => {
                            const tc = useCase.testCases.find((t) => t.id === run.testCaseId);
                            const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.pending;
                            const StatusIcon = statusCfg.icon;
                            const isExpanded = expandedRun === run.id;

                            return (
                                <div key={run.id} className="border rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                    >
                                        <StatusIcon className={`h-4 w-4 ${statusCfg.color} shrink-0 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                                        <span className="text-sm font-medium flex-1">{tc?.name ?? run.testCaseId}</span>
                                        {run.evaluationResult?.score != null && (
                                            <span className={`text-xs font-mono ${run.evaluationResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {(run.evaluationResult.score * 100).toFixed(0)}%
                                            </span>
                                        )}
                                        {run.durationMs != null && (
                                            <span className="text-[10px] text-muted-foreground">
                                                {run.durationMs}ms
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </button>
                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
                                            {run.aiResponse && (
                                                <div className="mt-3">
                                                    <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.aiResponse')}</label>
                                                    <pre className="mt-1 p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-60 overflow-auto border">
                                                        {run.aiResponse}
                                                    </pre>
                                                </div>
                                            )}
                                            {run.evaluationResult && (
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('workflow.evaluation')}</label>
                                                    <div className={`mt-1 p-3 rounded-lg text-xs ${run.evaluationResult.passed ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-red-500/5 border border-red-500/10'}`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`font-medium ${run.evaluationResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {run.evaluationResult.passed ? 'PASSED' : 'FAILED'}
                                                            </span>
                                                            {run.evaluationResult.score != null && (
                                                                <span className="text-muted-foreground">
                                                                    {t('workflow.score')} {(run.evaluationResult.score * 100).toFixed(0)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground">{run.evaluationResult.reasoning}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {run.tokenUsage && (
                                                <div className="flex gap-4 text-[10px] text-muted-foreground">
                                                    <span>{t('workflow.promptTokens').replace('{count}', String(run.tokenUsage.promptTokens))}</span>
                                                    <span>{t('workflow.completionTokens').replace('{count}', String(run.tokenUsage.completionTokens))}</span>
                                                    <span>{t('workflow.totalTokens').replace('{count}', String(run.tokenUsage.totalTokens))}</span>
                                                </div>
                                            )}
                                            {run.error && (
                                                <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg">
                                                    {run.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!summary && !running && !error && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('workflow.selectVersionToRun')}
                </div>
            )}
        </div>
    );
}
