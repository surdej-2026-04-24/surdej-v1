/**
 * Design Guide — reference page showcasing every UI control / component.
 *
 * Useful for visual QA across themes, skins, and i18n locales.
 * Sections are grouped by context and include a sticky ToC.
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
    Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogTrigger, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    Paintbrush, ChevronDown, Info, Check, X, AlertTriangle,
    Zap, Star, Heart, Settings, Plus, Copy, Trash2,
    Home, MessageSquare, FileText, Search, Layers, Users,
    BarChart3, Bell, FolderOpen, Archive, Globe, Shield,
    Database, Cpu, Terminal, Sun, Moon, Monitor,
    Languages, Palette, Eye, ListChecks,
} from 'lucide-react';
import { Rail, type RailItem } from '@/components/Rail';
import { cn } from '@/lib/utils';

// ─── Contexts ─────────────────────────────────────────────────
import { useAccessibility } from '@/core/accessibility/AccessibilityContext';
import { useTranslation, SUPPORTED_LOCALES, type Locale } from '@/core/i18n';
import { useAuth } from '@/core/auth/AuthContext';
import { useFeatures, RING_LABELS } from '@/core/features/FeatureContext';
import { useTenant } from '@/core/tenants/TenantContext';
import { useSkin } from '@/core/skins/SkinContext';
import { useWireframe } from '@/core/wireframe/WireframeContext';
import { WireframeElement } from '@/core/wireframe/WireframeElement';
import { useJobs } from '@/core/jobs/JobContext';

/* ─── ToC Sections ──────────────────────────────────────────── */

const TOC_SECTIONS = [
    { id: 'ui-components', label: 'UI Components' },
    { id: 'buttons', label: 'Buttons', indent: true },
    { id: 'badges', label: 'Badges', indent: true },
    { id: 'cards', label: 'Cards', indent: true },
    { id: 'inputs', label: 'Inputs', indent: true },
    { id: 'switches', label: 'Switches', indent: true },
    { id: 'progress', label: 'Progress', indent: true },
    { id: 'avatars', label: 'Avatars', indent: true },
    { id: 'tooltips', label: 'Tooltips', indent: true },
    { id: 'dropdown-menu', label: 'Dropdown', indent: true },
    { id: 'dialog', label: 'Dialog', indent: true },
    { id: 'typography', label: 'Typography', indent: true },
    { id: 'colors', label: 'Colors', indent: true },
    { id: 'rail', label: 'Rail', indent: true },
    { id: 'ctx-accessibility', label: 'AccessibilityContext' },
    { id: 'ctx-i18n', label: 'I18nContext' },
    { id: 'ctx-auth', label: 'AuthContext' },
    { id: 'ctx-features', label: 'FeatureContext' },
    { id: 'ctx-tenant', label: 'TenantContext' },
    { id: 'ctx-skin', label: 'SkinContext' },
    { id: 'ctx-wireframe', label: 'WireframeContext' },
    { id: 'ctx-jobs', label: 'JobContext' },
] as const;

/* ─── Reusable section wrapper ──────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="space-y-4 scroll-mt-8">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap items-center gap-3">{children}</div>
        </div>
    );
}

function ContextHeader({ name, hook, file }: { name: string; hook: string; file: string }) {
    return (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] font-mono">{name}</Badge>
                <Badge className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">{hook}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">{file}</p>
        </div>
    );
}

/* ─── Rail demo data ─────────────────────────────────────────── */

const RAIL_ITEMS_A: RailItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'layers', label: 'Topology', icon: Layers },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: 3 },
    { id: 'settings', label: 'Settings', icon: Settings, pinned: true },
];

const RAIL_ITEMS_B: RailItem[] = [
    { id: 'docs', label: 'Documents', icon: FileText },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'alerts', label: 'Notifications', icon: Bell, badge: 12 },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'globe', label: 'Localization', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield, pinned: true },
];

const RAIL_ITEMS_OVERFLOW: RailItem[] = [
    { id: 'r-home', label: 'Home', icon: Home },
    { id: 'r-search', label: 'Search', icon: Search, badge: 5 },
    { id: 'r-files', label: 'Files', icon: FolderOpen },
    { id: 'r-layers', label: 'Layers', icon: Layers },
    { id: 'r-chat', label: 'Chat', icon: MessageSquare, badge: 2 },
    { id: 'r-docs', label: 'Documents', icon: FileText },
    { id: 'r-users', label: 'Users', icon: Users },
    { id: 'r-analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'r-db', label: 'Database', icon: Database },
    { id: 'r-cpu', label: 'System', icon: Cpu },
    { id: 'r-term', label: 'Terminal', icon: Terminal },
    { id: 'r-settings', label: 'Settings', icon: Settings, pinned: true },
];

/* ─── Page ──────────────────────────────────────────────────── */

export function DesignGuidePage() {
    const [switchA, setSwitchA] = useState(false);
    const [switchB, setSwitchB] = useState(true);
    const [progress, setProgress] = useState(42);
    const [showDropdownChecks, setShowDropdownChecks] = useState({ bold: true, italic: false });
    const [railActiveA, setRailActiveA] = useState('home');
    const [railActiveB, setRailActiveB] = useState('docs');
    const [railActiveC, setRailActiveC] = useState('r-home');
    const [railActiveD, setRailActiveD] = useState('home');

    // ─── ToC active tracking ───
    const [activeSection, setActiveSection] = useState('ui-components');
    const tocObserverRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        tocObserverRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
        );
        const sections = TOC_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
        sections.forEach((el) => tocObserverRef.current!.observe(el!));
        return () => tocObserverRef.current?.disconnect();
    }, []);

    return (
        <div className="flex gap-8 max-w-[1200px] mx-auto animate-fade-in">
            {/* ─── Main content ─── */}
            <div className="flex-1 min-w-0 space-y-10">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Paintbrush className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Design Guide</h1>
                        <p className="text-sm text-muted-foreground">
                            All UI components and context-controlled state — for visual QA, theming, and reference.
                        </p>
                    </div>
                </div>

                <Separator />

                {/* ────────────────────────────────────────────── */}
                {/*  PART 1: UI COMPONENTS                        */}
                {/* ────────────────────────────────────────────── */}

                <div id="ui-components" className="scroll-mt-8">
                    <h2 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        UI Components
                    </h2>
                </div>

                {/* ─── Buttons ──────────────────────────────── */}
                <Section id="buttons" title="Buttons">
                    <Row label="Variants">
                        <Button>Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                    </Row>
                    <Row label="Sizes">
                        <Button size="lg">Large</Button>
                        <Button size="default">Default</Button>
                        <Button size="sm">Small</Button>
                        <Button size="icon"><Plus className="h-4 w-4" /></Button>
                    </Row>
                    <Row label="States">
                        <Button disabled>Disabled</Button>
                        <Button className="animate-pulse">Loading…</Button>
                    </Row>
                    <Row label="With icons">
                        <Button><Zap className="h-4 w-4 mr-2" /> With Icon</Button>
                        <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Settings</Button>
                        <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Badges ───────────────────────────────── */}
                <Section id="badges" title="Badges">
                    <Row label="Variants">
                        <Badge>Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="outline">Outline</Badge>
                    </Row>
                    <Row label="With icons">
                        <Badge><Check className="h-3 w-3 mr-1" /> Success</Badge>
                        <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Error</Badge>
                        <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Warning</Badge>
                        <Badge variant="outline"><Info className="h-3 w-3 mr-1" /> Info</Badge>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Cards ────────────────────────────────── */}
                <Section id="cards" title="Cards">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Basic Card</CardTitle>
                                <CardDescription>A simple informational card</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">Body content goes here.</p>
                            </CardContent>
                        </Card>
                        <Card className="border-primary/30 shadow-primary/5 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Star className="h-4 w-4 text-amber-500" /> Highlighted
                                </CardTitle>
                                <CardDescription>With primary border accent</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">Useful for drawing attention.</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">With Footer</CardTitle>
                                <CardDescription>Includes action buttons</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">Card body content with footer actions below.</p>
                            </CardContent>
                            <CardFooter className="gap-2">
                                <Button size="sm">Save</Button>
                                <Button size="sm" variant="ghost">Cancel</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </Section>

                <Separator />

                {/* ─── Inputs ──────────────────────────────── */}
                <Section id="inputs" title="Inputs & Form Controls">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label htmlFor="dg-email">Email</Label>
                            <Input id="dg-email" type="email" placeholder="you@example.com" />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="dg-search">Search</Label>
                            <Input id="dg-search" type="search" placeholder="Search…" />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="dg-disabled">Disabled</Label>
                            <Input id="dg-disabled" placeholder="Can't type here" disabled />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="dg-password">Password</Label>
                            <Input id="dg-password" type="password" placeholder="••••••••" />
                        </div>
                    </div>
                </Section>

                <Separator />

                {/* ─── Switches ─────────────────────────────── */}
                <Section id="switches" title="Switches">
                    <Row label="Interactive">
                        <div className="flex items-center gap-3">
                            <Switch id="dg-sw-a" checked={switchA} onCheckedChange={setSwitchA} />
                            <Label htmlFor="dg-sw-a">{switchA ? 'On' : 'Off'}</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch id="dg-sw-b" checked={switchB} onCheckedChange={setSwitchB} />
                            <Label htmlFor="dg-sw-b">Enabled by default</Label>
                        </div>
                    </Row>
                    <Row label="Disabled">
                        <div className="flex items-center gap-3">
                            <Switch disabled />
                            <Label className="text-muted-foreground">Disabled off</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch disabled checked />
                            <Label className="text-muted-foreground">Disabled on</Label>
                        </div>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Progress ─────────────────────────────── */}
                <Section id="progress" title="Progress">
                    <div className="space-y-4 max-w-md">
                        <Progress value={progress} />
                        <div className="flex items-center gap-3">
                            <Button size="sm" variant="outline" onClick={() => setProgress(Math.max(0, progress - 10))}>
                                − 10
                            </Button>
                            <span className="text-sm font-mono text-muted-foreground w-10 text-center">{progress}%</span>
                            <Button size="sm" variant="outline" onClick={() => setProgress(Math.min(100, progress + 10))}>
                                + 10
                            </Button>
                        </div>
                        <Progress value={0} />
                        <Progress value={100} />
                    </div>
                </Section>

                <Separator />

                {/* ─── Avatars ──────────────────────────────── */}
                <Section id="avatars" title="Avatars">
                    <Row label="Sizes & fallbacks">
                        <Avatar className="h-8 w-8"><AvatarFallback>AB</AvatarFallback></Avatar>
                        <Avatar className="h-10 w-10"><AvatarFallback>CD</AvatarFallback></Avatar>
                        <Avatar className="h-12 w-12"><AvatarFallback>EF</AvatarFallback></Avatar>
                        <Avatar className="h-14 w-14">
                            <AvatarImage src="https://avatar.vercel.sh/surdej" alt="Surdej" />
                            <AvatarFallback>SU</AvatarFallback>
                        </Avatar>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Tooltips ─────────────────────────────── */}
                <Section id="tooltips" title="Tooltips">
                    <Row label="Hover to see">
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm">Top</Button></TooltipTrigger><TooltipContent side="top">Tooltip on top</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm">Bottom</Button></TooltipTrigger><TooltipContent side="bottom">Tooltip on bottom</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm">Right</Button></TooltipTrigger><TooltipContent side="right">Tooltip on right</TooltipContent></Tooltip>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Dropdown Menu ────────────────────────── */}
                <Section id="dropdown-menu" title="Dropdown Menu">
                    <Row label="With items, checkboxes, and separators">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Options <ChevronDown className="h-4 w-4 ml-2" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Copy</DropdownMenuItem>
                                <DropdownMenuItem><Settings className="h-4 w-4 mr-2" /> Settings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Formatting</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem
                                    checked={showDropdownChecks.bold}
                                    onCheckedChange={(v) => setShowDropdownChecks((s) => ({ ...s, bold: !!v }))}
                                >Bold</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showDropdownChecks.italic}
                                    onCheckedChange={(v) => setShowDropdownChecks((s) => ({ ...s, italic: !!v }))}
                                >Italic</DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Dialog ────────────────────────────────── */}
                <Section id="dialog" title="Dialog">
                    <Row label="Modal dialog">
                        <Dialog>
                            <DialogTrigger asChild><Button variant="outline">Open Dialog</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Dialog Title</DialogTitle>
                                    <DialogDescription>This is a dialog description.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="dg-dialog-input">Name</Label>
                                    <Input id="dg-dialog-input" placeholder="Enter your name…" className="mt-2" />
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost">Cancel</Button>
                                    <Button>Save</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </Row>
                </Section>

                <Separator />

                {/* ─── Typography ──────────────────────────── */}
                <Section id="typography" title="Typography">
                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
                        <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
                        <h3 className="text-2xl font-semibold tracking-tight">Heading 3</h3>
                        <h4 className="text-xl font-semibold">Heading 4</h4>
                        <p className="text-base">Body text — The quick brown fox jumps over the lazy dog.</p>
                        <p className="text-sm text-muted-foreground">Muted text — secondary information.</p>
                        <p className="text-xs text-muted-foreground">Small / caption text — metadata, timestamps.</p>
                        <div className="flex gap-4">
                            <code className="text-sm px-2 py-1 rounded bg-muted font-mono">inline code</code>
                            <kbd className="text-sm px-2 py-1 rounded border bg-muted font-mono">⌘K</kbd>
                        </div>
                    </div>
                </Section>

                <Separator />

                {/* ─── Color Palette ────────────────────────── */}
                <Section id="colors" title="Color Palette">
                    <Row label="Semantic tokens">
                        {([
                            ['bg-background', 'text-foreground', 'Background'],
                            ['bg-primary', 'text-primary-foreground', 'Primary'],
                            ['bg-secondary', 'text-secondary-foreground', 'Secondary'],
                            ['bg-muted', 'text-muted-foreground', 'Muted'],
                            ['bg-accent', 'text-accent-foreground', 'Accent'],
                            ['bg-destructive', 'text-white', 'Destructive'],
                        ] as [string, string, string][]).map(([bg, text, label]) => (
                            <div
                                key={label}
                                className={cn(
                                    'flex items-center justify-center h-14 w-24 rounded-lg border text-xs font-medium shadow-sm',
                                    bg, text,
                                )}
                            >
                                {label}
                            </div>
                        ))}
                    </Row>
                </Section>

                <Separator />

                {/* ─── Rail ──────────────────────────────────── */}
                <Section id="rail" title="Rail (Activity Bar)">
                    <p className="text-sm text-muted-foreground -mt-2 mb-4">
                        VS Code–style Activity Bar with draggable icons, overflow menu, badges, and active indicators.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">1</Badge>
                                    Left Rail + Sidebar
                                </CardTitle>
                                <CardDescription>Classic VS Code layout</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="flex h-48 border-t">
                                    <Rail items={RAIL_ITEMS_A} activeId={railActiveA} onSelect={setRailActiveA} position="left" />
                                    <div className="w-36 border-r bg-muted/20 flex flex-col">
                                        <div className="px-3 py-2 border-b">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {RAIL_ITEMS_A.find(i => i.id === railActiveA)?.label ?? 'Panel'}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground">
                                            Sidebar content
                                        </div>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60">
                                        Editor area
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">2</Badge>
                                    Overflow + Badges
                                </CardTitle>
                                <CardDescription>Items collapse into ··· dropdown</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="flex h-48 border-t">
                                    <Rail items={RAIL_ITEMS_OVERFLOW} activeId={railActiveC} onSelect={setRailActiveC} maxVisible={4} position="left" />
                                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60">
                                        {RAIL_ITEMS_OVERFLOW.find(i => i.id === railActiveC)?.label ?? 'Panel'}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </Section>

                <Separator />

                {/* ────────────────────────────────────────────── */}
                {/*  PART 2: CONTEXT-CONTROLLED COMPONENTS        */}
                {/* ────────────────────────────────────────────── */}

                <div className="pt-4">
                    <h2 className="text-xl font-bold tracking-tight mb-2 flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Context-Controlled Components
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Live state from each React Context — changes reflect across the entire app.
                    </p>
                </div>

                {/* ─── AccessibilityContext ────────────────────── */}
                <AccessibilitySection />

                <Separator />

                {/* ─── I18nContext ─────────────────────────────── */}
                <I18nSection />

                <Separator />

                {/* ─── AuthContext ─────────────────────────────── */}
                <AuthSection />

                <Separator />

                {/* ─── FeatureContext ──────────────────────────── */}
                <FeatureSection />

                <Separator />

                {/* ─── TenantContext ───────────────────────────── */}
                <TenantSection />

                <Separator />

                {/* ─── SkinContext ─────────────────────────────── */}
                <SkinSection />

                <Separator />

                {/* ─── WireframeContext ────────────────────────── */}
                <WireframeSection />

                <Separator />

                {/* ─── JobContext ──────────────────────────────── */}
                <JobSection />

                {/* Bottom spacer */}
                <div className="h-16" />
            </div>

            {/* ─── Sticky ToC ─── */}
            <nav className="hidden xl:block w-48 shrink-0">
                <div className="sticky top-4 space-y-0.5 max-h-[calc(100vh-4rem)] overflow-y-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                        On this page
                    </p>
                    {TOC_SECTIONS.map((s) => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={cn(
                                'block text-[11px] py-1 rounded-sm transition-colors',
                                'indent' in s && s.indent ? 'pl-5 pr-2' : 'pl-2 pr-2 font-medium',
                                activeSection === s.id
                                    ? 'text-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {s.label}
                        </a>
                    ))}
                </div>
            </nav>
        </div>
    );
}

/* ───────────────────────────────────────────────────────────────
 *  CONTEXT SECTIONS
 * ─────────────────────────────────────────────────────────────── */

function AccessibilitySection() {
    const { theme, resolvedTheme, highContrast, fontScale, reduceMotion, setTheme, toggleTheme, setHighContrast, setFontScale, setReduceMotion } = useAccessibility();

    const themeOptions: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ElementType; label: string }> = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ];

    return (
        <Section id="ctx-accessibility" title="AccessibilityContext">
            <ContextHeader name="AccessibilityContext" hook="useAccessibility()" file="core/accessibility/AccessibilityContext.tsx" />

            <Row label="Theme">
                <div className="flex gap-2">
                    {themeOptions.map((opt) => (
                        <Button
                            key={opt.value}
                            variant={theme === opt.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTheme(opt.value)}
                            className="gap-1.5"
                        >
                            <opt.icon className="h-3.5 w-3.5" />
                            {opt.label}
                        </Button>
                    ))}
                </div>
                <Badge variant="outline" className="text-[10px]">resolved: {resolvedTheme}</Badge>
            </Row>

            <Row label="High Contrast">
                <div className="flex items-center gap-3">
                    <Switch checked={highContrast} onCheckedChange={setHighContrast} />
                    <Label>{highContrast ? 'On' : 'Off'}</Label>
                </div>
            </Row>

            <Row label="Font Scale">
                <div className="flex gap-1.5">
                    {([100, 110, 120, 130, 140, 150] as const).map((scale) => (
                        <Button
                            key={scale}
                            variant={fontScale === scale ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFontScale(scale)}
                            className="text-xs px-2"
                        >
                            {scale}%
                        </Button>
                    ))}
                </div>
            </Row>

            <Row label="Reduce Motion">
                <div className="flex items-center gap-3">
                    <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                    <Label>{reduceMotion ? 'On' : 'Off'}</Label>
                </div>
            </Row>
        </Section>
    );
}

function I18nSection() {
    const { locale, setLocale, t, locales } = useTranslation();

    return (
        <Section id="ctx-i18n" title="I18nContext">
            <ContextHeader name="I18nContext" hook="useTranslation()" file="core/i18n/I18nProvider.tsx" />

            <Row label="Locale Selector">
                <div className="flex gap-2">
                    {locales.map((loc) => (
                        <Button
                            key={loc.code}
                            variant={locale === loc.code ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setLocale(loc.code as Locale)}
                            className="gap-1.5"
                        >
                            <span>{loc.flag}</span>
                            {loc.nativeLabel}
                        </Button>
                    ))}
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">locale: {locale}</Badge>
            </Row>

            <Row label="Live Translations">
                <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">nav.home →</span> {t('nav.home')}</p>
                    <p><span className="text-muted-foreground">nav.settings →</span> {t('nav.settings')}</p>
                    <p><span className="text-muted-foreground">settings.sections.tenants →</span> {t('settings.sections.tenants')}</p>
                </div>
            </Row>
        </Section>
    );
}

function AuthSection() {
    const { user, isAuthenticated, isLoading } = useAuth();

    return (
        <Section id="ctx-auth" title="AuthContext">
            <ContextHeader name="AuthContext" hook="useAuth()" file="core/auth/AuthContext.tsx" />

            <Row label="Current State">
                <Badge variant={isAuthenticated ? 'default' : 'outline'} className="text-[10px]">
                    {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
                </Badge>
                {isLoading && <Badge variant="secondary" className="text-[10px] animate-pulse">Loading…</Badge>}
            </Row>

            {user && (
                <Row label="User">
                    <Card className="w-full max-w-sm">
                        <CardContent className="p-3 flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                                <AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user.displayName || user.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <Badge variant="outline" className="text-[9px] shrink-0">{user.role}</Badge>
                        </CardContent>
                    </Card>
                </Row>
            )}
        </Section>
    );
}

function FeatureSection() {
    const { features, userRing, setUserRing, isEnabled, toggleFeature } = useFeatures();

    return (
        <Section id="ctx-features" title="FeatureContext">
            <ContextHeader name="FeatureContext" hook="useFeatures()" file="core/features/FeatureContext.tsx" />

            <Row label="User Ring">
                <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((ring) => (
                        <Button
                            key={ring}
                            variant={userRing === ring ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setUserRing(ring)}
                            className="text-xs gap-1.5"
                        >
                            Ring {ring}
                            <span className="text-muted-foreground">({RING_LABELS[ring]})</span>
                        </Button>
                    ))}
                </div>
            </Row>

            <Row label="Feature Flags">
                <div className="w-full space-y-2">
                    {features.map((f) => {
                        const active = isEnabled(f.featureId);
                        return (
                            <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card">
                                <Switch checked={active} onCheckedChange={() => toggleFeature(f.featureId)} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{f.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{f.description}</p>
                                </div>
                                <Badge variant="outline" className="text-[9px] shrink-0">
                                    Ring {f.ring} · {RING_LABELS[f.ring]}
                                </Badge>
                                <Badge variant={active ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                                    {active ? 'ON' : 'OFF'}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            </Row>
        </Section>
    );
}

function TenantSection() {
    const { activeTenant, allTenants, switchTenant, tenantVersion } = useTenant();

    return (
        <Section id="ctx-tenant" title="TenantContext">
            <ContextHeader name="TenantContext" hook="useTenant()" file="core/tenants/TenantContext.tsx" />

            <Row label="Active Tenant">
                {activeTenant ? (
                    <Card className="w-full max-w-sm">
                        <CardContent className="p-3">
                            <p className="text-sm font-medium">{activeTenant.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{activeTenant.id}</p>
                            <div className="flex gap-1.5 mt-2">
                                <Badge variant="outline" className="text-[9px]">{activeTenant.slug}</Badge>
                                {activeTenant.isDemo && <Badge variant="secondary" className="text-[9px]">Demo</Badge>}
                                <Badge variant="outline" className="text-[9px]">v{tenantVersion}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Badge variant="secondary" className="text-[10px]">No tenant</Badge>
                )}
            </Row>

            {allTenants.length > 1 && (
                <Row label="Switch Tenant">
                    <div className="flex gap-2 flex-wrap">
                        {allTenants.map((t) => (
                            <Button
                                key={t.id}
                                variant={activeTenant?.id === t.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => switchTenant(t.id)}
                                className="text-xs"
                            >
                                {t.name}
                            </Button>
                        ))}
                    </div>
                </Row>
            )}
        </Section>
    );
}

function SkinSection() {
    const { activeSkin, allSkins, switchSkin } = useSkin();

    return (
        <Section id="ctx-skin" title="SkinContext">
            <ContextHeader name="SkinContext" hook="useSkin()" file="core/skins/SkinContext.tsx" />

            <Row label="Active Skin">
                {activeSkin ? (
                    <Card className="w-full max-w-md">
                        <CardContent className="p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{activeSkin.name}</p>
                                {activeSkin.isBuiltIn && <Badge variant="secondary" className="text-[9px]">Built-in</Badge>}
                            </div>
                            {activeSkin.description && (
                                <p className="text-[10px] text-muted-foreground">{activeSkin.description}</p>
                            )}
                            <div className="flex gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px]">
                                    {activeSkin.sidebar?.length ?? 0} sidebar items
                                </Badge>
                                <Badge variant="outline" className="text-[9px]">
                                    {activeSkin.activityBar?.length ?? 0} activity bar items
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                    {activeSkin.branding.appName}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Badge variant="secondary" className="text-[10px]">No skin</Badge>
                )}
            </Row>

            {allSkins.length > 1 && (
                <Row label="Switch Skin">
                    <div className="flex gap-2 flex-wrap">
                        {allSkins.map((s) => (
                            <Button
                                key={s.id}
                                variant={activeSkin?.id === s.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => switchSkin(s.id)}
                                className="text-xs gap-1.5"
                            >
                                {s.name}
                                {s.isBuiltIn && <Badge variant="secondary" className="text-[9px] ml-1">built-in</Badge>}
                            </Button>
                        ))}
                    </div>
                </Row>
            )}
        </Section>
    );
}

function WireframeSection() {
    const { isActive, toggle } = useWireframe();

    return (
        <Section id="ctx-wireframe" title="WireframeContext">
            <ContextHeader name="WireframeContext" hook="useWireframe()" file="core/wireframe/WireframeContext.tsx" />

            <Row label="Toggle Wireframe">
                <div className="flex items-center gap-3">
                    <Switch checked={isActive} onCheckedChange={toggle} />
                    <Label>{isActive ? 'Active' : 'Inactive'}</Label>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">⌃⌥⌘W</Badge>
            </Row>

            <Row label="WireframeElement Preview">
                <WireframeElement name="SampleRegion" description="Depth 0 — red outline when active" depth={0} className="w-full rounded-lg border bg-card p-4">
                    <WireframeElement name="Header" description="Depth 1" depth={1} className="rounded-md bg-muted/30 p-3 mb-2">
                        <div className="h-2 w-24 rounded-sm bg-muted-foreground/15" />
                    </WireframeElement>
                    <WireframeElement name="Content" description="Depth 2" depth={2} className="rounded-md bg-muted/20 p-3">
                        <div className="h-2 w-32 rounded-sm bg-muted-foreground/10 mb-1.5" />
                        <div className="h-2 w-20 rounded-sm bg-muted-foreground/10" />
                    </WireframeElement>
                </WireframeElement>
            </Row>
        </Section>
    );
}

function JobSection() {
    const { jobs, activeJobs, completedJobs, isLoading } = useJobs();

    return (
        <Section id="ctx-jobs" title="JobContext">
            <ContextHeader name="JobContext" hook="useJobs()" file="core/jobs/JobContext.tsx" />

            <Row label="Job Status">
                <Badge variant="outline" className="text-[10px]">{jobs.length} total</Badge>
                <Badge variant={activeJobs.length > 0 ? 'default' : 'outline'} className="text-[10px]">
                    {activeJobs.length} active
                </Badge>
                <Badge variant="outline" className="text-[10px]">{completedJobs.length} completed</Badge>
                {isLoading && <Badge variant="secondary" className="text-[10px] animate-pulse">Loading…</Badge>}
            </Row>

            {jobs.length > 0 && (
                <Row label="Recent Jobs">
                    <div className="w-full space-y-2">
                        {jobs.slice(0, 5).map((job) => (
                            <div key={job.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{job.type}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{job.id.slice(0, 8)}…</p>
                                </div>
                                <Progress value={job.progress} className="w-20 h-1.5" />
                                <Badge
                                    variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'outline'}
                                    className="text-[9px] shrink-0"
                                >
                                    {job.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </Row>
            )}

            {jobs.length === 0 && !isLoading && (
                <Row label="Jobs">
                    <p className="text-xs text-muted-foreground">No jobs — trigger a tenant export/import to see them here.</p>
                </Row>
            )}
        </Section>
    );
}
