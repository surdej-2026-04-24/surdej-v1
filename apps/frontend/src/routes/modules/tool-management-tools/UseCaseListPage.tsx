/**
 * Use Case List — Dashboard page
 *
 * Lists all persisted use cases with their latest version,
 * test case count, and quick actions.
 * Accessible at /modules/tool-management-tools/use-cases
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
    FlaskConical, Plus, RefreshCw, ChevronRight, Layers,
    CheckCircle2, XCircle, Trash2,
} from 'lucide-react';
import { fetchUseCases, deleteUseCase, type UseCaseListItem } from './use-case-api';
import { useTranslation } from '@/core/i18n';

const TIER_LABELS: Record<string, string> = {
    low: 'Low (4o-mini)',
    medium: 'Medium (5.2)',
    high: 'High (5.4-pro)',
    reasoning: 'Reasoning (o3)',
};

export function UseCaseListPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [useCases, setUseCases] = useState<UseCaseListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchUseCases(false);
            setUseCases(res.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load use cases');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm(t('workflow.deleteConfirm'))) return;
        setDeleting(id);
        try {
            await deleteUseCase(id);
            setUseCases((prev) => prev.filter((uc) => uc.id !== id));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workflow.deleteFailed'));
        } finally {
            setDeleting(null);
        }
    };

    const activeCount = useCases.filter((uc) => uc.isActive).length;

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div>
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <FlaskConical className="h-5 w-5" />
                        {t('workflow.useCases')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('workflow.useCasesCount').replace('{count}', String(useCases.length)).replace('{active}', String(activeCount))}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t('common.refresh')}
                    </button>
                    <button
                        onClick={() => navigate('/modules/workflow/new')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('workflow.newUseCase')}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm border-b">
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        {t('common.loading')}
                    </div>
                ) : useCases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <FlaskConical className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm">{t('workflow.noUseCases')}</p>
                        <button
                            onClick={() => navigate('/modules/workflow/new')}
                            className="mt-2 text-sm text-primary hover:underline"
                        >
                            {t('workflow.createFirst')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {useCases.map((uc) => (
                            <div
                                key={uc.id}
                                className="flex items-center gap-4 px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group"
                                onClick={() => navigate(`/modules/workflow/${uc.id}`)}
                            >
                                {/* Status indicator */}
                                <div className="shrink-0">
                                    {uc.isActive ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{uc.label}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            {uc.slug}
                                        </span>
                                        {uc.isBuiltIn && (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                {t('workflow.builtIn')}
                                            </span>
                                        )}
                                        {(uc as any).workflowMode && (
                                            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                {t('workflow.workflow')}
                                            </span>
                                        )}
                                    </div>
                                    {uc.description && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {uc.description}
                                        </p>
                                    )}
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                    {/* Version */}
                                    <div className="flex items-center gap-1" title="Latest version">
                                        <Layers className="h-3 w-3" />
                                        {uc.latestVersion ? `v${uc.latestVersion.version}` : t('workflow.noVersions')}
                                    </div>
                                    {/* Model tier */}
                                    {uc.latestVersion && (
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                            {TIER_LABELS[uc.latestVersion.modelTier] ?? uc.latestVersion.modelTier}
                                        </span>
                                    )}
                                    {/* Test cases */}
                                    <div className="flex items-center gap-1" title="Test cases">
                                        <FlaskConical className="h-3 w-3" />
                                        {uc.testCaseCount}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(uc.id);
                                        }}
                                        disabled={deleting === uc.id}
                                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
