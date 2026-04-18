import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, ChevronRight, Layout, Component,
    Blocks, TestTube2, Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

interface SampleCategory {
    id: string;
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    status: 'available' | 'planned';
    href: string;
    count: number;
}

const SAMPLE_CATEGORIES: SampleCategory[] = [
    {
        id: 'layouts',
        title: 'Layout Samples',
        description:
            'Reference implementations for page layouts — split views, dashboard grids, VS Code-style explorers, and fullscreen canvases.',
        icon: Layout,
        color: 'from-sky-500 to-blue-500',
        status: 'available',
        href: '/developer/samples/layouts',
        count: 4,
    },
    {
        id: 'patterns',
        title: 'Interaction Patterns',
        description:
            'Common interaction patterns — drag-and-drop, infinite scroll, virtualized lists, and command palettes.',
        icon: Blocks,
        color: 'from-violet-500 to-purple-600',
        status: 'planned',
        href: '/developer/samples/patterns',
        count: 0,
    },
    {
        id: 'data',
        title: 'Data Display',
        description:
            'Tables, charts, timelines, and other data visualization patterns for presenting complex information.',
        icon: TestTube2,
        color: 'from-emerald-500 to-teal-500',
        status: 'planned',
        href: '/developer/samples/data',
        count: 0,
    },
    {
        id: 'integration',
        title: 'Integration Samples',
        description:
            'Platform integration patterns — Spread secure sandboxing, MessageChannel bridges, and plugin micro-app architecture.',
        icon: Box,
        color: 'from-amber-500 to-orange-500',
        status: 'available',
        href: '/developer/samples/integration',
        count: 1,
    },
];

export function SamplesHubPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => navigate('/developer')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Component className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Samples</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Browse reference implementations organised by category.
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-8" />

            {/* Categories grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isPlanned = cat.status === 'planned';

                    return (
                        <Card
                            key={cat.id}
                            className={cn(
                                'group transition-all duration-300',
                                !isPlanned && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
                                isPlanned && 'opacity-60',
                            )}
                            onClick={() => {
                                if (!isPlanned) navigate(cat.href);
                            }}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-md`}
                                    >
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold">{cat.title}</span>
                                            {isPlanned && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                    Coming Soon
                                                </Badge>
                                            )}
                                            {!isPlanned && (
                                                <>
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                        {cat.count} {cat.count === 1 ? 'sample' : 'samples'}
                                                    </Badge>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                                                </>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {cat.description}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
