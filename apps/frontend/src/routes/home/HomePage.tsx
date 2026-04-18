import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/core/auth/AuthContext';
import { useSkin } from '@/core/skins/SkinContext';
import { useTranslation } from '@/core/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Activity, Layers, MessageSquare, Settings, ArrowRight, Zap,
    ChevronRight, Server, Clock, Bot, Loader2, RefreshCw, BookOpen, Building2,
    TrendingUp, Building, Store, BarChart3, Handshake, Settings2,
    type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const AREA_ICON_MAP: Record<string, LucideIcon> = {
    TrendingUp, Building, Store, BarChart3, Handshake, Settings2,
};

// ─── Types ─────────────────────────────────────────────────────

interface HealthData {
    status: string;
    version: string;
    uptime: number;
}

interface WorkerHealth {
    natsConnected: boolean;
    total: number;
    online: number;
    degraded: number;
    unhealthy: number;
    offline: number;
    draining: number;
}

interface FeatureFlag {
    featureId: string;
    title: string;
    enabledByDefault: boolean;
    ring: number;
    category: string;
}

interface RecentConversation {
    id: string;
    title: string | null;
    model: string;
    messageCount: number;
    updatedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────

const QUICK_ACTION_DEFS = [
    { labelKey: 'home.actions.knowledge', descKey: 'home.actions.knowledgeDesc', icon: BookOpen, path: '/knowledge', color: 'from-indigo-500 to-blue-500' },
    { labelKey: 'home.actions.topology', descKey: 'home.actions.topologyDesc', icon: Layers, path: '/topology', color: 'from-blue-500 to-cyan-500' },
    { labelKey: 'home.actions.chat', descKey: 'home.actions.chatDesc', icon: MessageSquare, path: '/chat', color: 'from-violet-500 to-purple-600' },
    { labelKey: 'home.actions.workers', descKey: 'home.actions.workersDesc', icon: Server, path: '/workers', color: 'from-amber-500 to-orange-500' },
    { labelKey: 'home.actions.settings', descKey: 'home.actions.settingsDesc', icon: Settings, path: '/settings', color: 'from-emerald-500 to-teal-500' },
] as const;

// ─── Component ─────────────────────────────────────────────────

export function HomePage() {
    const { user } = useAuth();
    const { activeSkin } = useSkin();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const brandName = activeSkin?.branding?.appName ?? 'Surdej';

    // On first page load (cold browser navigation), redirect to /chat.
    // Once the app is loaded, navigating to / via sidebar etc. stays on home.
    useEffect(() => {
        const SESSION_KEY = 'surdej_app_loaded';
        if (!sessionStorage.getItem(SESSION_KEY)) {
            sessionStorage.setItem(SESSION_KEY, '1');
            navigate('/chat', { replace: true });
        }
    }, []);

    const [health, setHealth] = useState<HealthData | null>(null);
    const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [conversations, setConversations] = useState<RecentConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);

        const settled = await Promise.allSettled([
            api.get<HealthData>('/health'),
            api.get<WorkerHealth>('/workers/health'),
            api.get<FeatureFlag[]>('/features'),
            api.get<RecentConversation[]>('/ai/conversations?limit=5'),
        ]);

        if (settled[0].status === 'fulfilled') setHealth(settled[0].value);
        if (settled[1].status === 'fulfilled') setWorkerHealth(settled[1].value);
        if (settled[2].status === 'fulfilled') setFeatures(settled[2].value);
        if (settled[3].status === 'fulfilled') setConversations(settled[3].value);

        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchDashboardData();
        // Auto-refresh every 30s
        const interval = setInterval(() => fetchDashboardData(), 30_000);
        return () => clearInterval(interval);
    }, []);

    // ─── Derived Values ─────────────────────────────────────────

    const apiStatus = health ? t('home.healthy') : t('home.unknown');
    const apiUptime = health ? formatUptime(health.uptime) : '—';

    const activeWorkers = workerHealth ? workerHealth.online : 0;
    const workerStatus = workerHealth
        ? workerHealth.online > 0
            ? t('home.online', { count: workerHealth.online })
            : workerHealth.total > 0 ? t('home.idle') : t('home.none')
        : '—';

    const enabledFeatures = features.filter(f => f.enabledByDefault).length;
    const totalFeatures = features.length;

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Welcome header */}
            {/* Premium Hero Section */}
            <div className="relative overflow-hidden rounded-3xl border border-border/50 shadow-sm mb-12">
                {/* Nordic Noir Sourdough Buns Background */}
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-10000 hover:scale-105"
                    style={{ backgroundImage: 'url("/welcome-red.png")' }}
                />
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
                <div className="absolute inset-0 z-0 bg-black/20" /> {/* Extra darken for Nordic mood */}

                <div className="absolute top-0 right-0 p-4 z-20">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        className="rounded-full bg-background/20 hover:bg-background/40 backdrop-blur-md border border-white/10 text-white"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="relative z-10 p-8 md:p-10">
                    <div className="flex flex-col gap-4 max-w-xl">

                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-md">
                            {t('home.welcomeBack', { name: user?.displayName ?? t('common.user') })}
                        </h1>

                        <div className="flex flex-wrap gap-3 mt-2">
                            <Button onClick={() => navigate('/chat')} className="gap-2 rounded-full shadow-lg">
                                <MessageSquare className="h-4 w-4" />
                                Start Chat
                            </Button>
                        </div>
                    </div>
                </div>
            </div>



            {/* Recent AI Conversations */}
            {conversations.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            {t('home.recentConversations')}
                        </h2>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/chat')} className="text-xs text-muted-foreground gap-1">
                            {t('common.viewAll')}
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="space-y-2 stagger-children">
                        {conversations.map((conv) => (
                            <Card
                                key={conv.id}
                                className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                                onClick={() => navigate(`/chat/${conv.id}`)}
                            >
                                <CardContent className="flex items-center gap-4 p-4">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center shrink-0">
                                        <Bot className="h-4 w-4 text-violet-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {conv.title ?? t('home.untitledConversation')}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                            <span>{conv.messageCount !== 1 ? t('home.messagesPlural', { count: conv.messageCount }) : t('home.messages', { count: conv.messageCount })}</span>
                                            <span>·</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {relativeTime(conv.updatedAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                        {conv.model}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <Separator className="my-8" />

            {/* Active Skin info card */}
            {activeSkin && (
                <div className="animate-slide-up">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        {t('home.activeSkin')}
                    </h2>
                    <Card>
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-primary/10">
                                    🎨
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{activeSkin.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {t('home.sidebarItems', { count: activeSkin.sidebar.length })} · {activeSkin.isBuiltIn ? t('home.builtIn') : t('home.custom')}
                                    </div>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => navigate('/settings/skins')}>
                                {t('common.manage')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function StatusCard({ label, value, icon: Icon, trend, trendUp, loading, color, subtitle }: {
    label: string;
    value: string;
    icon: React.ElementType;
    trend?: string;
    trendUp?: boolean;
    loading?: boolean;
    color?: string;
    subtitle?: string;
}) {
    return (
        <Card className="group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${color ? 'bg-current/10' : 'bg-primary/10'}`}>
                        {loading ? (
                            <Loader2 className="h-[18px] w-[18px] text-muted-foreground animate-spin" />
                        ) : (
                            <Icon className={`h-[18px] w-[18px] ${color ?? 'text-primary'}`} />
                        )}
                    </div>
                    {trend && (
                        <Badge variant={trendUp ? 'default' : 'secondary'} className="text-[11px]">
                            {trend}
                        </Badge>
                    )}
                </div>
                <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
                <div className="text-xl font-bold tracking-tight">{value}</div>
                {subtitle && (
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
// Note: relativeTime is kept English for now as it's called outside component context.
// For full i18n, use the t() function inside components.

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
