import { useState, useEffect, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { useCommandRegistry, type CommandDefinition } from '@/core/commands/CommandRegistry';
import { useContextKeys } from '@/core/commands/ContextKeyService';
import {
    Home, Layers, MessageSquare, Settings, Zap, Eye, Palette,
    MessageCircle, Moon, PanelLeft, LogOut, Search, Keyboard, Code2,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
    Home, Layers, MessageSquare, Settings, Zap, Eye, Palette,
    MessageCircle, Moon, PanelLeft, LogOut, Search, Code2,
};

function getIcon(name?: string) {
    if (!name) return null;
    const Icon = ICON_MAP[name];
    return Icon ? <Icon size={16} /> : null;
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const commands = useCommandRegistry((s) => s.search);
    const execute = useCommandRegistry((s) => s.execute);
    const recentIds = useCommandRegistry((s) => s.recentIds);
    const evaluate = useContextKeys((s) => s.evaluate);
    const inputRef = useRef<HTMLInputElement>(null);

    // ⌘K globally + custom open event
    useEffect(() => {
        const keyHandler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        const openHandler = () => setOpen(true);
        window.addEventListener('keydown', keyHandler);
        window.addEventListener('surdej:open-command-palette', openHandler);
        return () => {
            window.removeEventListener('keydown', keyHandler);
            window.removeEventListener('surdej:open-command-palette', openHandler);
        };
    }, [open]);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const handleSelect = useCallback(
        (id: string) => {
            setOpen(false);
            execute(id);
        },
        [execute],
    );

    // Filter commands by `when` expression
    const allResults = commands(query).filter((cmd) => evaluate(cmd.when ?? ''));

    // Group by group name
    const groups = new Map<string, CommandDefinition[]>();
    for (const cmd of allResults) {
        const group = cmd.group ?? 'Commands';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(cmd);
    }

    // Build recent list
    const recentCommands = recentIds
        .map((id) => allResults.find((c) => c.id === id))
        .filter(Boolean) as CommandDefinition[];

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in"
                onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <div className="fixed inset-x-0 top-[15%] z-50 flex justify-center px-4">
                <Command
                    className="w-full max-w-[540px] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
                    shouldFilter={false}
                >
                    {/* Input */}
                    <div className="flex items-center gap-3 px-4 border-b border-border">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Command.Input
                            ref={inputRef}
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Type a command or search…"
                            className="flex-1 h-12 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                        />
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <Command.List className="max-h-[320px] overflow-y-auto p-2">
                        <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                            No commands found.
                        </Command.Empty>

                        {/* Recent */}
                        {!query && recentCommands.length > 0 && (
                            <Command.Group
                                heading={
                                    <span className="text-xs font-medium uppercase tracking-wider px-2 text-muted-foreground">
                                        Recent
                                    </span>
                                }
                            >
                                {recentCommands.slice(0, 5).map((cmd) => (
                                    <CommandItem key={`recent-${cmd.id}`} cmd={cmd} onSelect={handleSelect} />
                                ))}
                            </Command.Group>
                        )}

                        {/* Grouped results */}
                        {Array.from(groups.entries()).map(([group, cmds]) => (
                            <Command.Group
                                key={group}
                                heading={
                                    <span className="text-xs font-medium uppercase tracking-wider px-2 text-muted-foreground">
                                        {group}
                                    </span>
                                }
                            >
                                {cmds.map((cmd) => (
                                    <CommandItem key={cmd.id} cmd={cmd} onSelect={handleSelect} />
                                ))}
                            </Command.Group>
                        ))}
                    </Command.List>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <Keyboard size={12} /> Navigate
                            </span>
                            <span>↵ Select</span>
                        </div>
                        <span>Surdej Command Palette</span>
                    </div>
                </Command>
            </div>
        </>
    );
}

function CommandItem({
    cmd,
    onSelect,
}: {
    cmd: CommandDefinition;
    onSelect: (id: string) => void;
}) {
    return (
        <Command.Item
            value={cmd.id}
            onSelect={() => onSelect(cmd.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm text-foreground data-[selected=true]:bg-accent"
        >
            <span className="text-muted-foreground">
                {getIcon(cmd.icon)}
            </span>
            <span className="flex-1 truncate">{cmd.label}</span>
            {cmd.keybinding && (
                <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground ml-auto">
                    {cmd.keybinding}
                </kbd>
            )}
        </Command.Item>
    );
}
