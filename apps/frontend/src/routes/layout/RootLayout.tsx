import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useSkin } from '@/core/skins/SkinContext';
import { useTenant } from '@/core/tenants/TenantContext';
import { useAuth } from '@/core/auth/AuthContext';
import { useFeatures, RING_LABELS } from '@/core/features/FeatureContext';
import { WireframeElement, useWireframe } from '@/core/wireframe';
import { useTranslation } from '@/core/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Building, Palette, Search, Zap, Activity, Menu, Globe, Server, ExternalLink, Settings, Plug } from 'lucide-react';
import { useCommandRegistry } from '@/core/commands/CommandRegistry';
import { cn } from '@/lib/utils';
import { BASE_URL, KNOWN_API_ENDPOINTS, switchApiEndpoint } from '@/lib/api';
import { useEffect, useState } from 'react';

// ─── Tracer & System Status ─────────────────────────────────────
import { useTracerStore, installTracerInterceptor } from '@/core/tracer/tracerStore';
import { useSystemStatusStore, startSystemStatusPolling, stopSystemStatusPolling } from '@/core/tracer/systemStatusStore';
import { useHelperStatusStore, startHelperPolling, stopHelperPolling } from '@/core/tracer/helperStatusStore';
import { TracerPanel } from '@/core/tracer/TracerPanel';
import { SystemStatusPanel } from '@/core/tracer/SystemStatusPanel';

const RING_COLORS: Record<number, string> = {
    1: 'bg-red-500',
    2: 'bg-amber-500',
    3: 'bg-blue-500',
    4: 'bg-emerald-500',
};

const STATUS_DOT_COLORS: Record<string, string> = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-muted-foreground/50',
};

export function RootLayout() {
    const { activeSkin, allSkins, switchSkin } = useSkin();
    const { activeTenant, allTenants, switchTenant } = useTenant();
    const { user } = useAuth();
    const executeCommand = useCommandRegistry((s) => s.execute);
    const { userRing } = useFeatures();
    const { isActive: wireframeActive } = useWireframe();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const { t } = useTranslation();

    // Tracer state
    const tracerEnabled = useTracerStore((s) => s.enabled);
    const tracerPanelOpen = useTracerStore((s) => s.panelOpen);
    const tracerRequestCount = useTracerStore((s) => s.requests.length);
    const tracerPendingCount = useTracerStore((s) => s.requests.filter((r) => r.pending).length);
    const toggleTracer = useTracerStore((s) => s.toggleEnabled);
    const toggleTracerPanel = useTracerStore((s) => s.togglePanel);

    // System status state
    const systemStatus = useSystemStatusStore((s) => s.status);
    const systemPanelOpen = useSystemStatusStore((s) => s.panelOpen);
    const toggleSystemPanel = useSystemStatusStore((s) => s.togglePanel);

    // Helper (MCP) status
    const helperStatus = useHelperStatusStore((s) => s.status);

    const [collapsed, setCollapsed] = useState(true);

    // Install tracer interceptor once
    useEffect(() => {
        installTracerInterceptor();
    }, []);

    // Start system status polling
    useEffect(() => {
        startSystemStatusPolling(30_000);
        return () => stopSystemStatusPolling();
    }, []);

    // Start helper status polling
    useEffect(() => {
        startHelperPolling(15_000);
        return () => stopHelperPolling();
    }, []);

    // Listen for toggle-sidebar events
    useEffect(() => {
        const handler = () => setCollapsed((c) => !c);
        window.addEventListener('surdej:toggle-sidebar', handler);
        return () => window.removeEventListener('surdej:toggle-sidebar', handler);
    }, []);

    // ... (rest of logic)

    return (
        <TooltipProvider delayDuration={200}>
            <WireframeElement name="RootLayout" description="App shell" depth={0} className="flex h-screen overflow-hidden bg-background">
                <WireframeElement name="Sidebar" description="Navigation" depth={1} className={cn("shrink-0 relative group transition-all duration-300", collapsed ? "w-0 overflow-hidden" : "w-auto")}>
                    <div className="h-full">
                        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
                    </div>
                </WireframeElement>

                {/* ... Main content ... */}
                <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-300', tracerPanelOpen && 'mr-[420px]')}>
                    <WireframeElement name="Header" description="Breadcrumbs & search" depth={1}>
                        <Header collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
                    </WireframeElement>
                    <WireframeElement name="Main" description="Page content" depth={1} className="flex-1 min-h-0 overflow-auto p-6">
                        <Outlet />
                    </WireframeElement>
                    <WireframeElement name="Footer" description="Status bar" depth={1}>
                        <footer className="flex items-center justify-between px-6 py-2 text-xs border-t text-muted-foreground">
                            <WireframeElement name="Version" description="App version" depth={2}>
                                <span>{t('footer.version')}</span>
                            </WireframeElement>
                            <WireframeElement name="SearchTrigger" description="Command palette shortcut" depth={2}>
                                <button
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-border/50 bg-muted/40 hover:bg-muted hover:border-border text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
                                    onClick={() => window.dispatchEvent(new CustomEvent('surdej:open-command-palette'))}
                                >
                                    <Search className="h-3 w-3" />
                                    <span className="text-[0.6875rem]">{t('common.searchPlaceholder')}</span>
                                    <kbd className="text-[0.625rem] font-mono ml-1 px-1.5 py-0.5 rounded bg-background border text-muted-foreground">⌘K</kbd>
                                </button>
                            </WireframeElement>
                            <WireframeElement name="StatusBar" description="Ring, skin, tenant, tracer & status" depth={2}>
                                <div className="flex items-center gap-4">
                                    {wireframeActive && (
                                        <Badge variant="default" className="gap-1.5 text-[0.625rem] py-0.5 animate-pulse">
                                            🔲 {t('footer.wireframe')}
                                        </Badge>
                                    )}

                                    {/* ── System Status ────────────────────── */}
                                    <button
                                        onClick={toggleSystemPanel}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all',
                                            systemPanelOpen
                                                ? 'bg-primary/10 text-foreground'
                                                : 'opacity-60 hover:opacity-100',
                                        )}
                                    >
                                        <div className={cn(
                                            'w-2 h-2 rounded-full',
                                            STATUS_DOT_COLORS[systemStatus],
                                            systemStatus === 'healthy' && 'shadow-[0_0_4px_0px] shadow-emerald-500/50',
                                        )} />
                                        <Activity className="h-3 w-3" />
                                        <span className="text-[0.625rem]">
                                            {systemStatus === 'healthy' ? 'Healthy' :
                                                systemStatus === 'degraded' ? 'Degraded' :
                                                    systemStatus === 'unhealthy' ? 'Unhealthy' : 'Unknown'}
                                        </span>
                                    </button>

                                    {/* ── Helper (MCP) Status ─────────────── */}
                                    <div
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
                                            'opacity-60 hover:opacity-100 transition-all',
                                        )}
                                        title={helperStatus === 'connected'
                                            ? 'Helper MCP server is running on :5050'
                                            : 'Helper MCP server is not reachable. Run task "Dev: Surdej Helper (MCP)"'}
                                    >
                                        <div className={cn(
                                            'w-2 h-2 rounded-full',
                                            helperStatus === 'connected' && 'bg-emerald-500 shadow-[0_0_4px_0px] shadow-emerald-500/50',
                                            helperStatus === 'disconnected' && 'bg-muted-foreground/40',
                                            helperStatus === 'checking' && 'bg-amber-500 animate-pulse',
                                        )} />
                                        <Plug className="h-3 w-3" />
                                        <span className="text-[0.625rem]">
                                            {helperStatus === 'connected' ? 'MCP' :
                                                helperStatus === 'checking' ? 'MCP…' : 'MCP ✗'}
                                        </span>
                                    </div>

                                    {/* ── API Endpoint Selector (SUPER_ADMIN only) ── */}
                                    {isSuperAdmin && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all',
                                                        BASE_URL.includes('localhost') || BASE_URL.startsWith('/')
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-blue-600 dark:text-blue-400',
                                                        'opacity-70 hover:opacity-100',
                                                    )}
                                                    title={`Connected to: ${BASE_URL}`}
                                                >
                                                    <div className={cn(
                                                        'w-2 h-2 rounded-full',
                                                        BASE_URL.includes('localhost') || BASE_URL.startsWith('/')
                                                            ? 'bg-emerald-500'
                                                            : 'bg-blue-500',
                                                    )} />
                                                    <Server className="h-3 w-3" />
                                                    <span className="text-[0.625rem] font-mono max-w-[120px] truncate">
                                                        {BASE_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '')}
                                                    </span>
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" side="top" className="w-72">
                                                <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
                                                    <Globe className="h-3 w-3" />
                                                    API Endpoint
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={BASE_URL}
                                                    onValueChange={(url) => {
                                                        switchApiEndpoint(url);
                                                        window.location.reload();
                                                    }}
                                                >
                                                    {KNOWN_API_ENDPOINTS.map((ep) => (
                                                        <DropdownMenuRadioItem
                                                            key={ep.url}
                                                            value={ep.url}
                                                            className="text-xs"
                                                            onSelect={(e) => e.preventDefault()}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{ep.label}</span>
                                                                <span className="text-[0.625rem] text-muted-foreground font-mono">
                                                                    {ep.url}
                                                                </span>
                                                            </div>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-xs gap-1.5"
                                                    onSelect={() => {
                                                        const url = window.prompt(
                                                            'Enter custom API URL:',
                                                            BASE_URL,
                                                        );
                                                        if (url && url.trim()) {
                                                            switchApiEndpoint(url.trim());
                                                            window.location.reload();
                                                        }
                                                    }}
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Custom URL…
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    {/* ── API Tracer ──────────────────────── */}
                                    <button
                                        onClick={toggleTracerPanel}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all',
                                            tracerPanelOpen
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : 'opacity-60 hover:opacity-100',
                                        )}
                                        title={tracerPanelOpen ? 'Hide Tracer Panel' : 'Show Tracer Panel'}
                                    >
                                        <div className={cn(
                                            'w-2 h-2 rounded-full transition-colors',
                                            tracerEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
                                        )} />
                                        <Zap className="h-3 w-3" />
                                        <span className="text-[0.625rem]">Tracer</span>
                                        {tracerEnabled && tracerRequestCount > 0 && (
                                            <span className="text-[0.5625rem] font-mono bg-emerald-500/15 px-1 rounded">
                                                {tracerPendingCount > 0
                                                    ? `${tracerPendingCount}⇄`
                                                    : tracerRequestCount}
                                            </span>
                                        )}
                                    </button>
                                    {tracerPanelOpen && (
                                        <button
                                            onClick={toggleTracerPanel}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[0.625rem] transition-colors"
                                        >
                                            Panel
                                        </button>
                                    )}

                                    {/* ── Ring indicator ──────────────────── */}
                                    <Badge variant="outline" className="gap-1.5 text-[0.625rem] font-normal py-0.5">
                                        <div className={cn('w-2 h-2 rounded-full', RING_COLORS[userRing])} />
                                        {t('footer.ring', { label: RING_LABELS[userRing] ?? `Ring ${userRing}` })}
                                    </Badge>

                                    {/* ── Skin picker ─────────────────────── */}
                                    {activeSkin && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    className="inline-flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    <Palette className="h-3 w-3" />
                                                    {t('footer.skin', { name: activeSkin.name })}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" side="top" className="w-52">
                                                <DropdownMenuLabel className="text-xs">
                                                    {t('footer.switchSkin')}
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={activeSkin.id}
                                                    onValueChange={(id) => switchSkin(id)}
                                                >
                                                    {allSkins.map((skin) => (
                                                        <DropdownMenuRadioItem
                                                            key={skin.id}
                                                            value={skin.id}
                                                            className="text-xs"
                                                            onSelect={(e) => e.preventDefault()}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{skin.name}</span>
                                                                {skin.description && (
                                                                    <span className="text-[0.625rem] text-muted-foreground">
                                                                        {skin.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-xs gap-2"
                                                    onSelect={() => executeCommand('navigate.settings.skins')}
                                                >
                                                    <Settings className="h-3 w-3" />
                                                    {t('footer.manageSkins')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    {/* ── Tenant picker ──────────────────── */}
                                    {activeTenant && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    className="inline-flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    {activeTenant.logoUrl ? (
                                                        <img src={activeTenant.logoUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                                                    ) : (
                                                        <Building className="h-3 w-3" />
                                                    )}
                                                    {t('footer.tenant', { name: activeTenant.name })}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" side="top" className="w-64">
                                                <DropdownMenuLabel className="text-xs">
                                                    {t('footer.switchTenant')}
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={activeTenant.id}
                                                    onValueChange={(id) => switchTenant(id)}
                                                >
                                                    {allTenants.map((tenant) => (
                                                        <DropdownMenuRadioItem
                                                            key={tenant.id}
                                                            value={tenant.id}
                                                            className="text-xs"
                                                            onSelect={(e) => e.preventDefault()}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {tenant.logoUrl ? (
                                                                    <img src={tenant.logoUrl} alt="" className="h-4 w-4 object-contain shrink-0" />
                                                                ) : (
                                                                    <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{tenant.name}</span>
                                                                    {tenant.description && (
                                                                        <span className="text-[0.625rem] text-muted-foreground">
                                                                            {tenant.description}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </WireframeElement>
                        </footer>
                    </WireframeElement>
                </div>
            </WireframeElement>

            {/* ── Overlay Panels (outside main flow) ── */}
            <TracerPanel />
            <SystemStatusPanel />
        </TooltipProvider>
    );
}
