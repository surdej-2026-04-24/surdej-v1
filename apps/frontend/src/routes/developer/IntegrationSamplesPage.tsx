import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

interface IntegrationSample {
    id: string;
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    status: 'available' | 'planned';
    href: string;
    tags: string[];
}

const INTEGRATION_SAMPLES: IntegrationSample[] = [
    {
        id: 'spread-sandbox',
        title: 'Spread Sandbox',
        description:
            'Securely load a sandboxed micro-app (Spread) inside a Blob-URL iframe with MessageChannel capability routing — PROXY_FETCH, SCRAPE_PAGE, AUTOMATE, MCP tools.',
        icon: Box,
        color: 'from-amber-500 to-orange-500',
        status: 'available',
        href: '/developer/samples/integration/spread-sandbox',
        tags: ['spread', 'sandbox', 'iframe', 'postMessage', 'bridge'],
    },
];

export function IntegrationSamplesPage() {
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
                        onClick={() => navigate('/developer/samples')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Box className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Integration Samples</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Platform integration patterns — Spread sandboxing, bridges, and plugin
                            architecture.
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-8" />

            {/* Samples grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INTEGRATION_SAMPLES.map((sample) => {
                    const Icon = sample.icon;
                    const isPlanned = sample.status === 'planned';

                    return (
                        <Card
                            key={sample.id}
                            className={cn(
                                'group transition-all duration-300',
                                !isPlanned && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
                                isPlanned && 'opacity-60',
                            )}
                            onClick={() => {
                                if (!isPlanned) navigate(sample.href);
                            }}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${sample.color} flex items-center justify-center shadow-md`}
                                    >
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold">{sample.title}</span>
                                            {isPlanned && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                    Coming Soon
                                                </Badge>
                                            )}
                                            {!isPlanned && (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                            {sample.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {sample.tags.map((tag) => (
                                                <Badge key={tag} variant="secondary" className="text-[10px]">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
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
