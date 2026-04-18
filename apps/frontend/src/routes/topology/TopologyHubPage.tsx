import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Layers, Network, Code2, ArrowRight, ChevronRight, GitBranch, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { DEMO_TOPOLOGIES } from '@/core/topology/demo-data';
import { countNodes } from '@surdej/core';
import { useTranslation } from '@/core/i18n';

export function TopologyHubPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const topologies = DEMO_TOPOLOGIES; // In production: from API + domain manifests

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Layers className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('topology.title')}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('topology.subtitleLong')}
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-8" />

            {topologies.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Layers className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">{t('topology.noTopologies')}</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {t('topology.noTopologiesDesc')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topologies.map((topo) => {
                        const typeKey = topo.type as 'infrastructure' | 'codebase' | 'data-flow' | 'custom';
                        const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
                            infrastructure: Network,
                            codebase: Code2,
                            'data-flow': GitBranch,
                            custom: Layers,
                        };
                        const TYPE_COLORS: Record<string, string> = {
                            infrastructure: 'from-blue-500 to-indigo-600',
                            codebase: 'from-violet-500 to-purple-600',
                            'data-flow': 'from-emerald-500 to-teal-500',
                            custom: 'from-amber-500 to-orange-500',
                        };

                        const Icon = TYPE_ICONS[topo.type] ?? Layers;
                        const color = TYPE_COLORS[topo.type] ?? 'from-amber-500 to-orange-500';
                        const typeLabel = t(`topology.types.${typeKey}` as string);
                        const nodeCount = countNodes(topo.layers);
                        const connCount = topo.connections.length;
                        const layerCount = topo.layers.length;

                        return (
                            <Card
                                key={topo.id}
                                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                                onClick={() => navigate(`/topology/${topo.id}`)}
                            >
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                                            <Icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold">{topo.name}</span>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            {topo.description && (
                                                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                                    {topo.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {typeLabel}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {t('topology.nodes', { count: nodeCount })}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {t('topology.connections', { count: connCount })}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {t('topology.layersCount', { count: layerCount })}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    {topo.generatedAt && (
                                        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t text-[10px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {t('topology.generated', { date: new Date(topo.generatedAt).toLocaleDateString() })} · {topo.generatedBy ?? t('topology.manual')}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
