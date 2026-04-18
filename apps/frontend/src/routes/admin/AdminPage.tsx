import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Shield, Settings, Users, Zap, Palette, Plug, KeyRound,
    Bell, DatabaseBackup, ExternalLink, Building, MessageSquare, Cog, Tags,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { useTranslation } from '@/core/i18n';

interface AdminTool {
    titleKey: string;
    descKey: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    status: 'available' | 'planned';
    href?: string;
    title?: string;
    desc?: string;
}

const ADMIN_TOOLS: AdminTool[] = [
    {
        titleKey: 'admin.generalSettings',
        descKey: 'admin.generalSettingsDesc',
        icon: Settings,
        color: 'from-slate-500 to-zinc-600',
        status: 'available',
        href: '/settings',
    },
    {
        titleKey: 'admin.tenantManagement',
        descKey: 'admin.tenantManagementDesc',
        icon: Building,
        color: 'from-blue-500 to-indigo-600',
        status: 'available',
        href: '/settings/tenants',
    },
    {
        titleKey: 'admin.chatInspection',
        descKey: 'admin.chatInspectionDesc',
        title: 'Chat Inspektion',
        desc: 'Overvåg og inspicer AI-samtaler, se brugeraktivitet og token-forbrug.',
        icon: MessageSquare,
        color: 'from-indigo-500 to-violet-600',
        status: 'available',
        href: '/admin/chats',
    },
    {
        titleKey: 'admin.operations',
        descKey: 'admin.operationsDesc',
        title: 'Operations',
        desc: 'Trigger reanalysis, monitor batch processing, and manage system operations.',
        icon: Cog,
        color: 'from-orange-500 to-amber-600',
        status: 'available',
        href: '/admin/operations',
    },
    {
        titleKey: 'admin.workflowTags',
        descKey: 'admin.workflowTagsDesc',
        title: 'Workflow Tags',
        desc: 'Manage classification tags for workflows.',
        icon: Tags,
        color: 'from-purple-500 to-violet-600',
        status: 'available',
        href: '/admin/workflows/tags',
    },
    {
        titleKey: 'admin.featureFlags',
        descKey: 'admin.featureFlagsDesc',
        icon: Zap,
        color: 'from-amber-500 to-orange-500',
        status: 'available',
        href: '/settings/features',
    },
    {
        titleKey: 'admin.skinsBranding',
        descKey: 'admin.skinsBrandingDesc',
        icon: Palette,
        color: 'from-pink-500 to-rose-500',
        status: 'available',
        href: '/settings/skins',
    },
    {
        titleKey: 'admin.mcpIntegrations',
        descKey: 'admin.mcpIntegrationsDesc',
        icon: Plug,
        color: 'from-violet-500 to-purple-600',
        status: 'available',
        href: '/settings/mcp',
    },
    {
        titleKey: 'admin.userManagement',
        descKey: 'admin.userManagementDesc',
        icon: Users,
        color: 'from-emerald-500 to-teal-500',
        status: 'planned',
    },
    {
        titleKey: 'admin.apiKeys',
        descKey: 'admin.apiKeysDesc',
        icon: KeyRound,
        color: 'from-cyan-500 to-blue-500',
        status: 'planned',
    },
    {
        titleKey: 'admin.auditLog',
        descKey: 'admin.auditLogDesc',
        icon: Bell,
        color: 'from-red-500 to-pink-500',
        status: 'planned',
    },
    {
        titleKey: 'admin.backupRecovery',
        descKey: 'admin.backupRecoveryDesc',
        icon: DatabaseBackup,
        color: 'from-teal-500 to-green-500',
        status: 'planned',
    },
];

export function AdminPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-destructive/10 p-2.5">
                        <Shield className="h-[22px] w-[22px] text-destructive" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
                        <Badge variant="destructive" className="mt-1">
                            <Shield className="h-3 w-3 mr-1" />
                            {t('admin.badge')}
                        </Badge>
                    </div>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('admin.subtitle')}
                </p>
            </div>

            <Separator className="mb-8" />

            {/* Tool grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ADMIN_TOOLS.map((tool) => {
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
                                        <span className="font-semibold text-sm">{tool.title || t(tool.titleKey)}</span>
                                        {isPlanned && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {t('common.comingSoon')}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {tool.desc || t(tool.descKey)}
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
