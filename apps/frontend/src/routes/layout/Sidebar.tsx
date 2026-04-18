import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/core/auth/AuthContext';
import { useSkin } from '@/core/skins/SkinContext';
import { useTenant } from '@/core/tenants/TenantContext';
import { useTranslation } from '@/core/i18n';
import { useFeatures } from '@/core/features/FeatureContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Home, Settings, Layers, MessageSquare, ChevronLeft, LogOut,
    Zap, Eye, Palette, MessageCircle, Code2, FileStack, Upload, Search, Building2,
    Cpu, BookOpen, Server, Shield, Workflow, FolderKanban,
    HelpCircle, User, ChevronsUpDown, Building, Wrench, FlaskConical, Plus, Activity, Tags
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Admin roles allowed to see /admin ──────────────────────────
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

// Map command IDs → icon, translation key, path, and optional featureId
const COMMAND_META: Record<string, { icon: React.FC<{ className?: string }>; labelKey: string; path: string; featureId?: string }> = {
    'navigate.home': { icon: Home, labelKey: 'nav.home', path: '/' },
    'navigate.topology': { icon: Layers, labelKey: 'nav.topology', path: '/topology' },
    'navigate.chat': { icon: MessageSquare, labelKey: 'nav.chat', path: '/chat' },
    'navigate.settings': { icon: Settings, labelKey: 'nav.settings', path: '/settings' },
    'navigate.settings.features': { icon: Zap, labelKey: 'nav.featureFlags', path: '/settings/features' },
    'navigate.settings.accessibility': { icon: Eye, labelKey: 'nav.accessibility', path: '/settings/accessibility' },
    'navigate.settings.skins': { icon: Palette, labelKey: 'nav.skins', path: '/settings/skins' },
    'navigate.feedback': { icon: MessageCircle, labelKey: 'nav.feedback', path: '/feedback' },
    'navigate.workers': { icon: Cpu, labelKey: 'nav.workers', path: '/workers' },
    'navigate.knowledge': { icon: BookOpen, labelKey: 'nav.knowledge', path: '/knowledge' },
    'navigate.processes': { icon: Workflow, labelKey: 'nav.processes', path: '/processes' },
    'navigate.projects': { icon: FolderKanban, labelKey: 'nav.projects', path: '/projects' },
    'navigate.help': { icon: HelpCircle, labelKey: 'nav.help', path: '/help' },
    'navigate.platform': { icon: Server, labelKey: 'nav.platform', path: '/platform' },
    'navigate.admin': { icon: Shield, labelKey: 'nav.admin', path: '/admin' },

    // Module: Tool Management
    'module.tools.list': { icon: Wrench, labelKey: 'nav.tools', path: '/modules/tool-management-tools' },
    'module.tools.create': { icon: Plus, labelKey: 'common.create', path: '/modules/tool-management-tools/new' },
    'module.tools.usecases': { icon: FlaskConical, labelKey: 'nav.usecases', path: '/modules/workflow/directory', featureId: 'workflows' },
    'module.tools.usecases.create': { icon: Plus, labelKey: 'common.create', path: '/modules/workflow/new', featureId: 'workflows' },
    'module.tools.workflows': { icon: Workflow, labelKey: 'nav.workflows', path: '/modules/workflow', featureId: 'workflows' },
    'module.tools.workflows.directory': { icon: BookOpen, labelKey: 'nav.workflowDirectory', path: '/modules/workflow/directory', featureId: 'workflows' },
    'module.tools.workflows.session': { icon: Activity, labelKey: 'nav.workflowSessions', path: '/modules/workflow/sessions', featureId: 'workflows' },
    'admin.workflows.tags': { icon: Tags, labelKey: 'nav.workflowTags', path: '/admin/workflows/tags', featureId: 'workflows' },
};

// Fallback labels for commands that don't have i18n keys yet
const FALLBACK_LABELS: Record<string, string> = {
    'navigate.processes': 'Processes',
    'navigate.projects': 'Projects',
    'navigate.help': 'Help',
    'navigate.platform': 'Platform',
    'navigate.admin': 'Admin',

    'module.tools.list': 'Tool Management',
    'module.tools.create': 'New Tool',
    'module.tools.usecases': 'Use Cases',
    'module.tools.usecases.create': 'New Use Case',
    'module.tools.workflows': 'Workflows',
    'module.tools.workflows.directory': 'Workflow Directory',
    'module.tools.workflows.session': 'My Workflows',
    'admin.workflows.tags': 'Workflow Tags',
};

interface SidebarNavItem {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    path: string;
}

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { activeSkin } = useSkin();
    const { activeTenant } = useTenant();
    const { t } = useTranslation();
    const { isEnabled } = useFeatures();

    const isAdmin = ADMIN_ROLES.has(user?.role ?? '');

    // Build nav items from active skin's sidebar config, respecting feature gates
    const navItems = useMemo<SidebarNavItem[]>(() => {
        if (!activeSkin?.sidebar) return [];
        return activeSkin.sidebar
            .map((item) => {
                const meta = COMMAND_META[item.commandId];
                if (!meta) return null;
                // Feature gate: hide sidebar items whose feature is disabled
                if (meta.featureId && !isEnabled(meta.featureId)) return null;
                const translated = t(meta.labelKey);
                const label = (translated !== meta.labelKey) ? translated : (FALLBACK_LABELS[item.commandId] ?? translated);
                return { id: item.commandId, label, icon: meta.icon, path: meta.path };
            })
            .filter(Boolean) as SidebarNavItem[];
    }, [activeSkin, t, isEnabled]);

    const brandName = activeSkin?.branding?.appName || 'Surdej';

    // Bottom-anchored nav items (always visible, outside skin config)
    const bottomNavPaths = useMemo(() => [
        '/modules/workflow/sessions',
        '/platform',
        '/developer',
        '/admin',
    ], []);

    // All paths for active-state specificity checks
    const allNavPaths = useMemo(() => [
        ...navItems.map((item) => item.path),
        ...bottomNavPaths,
    ], [navItems, bottomNavPaths]);

    const renderNavButton = (id: string, label: string, Icon: React.FC<{ className?: string }>, path: string) => {
        const routeMatches = path === '/'
            ? location.pathname === '/'
            : location.pathname === path || location.pathname.startsWith(path + '/');

        const hasMoreSpecificMatch = routeMatches && allNavPaths.some(
            (otherPath) => otherPath !== path
                && otherPath.length > path.length
                && otherPath.startsWith(path)
                && (location.pathname === otherPath || location.pathname.startsWith(otherPath + '/'))
        );

        const isActive = routeMatches && !hasMoreSpecificMatch;

        return (
            <Button
                key={id}
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                    'w-full justify-start gap-3 text-sm transition-colors duration-200',
                    isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90',
                )}
                size="default"
                onClick={() => navigate(path)}
            >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{label}</span>
            </Button>
        );
    };

    return (
        <aside
            className={cn(
                'flex flex-col h-full border-r bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0',
                collapsed ? 'w-0 overflow-hidden border-none' : 'w-[var(--sidebar-width)]',
            )}
        >
            {/* Header — Brand + Tenant */}
            <div className="flex items-center gap-3 h-14 border-b px-5 shrink-0">
                {!collapsed && (
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 animate-fade-in">
                        {activeTenant?.logoUrl ? (
                            <img
                                src={activeTenant.logoUrl}
                                alt={activeTenant.name}
                                className="h-7 w-7 object-contain shrink-0"
                            />
                        ) : (
                            <div className="h-7 w-7 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                                <Building className="h-4 w-4 text-primary/70" />
                            </div>
                        )}
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm font-semibold tracking-tight leading-none truncate">
                                {brandName}
                            </h1>
                            {activeTenant && (
                                <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                    {activeTenant.name}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {!collapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={onToggle}
                        aria-label={t('nav.collapseSidebar')}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Navigation — from skin */}
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
                {navItems.map(({ id, label, icon, path }) =>
                    renderNavButton(id, label, icon, path)
                )}
            </nav>

            {/* Bottom-anchored section — Platform, Developer, Admin */}
            <div className="space-y-1 p-3 pt-0">
                {isEnabled('workflows') && renderNavButton('module.tools.workflows.session', t('nav.workflowSessions'), Activity, '/modules/workflow/session')}
                {renderNavButton('navigate.platform', t('nav.platform'), Server, '/platform')}
                {renderNavButton('navigate.developer', t('nav.developer'), Code2, '/developer')}
                {isAdmin && renderNavButton('navigate.admin', t('nav.admin'), Shield, '/admin')}
            </div>

            <Separator />

            {/* Footer — User menu */}
            <div className="p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
                                    {user?.displayName?.charAt(0) ?? '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate">{user?.displayName ?? t('common.user')}</span>
                                <span className="text-xs text-muted-foreground truncate">{user?.role}</span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                                <p className="text-xs leading-none text-muted-foreground">{user?.email ?? user?.role}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => navigate('/profile')}>
                                <User className="mr-2 h-4 w-4" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
