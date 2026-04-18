/**
 * Modules Hub Page
 *
 * Landing page at /modules listing all available domain modules.
 * Each module is displayed as a card with icon, name, description,
 * a mini wireframe preview of its activity bar + dashboard layout,
 * and a link to its dashboard.
 */

import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ArrowRight, FileStack, Inbox, Puzzle, Map,
    Home, Upload, Search, Building2, FolderSearch, FolderOpen,
    LayoutDashboard, ListTodo, PlusCircle, Tags, CircleDot,
    Wrench, FlaskConical, Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODULE_REGISTRY, type ModuleDefinition } from '@/core/modules/moduleRegistry';
import { WireframeElement } from '@/core/wireframe/WireframeElement';
import { useFeatures } from '@/core/features/FeatureContext';
import { useTranslation } from '@/core/i18n';

// Icon map for module icons
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    FileStack, Inbox, Map, Wrench, FlaskConical, Workflow,
    Home, Upload, Search, Building2, FolderSearch, FolderOpen,
    LayoutDashboard, ListTodo, PlusCircle, Tags, CircleDot,
};

export function ModulesHubPage() {
    const navigate = useNavigate();
    const { isEnabled } = useFeatures();
    const { t } = useTranslation();

    // Filter modules by feature flag (if a module has featureId set, it must be enabled)
    const visibleModules = MODULE_REGISTRY.filter(
        mod => !mod.featureId || isEnabled(mod.featureId),
    );

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        <Puzzle className="h-5 w-5" />
                    </div>
                    {t('modules.title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t('modules.subtitle')}
                </p>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-xs gap-1.5 py-1">
                    <Puzzle className="h-3 w-3" />
                    {t('modules.moduleCount', { count: visibleModules.length })}
                </Badge>
            </div>

            {/* Module cards */}
            <div className="grid grid-cols-1 gap-6">
                {visibleModules.map((mod) => (
                    <ModuleCard
                        key={mod.id}
                        module={mod}
                        onClick={() => navigate(mod.href || `/modules/${mod.slug}`)}
                    />
                ))}
            </div>

            {/* Empty state */}
            {MODULE_REGISTRY.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                    <Puzzle className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">{t('modules.noModules')}</p>
                    <p className="text-xs mt-1">{t('modules.noModulesHint')}</p>
                </div>
            )}
        </div>
    );
}

function ModuleCard({ module, onClick }: { module: ModuleDefinition; onClick: () => void }) {
    const Icon = ICON_MAP[module.icon] ?? Puzzle;
    const { t } = useTranslation();

    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden rounded-xl border bg-card text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
            <Card className="border-0 shadow-none">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                        <div className={cn(
                            'p-3 rounded-xl bg-gradient-to-br text-white shrink-0 transition-transform group-hover:scale-110',
                            module.color,
                        )}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <h3 className="font-semibold text-base">{module.name}</h3>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                                    v{module.version}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {module.description}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                                    {module.id.slice(0, 8)}…
                                </Badge>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    {module.slug}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    {t('modules.views', { count: module.activityItems.length })}
                                </Badge>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 mt-1 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 shrink-0" />
                    </div>

                    {/* ── Wireframe Preview ── */}
                    <ModuleWireframe module={module} />
                </CardContent>
            </Card>
        </button>
    );
}

/** Mini wireframe showing the module's activity bar + dashboard layout */
function ModuleWireframe({ module }: { module: ModuleDefinition }) {
    return (
        <WireframeElement name={`Module:${module.slug}`} description="Layout preview" depth={0} className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10 overflow-hidden">
            {/* Top bar wireframe */}
            <WireframeElement name="TopBar" description="Module header" depth={1} className="flex items-center gap-1.5 px-2 py-1 border-b border-dashed border-muted-foreground/15 bg-muted/20">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                <div className="h-1 w-px bg-muted-foreground/15 mx-0.5" />
                <div className={cn('w-3 h-3 rounded-sm bg-gradient-to-br', module.color)} />
                <div className="h-1.5 w-12 rounded-sm bg-muted-foreground/15" />
                <div className="flex-1" />
                <div className="h-1.5 w-8 rounded-full bg-muted-foreground/10" />
            </WireframeElement>

            {/* Main area: activity bar + content */}
            <div className="flex" style={{ height: 80 }}>
                {/* Activity bar */}
                <WireframeElement name="ActivityBar" description={`${module.activityItems.length} items`} depth={1} className="w-8 border-r border-dashed border-muted-foreground/15 bg-muted/15 flex flex-col items-center py-1.5 gap-1 shrink-0">
                    {module.activityItems.map((item, i) => {
                        const ItemIcon = ICON_MAP[item.icon] ?? Puzzle;
                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    'relative flex items-center justify-center w-5 h-5 rounded-sm transition-colors',
                                    i === 0
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-muted-foreground/40',
                                )}
                                title={item.label}
                            >
                                {i === 0 && (
                                    <div className="absolute left-0 top-0.5 bottom-0.5 w-[1.5px] rounded-r bg-primary/60" />
                                )}
                                <ItemIcon className="h-2.5 w-2.5" />
                            </div>
                        );
                    })}
                </WireframeElement>

                {/* Dashboard wireframe */}
                <WireframeElement name="Dashboard" description="Main content area" depth={1} className="flex-1 p-2 flex flex-col gap-1.5 overflow-hidden">
                    {/* Stats row */}
                    <WireframeElement name="StatsRow" depth={2} className="flex gap-1.5">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="flex-1 h-5 rounded-sm border border-muted-foreground/10 bg-muted/20 flex items-center justify-center">
                                <div className="h-1 w-4 rounded-sm bg-muted-foreground/15" />
                            </div>
                        ))}
                    </WireframeElement>
                    {/* Content rows */}
                    <WireframeElement name="ContentArea" depth={2} className="flex-1 rounded-sm border border-muted-foreground/10 bg-muted/15 p-1.5 flex flex-col gap-1">
                        <div className="h-1 w-16 rounded-sm bg-muted-foreground/15" />
                        <div className="h-1 w-12 rounded-sm bg-muted-foreground/10" />
                        <div className="h-1 w-20 rounded-sm bg-muted-foreground/8" />
                        <div className="h-1 w-10 rounded-sm bg-muted-foreground/8" />
                    </WireframeElement>
                </WireframeElement>
            </div>

            {/* Activity bar labels */}
            <WireframeElement name="ViewLabels" description="Activity items" depth={1} className="px-2 py-1 border-t border-dashed border-muted-foreground/15 bg-muted/20">
                <div className="flex items-center gap-1 flex-wrap">
                    {module.activityItems.map((item, i) => (
                        <span
                            key={item.id}
                            className={cn(
                                'text-[8px] px-1 py-0.5 rounded-sm',
                                i === 0
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-muted-foreground/60',
                            )}
                        >
                            {item.label}
                        </span>
                    ))}
                </div>
            </WireframeElement>
        </WireframeElement>
    );
}

