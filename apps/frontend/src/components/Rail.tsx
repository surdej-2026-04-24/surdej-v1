/**
 * Rail — VS Code–style Activity Bar.
 *
 * A narrow vertical or horizontal strip of icon buttons:
 *  • Draggable / reorderable via native HTML drag-and-drop
 *  • Overflow menu when items exceed the visible area
 *  • Optional badge counts per item
 *  • Top (primary) and bottom (secondary/pinned) sections
 *  • Active-state indicator bar
 *
 * Designed to sit alongside the sidebar as a sub-navigation controller.
 */

import {
    useState, useCallback, useRef, useEffect, useMemo,
    type ReactNode,
} from 'react';
import {
    Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────── */

export interface RailItem {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number | string;
    /** If true, item is pinned to the bottom section (like Settings in VS Code) */
    pinned?: boolean;
}

export interface RailProps {
    items: RailItem[];
    activeId?: string | null;
    onSelect?: (id: string) => void;
    onReorder?: (items: RailItem[]) => void;
    /** Maximum visible items before showing overflow — 0 = auto-detect */
    maxVisible?: number;
    /** Visual position side — affects active indicator bar placement */
    position?: 'left' | 'right';
    className?: string;
}

/* ─── Component ───────────────────────────────────────── */

export function Rail({
    items,
    activeId,
    onSelect,
    onReorder,
    maxVisible: maxVisibleProp = 0,
    position = 'left',
    className,
}: RailProps) {
    const [orderedItems, setOrderedItems] = useState(items);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [computedMax, setComputedMax] = useState(0);

    // Sync external items changes
    useEffect(() => {
        setOrderedItems(items);
    }, [items]);

    // Auto-detect max visible from container height
    useEffect(() => {
        if (maxVisibleProp > 0) {
            setComputedMax(maxVisibleProp);
            return;
        }
        const el = containerRef.current;
        if (!el) return;

        const ro = new ResizeObserver(([entry]) => {
            const h = entry.contentRect.height;
            // Each icon button ≈ 48px, pinned section ≈ 56px.
            // Reserve space for pinned + overflow button + padding.
            const pinnedCount = orderedItems.filter((i) => i.pinned).length;
            const reservedPx = pinnedCount * 48 + 56 + 24; // pinned icons + overflow + padding
            const available = Math.max(1, Math.floor((h - reservedPx) / 48));
            setComputedMax(available);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [maxVisibleProp, orderedItems]);

    // Split into primary (top) and pinned (bottom)
    const { primary, pinned } = useMemo(() => {
        const p: RailItem[] = [];
        const b: RailItem[] = [];
        orderedItems.forEach((item) => {
            if (item.pinned) b.push(item);
            else p.push(item);
        });
        return { primary: p, pinned: b };
    }, [orderedItems]);

    const maxVisible = maxVisibleProp > 0 ? maxVisibleProp : computedMax;
    const visiblePrimary = maxVisible > 0 ? primary.slice(0, maxVisible) : primary;
    const overflowPrimary = maxVisible > 0 ? primary.slice(maxVisible) : [];

    /* ── Drag handlers ────────────────────────────── */

    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        // Make the drag image semi-transparent
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.4';
        }
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        setDragId(null);
        setDragOverId(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '';
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(id);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverId(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        if (!fromId || fromId === targetId) {
            setDragId(null);
            setDragOverId(null);
            return;
        }

        setOrderedItems((prev) => {
            const items = [...prev];
            const fromIdx = items.findIndex((i) => i.id === fromId);
            const toIdx = items.findIndex((i) => i.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = items.splice(fromIdx, 1);
            items.splice(toIdx, 0, moved);
            onReorder?.(items);
            return items;
        });

        setDragId(null);
        setDragOverId(null);
    }, [onReorder]);

    /* ── Render helpers ───────────────────────────── */

    const renderButton = (item: RailItem, inOverflow = false) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        const isDragging = item.id === dragId;
        const isDragOver = item.id === dragOverId;

        if (inOverflow) {
            return (
                <DropdownMenuItem
                    key={item.id}
                    className="flex items-center gap-2 text-xs"
                    onClick={() => onSelect?.(item.id)}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge != null && (
                        <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                            {item.badge}
                        </Badge>
                    )}
                </DropdownMenuItem>
            );
        }

        return (
            <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                    <button
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, item.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, item.id)}
                        onClick={() => onSelect?.(item.id)}
                        className={cn(
                            'relative flex items-center justify-center w-12 h-12 cursor-pointer',
                            'transition-all duration-200 group/rail-btn',
                            'hover:bg-accent/60',
                            isActive && 'text-foreground',
                            !isActive && 'text-muted-foreground/70 hover:text-foreground',
                            isDragging && 'opacity-40 scale-90',
                            isDragOver && !isDragging && 'bg-accent/80 scale-105',
                        )}
                        aria-label={item.label}
                    >
                        {/* Active indicator bar */}
                        {isActive && (
                            <div
                                className={cn(
                                    'absolute top-1 bottom-1 w-[2px] rounded-full bg-primary transition-all duration-200',
                                    position === 'left' ? 'left-0' : 'right-0',
                                )}
                            />
                        )}

                        <Icon className={cn(
                            'h-[22px] w-[22px] transition-transform duration-200',
                            'group-hover/rail-btn:scale-110',
                        )} />

                        {/* Badge */}
                        {item.badge != null && (
                            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none px-1">
                                {item.badge}
                            </span>
                        )}

                        {/* Drag-over drop indicator line */}
                        {isDragOver && !isDragging && (
                            <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary animate-pulse" />
                        )}
                    </button>
                </TooltipTrigger>
                <TooltipContent side={position === 'left' ? 'right' : 'left'} className="text-xs">
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex flex-col items-center bg-muted/30 border-r shrink-0 w-12 select-none',
                position === 'right' && 'border-r-0 border-l',
                className,
            )}
        >
            {/* ── Primary items (top) ── */}
            <div className="flex flex-col items-center flex-1 min-h-0">
                {visiblePrimary.map((item) => renderButton(item))}

                {/* Overflow button */}
                {overflowPrimary.length > 0 && (
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className={cn(
                                            'relative flex items-center justify-center w-12 h-12 cursor-pointer',
                                            'text-muted-foreground/50 hover:text-foreground hover:bg-accent/60',
                                            'transition-all duration-200',
                                        )}
                                        aria-label={`${overflowPrimary.length} more items`}
                                    >
                                        <MoreHorizontal className="h-5 w-5" />
                                        <span className="absolute top-1.5 right-1 text-[8px] font-bold text-muted-foreground">
                                            +{overflowPrimary.length}
                                        </span>
                                    </button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side={position === 'left' ? 'right' : 'left'} className="text-xs">
                                {overflowPrimary.length} more items
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent side={position === 'left' ? 'right' : 'left'} align="start" className="w-48">
                            <DropdownMenuLabel className="text-[10px]">More Items</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {overflowPrimary.map((item) => renderButton(item, true))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* ── Pinned items (bottom) ── */}
            {pinned.length > 0 && (
                <div className="flex flex-col items-center border-t py-1">
                    {pinned.map((item) => renderButton(item))}
                </div>
            )}
        </div>
    );
}
