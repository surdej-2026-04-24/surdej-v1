/**
 * Module Layout
 *
 * Activity-bar layout for domain modules at /modules/:moduleId/*.
 * Resolves the moduleId GUID, renders a left-hand icon activity bar
 * derived from the module's activityItems, and provides module context
 * to child routes via Outlet context.
 *
 * Pattern identical to ProspekterLayout — but driven by the module registry.
 */

import { Outlet, useParams, useNavigate, useLocation, useResolvedPath, Navigate } from 'react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Puzzle } from 'lucide-react';
import {
    Home, Upload, Search, Building2, FolderSearch,
    Inbox, LayoutList, BookOpen, FileStack, FolderOpen,
    LayoutDashboard, ListTodo, PlusCircle, Tags, CircleDot,
    Wrench, Map, FlaskConical, Workflow, Activity, Bug, Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModuleById, getModuleBySlug, type ModuleDefinition, type ModuleActivityItem } from '@/core/modules/moduleRegistry';
import { useTranslation } from '@/core/i18n';

// Map icon name strings → React components
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Home, Upload, Search, Building2, FolderSearch,
    Inbox, LayoutList, BookOpen, FileStack, Puzzle, FolderOpen,
    LayoutDashboard, ListTodo, PlusCircle, Tags, CircleDot,
    Wrench, Map, FlaskConical, Workflow, Activity, Bug, Library,
};

export interface ModuleOutletContext {
    module: ModuleDefinition;
}

export function ModuleLayout() {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const resolved = useResolvedPath('.');
    const { t } = useTranslation();

    // Extract slug from pathname as fallback when used with hardcoded routes
    // e.g. /modules/core-issues/issues → slug = "core-issues"
    const slugFromPath = location.pathname.match(/^\/modules\/([^/]+)/)?.[1];
    const lookupKey = moduleId ?? slugFromPath;

    if (!lookupKey) {
        return <Navigate to="/modules" replace />;
    }

    // Resolve by GUID first, then by slug
    const module = getModuleById(lookupKey) ?? getModuleBySlug(lookupKey);

    if (!module) {
        return <Navigate to="/modules" replace />;
    }

    const basePath = resolved.pathname.replace(/\/$/, '');

    // Determine which activity item is active
    const relativePath = location.pathname.replace(basePath, '') || '';
    const activeItem = module.activityItems.find(
        (item) => item.path === relativePath || (item.path && relativePath.startsWith(item.path)),
    ) ?? module.activityItems[0];

    const ModuleIcon = ICON_MAP[module.icon] ?? Puzzle;

    return (
        <div className="flex flex-col h-[calc(100%+3rem)] -m-6 animate-fade-in">
            {/* ── Top bar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/modules')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            {t('modules.backToModules')}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('modules.backToModulesHint')}</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-md bg-gradient-to-br text-white', module.color)}>
                        <ModuleIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-semibold">{(() => {
                        const nameKey = `modules.names.${module.slug}`;
                        const translated = t(nameKey);
                        return translated !== nameKey ? translated : module.name;
                    })()}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{module.slug}</span>
                </div>

                <div className="flex-1" />

                {/* Active section label */}
                <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">
                    {activeItem?.label}
                </Badge>
            </div>

            {/* ── Main area: activity bar + content ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Activity bar */}
                <div className="w-12 border-r bg-muted/20 flex flex-col items-center py-2 gap-1 shrink-0">
                    {module.activityItems.map((item) => {
                        const isActive = activeItem?.id === item.id;
                        const Icon = ICON_MAP[item.icon] ?? Puzzle;

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => navigate(`${basePath}${item.path}`)}
                                        className={cn(
                                            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150',
                                            isActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                                        )}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
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
                <div className="flex-1 min-h-0 overflow-auto p-6">
                    <Outlet context={{ module } satisfies ModuleOutletContext} />
                </div>
            </div>
        </div>
    );
}
