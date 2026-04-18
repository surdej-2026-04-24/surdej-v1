import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Code2, Terminal, Bug, Palette, Layers, Eye, Keyboard,
    Box, Network, Cpu, Database, ExternalLink, Layout,
    UserCircle, Loader2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWireframe } from '@/core/wireframe';
import { useNavigate } from 'react-router';
import { useAuth, type User } from '@/core/auth/AuthContext';
import { api, BASE_URL } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

interface DevTool {
    titleKey: string;
    descKey: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    status: 'available' | 'planned';
    shortcut?: string;
    action?: () => void;
    href?: string;
    activeKey?: string;
}

const DEV_TOOLS: DevTool[] = [
    {
        titleKey: 'developer.wireframeMode',
        descKey: 'developer.wireframeModeDesc',
        icon: Box,
        color: 'from-violet-500 to-purple-600',
        status: 'available',
        shortcut: '⌃⌥⌘W',
        action: () => window.dispatchEvent(new CustomEvent('surdej:toggle-wireframe')),
        activeKey: 'wireframe',
    },
    {
        titleKey: 'developer.componentInspector',
        descKey: 'developer.componentInspectorDesc',
        icon: Eye,
        color: 'from-blue-500 to-cyan-500',
        status: 'available',
        shortcut: '⌃⌥ Hover',
        action: () => window.dispatchEvent(new CustomEvent('surdej:toggle-dev-inspector')),
        activeKey: 'inspector',
    },
    {
        titleKey: 'developer.commandPalette',
        descKey: 'developer.commandPaletteDesc',
        icon: Keyboard,
        color: 'from-emerald-500 to-teal-500',
        status: 'available',
        shortcut: '⌘K',
        href: '/developer/commands',
    },
    {
        titleKey: 'developer.skinEditor',
        descKey: 'developer.skinEditorDesc',
        icon: Palette,
        color: 'from-amber-500 to-orange-500',
        status: 'available',
        href: '/settings/skins',
    },
    {
        titleKey: 'developer.featureFlags',
        descKey: 'developer.featureFlagsDesc',
        icon: Layers,
        color: 'from-pink-500 to-rose-500',
        status: 'available',
        href: '/settings/features',
    },
    {
        titleKey: 'developer.layoutSamples',
        descKey: 'developer.layoutSamplesDesc',
        icon: Layout,
        color: 'from-sky-500 to-blue-500',
        status: 'available',
        href: '/developer/samples',
    },
    {
        titleKey: 'developer.designGuide',
        descKey: 'developer.designGuideDesc',
        icon: Palette,
        color: 'from-fuchsia-500 to-pink-500',
        status: 'available',
        href: '/developer/design-guide',
    },
    {
        titleKey: 'developer.imageGallery',
        descKey: 'developer.imageGalleryDesc',
        icon: Palette,
        color: 'from-zinc-700 to-black',
        status: 'available',
        href: '/developer/images',
    },
    {
        titleKey: 'developer.apiExplorer',
        descKey: 'developer.apiExplorerDesc',
        icon: Network,
        color: 'from-indigo-500 to-violet-500',
        status: 'planned',
    },
    {
        titleKey: 'developer.workerDashboard',
        descKey: 'developer.workerDashboardDesc',
        icon: Cpu,
        color: 'from-sky-500 to-blue-500',
        status: 'planned',
    },
    {
        titleKey: 'developer.databaseStudio',
        descKey: 'developer.databaseStudioDesc',
        icon: Database,
        color: 'from-teal-500 to-green-500',
        status: 'planned',
    },
];

export function DeveloperPage() {
    const { isActive: wireframeActive } = useWireframe();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Track which tools are active
    const activeStates: Record<string, boolean> = {
        wireframe: wireframeActive,
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Code2 className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('developer.title')}</h1>
                        <Badge variant="secondary" className="mt-1">
                            <Terminal className="h-3 w-3 mr-1" />
                            {t('developer.badge')}
                        </Badge>
                    </div>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('developer.subtitle')}
                </p>
            </div>

            <Separator className="mb-8" />

            {/* Tool grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEV_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const isPlanned = tool.status === 'planned';
                    const isActive = tool.activeKey ? activeStates[tool.activeKey] : false;

                    return (
                        <Card
                            key={tool.titleKey}
                            className={cn(
                                'group transition-all duration-300',
                                !isPlanned && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
                                isPlanned && 'opacity-60',
                                isActive && 'ring-2 ring-primary shadow-lg shadow-primary/10',
                            )}
                            onClick={() => {
                                if (isPlanned) return;
                                if (tool.action) tool.action();
                                if (tool.href) navigate(tool.href);
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
                                        {isActive && (
                                            <Badge className="text-[10px] px-1.5 py-0 bg-primary">
                                                {t('developer.active')}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {t(tool.descKey)}
                                    </p>
                                    {tool.shortcut && (
                                        <kbd className="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground font-mono">
                                            {tool.shortcut}
                                        </kbd>
                                    )}
                                </div>
                                {!isPlanned && (
                                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* User Impersonation */}
            <Separator className="my-8" />
            <ImpersonationPanel />

            {/* Environment info */}
            <Separator className="my-8" />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Bug className="h-4 w-4 text-muted-foreground" />
                        {t('developer.environment')}
                    </CardTitle>
                    <CardDescription>{t('developer.environmentDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <div className="text-muted-foreground mb-1">{t('developer.mode')}</div>
                            <Badge variant="outline">{import.meta.env.MODE}</Badge>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">{t('developer.baseUrl')}</div>
                            <Badge variant="outline">{import.meta.env.BASE_URL}</Badge>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">{t('developer.apiLabel')}</div>
                            <Badge variant="outline">{BASE_URL}</Badge>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-1">{t('developer.authLabel')}</div>
                            <Badge variant="outline">{import.meta.env.VITE_AUTH_PROVIDER ?? 'demo'}</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Impersonation Panel ───────────────────────────────────────

interface TenantUser {
    id: string;
    email: string;
    name: string | null;
    displayName: string | null;
    role: string;
    avatarUrl: string | null;
}

function ImpersonationPanel() {
    const { t } = useTranslation();
    const { user, setSession } = useAuth();
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ tenantId: string; users: TenantUser[] }>('/auth/dev/tenant-users')
            .then(res => {
                setUsers(res.users);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleImpersonate = async (targetUser: TenantUser) => {
        if (targetUser.id === user?.id) return;
        setSwitching(targetUser.id);
        try {
            const res = await api.post<{ token: string; user: User }>('/auth/dev/impersonate', {
                userId: targetUser.id,
            });
            setSession(res.token, res.user);
            // Reload the page to reset all state
            window.location.reload();
        } catch (e) {
            console.error('Impersonation failed:', e);
            setSwitching(null);
        }
    };

    const roleColor = (role: string) => {
        switch (role) {
            case 'SUPER_ADMIN': return 'bg-red-500/10 text-red-600';
            case 'ADMIN': return 'bg-amber-500/10 text-amber-600';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    {t('developer.impersonation')}
                </CardTitle>
                <CardDescription>
                    {t('developer.impersonationDesc')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('developer.loadingUsers')}
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">{t('developer.noUsersFound')}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                        {users.map(u => {
                            const isCurrent = u.id === user?.id;
                            const isSwitching = switching === u.id;
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => handleImpersonate(u)}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer',
                                        isCurrent
                                            ? 'ring-2 ring-primary bg-primary/5 border-primary/30'
                                            : 'hover:bg-muted/50 hover:shadow-sm',
                                        isSwitching && 'opacity-60 pointer-events-none',
                                    )}
                                >
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                                        {(u.displayName || u.name || u.email)[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm truncate">
                                                {u.displayName || u.name || u.email}
                                            </span>
                                            {isCurrent && (
                                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {u.email}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn('text-[10px] shrink-0', roleColor(u.role))}>
                                        {u.role}
                                    </Badge>
                                    {isSwitching && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="text-[10px] text-muted-foreground/60 mt-3">
                    {t('developer.usersFooter', { count: users.length })}
                </div>
            </CardContent>
        </Card>
    );
}
