/**
 * Dashboard Grid sample — responsive widget grid with drag-to-reorder.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    ArrowLeft, Grid3X3, GripVertical,
    TrendingUp, Users, FileText, Activity,
    BarChart3, Clock, Cpu, HardDrive,
    RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

/* ── Widget definitions ─────────────────────────────── */

interface Widget {
    id: string;
    title: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    span: 1 | 2;
    render: () => React.ReactNode;
}

function StatValue({ value, label, trend }: { value: string; label: string; trend?: string }) {
    return (
        <div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                {trend && (
                    <span className="text-xs text-emerald-500 font-medium flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" /> {trend}
                    </span>
                )}
            </div>
        </div>
    );
}

function MiniBarChart({ data }: { data: number[] }) {
    const max = Math.max(...data);
    return (
        <div className="flex items-end gap-1 h-16 mt-2">
            {data.map((v, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors min-w-0"
                    style={{ height: `${(v / max) * 100}%` }}
                />
            ))}
        </div>
    );
}

const DEFAULT_WIDGETS: Widget[] = [
    {
        id: 'users',
        title: 'Active Users',
        icon: Users,
        color: 'text-blue-500',
        span: 1,
        render: () => <StatValue value="1,284" label="Online now" trend="+12%" />,
    },
    {
        id: 'documents',
        title: 'Documents',
        icon: FileText,
        color: 'text-emerald-500',
        span: 1,
        render: () => <StatValue value="4,721" label="Total processed" trend="+8%" />,
    },
    {
        id: 'uptime',
        title: 'Uptime',
        icon: Clock,
        color: 'text-amber-500',
        span: 1,
        render: () => <StatValue value="99.97%" label="Last 30 days" />,
    },
    {
        id: 'api-calls',
        title: 'API Calls',
        icon: Activity,
        color: 'text-violet-500',
        span: 1,
        render: () => <StatValue value="89.2K" label="This week" trend="+24%" />,
    },
    {
        id: 'traffic',
        title: 'Traffic Overview',
        icon: BarChart3,
        color: 'text-pink-500',
        span: 2,
        render: () => (
            <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Mon–Sun requests</span>
                    <span>Peak: 14.2K</span>
                </div>
                <MiniBarChart data={[8200, 9400, 12100, 14200, 11800, 7600, 9900]} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
            </div>
        ),
    },
    {
        id: 'cpu',
        title: 'CPU Usage',
        icon: Cpu,
        color: 'text-orange-500',
        span: 1,
        render: () => (
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Core avg</span>
                    <span className="font-medium">34%</span>
                </div>
                <Progress value={34} />
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">62%</span>
                </div>
                <Progress value={62} />
            </div>
        ),
    },
    {
        id: 'storage',
        title: 'Storage',
        icon: HardDrive,
        color: 'text-teal-500',
        span: 1,
        render: () => (
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">128 / 256 GB</span>
                </div>
                <Progress value={50} />
                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mt-1">
                    <div><div className="h-1.5 rounded bg-primary/60 mb-1" /> Docs 48GB</div>
                    <div><div className="h-1.5 rounded bg-primary/30 mb-1" /> Logs 32GB</div>
                    <div><div className="h-1.5 rounded bg-muted mb-1" /> Other 48GB</div>
                </div>
            </div>
        ),
    },
];

/* ── Page ─────────────────────────────────────────────── */

export function DashboardGridSample() {
    const navigate = useNavigate();
    const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [compact, setCompact] = useState(false);

    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        if (fromId === targetId) return;

        setWidgets((prev) => {
            const items = [...prev];
            const fromIdx = items.findIndex((w) => w.id === fromId);
            const toIdx = items.findIndex((w) => w.id === targetId);
            const [moved] = items.splice(fromIdx, 1);
            items.splice(toIdx, 0, moved);
            return items;
        });
        setDraggingId(null);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
    }, []);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/developer/samples/layouts')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Grid3X3 className="h-5 w-5 text-primary" />
                <h1 className="font-semibold text-sm">Dashboard Grid</h1>
                <Badge variant="secondary" className="text-[10px]">Sample</Badge>
                <div className="flex-1" />
                <div className="flex items-center gap-1 border rounded-lg p-0.5">
                    <Button
                        variant={!compact ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setCompact(false)}
                    >
                        Normal
                    </Button>
                    <Button
                        variant={compact ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setCompact(true)}
                    >
                        Compact
                    </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWidgets(DEFAULT_WIDGETS)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-6">
                <div className={cn(
                    'grid gap-4 max-w-5xl mx-auto',
                    compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                )}>
                    {widgets.map((widget) => {
                        const Icon = widget.icon;
                        return (
                            <Card
                                key={widget.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, widget.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, widget.id)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                    'transition-all duration-200 group cursor-grab active:cursor-grabbing',
                                    widget.span === 2 && !compact && 'md:col-span-2',
                                    draggingId === widget.id && 'opacity-40 scale-95 ring-2 ring-primary',
                                    draggingId && draggingId !== widget.id && 'hover:ring-2 hover:ring-primary/30',
                                )}
                            >
                                <CardHeader className={cn('pb-2', compact && 'p-3 pb-1')}>
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        <Icon className={cn('h-4 w-4 shrink-0', widget.color)} />
                                        <span className="truncate">{widget.title}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className={cn(compact && 'px-3 pb-3')}>
                                    {widget.render()}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Hint */}
                <div className="text-center mt-6 text-xs text-muted-foreground">
                    Drag cards by the grip handle to reorder • Switch between Normal and Compact views
                </div>
            </div>
        </div>
    );
}
