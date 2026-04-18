/**
 * System Status Panel
 *
 * Popover-style panel that expands from the footer,
 * showing detailed system health information.
 * Integrates with existing monitoring endpoints.
 */

import { useEffect } from 'react';
import { useSystemStatusStore, startSystemStatusPolling, stopSystemStatusPolling, type SystemStatus } from '@/core/tracer/systemStatusStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
    Activity, Server, RefreshCw, Clock, CheckCircle2,
    AlertTriangle, XCircle, Wifi, WifiOff, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<SystemStatus, {
    label: string;
    color: string;
    dotColor: string;
    icon: React.ElementType;
}> = {
    healthy: { label: 'All Systems Operational', color: 'text-emerald-500', dotColor: 'bg-emerald-500', icon: CheckCircle2 },
    degraded: { label: 'Degraded Performance', color: 'text-amber-500', dotColor: 'bg-amber-500', icon: AlertTriangle },
    unhealthy: { label: 'System Issues Detected', color: 'text-red-500', dotColor: 'bg-red-500', icon: XCircle },
    unknown: { label: 'Status Unknown', color: 'text-muted-foreground', dotColor: 'bg-muted-foreground', icon: Activity },
};

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hrs < 24) return `${hrs}h ${remainMins}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
}

export function SystemStatusPanel() {
    const {
        status, apiHealth, workerHealth, lastChecked,
        checking, panelOpen, setPanelOpen, checkHealth, error,
    } = useSystemStatusStore();

    // Start polling when mounted
    useEffect(() => {
        startSystemStatusPolling(30_000);
        return () => stopSystemStatusPolling();
    }, []);

    if (!panelOpen) return null;

    const cfg = STATUS_CONFIG[status];
    const StatusIcon = cfg.icon;

    return (
        <div className="fixed bottom-10 right-6 w-96 z-50 rounded-xl border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
                <div className={cn('p-1.5 rounded-lg', status === 'healthy' ? 'bg-emerald-500/10' : 'bg-destructive/10')}>
                    <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-semibold">System Status</div>
                    <div className={cn('text-xs', cfg.color)}>{cfg.label}</div>
                </div>
                <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => checkHealth()} disabled={checking}
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* API Health */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">API Server</span>
                        <div className="flex-1" />
                        <Badge
                            variant={apiHealth ? 'default' : 'destructive'}
                            className="text-[0.5625rem]"
                        >
                            {apiHealth ? 'Connected' : 'Unreachable'}
                        </Badge>
                    </div>
                    {apiHealth ? (
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-muted/40 rounded-lg p-2">
                                <div className="text-[0.625rem] text-muted-foreground mb-0.5">Status</div>
                                <div className="text-xs font-semibold text-emerald-500">{apiHealth.status}</div>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-2">
                                <div className="text-[0.625rem] text-muted-foreground mb-0.5">Version</div>
                                <div className="text-xs font-semibold font-mono">{apiHealth.version}</div>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-2">
                                <div className="text-[0.625rem] text-muted-foreground mb-0.5">Uptime</div>
                                <div className="text-xs font-semibold flex items-center justify-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatUptime(apiHealth.uptime)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">
                            {error ?? 'Unable to connect to API server'}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Worker Health */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Server className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Workers</span>
                        <div className="flex-1" />
                        {workerHealth && (
                            <div className="flex items-center gap-1">
                                {workerHealth.natsConnected
                                    ? <Wifi className="h-3 w-3 text-emerald-500" />
                                    : <WifiOff className="h-3 w-3 text-red-500" />
                                }
                                <span className="text-[0.5625rem] text-muted-foreground">
                                    NATS {workerHealth.natsConnected ? 'connected' : 'disconnected'}
                                </span>
                            </div>
                        )}
                    </div>
                    {workerHealth ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <WorkerStat label="Online" count={workerHealth.online} total={workerHealth.total} color="text-emerald-500" />
                                <WorkerStat label="Degraded" count={workerHealth.degraded} total={workerHealth.total} color="text-amber-500" />
                                <WorkerStat label="Offline" count={workerHealth.offline} total={workerHealth.total} color="text-muted-foreground" />
                            </div>
                            {workerHealth.total > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
                                        <span>Capacity</span>
                                        <span>{workerHealth.online}/{workerHealth.total} active</span>
                                    </div>
                                    <Progress value={workerHealth.total > 0 ? (workerHealth.online / workerHealth.total) * 100 : 0} className="h-1.5" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">
                            Worker status unavailable
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t text-[0.625rem] text-muted-foreground">
                <span>
                    {lastChecked
                        ? `Last checked: ${new Date(lastChecked).toLocaleTimeString()}`
                        : 'Checking...'}
                </span>
                <span>Auto-refresh: 30s</span>
            </div>
        </div>
    );
}

function WorkerStat({ label, count, total, color }: {
    label: string; count: number; total: number; color: string;
}) {
    return (
        <div className="bg-muted/40 rounded-lg p-2 text-center">
            <div className="text-[0.625rem] text-muted-foreground mb-0.5">{label}</div>
            <div className={cn('text-sm font-bold', color)}>{count}</div>
            {total > 0 && (
                <div className="text-[0.5625rem] text-muted-foreground">/ {total}</div>
            )}
        </div>
    );
}
