import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ArrowLeft, ChevronRight, ChevronDown, PanelLeftClose, PanelRightClose,
    Search, File, Folder, FolderOpen, Settings, Plus, RefreshCw, X,
    MoreHorizontal, Copy, FileText, FileCode, Image, Package,
    Layout, Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

// ── Demo file tree data ──

interface TreeItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    icon?: React.FC<{ className?: string }>;
    children?: TreeItem[];
}

const DEMO_TREE: TreeItem[] = [
    {
        id: 'src', name: 'src', type: 'folder', children: [
            {
                id: 'src/components', name: 'components', type: 'folder', children: [
                    { id: 'src/components/Button.tsx', name: 'Button.tsx', type: 'file', icon: FileCode },
                    { id: 'src/components/Card.tsx', name: 'Card.tsx', type: 'file', icon: FileCode },
                    { id: 'src/components/Dialog.tsx', name: 'Dialog.tsx', type: 'file', icon: FileCode },
                ],
            },
            {
                id: 'src/pages', name: 'pages', type: 'folder', children: [
                    { id: 'src/pages/Home.tsx', name: 'Home.tsx', type: 'file', icon: FileCode },
                    { id: 'src/pages/Settings.tsx', name: 'Settings.tsx', type: 'file', icon: FileCode },
                ],
            },
            { id: 'src/App.tsx', name: 'App.tsx', type: 'file', icon: FileCode },
            { id: 'src/main.tsx', name: 'main.tsx', type: 'file', icon: FileCode },
            { id: 'src/index.css', name: 'index.css', type: 'file', icon: FileText },
        ],
    },
    {
        id: 'public', name: 'public', type: 'folder', children: [
            { id: 'public/logo.svg', name: 'logo.svg', type: 'file', icon: Image },
            { id: 'public/favicon.ico', name: 'favicon.ico', type: 'file', icon: Image },
        ],
    },
    { id: 'package.json', name: 'package.json', type: 'file', icon: Package },
    { id: 'tsconfig.json', name: 'tsconfig.json', type: 'file', icon: Settings },
    { id: 'README.md', name: 'README.md', type: 'file', icon: FileText },
];

// ── Demo tab/file content ──

const FILE_CONTENT: Record<string, string> = {
    'src/App.tsx': `import { Routes, Route } from 'react-router';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
        </Routes>
    );
}`,
    'src/components/Button.tsx': `import { cn } from '@/lib/utils';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    onClick?: () => void;
}

export function Button({ variant = 'primary', size = 'md', children, onClick }: ButtonProps) {
    return (
        <button
            className={cn('rounded-lg font-medium transition-colors', variantStyles[variant], sizeStyles[size])}
            onClick={onClick}
        >
            {children}
        </button>
    );
}`,
    'package.json': `{
    "name": "demo-project",
    "version": "1.0.0",
    "private": true,
    "scripts": {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview"
    },
    "dependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-router": "^7.0.0"
    }
}`,
    'README.md': `# Demo Project

This is a sample project structure used to 
demonstrate the VS Code Explorer layout.

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\``,
};

// ── Main component ──

export function VscodeExplorerSample() {
    const navigate = useNavigate();

    const [explorerOpen, setExplorerOpen] = useState(true);
    const [propertiesOpen, setPropertiesOpen] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/components']));
    const [selectedFileId, setSelectedFileId] = useState<string | null>('src/App.tsx');
    const [openTabs, setOpenTabs] = useState<string[]>(['src/App.tsx']);

    const toggleFolder = useCallback((id: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectFile = useCallback((id: string) => {
        setSelectedFileId(id);
        setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const closeTab = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenTabs((prev) => {
            const next = prev.filter((t) => t !== id);
            if (selectedFileId === id) {
                setSelectedFileId(next.length > 0 ? next[next.length - 1] : null);
            }
            return next;
        });
    }, [selectedFileId]);

    const fileNameFromId = (id: string) => id.split('/').pop() ?? id;
    const activeContent = selectedFileId ? (FILE_CONTENT[selectedFileId] ?? `// ${selectedFileId}\n// No preview available for this file.`) : null;

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/developer/samples/layouts')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back to samples</TooltipContent>
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
                        <Layout className="h-3 w-3" />
                        VS Code Explorer Layout — Sample
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
                {/* Explorer sidebar */}
                {explorerOpen && (
                    <div className="w-60 border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden">
                        {/* Explorer header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
                            <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                    <Plus className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                    <MoreHorizontal className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Search bar */}
                        <div className="px-2 py-1.5 border-b">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/60 text-muted-foreground">
                                <Search className="h-3 w-3 shrink-0" />
                                <span className="text-[10px]">Search files…</span>
                            </div>
                        </div>

                        {/* Tree */}
                        <div className="flex-1 overflow-y-auto py-1 px-1">
                            {DEMO_TREE.map((item) => (
                                <TreeNode
                                    key={item.id}
                                    item={item}
                                    depth={0}
                                    expandedFolders={expandedFolders}
                                    selectedId={selectedFileId}
                                    onToggleFolder={toggleFolder}
                                    onSelectFile={selectFile}
                                />
                            ))}
                        </div>

                        {/* Explorer footer */}
                        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                            5 folders · 10 files
                        </div>
                    </div>
                )}

                {/* Editor area */}
                <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
                    {/* Tabs */}
                    {openTabs.length > 0 && (
                        <div className="flex items-center border-b bg-muted/20 overflow-x-auto shrink-0">
                            {openTabs.map((tabId) => (
                                <button
                                    key={tabId}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r transition-colors whitespace-nowrap shrink-0',
                                        tabId === selectedFileId
                                            ? 'bg-background text-foreground border-b-2 border-b-primary'
                                            : 'text-muted-foreground hover:bg-muted/40',
                                    )}
                                    onClick={() => setSelectedFileId(tabId)}
                                >
                                    <FileCode className="h-3 w-3 shrink-0" />
                                    <span>{fileNameFromId(tabId)}</span>
                                    <button
                                        className="ml-1 p-0.5 rounded hover:bg-muted transition-colors opacity-50 hover:opacity-100"
                                        onClick={(e) => closeTab(tabId, e)}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Breadcrumb bar */}
                    {selectedFileId && (
                        <div className="flex items-center gap-1 px-4 py-1 border-b text-[10px] text-muted-foreground">
                            {selectedFileId.split('/').map((segment, i, arr) => (
                                <span key={i} className="flex items-center gap-1">
                                    {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                                    <span className={cn(i === arr.length - 1 && 'text-foreground font-medium')}>{segment}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Content area */}
                    <div className="flex-1 overflow-auto">
                        {activeContent ? (
                            <div className="relative">
                                {/* Line numbers + code */}
                                <pre className="p-4 text-xs leading-relaxed font-mono">
                                    {activeContent.split('\n').map((line, i) => (
                                        <div key={i} className="flex">
                                            <span className="w-8 shrink-0 text-right pr-4 text-muted-foreground/50 select-none">{i + 1}</span>
                                            <span className="text-foreground/90">{line || ' '}</span>
                                        </div>
                                    ))}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                <Code2 className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium mb-1">No file open</p>
                                <p className="text-xs">Select a file from the explorer to view it here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Properties pane */}
                {propertiesOpen && selectedFileId && (
                    <div className="w-64 border-l bg-background flex flex-col shrink-0 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPropertiesOpen(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">File</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Name" value={fileNameFromId(selectedFileId)} />
                                    <PropertyRow label="Path" value={selectedFileId} copyable />
                                    <PropertyRow label="Type" value={selectedFileId.endsWith('.tsx') ? 'TypeScript JSX' : selectedFileId.endsWith('.ts') ? 'TypeScript' : selectedFileId.endsWith('.css') ? 'CSS' : selectedFileId.endsWith('.json') ? 'JSON' : selectedFileId.endsWith('.md') ? 'Markdown' : 'Unknown'} />
                                    <PropertyRow label="Size" value={`${(FILE_CONTENT[selectedFileId]?.length ?? 0).toLocaleString()} bytes`} />
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stats</div>
                                <div className="space-y-1.5">
                                    <PropertyRow label="Lines" value={String(FILE_CONTENT[selectedFileId]?.split('\n').length ?? 0)} />
                                    <PropertyRow label="Encoding" value="UTF-8" />
                                    <PropertyRow label="EOL" value="LF" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Status bar ── */}
            <div className="flex items-center justify-between px-4 py-1 border-t text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                    <span>Ln 1, Col 1</span>
                    <span>UTF-8</span>
                    <span>LF</span>
                </div>
                <div className="flex items-center gap-3">
                    {selectedFileId && <span>{fileNameFromId(selectedFileId)}</span>}
                    <span>{openTabs.length} open</span>
                </div>
            </div>
        </div>
    );
}

// ── Tree node ──

function TreeNode({
    item,
    depth,
    expandedFolders,
    selectedId,
    onToggleFolder,
    onSelectFile,
}: {
    item: TreeItem;
    depth: number;
    expandedFolders: Set<string>;
    selectedId: string | null;
    onToggleFolder: (id: string) => void;
    onSelectFile: (id: string) => void;
}) {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = selectedId === item.id;
    const Icon = isFolder
        ? (isExpanded ? FolderOpen : Folder)
        : (item.icon ?? File);

    return (
        <div>
            <button
                className={cn(
                    'flex items-center gap-1.5 w-full text-left text-xs py-[3px] pr-2 rounded-sm transition-colors',
                    isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/60 text-foreground/80',
                )}
                style={{ paddingLeft: `${depth * 14 + 6}px` }}
                onClick={() => {
                    if (isFolder) {
                        onToggleFolder(item.id);
                    } else {
                        onSelectFile(item.id);
                    }
                }}
            >
                {isFolder ? (
                    isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                    <span className="w-3 shrink-0" />
                )}
                <Icon className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isFolder ? 'text-amber-500' : 'text-blue-400',
                )} />
                <span className="truncate">{item.name}</span>
            </button>
            {isFolder && isExpanded && item.children?.map((child) => (
                <TreeNode
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    expandedFolders={expandedFolders}
                    selectedId={selectedId}
                    onToggleFolder={onToggleFolder}
                    onSelectFile={onSelectFile}
                />
            ))}
        </div>
    );
}

// ── Property row ──

function PropertyRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex items-center justify-between gap-2 group">
            <span className="text-xs text-muted-foreground">{label}</span>
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
