/**
 * Tenant Workspace Layout
 *
 * VS Code–style explorer layout for a single tenant.
 * Activity bar on the far left with icon navigation,
 * main content area rendered via <Outlet />.
 *
 * Route: /settings/tenants/:tenantId/*
 */

import { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Loader2, Home, Database, ArrowLeft, Building, Check, Trash2,
    Settings, Users, FileText, BarChart3, Globe, Folder,
    Bell, BookOpen, Cpu, Zap, Heart, Package, Lock, Key, Server,
    Table2, HardDrive, Inbox, Search, Eye, Code2, MessageSquare,
    Layers, Palette, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTenant, type Tenant } from '@/core/tenants/TenantContext';
import { useSkin, type SkinActivityBarItem } from '@/core/skins/SkinContext';

// ── Icon map: icon name string → component ──

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Home, Database, Settings, Users, FileText, BarChart3, Globe, Folder,
    Bell, BookOpen, Cpu, Zap, Heart, Package, Lock, Key, Server,
    Table2, HardDrive, Inbox, Search, Eye, Code2, MessageSquare,
    Layers, Palette, Star,
};

const DEFAULT_ACTIVITY_ITEMS: SkinActivityBarItem[] = [
    { id: 'home', label: 'Overview', icon: 'Home', path: '' },
    { id: 'database', label: 'Database', icon: 'Database', path: '/database' },
];

// ── Layout component ──

export function TenantWorkspaceLayout() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { activeTenant } = useTenant();
    const { activeSkin } = useSkin();

    // Resolve activity bar items from skin (falling back to defaults)
    const activityItems = (activeSkin?.activityBar && activeSkin.activityBar.length > 0)
        ? activeSkin.activityBar
        : DEFAULT_ACTIVITY_ITEMS;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);

    // ── Load tenant ──
    useEffect(() => {
        if (!tenantId) return;
        (async () => {
            try {
                const t = await api.get<Tenant>(`/tenants/${tenantId}`);
                setTenant(t);
            } catch {
                navigate('/settings/tenants');
            } finally {
                setLoading(false);
            }
        })();
    }, [tenantId, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                Tenant not found
            </div>
        );
    }

    const basePath = `/settings/tenants/${tenantId}`;
    const isActive = activeTenant?.id === tenant.id;
    const isDeleted = !!tenant.deletedAt;

    // Determine active activity item
    const relativePath = location.pathname.replace(basePath, '') || '';
    const activeItemId = activityItems.find(
        (item) => item.path === relativePath || (item.path && relativePath.startsWith(item.path)),
    )?.id ?? activityItems[0]?.id ?? 'home';

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* ── Top bar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/settings/tenants')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Tenants
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Back to tenant hub</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold truncate max-w-[200px]">{tenant.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{tenant.slug}</span>
                </div>

                <div className="flex items-center gap-1.5 ml-1">
                    {tenant.isDemo && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Demo</Badge>
                    )}
                    {isActive && (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0 gap-0.5">
                            <Check className="h-2 w-2" /> Active
                        </Badge>
                    )}
                    {isDeleted && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5">
                            <Trash2 className="h-2 w-2" /> Archived
                        </Badge>
                    )}
                </div>

                <div className="flex-1" />

                {/* Active section label */}
                <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">
                    {activityItems.find((i) => i.id === activeItemId)?.label}
                </Badge>
            </div>

            {/* ── Main area: activity bar + content ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Activity bar */}
                <div className="w-12 border-r bg-muted/20 flex flex-col items-center py-2 gap-1 shrink-0">
                    {activityItems.map((item) => {
                        const isItemActive = activeItemId === item.id;
                        const Icon = ICON_MAP[item.icon] ?? FileText;

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => navigate(`${basePath}${item.path}`)}
                                        className={cn(
                                            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150',
                                            isItemActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                                        )}
                                    >
                                        {/* Active indicator bar */}
                                        {isItemActive && (
                                            <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                                        )}
                                        <Icon className="h-5 w-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right">{item.label}</TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto p-6">
                    <Outlet context={{ tenant, setTenant }} />
                </div>
            </div>

            {/* ── Status bar ── */}
            <div className="flex items-center justify-between px-4 py-1 border-t text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {tenant.name}
                    </span>
                    <span className="font-mono">{tenant.slug}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span>ID: {tenant.id.slice(0, 8)}…</span>
                    <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
}
