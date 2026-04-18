/**
 * Worker Detail Page (Phase 4.11)
 *
 * Shows a single worker's full info: metadata, live metrics chart,
 * recent heartbeat history, capabilities, and drain action.
 *
 * Route: /workers/:id
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Activity, Cpu, Database, Clock, AlertTriangle,
    Server, Zap, RefreshCcw, Loader2, Waves, Heart, XCircle,
    CheckCircle2, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

// ─── Types ───

interface Heartbeat {
    id: string;
    instanceId: string;
    activeJobs: number;
    totalProcessed: number;
    totalFailed: number;
    memoryUsage: number;
    cpuUsage: number;
    createdAt: string;
}

interface WorkerDetail {
    id: string;
    instanceId: string;
    type: string;
    version: string;
    capabilities: string[];
    maxConcurrency: number;
    hostname: string;
    status: string;
    healthState: string;
    registeredAt: string;
    lastHeartbeat: string | null;
    heartbeats: Heartbeat[];
}

// ─── Component ───

export function WorkerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [worker, setWorker] = useState<WorkerDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [draining, setDraining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchWorker = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.get<WorkerDetail>(`/workers/${id}`);
            setWorker(data);
            setError(null);
        } catch {
            if (!isRefresh) navigate('/workers');
            else setError(t('workers.fetchError'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, navigate, t]);

    useEffect(() => {
        fetchWorker();
        const interval = setInterval(() => fetchWorker(true), 10_000);
        return () => clearInterval(interval);
    }, [fetchWorker]);

    const handleDrain = useCallback(async () => {
        if (!id) return;
        setDraining(true);
        try {
            await api.post(`/workers/${id}/drain`);
            await fetchWorker(true);
        } catch (err) {
            console.error('Drain failed:', err);
        } finally {
            setDraining(false);
        }
    }, [id, fetchWorker]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!worker) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                {t('workers.notFound')}
            </div>
        );
    }

    const statusConfig = getStatusConfig(worker.status);
    const latestHB = worker.heartbeats[0];
    const uptimeMs = Date.now() - new Date(worker.registeredAt).getTime();

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/workers')} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        {t('workers.backToWorkers')}
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight font-mono">{worker.instanceId}</h1>
                            <Badge className={`text-[10px] gap-1 ${statusConfig.badge}`}>
                                <statusConfig.icon className="h-2.5 w-2.5" />
                                {worker.status}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {worker.type} v{worker.version} · {worker.hostname}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchWorker(true)}
                        disabled={refreshing}
                        className="gap-1.5 text-xs"
                    >
                        <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('common.refresh')}
                    </Button>
                    {worker.status !== 'offline' && worker.status !== 'draining' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDrain}
                            disabled={draining}
                            className="gap-1.5 text-xs"
                        >
                            {draining ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Waves className="h-3.5 w-3.5" />
                            )}
                            {t('workers.drain')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Left Column: Metadata + Capabilities ─── */}
                <div className="space-y-6">
                    {/* Metadata Card */}
                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Server className="h-3 w-3" /> {t('workers.workerInfo')}
                            </div>
                            <div className="space-y-3">
                                <MetaRow label={t('workers.instanceId')} value={worker.instanceId} mono />
                                <MetaRow label={t('workers.type')} value={worker.type} />
                                <MetaRow label={t('workers.version')} value={worker.version} />
                                <MetaRow label={t('workers.hostname')} value={worker.hostname} mono />
                                <MetaRow label={t('workers.maxConcurrency')} value={String(worker.maxConcurrency)} />
                                <MetaRow label={t('workers.registered')} value={formatDate(worker.registeredAt)} />
                                <MetaRow label={t('workers.uptime')} value={formatDuration(uptimeMs)} />
                                <MetaRow
                                    label={t('workers.lastHeartbeat')}
                                    value={worker.lastHeartbeat ? formatTimeAgo(new Date(worker.lastHeartbeat)) : t('workers.never')}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Capabilities */}
                    <Card>
                        <CardContent className="p-5">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
                                <Zap className="h-3 w-3" /> {t('workers.capabilities')}
                            </div>
                            {worker.capabilities.length === 0 ? (
                                <div className="text-sm text-muted-foreground">{t('workers.noCaps')}</div>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {(worker.capabilities as string[]).map((cap) => (
                                        <Badge key={cap} variant="secondary" className="text-[11px]">
                                            {cap}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ─── Right Column: Live Metrics + Heartbeat History ─── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Live Metrics */}
                    {latestHB && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard
                                icon={Activity}
                                label={t('workers.activeJobs')}
                                value={`${latestHB.activeJobs}/${worker.maxConcurrency}`}
                                color={latestHB.activeJobs >= worker.maxConcurrency ? 'text-amber-500' : 'text-primary'}
                            />
                            <MetricCard
                                icon={CheckCircle2}
                                label={t('workers.processed')}
                                value={latestHB.totalProcessed.toLocaleString()}
                                color="text-emerald-500"
                            />
                            <MetricCard
                                icon={XCircle}
                                label={t('workers.failed')}
                                value={latestHB.totalFailed.toLocaleString()}
                                color={latestHB.totalFailed > 0 ? 'text-red-500' : 'text-muted-foreground'}
                            />
                            <MetricCard
                                icon={Database}
                                label={t('workers.memory')}
                                value={formatBytes(latestHB.memoryUsage)}
                                color="text-sky-500"
                            />
                        </div>
                    )}

                    {/* Heartbeat Timeline */}
                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Heart className="h-3 w-3" /> {t('workers.heartbeatHistory')}
                                </div>
                                <span className="text-[10px] text-muted-foreground/60">
                                    {t('workers.lastNHeartbeats', { count: worker.heartbeats.length })}
                                </span>
                            </div>

                            {worker.heartbeats.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    <Heart className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    {t('workers.noHeartbeats')}
                                </div>
                            ) : (
                                <>
                                    {/* Mini bar chart for memory usage */}
                                    <div className="mb-4">
                                        <div className="text-[10px] text-muted-foreground/60 mb-1.5">{t('workers.memoryUsage')}</div>
                                        <div className="flex items-end gap-0.5 h-16">
                                            {[...worker.heartbeats].reverse().slice(-30).map((hb, i) => {
                                                const maxMem = Math.max(...worker.heartbeats.map(h => h.memoryUsage), 1);
                                                const pct = (hb.memoryUsage / maxMem) * 100;
                                                return (
                                                    <div
                                                        key={hb.id}
                                                        className="flex-1 rounded-t bg-sky-500/40 hover:bg-sky-500/70 transition-colors min-w-[2px]"
                                                        style={{ height: `${Math.max(pct, 4)}%` }}
                                                        title={`${formatBytes(hb.memoryUsage)} · ${formatTimeAgo(new Date(hb.createdAt))}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Active jobs chart */}
                                    <div className="mb-4">
                                        <div className="text-[10px] text-muted-foreground/60 mb-1.5">{t('workers.activeJobs')}</div>
                                        <div className="flex items-end gap-0.5 h-12">
                                            {[...worker.heartbeats].reverse().slice(-30).map((hb) => {
                                                const pct = worker.maxConcurrency > 0
                                                    ? (hb.activeJobs / worker.maxConcurrency) * 100
                                                    : 0;
                                                return (
                                                    <div
                                                        key={hb.id}
                                                        className={`flex-1 rounded-t transition-colors min-w-[2px] ${pct >= 90
                                                            ? 'bg-amber-500/60 hover:bg-amber-500/90'
                                                            : 'bg-primary/30 hover:bg-primary/60'
                                                            }`}
                                                        style={{ height: `${Math.max(pct, 4)}%` }}
                                                        title={`${hb.activeJobs}/${worker.maxConcurrency} · ${formatTimeAgo(new Date(hb.createdAt))}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <Separator className="my-3" />

                                    {/* Table */}
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-muted-foreground/60 border-b">
                                                    <th className="text-left pb-2 font-medium">{t('workers.time')}</th>
                                                    <th className="text-right pb-2 font-medium">{t('health.jobs')}</th>
                                                    <th className="text-right pb-2 font-medium">{t('workers.processed')}</th>
                                                    <th className="text-right pb-2 font-medium">{t('workers.failed')}</th>
                                                    <th className="text-right pb-2 font-medium">{t('workers.memory')}</th>
                                                    <th className="text-right pb-2 font-medium">{t('workers.cpu')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {worker.heartbeats.slice(0, 20).map((hb) => (
                                                    <tr key={hb.id} className="border-b border-border/30 hover:bg-muted/20">
                                                        <td className="py-1.5 text-muted-foreground">
                                                            {formatTimeAgo(new Date(hb.createdAt))}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono">
                                                            {hb.activeJobs}/{worker.maxConcurrency}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono text-emerald-500">
                                                            {hb.totalProcessed}
                                                        </td>
                                                        <td className={`py-1.5 text-right font-mono ${hb.totalFailed > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                            {hb.totalFailed}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono text-sky-500">
                                                            {formatBytes(hb.memoryUsage)}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono">
                                                            {hb.cpuUsage}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={`${mono ? 'font-mono text-xs' : ''} truncate max-w-[200px]`}>{value}</span>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className={`mb-2 ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold tracking-tight">{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
            </CardContent>
        </Card>
    );
}

// ─── Helpers ───

function getStatusConfig(status: string) {
    switch (status) {
        case 'online':
            return { icon: CheckCircle2, badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
        case 'degraded':
            return { icon: AlertTriangle, badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
        case 'unhealthy':
            return { icon: AlertCircle, badge: 'bg-red-500/10 text-red-500 border-red-500/20' };
        case 'draining':
            return { icon: Waves, badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
        case 'offline':
        default:
            return { icon: XCircle, badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' };
    }
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
