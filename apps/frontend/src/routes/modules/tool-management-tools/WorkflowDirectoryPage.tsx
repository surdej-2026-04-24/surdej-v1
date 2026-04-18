/**
 * Workflow Directory — Browsable catalog of all workflows, filterable by tag.
 *
 * Accessible at /modules/workflow/directory
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
    BookOpen, Workflow, ArrowLeft, Search, Filter, X,
    ChevronRight, Sparkles, Building2, Globe, FileSearch, FileText, Upload,
} from 'lucide-react';
import {
    fetchActiveUseCases, fetchWorkflowTags,
    type ActiveUseCase, type WorkflowTagItem,
} from './use-case-api';
import { BUILT_IN_WORKFLOWS, type BuiltInWorkflow } from './built-in-workflows';
import { useTranslation } from '@/core/i18n';

type ActiveUseCaseWithTags = ActiveUseCase & { workflowTags?: WorkflowTagItem[] };

export function WorkflowDirectoryPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [workflows, setWorkflows] = useState<ActiveUseCaseWithTags[]>([]);
    const [tags, setTags] = useState<WorkflowTagItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [wfList, tagsRes] = await Promise.all([
                    fetchActiveUseCases(),
                    fetchWorkflowTags(),
                ]);
                if (cancelled) return;
                setWorkflows(wfList.filter((w) => w.workflowMode));
                setTags(tagsRes.items);
            } catch {
                // fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const toggleTag = (tagId: string) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) next.delete(tagId);
            else next.add(tagId);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedTagIds(new Set());
    };

    const filtered = useMemo(() => {
        let list = workflows;

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (w) =>
                    w.label.toLowerCase().includes(q) ||
                    w.description?.toLowerCase().includes(q) ||
                    w.slug.toLowerCase().includes(q),
            );
        }

        // Filter by tags
        if (selectedTagIds.size > 0) {
            list = list.filter((w) => {
                const wfTags = (w as ActiveUseCaseWithTags).workflowTags;
                if (!wfTags || wfTags.length === 0) return false;
                return [...selectedTagIds].some((tid) => wfTags.some((t) => t.id === tid));
            });
        }

        return list;
    }, [workflows, searchQuery, selectedTagIds]);

    const hasFilters = searchQuery.trim() !== '' || selectedTagIds.size > 0;

    // Filter built-in workflows by search
    const filteredBuiltIn = useMemo(() => {
        if (!searchQuery.trim()) return BUILT_IN_WORKFLOWS;
        const q = searchQuery.toLowerCase();
        return BUILT_IN_WORKFLOWS.filter(
            (w) =>
                w.label.toLowerCase().includes(q) ||
                w.description.toLowerCase().includes(q) ||
                w.slug.toLowerCase().includes(q) ||
                w.tags.some((t) => t.toLowerCase().includes(q)),
        );
    }, [searchQuery]);

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
                    <button
                        onClick={() => navigate('/modules/workflow')}
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            {t('workflow.directory')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('workflow.workflowsAvailable').replace('{count}', String(workflows.length))}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search & Tag Filters */}
            <div className="px-6 py-3 border-b space-y-3 shrink-0">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('workflow.searchPlaceholder')}
                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                {/* Tag filter chips */}
                {tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {tags.map((tag) => {
                            const selected = selectedTagIds.has(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.id)}
                                    className={`
                                        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                                        border transition-all cursor-pointer
                                        ${selected
                                            ? 'border-transparent text-white shadow-sm'
                                            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-background'
                                        }
                                    `}
                                    style={selected ? { backgroundColor: tag.color } : undefined}
                                >
                                    <span
                                        className={`h-2 w-2 rounded-full shrink-0 ${selected ? 'bg-white/40' : ''}`}
                                        style={!selected ? { backgroundColor: tag.color } : undefined}
                                    />
                                    {tag.label}
                                </button>
                            );
                        })}
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                <X className="h-3 w-3" />
                                {t('workflow.clearFilters')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Workflow Grid */}
            <div className="flex-1 overflow-auto p-6">
                {/* Built-in Workflows Section */}
                {filteredBuiltIn.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold">Indbyggede workflows</h2>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {filteredBuiltIn.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredBuiltIn.map((bw) => (
                                <BuiltInWorkflowCard key={bw.id} workflow={bw} navigate={navigate} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Workflows Section */}
                {(filteredBuiltIn.length > 0 && filtered.length > 0) && (
                    <div className="flex items-center gap-2 mb-3">
                        <Workflow className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold">Brugerdefinerede workflows</h2>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {filtered.length}
                        </span>
                    </div>
                )}

                {filtered.length === 0 && filteredBuiltIn.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <Workflow className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm">
                            {hasFilters ? t('workflow.noWorkflowsMatch') : t('workflow.noWorkflows')}
                        </p>
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="mt-2 text-sm text-primary hover:underline"
                            >
                                {t('workflow.clearFilters')}
                            </button>
                        )}
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((wf) => {
                            const wfTags = wf.workflowTags;
                            return (
                                <div
                                    key={wf.id}
                                    onClick={() => navigate(`/modules/workflow/${wf.id}`)}
                                    className="flex flex-col gap-2 p-4 rounded-xl border hover:bg-muted/30 hover:shadow-sm transition-all cursor-pointer group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Workflow className="h-4.5 w-4.5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-sm block truncate">{wf.label}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground">{wf.slug}</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                                    </div>

                                    {wf.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 pl-12">{wf.description}</p>
                                    )}

                                    {/* Task count + tags */}
                                    <div className="flex items-center gap-2 mt-auto pl-12 flex-wrap">
                                        {wf.tasks && wf.tasks.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {t('workflow.steps').replace('{count}', String(wf.tasks.length))}
                                            </span>
                                        )}
                                        {wfTags && wfTags.length > 0 && wfTags.map((t) => (
                                            <span
                                                key={t.id}
                                                className="text-[10px] text-white px-1.5 py-0.5 rounded-full"
                                                style={{ backgroundColor: t.color }}
                                            >
                                                {t.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── Built-in Workflow Card ─────────────────────────────────────

function BuiltInWorkflowCard({
    workflow,
    navigate,
}: {
    workflow: BuiltInWorkflow;
    navigate: (path: string) => void;
}) {
    return (
        <div
            onClick={() => navigate(`/modules/workflow/builtin/${workflow.id}`)}
            className="flex flex-col gap-2 p-4 rounded-xl border border-primary/20 bg-primary/[0.02] hover:bg-primary/[0.05] hover:shadow-sm transition-all cursor-pointer group"
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">{workflow.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{workflow.slug}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
            </div>

            {workflow.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 pl-12">{workflow.description}</p>
            )}

            <div className="flex items-center gap-2 mt-auto pl-12 flex-wrap">
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {workflow.steps.length} trin
                </span>
                {workflow.tags.map((tag) => (
                    <span
                        key={tag}
                        className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium"
                    >
                        {tag}
                    </span>
                ))}
                <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                    Indbygget
                </span>
            </div>
        </div>
    );
}
