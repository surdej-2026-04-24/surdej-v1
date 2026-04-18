import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Server, Layers, Box, Cpu, Network, Database,
    Activity, ExternalLink, Globe, Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { useTranslation } from '@/core/i18n';

interface PlatformTool {
    titleKey: string;
    descKey: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    status: 'available' | 'planned';
    href?: string;
}

const PLATFORM_TOOLS: PlatformTool[] = [
    {
        titleKey: 'platform.workers',
        descKey: 'platform.workersDesc',
        icon: Cpu,
        color: 'from-sky-500 to-blue-600',
        status: 'available',
        href: '/workers',
    },
    {
        titleKey: 'platform.topology',
        descKey: 'platform.topologyDesc',
        icon: Layers,
        color: 'from-violet-500 to-purple-600',
        status: 'available',
        href: '/topology',
    },
    {
        titleKey: 'platform.modules',
        descKey: 'platform.modulesDesc',
        icon: Box,
        color: 'from-emerald-500 to-teal-600',
        status: 'available',
        href: '/modules',
    },
    {
        titleKey: 'platform.serviceMap',
        descKey: 'platform.serviceMapDesc',
        icon: Network,
        color: 'from-amber-500 to-orange-500',
        status: 'planned',
    },
    {
        titleKey: 'platform.healthDashboard',
        descKey: 'platform.healthDashboardDesc',
        icon: Activity,
        color: 'from-green-500 to-emerald-500',
        status: 'available',
        href: '/platform/health',
    },
    {
        titleKey: 'platform.databaseExplorer',
        descKey: 'platform.databaseExplorerDesc',
        icon: Database,
        color: 'from-teal-500 to-cyan-500',
        status: 'available',
        href: '/platform/database',
    },
    {
        titleKey: 'platform.natsStreams',
        descKey: 'platform.natsStreamsDesc',
        icon: Workflow,
        color: 'from-pink-500 to-rose-500',
        status: 'available',
        href: '/platform/health',
    },
    {
        titleKey: 'platform.environments',
        descKey: 'platform.environmentsDesc',
        icon: Globe,
        color: 'from-indigo-500 to-violet-500',
        status: 'planned',
    },
];

export function PlatformPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Server className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('platform.title')}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t('platform.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <Separator className="mb-8" />

            {/* Tool grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORM_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const isPlanned = tool.status === 'planned';

                    return (
                        <Card
                            key={tool.titleKey}
                            className={cn(
                                'group transition-all duration-300',
                                !isPlanned && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
                                isPlanned && 'opacity-60',
                            )}
                            onClick={() => {
                                if (!isPlanned && tool.href) navigate(tool.href);
                            }}
                        >
                            <CardContent className="flex items-start gap-4 p-5">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-md`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-sm">{t(tool.titleKey)}</span>
                                        {isPlanned && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {t('common.comingSoon')}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {t(tool.descKey)}
                                    </p>
                                </div>
                                {!isPlanned && (
                                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
