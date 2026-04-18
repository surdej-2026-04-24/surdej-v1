import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Workflow, Clock, CheckCircle2, XCircle, Loader2,
    PlayCircle, PauseCircle, BarChart3,
} from 'lucide-react';
import { useTranslation } from '@/core/i18n';

// Simulated process data for the initial UI
const SAMPLE_PROCESSES = [
    { id: '1', name: 'Document Ingest — SharePoint', status: 'running', progress: 67, items: 342, started: '10 min ago' },
    { id: '2', name: 'Knowledge Re-index', status: 'completed', progress: 100, items: 1280, started: '2h ago' },
    { id: '3', name: 'PDF Extraction Batch #47', status: 'running', progress: 23, items: 89, started: '5 min ago' },
    { id: '4', name: 'Training Module Generation', status: 'queued', progress: 0, items: 15, started: 'Pending' },
    { id: '5', name: 'Duplicate Detection Sweep', status: 'failed', progress: 45, items: 567, started: '1h ago' },
];

const STATUS_ICONS: Record<string, { icon: React.FC<{ className?: string }>; color: string; labelKey: string }> = {
    running: { icon: Loader2, color: 'text-blue-500', labelKey: 'processes.statusRunning' },
    completed: { icon: CheckCircle2, color: 'text-green-500', labelKey: 'processes.statusCompleted' },
    queued: { icon: Clock, color: 'text-amber-500', labelKey: 'processes.statusQueued' },
    failed: { icon: XCircle, color: 'text-red-500', labelKey: 'processes.statusFailed' },
    paused: { icon: PauseCircle, color: 'text-muted-foreground', labelKey: 'processes.statusPaused' },
};

export function ProcessesPage() {
    const { t } = useTranslation();

    const statCards = [
        { labelKey: 'processes.statusRunning', value: '2', icon: PlayCircle, color: 'text-blue-500' },
        { labelKey: 'processes.statusQueued', value: '1', icon: Clock, color: 'text-amber-500' },
        { labelKey: 'processes.statusCompleted', value: '1', icon: CheckCircle2, color: 'text-green-500' },
        { labelKey: 'processes.statusFailed', value: '1', icon: XCircle, color: 'text-red-500' },
    ];

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Workflow className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('processes.title')}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t('processes.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-8" />

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {statCards.map((stat) => (
                    <Card key={stat.labelKey}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            <div>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <div className="text-xs text-muted-foreground">{t(stat.labelKey)}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Process list */}
            <div className="space-y-3">
                {SAMPLE_PROCESSES.map((proc) => {
                    const config = STATUS_ICONS[proc.status] ?? STATUS_ICONS.queued;
                    const StatusIcon = config.icon;

                    return (
                        <Card key={proc.id} className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-4">
                                <StatusIcon className={`h-5 w-5 shrink-0 ${config.color} ${proc.status === 'running' ? 'animate-spin' : ''}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm truncate">{proc.name}</span>
                                        <Badge variant="outline" className="text-[10px] shrink-0">{t(config.labelKey)}</Badge>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${proc.status === 'failed' ? 'bg-red-500' :
                                                    proc.status === 'completed' ? 'bg-green-500' :
                                                        'bg-primary'
                                                    }`}
                                                style={{ width: `${proc.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{proc.progress}%</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <BarChart3 className="h-3 w-3" />
                                        {t('processes.items', { count: proc.items })}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">{proc.started}</div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
