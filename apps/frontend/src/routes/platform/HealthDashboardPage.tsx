import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Activity, Database, Server, Workflow, Cpu,
    RefreshCw, CheckCircle2, AlertTriangle, XCircle,
    ArrowLeft, Zap, HardDrive, Clock, BarChart3,
    Loader2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

interface PlatformHealth {
    status: string;
    timestamp: string;
    uptime: number;
    database: { ok: boolean; latencyMs: number };
    nats: {
        ok: boolean;
        server: string;
        streams: { name: string; messages: number; bytes: number; consumers: number }[];
    };
    workers: { total: number; online: number; offline: number; degraded: number };
    jobs: Record<string, number>;
}

interface StreamInfo {
    name: string;
    description: string;
    subjects: string[];
    state: {
        messages: number;
        bytes: number;
        firstSeq: number;
        lastSeq: number;
        consumerCount: number;
    };
    consumers: {
        name: string;
        filterSubject: string;
        numPending: number;
        numAckPending: number;
        numRedelivered: number;
        numWaiting: number;
        delivered: { streamSeq: number; consumerSeq: number };
    }[];
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatusIcon({ ok }: { ok: boolean }) {
    return ok
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        : <XCircle className="h-4 w-4 text-destructive" />;
}

export function HealthDashboardPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [health, setHealth] = useState<PlatformHealth | null>(null);
    const [streams, setStreams] = useState<StreamInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchAll = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [healthRes, streamsRes] = await Promise.allSettled([
                api.get<PlatformHealth>('/platform/health'),
                api.get<StreamInfo[]>('/platform/streams'),
            ]);

            const errors: string[] = [];
            if (healthRes.status === 'fulfilled') {
                setHealth(healthRes.value);
            } else {
                errors.push('health');
            }
            if (streamsRes.status === 'fulfilled') {
                setStreams(streamsRes.value);
            } else {
                errors.push('streams');
            }

            if (errors.length > 0) {
                setError(t('health.fetchError'));
            } else {
                setError(null);
            }
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Failed to fetch health:', err);
            setError(t('health.fetchError'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-refresh every 15s
    useEffect(() => {
        const interval = setInterval(() => fetchAll(true), 15_000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const totalJobs = health ? Object.values(health.jobs).reduce((a, b) => a + b, 0) : 0;

    if (loading && !health) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/platform')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 p-2.5 shadow-md">
                        <Activity className="h-[22px] w-[22px] text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('health.title')}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t('health.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {health && (
                        <Badge
                            variant={health.status === 'healthy' ? 'default' : 'destructive'}
                            className={cn(
                                'text-xs',
                                health.status === 'healthy' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                            )}
                        >
                            {health.status === 'healthy' ? t('health.healthy') : t('health.degraded')}
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAll(true)}
                        disabled={refreshing}
                        className="gap-1.5"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>

            <Separator className="mb-6" />

            {/* Error banner */}
            {error && (
                <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* API */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-blue-500/5" />
                    <CardContent className="p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                            <Server className="h-4 w-4 text-sky-500" />
                            <StatusIcon ok={!!health} />
                        </div>
                        <div className="text-xl font-bold">{health ? formatUptime(health.uptime) : '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{t('health.apiUptime')}</div>
                    </CardContent>
                </Card>

                {/* Database */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5" />
                    <CardContent className="p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                            <Database className="h-4 w-4 text-teal-500" />
                            <StatusIcon ok={health?.database.ok ?? false} />
                        </div>
                        <div className="text-xl font-bold">{health?.database.latencyMs ?? '—'}<span className="text-xs font-normal ml-0.5">ms</span></div>
                        <div className="text-[10px] text-muted-foreground">{t('health.dbLatency')}</div>
                    </CardContent>
                </Card>

                {/* NATS */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-rose-500/5" />
                    <CardContent className="p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                            <Zap className="h-4 w-4 text-pink-500" />
                            <StatusIcon ok={health?.nats.ok ?? false} />
                        </div>
                        <div className="text-xl font-bold">{health?.nats.streams?.length ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">{t('health.jetStreamStreams')}</div>
                    </CardContent>
                </Card>

                {/* Workers */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5" />
                    <CardContent className="p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                            <Cpu className="h-4 w-4 text-violet-500" />
                            {health && <StatusIcon ok={health.workers.online > 0} />}
                        </div>
                        <div className="text-xl font-bold">
                            {health?.workers.online ?? 0}<span className="text-xs font-normal text-muted-foreground ml-1">/ {health?.workers.total ?? 0}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{t('health.workersOnline')}</div>
                    </CardContent>
                </Card>
            </div>

            {/* NATS Streams */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Workflow className="h-4 w-4 text-pink-500" />
                    <h2 className="text-sm font-semibold">{t('health.jetStreamStreams')}</h2>
                </div>
                <div className="space-y-3">
                    {streams.map((stream) => (
                        <Card key={stream.name} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-xs">{stream.name}</Badge>
                                        <span className="text-xs text-muted-foreground">{stream.description}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <BarChart3 className="h-3 w-3" />
                                            {stream.state.messages.toLocaleString()} msgs
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <HardDrive className="h-3 w-3" />
                                            {formatBytes(stream.state.bytes)}
                                        </span>
                                    </div>
                                </div>

                                {/* Consumers */}
                                {stream.consumers.length > 0 && (
                                    <div className="space-y-2">
                                        {stream.consumers.map((c) => (
                                            <div key={c.name} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-medium">{c.name}</span>
                                                    <span className="text-muted-foreground">{c.filterSubject}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {c.numPending > 0 && (
                                                        <span className="flex items-center gap-1 text-amber-500">
                                                            <Clock className="h-3 w-3" />
                                                            {t('health.pending', { count: c.numPending })}
                                                        </span>
                                                    )}
                                                    {c.numAckPending > 0 && (
                                                        <span className="flex items-center gap-1 text-sky-500">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            {t('health.ackPending', { count: c.numAckPending })}
                                                        </span>
                                                    )}
                                                    {c.numRedelivered > 0 && (
                                                        <span className="text-orange-500">{c.numRedelivered} redelivered</span>
                                                    )}
                                                    <span className="text-muted-foreground">
                                                        seq {c.delivered.streamSeq}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {stream.consumers.length === 0 && (
                                    <div className="text-xs text-muted-foreground italic">{t('health.noConsumers')}</div>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    {streams.length === 0 && !loading && (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            {t('health.noStreams')}
                        </div>
                    )}
                </div>
            </div>

            {/* Jobs Summary */}
            {health && totalJobs > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-amber-500" />
                        <h2 className="text-sm font-semibold">{t('health.jobs')}</h2>
                    </div>
                    <Card>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {Object.entries(health.jobs).map(([status, count]) => (
                                    <div key={status} className="text-center">
                                        <div className="text-lg font-bold">{count}</div>
                                        <div className="text-[10px] text-muted-foreground capitalize">{status}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Last refresh */}
            <div className="text-center text-[10px] text-muted-foreground/50">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
            </div>
        </div>
    );
}
