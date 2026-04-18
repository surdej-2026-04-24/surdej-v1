import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ArrowLeft, ChevronRight, ChevronDown, PanelLeftClose, PanelRightClose,
    Search, File, Folder, FolderOpen, RefreshCw, X, Trash2,
    FileText, FileSpreadsheet, FileArchive, Image, HardDrive,
    Copy, Loader2, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, BASE_URL } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────

interface DocumentBlob {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    uploaderId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────

const API_BASE = BASE_URL;

function contentUrl(docId: string) {
    return `${API_BASE}/api/knowledge/documents/${docId}/content`;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getExtension(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() ?? '';
}

function getMimeIcon(mimeType: string) {
    if (mimeType === 'application/pdf')
        return { icon: FileText, color: 'text-red-500' };
    if (mimeType === 'application/zip')
        return { icon: FileArchive, color: 'text-amber-500' };
    if (mimeType.includes('spreadsheet'))
        return { icon: FileSpreadsheet, color: 'text-emerald-500' };
    if (mimeType.startsWith('image/'))
        return { icon: Image, color: 'text-violet-500' };
    return { icon: File, color: 'text-blue-400' };
}

function isViewable(mimeType: string): boolean {
    return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

// ─── Category tree structure ───────────────────────────────────

interface CategoryNode {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
}

const CATEGORY_TREE: CategoryNode[] = [
    { id: '', label: 'All Documents', icon: FolderOpen },
    { id: 'manual', label: 'Manuals', icon: Folder },
    { id: 'checklist', label: 'Checklists', icon: Folder },
    { id: 'handbook', label: 'Handbooks', icon: Folder },
    { id: 'equipment', label: 'Equipment', icon: Folder },
    { id: 'training', label: 'Training', icon: Folder },
    { id: 'marketing', label: 'Marketing', icon: Folder },
    { id: 'inventory', label: 'Inventory', icon: Folder },
    { id: 'maintenance', label: 'Maintenance', icon: Folder },
    { id: 'safety', label: 'Safety', icon: Folder },
    { id: 'forms', label: 'Forms', icon: Folder },
];

// ─── Main Component ────────────────────────────────────────────

export function DocumentsPage() {
    const navigate = useNavigate();

    const [documents, setDocuments] = useState<DocumentBlob[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Layout state
    const [explorerOpen, setExplorerOpen] = useState(true);
    const [propertiesOpen, setPropertiesOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchText, setSearchText] = useState('');

    // ─── Tab management ────────────────────────────────────────
    const [openTabs, setOpenTabs] = useState<string[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Drag-and-drop
    const [dragTabId, setDragTabId] = useState<string | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

    // Context menu
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
    const ctxRef = useRef<HTMLDivElement>(null);

    // Close context menu on outside click
    useEffect(() => {
        if (!ctxMenu) return;
        const handler = (e: MouseEvent) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [ctxMenu]);

    const fetchDocuments = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const params = new URLSearchParams();
            if (searchText) params.set('search', searchText);
            if (selectedCategory) params.set('category', selectedCategory);
            const query = params.toString();
            const data = await api.get<DocumentBlob[]>(`/knowledge/documents${query ? `?${query}` : ''}`);
            setDocuments(data);
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchText, selectedCategory]);

    useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this document?')) return;
        try {
            await api.del(`/knowledge/documents/${id}`);
            closeTab(id);
            await fetchDocuments(true);
        } catch (err) {
            console.error('Failed to delete document:', err);
        }
    };

    // ─── Tab operations ────────────────────────────────────────
    const openDocument = (id: string) => {
        if (!openTabs.includes(id)) {
            // Insert the new tab right after the active one
            setOpenTabs((prev) => {
                const activeIdx = prev.indexOf(activeTabId ?? '');
                if (activeIdx >= 0) {
                    const next = [...prev];
                    next.splice(activeIdx + 1, 0, id);
                    return next;
                }
                return [...prev, id];
            });
        }
        setActiveTabId(id);
    };

    const closeTab = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setOpenTabs((prev) => {
            const idx = prev.indexOf(id);
            const next = prev.filter((t) => t !== id);
            if (activeTabId === id) {
                // Focus the adjacent tab (prefer the one to the right, then left)
                const newActive = next.length > 0
                    ? next[Math.min(idx, next.length - 1)]!
                    : null;
                setActiveTabId(newActive);
            }
            return next;
        });
    };

    const closeOtherTabs = (keepId: string) => {
        setOpenTabs([keepId]);
        setActiveTabId(keepId);
        setCtxMenu(null);
    };

    const closeTabsToRight = (fromId: string) => {
        setOpenTabs((prev) => {
            const idx = prev.indexOf(fromId);
            const kept = prev.slice(0, idx + 1);
            if (activeTabId && !kept.includes(activeTabId)) {
                setActiveTabId(fromId);
            }
            return kept;
        });
        setCtxMenu(null);
    };

    const closeAllTabs = () => {
        setOpenTabs([]);
        setActiveTabId(null);
        setCtxMenu(null);
    };

    // ─── Drag-and-drop reorder handlers ────────────────────────
    const handleDragStart = (tabId: string) => {
        setDragTabId(tabId);
    };

    const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetIdx(targetIdx);
    };

    const handleDrop = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        if (!dragTabId) return;

        setOpenTabs((prev) => {
            const fromIdx = prev.indexOf(dragTabId);
            if (fromIdx === -1 || fromIdx === targetIdx) return prev;
            const next = [...prev];
            next.splice(fromIdx, 1);
            const insertAt = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
            next.splice(insertAt, 0, dragTabId);
            return next;
        });

        setDragTabId(null);
        setDropTargetIdx(null);
    };

    const handleDragEnd = () => {
        setDragTabId(null);
        setDropTargetIdx(null);
    };

    const activeDoc = documents.find((d) => d.id === activeTabId) ?? null;

    // Count per category for the explorer badge
    const categoryCounts = documents.reduce<Record<string, number>>((acc, d) => {
        const cat = (d.metadata as any)?.category ?? 'other';
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
    }, {});

    const totalSize = documents.reduce((sum, d) => sum + d.sizeBytes, 0);

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/knowledge')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back to Knowledge</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={explorerOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setExplorerOpen(!explorerOpen)}
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle explorer</TooltipContent>
                </Tooltip>

                <div className="flex-1 flex items-center justify-center">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                        <FolderOpen className="h-3 w-3" />
                        Document Explorer
                    </Badge>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => fetchDocuments(true)}
                            disabled={refreshing}
                        >
                            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                </Tooltip>

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
                {/* Explorer sidebar */}
                {explorerOpen && (
                    <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden">
                        {/* Explorer header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Categories
                            </span>
                            <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => fetchDocuments(true)}>
                                    <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
                                </Button>
                            </div>
                        </div>

                        {/* Search bar */}
                        <div className="px-2 py-1.5 border-b">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/60">
                                <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search files…"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    className="bg-transparent border-none outline-none text-[11px] w-full placeholder:text-muted-foreground/60"
                                />
                                {searchText && (
                                    <button onClick={() => setSearchText('')} className="text-muted-foreground hover:text-foreground">
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Category tree */}
                        <div className="flex-1 overflow-y-auto py-1 px-1">
                            {CATEGORY_TREE.map((cat) => {
                                const isSelected = selectedCategory === cat.id;
                                const CatIcon = isSelected && cat.id ? FolderOpen : cat.icon;
                                const count = cat.id ? (categoryCounts[cat.id] ?? 0) : documents.length;

                                return (
                                    <button
                                        key={cat.id}
                                        className={cn(
                                            'flex items-center gap-1.5 w-full text-left text-xs py-[5px] px-2 rounded-sm transition-colors',
                                            isSelected
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'hover:bg-muted/60 text-foreground/80',
                                        )}
                                        onClick={() => {
                                            setSelectedCategory(cat.id);
                                        }}
                                    >
                                        {cat.id ? (
                                            isSelected
                                                ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <span className="w-3 shrink-0" />
                                        )}
                                        <CatIcon className={cn(
                                            'h-3.5 w-3.5 shrink-0',
                                            cat.id ? 'text-amber-500' : 'text-blue-400',
                                        )} />
                                        <span className="truncate flex-1">{cat.label}</span>
                                        {count > 0 && (
                                            <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                                        )}
                                    </button>
                                );
                            })}

                            {/* File list inside explorer */}
                            {documents.length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                                        Files
                                    </div>
                                    {documents.map((doc) => {
                                        const mime = getMimeIcon(doc.mimeType);
                                        const DocIcon = mime.icon;
                                        const isActive = activeTabId === doc.id;

                                        return (
                                            <button
                                                key={doc.id}
                                                className={cn(
                                                    'flex items-center gap-1.5 w-full text-left text-xs py-[4px] px-2 rounded-sm transition-colors',
                                                    isActive
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'hover:bg-muted/60 text-foreground/80',
                                                )}
                                                onClick={() => openDocument(doc.id)}
                                                onDoubleClick={() => {
                                                    openDocument(doc.id);
                                                    if (!propertiesOpen) setPropertiesOpen(true);
                                                }}
                                            >
                                                <span className="w-3 shrink-0" />
                                                <DocIcon className={cn('h-3.5 w-3.5 shrink-0', mime.color)} />
                                                <span className="truncate">{doc.filename}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Explorer footer */}
                        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                            {Object.keys(categoryCounts).length} categor{Object.keys(categoryCounts).length !== 1 ? 'ies' : 'y'} · {documents.length} file{documents.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}

                {/* Main content area */}
                <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
                    {/* ── Tab strip with drag-and-drop reordering ── */}
                    {openTabs.length > 0 && (
                        <div className="flex items-center border-b bg-muted/20 shrink-0 relative">
                            <div className="flex items-center flex-1 overflow-x-auto scrollbar-none">
                                {openTabs.map((tabId, idx) => {
                                    const doc = documents.find((d) => d.id === tabId);
                                    if (!doc) return null;
                                    const mime = getMimeIcon(doc.mimeType);
                                    const TabIcon = mime.icon;
                                    const isActive = tabId === activeTabId;
                                    const isDragging = tabId === dragTabId;
                                    const isDropTarget = idx === dropTargetIdx && dragTabId !== tabId;

                                    return (
                                        <div
                                            key={tabId}
                                            className={cn(
                                                'relative flex items-center gap-1.5 pl-3 pr-1 py-1.5 text-xs border-r transition-all whitespace-nowrap shrink-0 cursor-pointer select-none group/tab',
                                                isActive
                                                    ? 'bg-background text-foreground'
                                                    : 'text-muted-foreground hover:bg-muted/40',
                                                isDragging && 'opacity-40',
                                            )}
                                            draggable
                                            onDragStart={() => handleDragStart(tabId)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => setActiveTabId(tabId)}
                                            onAuxClick={(e) => { if (e.button === 1) closeTab(tabId, e); }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setCtxMenu({ x: e.clientX, y: e.clientY, tabId });
                                            }}
                                        >
                                            {/* Active indicator */}
                                            {isActive && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                                            )}
                                            {/* Drop indicator */}
                                            {isDropTarget && (
                                                <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-primary rounded-full z-10" />
                                            )}

                                            <TabIcon className={cn('h-3 w-3 shrink-0', mime.color)} />
                                            <span className="max-w-[160px] truncate">{doc.filename}</span>
                                            <button
                                                className="ml-1 p-0.5 rounded hover:bg-muted/80 transition-colors opacity-0 group-hover/tab:opacity-100"
                                                onClick={(e) => closeTab(tabId, e)}
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* Drop zone past the last tab */}
                                {dragTabId && (
                                    <div
                                        className="w-6 shrink-0 self-stretch"
                                        onDragOver={(e) => handleDragOver(e, openTabs.length)}
                                        onDrop={(e) => handleDrop(e, openTabs.length)}
                                    />
                                )}
                            </div>

                            {/* Tab actions */}
                            <div className="flex items-center gap-0 px-1 border-l shrink-0">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={closeAllTabs}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Close all tabs</TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    )}

                    {/* ── Tab context menu ── */}
                    {ctxMenu && (
                        <div
                            ref={ctxRef}
                            className="fixed z-50 min-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
                            style={{ left: ctxMenu.x, top: ctxMenu.y }}
                        >
                            <CtxMenuItem
                                label="Close"
                                shortcut="⌘W"
                                onClick={() => { closeTab(ctxMenu.tabId); setCtxMenu(null); }}
                            />
                            <CtxMenuItem
                                label="Close Others"
                                onClick={() => closeOtherTabs(ctxMenu.tabId)}
                                disabled={openTabs.length <= 1}
                            />
                            <CtxMenuItem
                                label="Close Tabs to the Right"
                                onClick={() => closeTabsToRight(ctxMenu.tabId)}
                                disabled={openTabs.indexOf(ctxMenu.tabId) === openTabs.length - 1}
                            />
                            <div className="h-px bg-border my-1" />
                            <CtxMenuItem
                                label="Close All"
                                onClick={closeAllTabs}
                            />
                        </div>
                    )}

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 px-4 py-1.5 border-b text-[10px] text-muted-foreground">
                        <span
                            className="hover:text-foreground cursor-pointer"
                            onClick={() => { setSelectedCategory(''); setActiveTabId(null); }}
                        >
                            Documents
                        </span>
                        {selectedCategory && (
                            <>
                                <ChevronRight className="h-2.5 w-2.5" />
                                <span className="text-foreground font-medium capitalize">{selectedCategory}</span>
                            </>
                        )}
                        {activeDoc && (
                            <>
                                <ChevronRight className="h-2.5 w-2.5" />
                                <span className="text-foreground font-medium">{activeDoc.filename}</span>
                            </>
                        )}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-auto">
                        {activeDoc ? (
                            /* ─── Document Viewer ─── */
                            <DocumentViewer doc={activeDoc} onDelete={handleDelete} />
                        ) : loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                <FolderOpen className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium mb-1">No documents</p>
                                <p className="text-xs">
                                    {searchText ? 'Try a different search term.' : selectedCategory ? 'No documents in this category.' : 'Upload documents to get started.'}
                                </p>
                            </div>
                        ) : (
                            /* ─── File List (when no doc is open) ─── */
                            <div className="divide-y">
                                {/* Column header */}
                                <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20 sticky top-0 z-10">
                                    <span className="w-5" />
                                    <span className="flex-1">Name</span>
                                    <span className="w-20 text-right">Size</span>
                                    <span className="w-16 text-center">Type</span>
                                    <span className="w-20 text-right">Category</span>
                                    <span className="w-24 text-right">Date</span>
                                    <span className="w-16" />
                                </div>

                                {documents.map((doc) => {
                                    const mime = getMimeIcon(doc.mimeType);
                                    const DocIcon = mime.icon;
                                    const meta = doc.metadata as Record<string, unknown> | null;
                                    const docCategory = (meta?.category as string) ?? '—';
                                    const viewable = isViewable(doc.mimeType);

                                    return (
                                        <button
                                            key={doc.id}
                                            className={cn(
                                                'flex items-center gap-3 w-full text-left px-4 py-2.5 text-xs transition-colors group',
                                                'hover:bg-muted/40 text-foreground/80',
                                            )}
                                            onClick={() => openDocument(doc.id)}
                                        >
                                            <DocIcon className={cn('h-4 w-4 shrink-0', mime.color)} />
                                            <span className="flex-1 truncate font-medium">{doc.filename}</span>
                                            <span className="w-20 text-right text-muted-foreground tabular-nums">{formatBytes(doc.sizeBytes)}</span>
                                            <span className="w-16 text-center">
                                                <Badge variant="outline" className="text-[9px] px-1 py-0">{getExtension(doc.filename)}</Badge>
                                            </span>
                                            <span className="w-20 text-right text-muted-foreground capitalize text-[11px]">{docCategory}</span>
                                            <span className="w-24 text-right text-muted-foreground tabular-nums">
                                                {new Date(doc.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="w-16 flex justify-end gap-1">
                                                {viewable && (
                                                    <span className="p-1 rounded opacity-0 group-hover:opacity-100 text-primary transition-all">
                                                        <Eye className="h-3 w-3" />
                                                    </span>
                                                )}
                                                <button
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Properties pane */}
                {propertiesOpen && activeDoc && (
                    <div className="w-64 border-l bg-background flex flex-col shrink-0 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPropertiesOpen(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* File icon */}
                            <div className="flex flex-col items-center py-3">
                                {(() => {
                                    const m = getMimeIcon(activeDoc.mimeType);
                                    const I = m.icon;
                                    return <I className={cn('h-10 w-10 mb-2', m.color)} />;
                                })()}
                                <span className="text-sm font-medium text-center break-all">{activeDoc.filename}</span>
                            </div>

                            <Separator />

                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">File</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Name" value={activeDoc.filename} />
                                    <PropertyRow label="Size" value={formatBytes(activeDoc.sizeBytes)} />
                                    <PropertyRow label="Type" value={activeDoc.mimeType.split('/').pop() ?? 'unknown'} />
                                    <PropertyRow label="Extension" value={getExtension(activeDoc.filename)} />
                                    <PropertyRow label="Path" value={activeDoc.storagePath} copyable />
                                </div>
                            </div>

                            <Separator />

                            {activeDoc.metadata && Object.keys(activeDoc.metadata).length > 0 && (
                                <>
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Metadata</div>
                                        <div className="space-y-1.5">
                                            {Object.entries(activeDoc.metadata).map(([key, value]) => (
                                                <PropertyRow
                                                    key={key}
                                                    label={key}
                                                    value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <Separator />
                                </>
                            )}

                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dates</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Created" value={new Date(activeDoc.createdAt).toLocaleString()} />
                                </div>
                            </div>

                            <Separator />

                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full gap-1.5 text-xs"
                                    onClick={() => handleDelete(activeDoc.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Delete Document
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Status bar ── */}
            <div className="flex items-center justify-between px-4 py-1 border-t text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(totalSize)}
                    </span>
                    <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
                    <span>{openTabs.length} open</span>
                </div>
                <div className="flex items-center gap-3">
                    {selectedCategory && <span className="capitalize">{selectedCategory}</span>}
                    {activeDoc && <span>{activeDoc.filename}</span>}
                </div>
            </div>
        </div>
    );
}

// ─── Document Viewer ───────────────────────────────────────────

function DocumentViewer({ doc, onDelete }: { doc: DocumentBlob; onDelete: (id: string) => void }) {
    const isPdf = doc.mimeType === 'application/pdf';
    const isImage = doc.mimeType.startsWith('image/');
    const url = contentUrl(doc.id);

    if (isPdf) {
        return (
            <div className="flex flex-col h-full">
                {/* Mini toolbar */}
                <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/10 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                        <span className="font-medium text-foreground">{doc.filename}</span>
                        <span>·</span>
                        <span>{formatBytes(doc.sizeBytes)}</span>
                        {(doc.metadata as any)?.pages && (
                            <>
                                <span>·</span>
                                <span>{(doc.metadata as any).pages} pages</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                        >
                            <Eye className="h-3 w-3" />
                            Open in new tab
                        </a>
                    </div>
                </div>

                {/* PDF embed */}
                <div className="flex-1 bg-muted/5">
                    <iframe
                        src={url}
                        className="w-full h-full border-0"
                        title={doc.filename}
                    />
                </div>
            </div>
        );
    }

    if (isImage) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-muted/5">
                <img
                    src={url}
                    alt={doc.filename}
                    className="max-w-full max-h-[70vh] rounded-lg shadow-lg object-contain"
                />
                <p className="text-sm text-muted-foreground mt-4">{doc.filename}</p>
            </div>
        );
    }

    // Non-viewable file — show info card
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-muted/5">
            <div className="rounded-2xl bg-muted/30 p-8 mb-6 border">
                {(() => {
                    const m = getMimeIcon(doc.mimeType);
                    const I = m.icon;
                    return <I className={cn('h-16 w-16', m.color)} />;
                })()}
            </div>
            <h2 className="text-lg font-semibold mb-1">{doc.filename}</h2>
            <p className="text-sm text-muted-foreground mb-1">{doc.mimeType}</p>
            <p className="text-sm text-muted-foreground mb-6">{formatBytes(doc.sizeBytes)}</p>
            <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">{getExtension(doc.filename)}</Badge>
                {(doc.metadata as any)?.category && (
                    <Badge variant="secondary" className="text-xs capitalize">{(doc.metadata as any).category}</Badge>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-8 max-w-sm">
                Preview is not available for this file type. The content will be viewable once the file is uploaded to storage.
            </p>
        </div>
    );
}

// ─── Context Menu Item ─────────────────────────────────────────

function CtxMenuItem({ label, shortcut, onClick, disabled }: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            className={cn(
                'flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors',
                disabled
                    ? 'text-muted-foreground/40 cursor-default'
                    : 'text-foreground hover:bg-muted',
            )}
            onClick={() => { if (!disabled) onClick(); }}
            disabled={disabled}
        >
            <span>{label}</span>
            {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
        </button>
    );
}

// ─── Property Row ──────────────────────────────────────────────

function PropertyRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex items-center justify-between gap-2 group">
            <span className="text-xs text-muted-foreground capitalize">{label}</span>
            <div className="flex items-center gap-1">
                <span className="text-xs font-mono truncate max-w-[120px]">{value}</span>
                {copyable && (
                    <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        onClick={() => {
                            navigator.clipboard.writeText(value);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }}
                    >
                        {copied ? (
                            <span className="text-[9px] text-green-500">✓</span>
                        ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
