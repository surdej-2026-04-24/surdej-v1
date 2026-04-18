/**
 * Workers Hub Page — Live dashboard showing all registered workers.
 *
 * Displays:
 *   - Health summary badges (online, degraded, unhealthy, offline)
 *   - Worker list with real-time status, metrics, and actions
 *   - NATS connection status
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Server, Activity, Wifi, WifiOff, RefreshCcw, Loader2,
    CheckCircle2, AlertTriangle, AlertCircle, XCircle, Waves, Cog,
    Inbox, Clock, RotateCcw, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

// ─── Types ─────────────────────────────────────────────────────

interface WorkerSummary {
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
    latestMetrics: {
        activeJobs: number;
        totalProcessed: number;
        totalFailed: number;
        memoryUsage: number;
        cpuUsage: number;
    } | null;
}

interface HealthStats {
    natsConnected: boolean;
    total: number;
    online: number;
    degraded: number;
    unhealthy: number;
    offline: number;
    draining: number;
}

interface StreamInfo {
    name: string;
    messages: number;
    bytes: number;
    firstSeq: number;
    lastSeq: number;
    consumerCount: number;
}

interface ConsumerInfo {
    stream: string;
    name: string;
    pending: number;
    waiting: number;
    ackPending: number;
    redelivered: number;
    delivered: number;
}

interface QueueStats {
    connected: boolean;
    streams: StreamInfo[];
    consumers: ConsumerInfo[];
}

// ─── Component ─────────────────────────────────────────────────

export function WorkersPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [workers, setWorkers] = useState<WorkerSummary[]>([]);
    const [health, setHealth] = useState<HealthStats | null>(null);
    const [queues, setQueues] = useState<QueueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [workersRes, healthRes, queuesRes] = await Promise.all([
                api.get<WorkerSummary[]>('/workers'),
                api.get<HealthStats>('/workers/health'),
                api.get<QueueStats>('/workers/queues'),
            ]);
            setWorkers(workersRes);
            setHealth(healthRes);
            setQueues(queuesRes);
            setError(null);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(() => refresh(true), 5_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleDrain = async (instanceId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.post(`/workers/${instanceId}/drain`);
            await refresh(true);
        } catch (err) {
            console.error('Drain failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <Server className="h-[22px] w-[22px] text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('workers.title')}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {health && (
                            <div className="flex items-center gap-1.5 text-xs">
                                {health.natsConnected ? (
                                    <><Wifi className="h-3.5 w-3.5 text-emerald-500" /><span className="text-muted-foreground">{t('workers.natsConnected')}</span></>
                                ) : (
                                    <><WifiOff className="h-3.5 w-3.5 text-red-500" /><span className="text-muted-foreground">{t('workers.natsDisconnected')}</span></>
                                )}
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refresh(true)}
                            disabled={refreshing}
                            className="gap-1.5 text-xs"
                        >
                            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </Button>
                    </div>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('workers.subtitleLong')}
                </p>
            </div>

            {/* Health Summary */}
            {health && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
                    <HealthBadge label={t('common.total')} count={health.total} icon={Server} color="text-foreground" />
                    <HealthBadge label={t('workers.online')} count={health.online} icon={CheckCircle2} color="text-emerald-500" />
                    <HealthBadge label={t('workers.degraded')} count={health.degraded} icon={AlertTriangle} color="text-amber-500" />
                    <HealthBadge label={t('workers.unhealthy')} count={health.unhealthy} icon={AlertCircle} color="text-red-500" />
                    <HealthBadge label={t('workers.draining')} count={health.draining} icon={Waves} color="text-blue-500" />
                    <HealthBadge label={t('workers.offline')} count={health.offline} icon={XCircle} color="text-muted-foreground" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {t('workers.fetchError')}
                </div>
            )}

            {/* Queue Stats */}
            {queues?.connected && (
                <div className="mb-8">
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                        Job Queues
                    </h2>

                    {/* Streams overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {queues.streams.map((s) => (
                            <Card key={s.name}>
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs font-semibold">{s.name}</span>
                                        <Badge variant={s.messages > 0 ? 'default' : 'secondary'} className="text-[10px]">
                                            {s.messages} msgs
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                        <span>{formatBytes(s.bytes)}</span>
                                        <span>{s.consumerCount} consumers</span>
                                        <span>seq {s.firstSeq}–{s.lastSeq}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Consumers detail */}
                    {queues.consumers.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground">
                                        <th className="text-left px-3 py-2 font-medium">Consumer</th>
                                        <th className="text-right px-3 py-2 font-medium">
                                            <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Pending</span>
                                        </th>
                                        <th className="text-right px-3 py-2 font-medium">
                                            <span className="flex items-center justify-end gap-1"><ArrowRight className="h-3 w-3" /> In-flight</span>
                                        </th>
                                        <th className="text-right px-3 py-2 font-medium">
                                            <span className="flex items-center justify-end gap-1"><RotateCcw className="h-3 w-3" /> Redelivered</span>
                                        </th>
                                        <th className="text-right px-3 py-2 font-medium">Delivered</th>
                                        <th className="text-right px-3 py-2 font-medium">Waiting</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queues.consumers.map((c) => (
                                        <tr key={c.name} className="border-t hover:bg-muted/30">
                                            <td className="px-3 py-2 font-mono">{c.name}</td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={c.pending > 0 ? 'text-amber-500 font-semibold' : ''}>{c.pending}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={c.ackPending > 0 ? 'text-blue-500 font-semibold' : ''}>{c.ackPending}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={c.redelivered > 0 ? 'text-red-500 font-semibold' : ''}>{c.redelivered}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-muted-foreground">{c.delivered}</td>
                                            <td className="px-3 py-2 text-right text-muted-foreground">{c.waiting}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Worker List */}
            {workers.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20">
                        <Cog className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <h2 className="text-lg font-semibold mb-2">{t('workers.noWorkers')}</h2>
                        <p className="text-sm text-muted-foreground text-center max-w-sm">
                            {t('workers.noWorkersDesc')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3 stagger-children">
                    {workers.map((w) => (
                        <WorkerCard key={w.id} worker={w} onDrain={handleDrain} onClick={() => navigate(`/workers/${w.instanceId}`)} t={t} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function HealthBadge({ label, count, icon: Icon, color }: { label: string; count: number; icon: React.ElementType; color: string }) {
    return (
        <Card>
            <CardContent className="p-3 flex items-center gap-3">
                <Icon className={`h-4 w-4 ${color}`} />
                <div>
                    <div className={`text-xl font-bold ${color}`}>{count}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function WorkerCard({
    worker,
    onDrain,
    onClick,
    t,
}: {
    worker: WorkerSummary;
    onDrain: (id: string, e: React.MouseEvent) => void;
    onClick: () => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}) {
    const StatusIcon = {
        online: CheckCircle2,
        degraded: AlertTriangle,
        unhealthy: AlertCircle,
        draining: Waves,
        offline: XCircle,
    }[worker.status] ?? XCircle;

    const statusColor = {
        online: 'text-emerald-500',
        degraded: 'text-amber-500',
        unhealthy: 'text-red-500',
        draining: 'text-blue-500',
        offline: 'text-zinc-400',
    }[worker.status] ?? 'text-zinc-400';

    const timeSince = worker.lastHeartbeat
        ? formatTimeAgo(new Date(worker.lastHeartbeat), t)
        : t('workers.never');

    return (
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" onClick={onClick}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <StatusIcon className={`h-4 w-4 ${statusColor} shrink-0`} />
                        <div>
                            <div className="font-mono text-sm font-medium">{worker.instanceId}</div>
                            <div className="text-xs text-muted-foreground">
                                {worker.type} v{worker.version} · {worker.hostname}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">♡ {timeSince}</span>
                        {worker.status !== 'offline' && worker.status !== 'draining' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => onDrain(worker.instanceId, e)}
                                className="h-7 px-2 text-xs hover:text-destructive"
                            >
                                {t('workers.drain')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Metrics */}
                {worker.latestMetrics && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            <b className="text-foreground">{worker.latestMetrics.activeJobs}</b>/{worker.maxConcurrency}
                        </span>
                        <span>
                            {t('workers.processed')}: <b className="text-emerald-500">{worker.latestMetrics.totalProcessed}</b>
                        </span>
                        <span>
                            {t('workers.failed')}: <b className={worker.latestMetrics.totalFailed > 0 ? 'text-red-500' : 'text-foreground'}>
                                {worker.latestMetrics.totalFailed}
                            </b>
                        </span>
                        <span>
                            {t('workers.memory')}: <b className="text-sky-500">{formatBytes(worker.latestMetrics.memoryUsage)}</b>
                        </span>
                    </div>
                )}

                {/* Capabilities */}
                {worker.capabilities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {(worker.capabilities as string[]).map((cap) => (
                            <Badge key={cap} variant="secondary" className="text-[10px]">
                                {cap}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Helpers ───────────────────────────────────────────────────

function formatTimeAgo(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return t('time.justNow');
    if (seconds < 60) return t('time.minutesAgo', { count: Math.floor(seconds / 60) || 1 });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    return t('time.hoursAgo', { count: hours });
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
