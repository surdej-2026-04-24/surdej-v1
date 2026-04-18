import { useAccessibility } from '@/core/accessibility/AccessibilityContext';
import { useTranslation } from '@/core/i18n';
import { WireframeElement } from '@/core/wireframe';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLocation, Link, useNavigate } from 'react-router';
import { useTenant } from '@/core/tenants/TenantContext';
import { useSkin } from '@/core/skins/SkinContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import {
    Sun, Moon, Maximize, Minimize, ChevronRight, MessageSquareMore, Menu, Puzzle,
    Sparkles, Megaphone, FileSearch, Building2, SearchCheck, Bot, Loader2,
    FlaskConical, Scale, Wrench, BookOpen, Globe, Layers, Zap, FileText,
    MessageSquare, Settings, Database, Search, Code, Lightbulb, PenTool, Wand2,
} from 'lucide-react';

import { QuickChat } from './QuickChat';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getModuleById } from '@/core/modules/moduleRegistry';
import { BUILT_IN_USE_CASES } from '@surdej/module-tool-management-tools-shared';
import { fetchActiveUseCases, type ActiveUseCase } from '@/routes/modules/tool-management-tools/use-case-api';

// ─── Feedback ────────────────────────────────────────────────────
import { useFeedbackStore } from '@/core/feedback/feedbackStore';
import { FeedbackToolbar } from '@/core/feedback/FeedbackToolbar';
import { StartFeedbackDialog } from '@/core/feedback/StartFeedbackDialog';
import { useFeature } from '@/core/features/FeatureContext';


export interface HeaderProps {
    collapsed: boolean;
    onToggleSidebar: () => void;
}

export function Header({ collapsed, onToggleSidebar }: HeaderProps) {
    const { resolvedTheme, toggleTheme } = useAccessibility();
    const { t } = useTranslation();
    const { activeTenant } = useTenant();
    const { activeSkin } = useSkin();
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
    const [useCasesDialogOpen, setUseCasesDialogOpen] = useState(false);
    const workflowsEnabled = useFeature('workflows');
    const location = useLocation();

    // Feedback state
    const activeSession = useFeedbackStore((s) => s.activeSession);
    const trackNavigation = useFeedbackStore((s) => s.trackNavigation);

    // Track navigation changes in active feedback session
    useEffect(() => {
        if (activeSession && activeSession.status === 'active') {
            trackNavigation(window.location.href, document.title || window.location.href);
        }
    }, [location.pathname, location.search, location.hash]);

    // Track fullscreen state change
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    // Resolve workflow use case names for breadcrumbs
    const [useCaseNames, setUseCaseNames] = useState<Record<string, string>>({});
    useEffect(() => {
        // Find UUID segments under /modules/workflow/
        const segs = location.pathname.split('/').filter(Boolean);
        const workflowIdx = segs.indexOf('workflow');
        if (workflowIdx === -1) return;
        const nextSeg = segs[workflowIdx + 1];
        if (!nextSeg || !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(nextSeg)) return;
        if (useCaseNames[nextSeg]) return; // already cached

        // Fetch from API
        import('@/routes/modules/tool-management-tools/use-case-api').then(({ fetchUseCase }) => {
            fetchUseCase(nextSeg)
                .then((uc) => {
                    setUseCaseNames((prev) => ({ ...prev, [nextSeg]: uc.label }));
                })
                .catch(() => { /* ignore */ });
        });
    }, [location.pathname]);

    // Build breadcrumbs — resolve module GUIDs to friendly names
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}/i;
    const segments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [
        { label: t('header.home'), path: '/' },
        ...segments
            .map((seg, i, arr) => {
                const fullPath = '/' + arr.slice(0, i + 1).join('/');

                // If this segment is a UUID, try to resolve it as a module GUID
                if (UUID_RE.test(seg)) {
                    const mod = getModuleById(seg);
                    if (mod) {
                        const nameKey = `modules.names.${mod.slug}`;
                        const translated = t(nameKey);
                        const label = translated !== nameKey ? translated : mod.name;
                        return { label, path: fullPath };
                    }
                    // Try resolving as a workflow use case name
                    if (useCaseNames[seg]) {
                        return { label: useCaseNames[seg], path: fullPath };
                    }
                    // Unknown UUID — skip it from breadcrumbs
                    return null;
                }

                const bcKey = `header.breadcrumbs.${seg}`;
                const translated = t(bcKey);
                // If translation returned the key itself (no match), fall back to capitalized segment
                const label = translated !== bcKey ? translated : seg.charAt(0).toUpperCase() + seg.slice(1);
                return { label, path: fullPath };
            })
            .filter(Boolean) as { label: string; path: string }[],
    ];

    // Update document.title: "PageName (Tenant) — AppName"
    useEffect(() => {
        const pageName = breadcrumbs.length > 1
            ? breadcrumbs[breadcrumbs.length - 1].label
            : t('header.home');
        const appName = activeSkin?.branding?.appName ?? 'Surdej';
        const tenantName = activeTenant?.name;
        document.title = tenantName
            ? `${pageName} (${tenantName}) — ${appName}`
            : `${pageName} — ${appName}`;
    }, [location.pathname, activeTenant?.name, activeSkin?.branding?.appName]);

    return (
        <header className="flex items-center justify-between h-14 px-6 border-b bg-background shrink-0">
            {/* Breadcrumbs */}
            <WireframeElement name="Breadcrumbs" description="Path navigation" depth={2}>
                <nav className="flex items-center gap-1.5 text-sm min-w-0">
                    {collapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleSidebar}
                            className="h-8 w-8 mr-2 -ml-2 text-muted-foreground hover:text-foreground"
                            title="Expand Sidebar"
                        >
                            <Menu className="h-4 w-4" />
                        </Button>
                    )}

                    {breadcrumbs.map((crumb, i) => (
                        <div key={crumb.path} className="flex items-center gap-1.5 min-w-0">
                            {i > 0 && (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {i === breadcrumbs.length - 1 ? (
                                <span className="font-medium truncate">{crumb.label}</span>
                            ) : (
                                <Link
                                    to={crumb.path}
                                    className="truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
                                >
                                    {crumb.label}
                                </Link>
                            )}
                        </div>
                    ))}
                </nav>
            </WireframeElement>

            {/* Toolbar */}
            <WireframeElement name="Toolbar" description="Actions & search" depth={2}>
                <div className="flex items-center gap-1">
                    {/* Feedback toolbar — visible when session is active */}
                    <FeedbackToolbar />

                    {/* Extension use cases — to the left of Send Feedback */}
                    {workflowsEnabled && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUseCasesDialogOpen(true)}
                                className="h-8 w-8"
                                aria-label="Extension use cases"
                            >
                                <Puzzle className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Extension use cases</TooltipContent>
                    </Tooltip>
                    )}

                    {/* Start / view feedback session */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                id="feedback-trigger"
                                variant={activeSession ? 'default' : 'ghost'}
                                size="icon"
                                onClick={() => {
                                    if (!activeSession) setFeedbackDialogOpen(true);
                                }}
                                className="h-8 w-8 relative"
                                aria-label="Feedback"
                            >
                                <img src="/happy-mates-logo.png" alt="Feedback" className="h-5 w-5 rounded-full object-cover" />
                                {activeSession && (
                                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse border-2 border-background" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {activeSession ? 'Feedbacksession aktiv' : 'Start feedbacksession'}
                        </TooltipContent>
                    </Tooltip>

                    {/* Command palette trigger */}
                    <QuickChat />

                    <LanguageSwitcher />

                    <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8" aria-label={t('header.toggleTheme')}>
                        {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8" aria-label={t('header.toggleFullscreen')}>
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                </div>
            </WireframeElement>

            {/* Start Feedback Session Dialog */}
            <StartFeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />

            {/* Extension Use Cases Dialog */}
            <UseCasesDialog
                open={useCasesDialogOpen}
                onOpenChange={setUseCasesDialogOpen}
                onSelect={(useCaseId, openInSidebar) => {
                    setUseCasesDialogOpen(false);

                    // If extension is loaded and user wants sidepanel, send postMessage
                    if (openInSidebar) {
                        window.postMessage({ type: 'SURDEJ_OPEN_SIDEBAR', useCase: useCaseId }, '*');
                        return;
                    }

                    // Try to send to the Chrome extension sidepanel (from within extension iframe)
                    const cr = (window as unknown as Record<string, unknown>).chrome as
                        | { runtime?: { sendMessage?: (extId: string, msg: unknown, cb: (r: unknown) => void) => void; id?: string } }
                        | undefined;

                    if (cr?.runtime?.id && cr.runtime.sendMessage) {
                        cr.runtime.sendMessage(
                            cr.runtime.id,
                            { type: 'SET_USE_CASE', useCase: useCaseId },
                            () => { /* ignore response */ },
                        );
                        return;
                    }

                    // Fallback: navigate to the chat page
                    navigate(`/chat?useCase=${encodeURIComponent(useCaseId)}`);
                }}
            />
        </header>
    );
}

// ─── Use Cases Dialog ────────────────────────────────────────────

// Broad icon map — covers built-in icons + common Lucide names admins might set
export const USE_CASE_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Sparkles, Megaphone, FileSearch, Building2, SearchCheck, Bot,
    FlaskConical, Scale, Wrench, BookOpen, Globe, Layers, Zap, FileText,
    MessageSquare, Settings, Database, Search, Code, Lightbulb, PenTool, Wand2,
};

export interface UseCasesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (useCaseId: string, openInSidebar: boolean) => void;
}

export function UseCasesDialog({ open, onOpenChange, onSelect }: UseCasesDialogProps) {
    const { t } = useTranslation();
    const [useCases, setUseCases] = useState<ActiveUseCase[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isExtensionLoaded, setIsExtensionLoaded] = useState(false);
    const [openInSidebar, setOpenInSidebar] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const items = await fetchActiveUseCases();
            if (items.length > 0) {
                setUseCases(items);
            } else {
                // API returned empty or failed — use built-in fallback
                setUseCases(BUILT_IN_USE_CASES.map((uc) => ({
                    id: uc.id,
                    slug: uc.id,
                    label: uc.label,
                    description: uc.description,
                    icon: uc.icon,
                    tags: [], // Built-ins do not have tags
                    promptTemplate: uc.promptTemplate,
                    tools: uc.tools,
                    modelTier: 'medium',
                    source: 'built-in' as const,
                })));
            }
        } catch {
            // API returned empty or failed — use built-in fallback
            setUseCases(BUILT_IN_USE_CASES.map((uc) => ({
                id: uc.id,
                slug: uc.id,
                label: uc.label,
                description: uc.description,
                icon: uc.icon,
                tags: [],
                promptTemplate: uc.promptTemplate,
                tools: uc.tools,
                modelTier: 'medium',
                source: 'built-in' as const,
            })));
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }, [open]);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        useCases.forEach(uc => uc.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [useCases]);

    const filteredSortedUseCases = useMemo(() => {
        let list = [...useCases];
        if (selectedTag) {
             list = list.filter(uc => uc.tags?.includes(selectedTag));
        }
        return list.sort((a, b) => a.label.localeCompare(b.label));
    }, [useCases, selectedTag]);

    // Fetch on first open
    useEffect(() => {
        if (open) {
            const hasExt = document.documentElement.hasAttribute('data-surdej-extension');
            setIsExtensionLoaded(hasExt);
            setOpenInSidebar(hasExt);
            
            if (!loaded) {
                load();
            }
        }
    }, [open, loaded, load]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Puzzle className="h-4 w-4 text-primary" />
                        {t('header.useCases.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('header.useCases.subtitle')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20 my-2">
                    <div className="flex flex-col gap-0.5 pr-4">
                        <Label htmlFor="open-sidebar" className={!isExtensionLoaded ? 'text-muted-foreground' : ''}>
                            {t('header.useCases.openInSidebar')}
                        </Label>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                            {t('header.useCases.openInSidebarDesc')}
                        </span>
                    </div>
                    <Switch 
                        id="open-sidebar" 
                        checked={openInSidebar} 
                        onCheckedChange={setOpenInSidebar} 
                        disabled={!isExtensionLoaded} 
                    />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {allTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1 px-1">
                                <Badge
                                    variant={selectedTag === null ? "default" : "secondary"}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedTag(null)}
                                >
                                    Alle
                                </Badge>
                                {allTags.map(tag => (
                                    <Badge
                                        key={tag}
                                        variant={selectedTag === tag ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="grid gap-2 py-2 max-h-[60vh] overflow-y-auto px-1">
                            {filteredSortedUseCases.map((uc) => {
                                const Icon = USE_CASE_ICON_MAP[uc.icon] ?? Bot;
                            return (
                                <button
                                    key={uc.id}
                                    onClick={() => onSelect(uc.slug ?? uc.id, openInSidebar)}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/50 hover:border-primary/40 transition-all text-left group"
                                >
                                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                        <Icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium leading-tight flex items-center gap-1.5">
                                            {uc.label}
                                            {uc.source === 'db' && (
                                                <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-normal">
                                                    {t('header.useCases.custom')}
                                                </span>
                                            )}
                                        </div>
                                            {uc.tags && uc.tags.length > 0 && (
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {uc.tags.map(tag => (
                                                        <span key={tag} className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded leading-none">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
