import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ArrowLeft, PanelLeftClose, PanelRightClose, Search, X,
    ChevronRight, ChevronDown, Play, Copy, Terminal as TerminalIcon,
    ArrowUpDown, Filter, Keyboard, SortAsc, SortDesc,
    Home, Layers, MessageSquare, Settings, Zap, Eye, Palette,
    MessageCircle, Moon, PanelLeft, LogOut, Code2, Cpu,
    FileStack, Upload, BookOpen, Inbox, LayoutList, Building2,
    Command as CommandIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { useCommandRegistry, type CommandDefinition } from '@/core/commands/CommandRegistry';

// ── Icon mapping (same as CommandPalette + extras) ──

const ICON_MAP: Record<string, React.FC<{ className?: string; size?: number }>> = {
    Home, Layers, MessageSquare, Settings, Zap, Eye, Palette,
    MessageCircle, Moon, PanelLeft, LogOut, Search, Code2, Cpu,
    FileStack, Upload, BookOpen, Inbox, LayoutList, Building2, Keyboard,
};

function getIcon(name?: string, className = 'h-4 w-4') {
    if (!name) return <CommandIcon className={className} />;
    const Icon = ICON_MAP[name];
    return Icon ? <Icon className={className} /> : <CommandIcon className={className} />;
}

// ── Sort options ──

type SortMode = 'label-asc' | 'label-desc' | 'id-asc' | 'id-desc' | 'group-asc';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'label-asc', label: 'Label A→Z' },
    { value: 'label-desc', label: 'Label Z→A' },
    { value: 'id-asc', label: 'ID A→Z' },
    { value: 'id-desc', label: 'ID Z→A' },
    { value: 'group-asc', label: 'Group' },
];

// ── Main component ──

export function CommandExplorerPage() {
    const navigate = useNavigate();
    const allCommands = useCommandRegistry((s) => s.getAll)();
    const executeCmd = useCommandRegistry((s) => s.execute);
    const recentIds = useCommandRegistry((s) => s.recentIds);

    // Layout state
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [propertiesOpen, setPropertiesOpen] = useState(true);

    // Selection
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Search / sort / filter
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('group-asc');
    const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Derive groups
    const groups = useMemo(() => {
        const g = new Set<string>();
        for (const cmd of allCommands) g.add(cmd.group ?? 'Ungrouped');
        return Array.from(g).sort();
    }, [allCommands]);

    // Initialize expanded groups on first render
    useMemo(() => {
        if (expandedGroups.size === 0 && groups.length > 0) {
            setExpandedGroups(new Set(groups));
        }
    }, [groups]);

    // Filtered + sorted commands
    const filteredCommands = useMemo(() => {
        let cmds = [...allCommands];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            cmds = cmds.filter(
                (c) =>
                    c.label.toLowerCase().includes(q) ||
                    c.id.toLowerCase().includes(q) ||
                    (c.group?.toLowerCase().includes(q) ?? false),
            );
        }

        // Group filter
        if (activeGroupFilter) {
            cmds = cmds.filter((c) => (c.group ?? 'Ungrouped') === activeGroupFilter);
        }

        // Sort
        cmds.sort((a, b) => {
            switch (sortMode) {
                case 'label-asc': return a.label.localeCompare(b.label);
                case 'label-desc': return b.label.localeCompare(a.label);
                case 'id-asc': return a.id.localeCompare(b.id);
                case 'id-desc': return b.id.localeCompare(a.id);
                case 'group-asc': return (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label);
            }
        });

        return cmds;
    }, [allCommands, searchQuery, activeGroupFilter, sortMode]);

    // Group the filtered commands
    const groupedCommands = useMemo(() => {
        const map = new Map<string, CommandDefinition[]>();
        for (const cmd of filteredCommands) {
            const g = cmd.group ?? 'Ungrouped';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(cmd);
        }
        return map;
    }, [filteredCommands]);

    const selectedCmd = selectedId ? allCommands.find((c) => c.id === selectedId) : null;

    const toggleGroup = useCallback((group: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    }, []);

    const handleExecute = useCallback(async () => {
        if (!selectedId) return;
        await executeCmd(selectedId);
    }, [selectedId, executeCmd]);

    const [copied, setCopied] = useState<string | null>(null);
    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 1500);
    }, []);

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/developer')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back to Developer</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={sidebarOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle command list</TooltipContent>
                </Tooltip>

                <div className="flex-1 flex items-center justify-center">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                        <TerminalIcon className="h-3 w-3" />
                        Command Explorer — {allCommands.length} commands registered
                    </Badge>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={propertiesOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPropertiesOpen(!propertiesOpen)}
                        >
                            <PanelRightClose className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle properties</TooltipContent>
                </Tooltip>
            </div>

            {/* ── Main layout ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Command list sidebar */}
                {sidebarOpen && (
                    <div className="w-72 border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Commands
                            </span>
                            <div className="flex items-center gap-0.5">
                                {/* Sort toggle */}
                                <div className="relative">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={showSortMenu ? 'secondary' : 'ghost'}
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                                            >
                                                <ArrowUpDown className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Sort</TooltipContent>
                                    </Tooltip>
                                    {showSortMenu && (
                                        <div className="absolute right-0 top-6 z-20 w-36 rounded-lg border bg-popover shadow-lg p-1 animate-in fade-in slide-in-from-top-1">
                                            {SORT_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    className={cn(
                                                        'flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors',
                                                        sortMode === opt.value
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'hover:bg-muted text-foreground',
                                                    )}
                                                    onClick={() => { setSortMode(opt.value); setShowSortMenu(false); }}
                                                >
                                                    {opt.value.includes('asc') ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Filter toggle */}
                                <div className="relative">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={activeGroupFilter || showFilterMenu ? 'secondary' : 'ghost'}
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                                            >
                                                <Filter className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Filter by group</TooltipContent>
                                    </Tooltip>
                                    {showFilterMenu && (
                                        <div className="absolute right-0 top-6 z-20 w-40 rounded-lg border bg-popover shadow-lg p-1 animate-in fade-in slide-in-from-top-1">
                                            <button
                                                className={cn(
                                                    'flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors',
                                                    !activeGroupFilter
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'hover:bg-muted text-foreground',
                                                )}
                                                onClick={() => { setActiveGroupFilter(null); setShowFilterMenu(false); }}
                                            >
                                                All Groups
                                            </button>
                                            <Separator className="my-1" />
                                            {groups.map((g) => (
                                                <button
                                                    key={g}
                                                    className={cn(
                                                        'flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors',
                                                        activeGroupFilter === g
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'hover:bg-muted text-foreground',
                                                    )}
                                                    onClick={() => { setActiveGroupFilter(g); setShowFilterMenu(false); }}
                                                >
                                                    {g}
                                                    <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">
                                                        {allCommands.filter((c) => (c.group ?? 'Ungrouped') === g).length}
                                                    </Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search bar */}
                        <div className="px-2 py-1.5 border-b">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/60">
                                <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search commands…"
                                    className="flex-1 bg-transparent outline-none text-[11px] text-foreground placeholder:text-muted-foreground"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-muted transition-colors">
                                        <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active filter badge */}
                        {activeGroupFilter && (
                            <div className="px-2 py-1 border-b">
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                    <Filter className="h-2.5 w-2.5" />
                                    {activeGroupFilter}
                                    <button
                                        onClick={() => setActiveGroupFilter(null)}
                                        className="ml-1 p-0.5 rounded-full hover:bg-muted transition-colors"
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </Badge>
                            </div>
                        )}

                        {/* Command tree */}
                        <div className="flex-1 overflow-y-auto py-1 px-1">
                            {filteredCommands.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                    <Search className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-xs">No commands match your search.</p>
                                </div>
                            ) : (
                                Array.from(groupedCommands.entries()).map(([group, cmds]) => {
                                    const isExpanded = expandedGroups.has(group);
                                    return (
                                        <div key={group} className="mb-0.5">
                                            {/* Group header */}
                                            <button
                                                className="flex items-center gap-1.5 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 rounded-sm hover:bg-muted/60 transition-colors"
                                                onClick={() => toggleGroup(group)}
                                            >
                                                {isExpanded
                                                    ? <ChevronDown className="h-3 w-3 shrink-0" />
                                                    : <ChevronRight className="h-3 w-3 shrink-0" />}
                                                <span className="flex-1">{group}</span>
                                                <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal">
                                                    {cmds.length}
                                                </Badge>
                                            </button>

                                            {/* Commands in group */}
                                            {isExpanded && cmds.map((cmd) => {
                                                const isSelected = selectedId === cmd.id;
                                                const isRecent = recentIds.includes(cmd.id);
                                                return (
                                                    <button
                                                        key={cmd.id}
                                                        className={cn(
                                                            'flex items-center gap-2 w-full text-left text-xs py-[5px] px-3 pl-7 rounded-sm transition-colors',
                                                            isSelected
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : 'hover:bg-muted/60 text-foreground/80',
                                                        )}
                                                        onClick={() => setSelectedId(cmd.id)}
                                                    >
                                                        <span className={cn(
                                                            'shrink-0',
                                                            isSelected ? 'text-primary' : 'text-muted-foreground',
                                                        )}>
                                                            {getIcon(cmd.icon, 'h-3.5 w-3.5')}
                                                        </span>
                                                        <span className="flex-1 truncate">{cmd.label}</span>
                                                        {cmd.keybinding && (
                                                            <kbd className="text-[9px] px-1 py-0 rounded border border-border text-muted-foreground shrink-0">
                                                                {cmd.keybinding}
                                                            </kbd>
                                                        )}
                                                        {isRecent && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="Recently used" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                            {filteredCommands.length} of {allCommands.length} commands
                            {activeGroupFilter && ` · ${activeGroupFilter}`}
                        </div>
                    </div>
                )}

                {/* Centre detail area */}
                <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
                    {selectedCmd ? (
                        <div className="flex-1 overflow-auto">
                            {/* Command hero header */}
                            <div className="px-8 pt-8 pb-6 border-b bg-muted/20">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                                        <span className="text-primary">
                                            {getIcon(selectedCmd.icon, 'h-6 w-6')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-semibold tracking-tight">{selectedCmd.label}</h2>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {selectedCmd.id}
                                            </code>
                                            {selectedCmd.group && (
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {selectedCmd.group}
                                                </Badge>
                                            )}
                                            {selectedCmd.keybinding && (
                                                <Badge variant="outline" className="text-[10px] gap-1">
                                                    <Keyboard className="h-2.5 w-2.5" />
                                                    {selectedCmd.keybinding}
                                                </Badge>
                                            )}
                                            {selectedCmd.when && (
                                                <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
                                                    <Eye className="h-2.5 w-2.5" />
                                                    {selectedCmd.when}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="shrink-0 gap-1.5"
                                        onClick={handleExecute}
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        Execute
                                    </Button>
                                </div>
                            </div>

                            {/* Command details content */}
                            <div className="px-8 py-6 space-y-6">
                                {/* Execution info */}
                                <section>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <TerminalIcon className="h-4 w-4 text-muted-foreground" />
                                        Execution
                                    </h3>
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">Command ID</span>
                                            <div className="flex items-center gap-1.5">
                                                <code className="text-xs font-mono">{selectedCmd.id}</code>
                                                <button
                                                    className="p-0.5 rounded hover:bg-muted transition-colors"
                                                    onClick={() => copyToClipboard(selectedCmd.id, 'id')}
                                                >
                                                    {copied === 'id'
                                                        ? <span className="text-[9px] text-green-500">✓</span>
                                                        : <Copy className="h-3 w-3 text-muted-foreground" />}
                                                </button>
                                            </div>
                                        </div>
                                        {selectedCmd.keybinding && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Keyboard Shortcut</span>
                                                <kbd className="text-xs px-2 py-0.5 rounded border font-mono">{selectedCmd.keybinding}</kbd>
                                            </div>
                                        )}
                                        {selectedCmd.when && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">When Clause</span>
                                                <code className="text-xs font-mono text-amber-600">{selectedCmd.when}</code>
                                            </div>
                                        )}
                                        <Separator />
                                        <div className="text-xs text-muted-foreground">
                                            Click <strong>Execute</strong> above or use the keyboard shortcut
                                            {selectedCmd.keybinding ? ` (${selectedCmd.keybinding})` : ''} to run this command.
                                        </div>
                                    </div>
                                </section>

                                {/* Programmatic usage */}
                                <section>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Code2 className="h-4 w-4 text-muted-foreground" />
                                        Programmatic Usage
                                    </h3>
                                    <div className="rounded-lg border overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                            <span className="text-[10px] font-mono text-muted-foreground">TypeScript</span>
                                            <button
                                                className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={() => copyToClipboard(
                                                    `const execute = useCommandRegistry((s) => s.execute);\nawait execute('${selectedCmd.id}');`,
                                                    'code',
                                                )}
                                            >
                                                {copied === 'code'
                                                    ? <span className="text-green-500">✓ Copied</span>
                                                    : <><Copy className="h-3 w-3" /> Copy</>}
                                            </button>
                                        </div>
                                        <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto">
                                            <div className="flex">
                                                <span className="w-6 shrink-0 text-right pr-3 text-muted-foreground/50 select-none">1</span>
                                                <span>
                                                    <span className="text-blue-400">const</span>{' '}
                                                    <span className="text-foreground">execute</span>{' = '}
                                                    <span className="text-yellow-500">useCommandRegistry</span>
                                                    {'((s) => s.execute);'}
                                                </span>
                                            </div>
                                            <div className="flex">
                                                <span className="w-6 shrink-0 text-right pr-3 text-muted-foreground/50 select-none">2</span>
                                                <span>
                                                    <span className="text-purple-400">await</span>{' '}
                                                    <span className="text-foreground">execute</span>
                                                    {'('}
                                                    <span className="text-emerald-400">'{selectedCmd.id}'</span>
                                                    {');'}
                                                </span>
                                            </div>
                                        </pre>
                                    </div>
                                </section>

                                {/* Related commands */}
                                <section>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-muted-foreground" />
                                        Related Commands
                                        {selectedCmd.group && (
                                            <Badge variant="outline" className="text-[10px] ml-1">{selectedCmd.group}</Badge>
                                        )}
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        {allCommands
                                            .filter((c) => c.group === selectedCmd.group && c.id !== selectedCmd.id)
                                            .map((cmd) => (
                                                <button
                                                    key={cmd.id}
                                                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors"
                                                    onClick={() => setSelectedId(cmd.id)}
                                                >
                                                    <span className="text-muted-foreground">
                                                        {getIcon(cmd.icon, 'h-3.5 w-3.5')}
                                                    </span>
                                                    <span className="text-xs flex-1">{cmd.label}</span>
                                                    <code className="text-[10px] font-mono text-muted-foreground">{cmd.id}</code>
                                                </button>
                                            ))}
                                        {allCommands.filter((c) => c.group === selectedCmd.group && c.id !== selectedCmd.id).length === 0 && (
                                            <div className="px-4 py-3 text-xs text-muted-foreground">
                                                No other commands in this group.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    ) : (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                <TerminalIcon className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="text-sm font-medium mb-1">Select a command</p>
                            <p className="text-xs max-w-[300px]">
                                Choose a command from the list to view its details, properties, and usage examples.
                            </p>
                        </div>
                    )}
                </div>

                {/* Properties panel */}
                {propertiesOpen && selectedCmd && (
                    <div className="w-64 border-l bg-background flex flex-col shrink-0 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPropertiesOpen(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Identity */}
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Identity</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="ID" value={selectedCmd.id} copyable onCopy={copyToClipboard} copied={copied} />
                                    <PropertyRow label="Label" value={selectedCmd.label} copyable onCopy={copyToClipboard} copied={copied} />
                                    <PropertyRow label="Group" value={selectedCmd.group ?? '—'} />
                                </div>
                            </div>
                            <Separator />
                            {/* Presentation */}
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Presentation</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Icon" value={selectedCmd.icon ?? '—'} />
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">Preview</span>
                                        <span className="text-foreground">{getIcon(selectedCmd.icon, 'h-4 w-4')}</span>
                                    </div>
                                </div>
                            </div>
                            <Separator />
                            {/* Binding */}
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Binding</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Shortcut" value={selectedCmd.keybinding ?? '—'} />
                                    <PropertyRow label="When" value={selectedCmd.when ?? 'Always'} />
                                </div>
                            </div>
                            <Separator />
                            {/* Runtime */}
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Runtime</div>
                                <div className="space-y-1.5">
                                    <PropertyRow
                                        label="Recent"
                                        value={recentIds.includes(selectedCmd.id) ? `#${recentIds.indexOf(selectedCmd.id) + 1}` : 'No'}
                                    />
                                    <PropertyRow label="Has Execute" value="Yes" />
                                </div>
                            </div>
                            <Separator />
                            {/* Actions */}
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</div>
                                <div className="space-y-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-1.5 text-xs"
                                        onClick={handleExecute}
                                    >
                                        <Play className="h-3 w-3" />
                                        Execute Command
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full gap-1.5 text-xs"
                                        onClick={() => copyToClipboard(selectedCmd.id, 'prop-id')}
                                    >
                                        <Copy className="h-3 w-3" />
                                        {copied === 'prop-id' ? 'Copied!' : 'Copy ID'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Status bar ── */}
            <div className="flex items-center justify-between px-4 py-1 border-t text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                    <span>{allCommands.length} commands</span>
                    <span>{groups.length} groups</span>
                    {searchQuery && <span>filter: "{searchQuery}"</span>}
                </div>
                <div className="flex items-center gap-3">
                    {selectedCmd && <span>{selectedCmd.id}</span>}
                    <span>⌘K to invoke</span>
                </div>
            </div>
        </div>
    );
}

// ── Property row helper ──

function PropertyRow({
    label,
    value,
    copyable,
    onCopy,
    copied,
}: {
    label: string;
    value: string;
    copyable?: boolean;
    onCopy?: (text: string, field: string) => void;
    copied?: string | null;
}) {
    const field = `prop-${label.toLowerCase()}`;
    return (
        <div className="flex items-center justify-between gap-2 group">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1">
                <span className="text-xs font-mono truncate max-w-[120px]">{value}</span>
                {copyable && onCopy && (
                    <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        onClick={() => onCopy(value, field)}
                    >
                        {copied === field
                            ? <span className="text-[9px] text-green-500">✓</span>
                            : <Copy className="h-3 w-3 text-muted-foreground" />}
                    </button>
                )}
            </div>
        </div>
    );
}
