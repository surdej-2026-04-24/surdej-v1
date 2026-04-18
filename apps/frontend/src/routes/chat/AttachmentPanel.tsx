import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X, Loader2, LayoutPanelLeft, LayoutPanelTop, Code2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_URL } from '@/lib/api';
const API_BASE = BASE_URL;
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface AttachedFile {
    id: string;
    name: string;
    isLoading: boolean;
    error?: string;
    pollInterval?: number;
    storagePath?: string;
    mimeType?: string;
}

interface AttachmentPanelProps {
    files: AttachedFile[];
    onCloseFile: (id: string) => void;
    onReorder: (draggedId: string, targetId: string) => void;
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
    side?: 'left' | 'right';
}

/** Renders extracted markdown for non-PDF office docs (docx, xlsx, pptx) */
function OfficeDocPreview({ file }: { file: AttachedFile }) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!file.storagePath) {
            setContent('Udtrukket tekst er ikke tilgængelig.');
            setLoading(false);
            return;
        }
        const mdPath = file.storagePath.replace(/\.[^/.]+$/, '.md');
        setLoading(true);
        fetch(`${BASE_URL}/blobs/storage/${mdPath}`)
            .then(res => {
                if (!res.ok) throw new Error('No markdown');
                return res.text();
            })
            .then(text => setContent(text))
            .catch(() => setContent('Udtrukket tekst er ikke tilgængelig for dette dokument endnu. Dokumentet er muligvis stadig under behandling.'))
            .finally(() => setLoading(false));
    }, [file.id, file.storagePath]);

    const ext = file.name.split('.').pop()?.toUpperCase() || 'DOC';
    const extColors: Record<string, string> = {
        DOCX: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        XLSX: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        PPTX: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    const colorClass = extColors[ext] || 'bg-muted/10 text-muted-foreground border-border/40';

    return (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-background">
            {/* File type badge bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/10">
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", colorClass)}>{ext}</span>
                <span className="text-xs text-muted-foreground truncate">{file.name}</span>
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Indlæser dokumentindhold...
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-5 md-preview prose prose-sm dark:prose-invert prose-headings:font-medium prose-p:text-muted-foreground prose-a:text-primary max-w-none text-sm leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{content ?? ''}</Markdown>
                </div>
            )}
        </div>
    );
}

export function AttachmentPanel({
    files,
    onCloseFile,
    onReorder,
    activeTabId,
    setActiveTabId,
    width,
    onResizeStart,
    side = 'left'
}: AttachmentPanelProps) {
    const [dragTabId, setDragTabId] = useState<string | null>(null);
    const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
    const [splitMode, setSplitMode] = useState<'pdf' | 'split'>('pdf');
    const [mdContent, setMdContent] = useState<string | null>(null);
    const [mdLoading, setMdLoading] = useState(false);

    const activeFile = files.find(f => f.id === activeTabId);

    // Auto-select first tab if none is selected
    useEffect(() => {
        if (files.length > 0 && !activeTabId) {
            setActiveTabId(files[0].id);
        } else if (files.length === 0 && activeTabId) {
            setActiveTabId(null);
        } else if (activeTabId && !files.find(f => f.id === activeTabId)) {
             setActiveTabId(files[0]?.id || null);
        }
    }, [files, activeTabId, setActiveTabId]);

    useEffect(() => {
        if (activeFile && !activeFile.isLoading && splitMode === 'split') {
            const mdPath = activeFile.storagePath?.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, '.md');
            if (mdPath) {
                setMdLoading(true);
                fetch(`${BASE_URL}/blobs/storage/${mdPath}`)
                    .then(res => {
                        if (!res.ok) throw new Error('No markdown');
                        return res.text();
                    })
                    .then(text => setMdContent(text))
                    .catch(() => setMdContent("Udtrukket tekst er ikke tilgængelig for dette dokument endnu."))
                    .finally(() => setMdLoading(false));
            } else {
                 setMdContent("Udtrukket tekst er ikke tilgængelig.");
            }
        }
    }, [activeFile?.id, activeFile?.isLoading, splitMode, activeFile?.storagePath]);


    const handleDragStart = (id: string, e: React.DragEvent) => {
        setDragTabId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (id: string, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverTabId(id);
    };

    const handleDrop = (id: string, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverTabId(null);
        if (dragTabId && dragTabId !== id) {
            onReorder(dragTabId, id);
        }
        setDragTabId(null);
    };

    if (files.length === 0) return null;

    return (
        <div style={{ width }} className={cn("shrink-0 flex flex-col border-border/50 bg-background relative group", side === 'right' ? 'border-l' : 'border-r')}>
            <div className="flex bg-muted/20 border-b border-border/50 overflow-x-auto hide-scrollbar sticky top-0 z-10 shrink-0">
                {files.map(file => (
                    <div
                        key={file.id}
                        draggable
                        onDragStart={(e) => handleDragStart(file.id, e)}
                        onDragOver={(e) => handleDragOver(file.id, e)}
                        onDrop={(e) => handleDrop(file.id, e)}
                        onClick={() => setActiveTabId(file.id)}
                        className={cn(
                            "group/tab relative flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] border-r border-border/50 cursor-pointer select-none text-xs transition-colors",
                            activeTabId === file.id ? "bg-background text-foreground shrink-0 shadow-[inset_0_2px_0_0_hsl(var(--primary))]" : "text-muted-foreground hover:bg-muted/50",
                            dragOverTabId === file.id && "bg-primary/5",
                            file.error && "text-destructive"
                        )}
                        title={file.name}
                    >
                        <FileText className={cn("h-3.5 w-3.5 shrink-0", activeTabId === file.id ? "text-primary" : "text-muted-foreground/70")} />
                        <span className="truncate flex-1 font-medium">{file.name}</span>
                        {file.isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin shrink-0 text-blue-500" />
                        ) : (
                             file.error && <X className="h-3 w-3 shrink-0 text-destructive" />
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onCloseFile(file.id); }}
                            className="opacity-0 group-hover/tab:opacity-100 hover:text-destructive hover:bg-destructive/10 p-0.5 rounded transition-all ml-1 shrink-0"
                        >
                            <X className="h-3 w-3" />
                        </button>
                        
                        {/* Progress indicator overlay on tab if loading */}
                        {file.isLoading && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500/20 overflow-hidden">
                                 <div className="h-full bg-blue-500 animate-pulse w-1/2" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-muted/5">
                {/* Actions Toolbar */}
                {activeFile && !activeFile.isLoading && !activeFile.error && (
                    <div className="flex items-center justify-between p-1.5 border-b border-border/30 bg-background/50">
                        <div className="text-[10px] text-muted-foreground font-medium px-2 rounded-full border border-border/40 bg-muted/30 flex items-center gap-1.5 py-0.5">
                             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                             Analysis Complete
                        </div>
                        {activeFile.name.toLowerCase().endsWith('.pdf') && (
                            <div className="flex items-center p-0.5 rounded-md border border-border/40 bg-muted/30">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setSplitMode('pdf')}
                                            className={cn("p-1 rounded text-muted-foreground hover:text-foreground transition-colors", splitMode === 'pdf' && "bg-background shadow-sm text-foreground")}
                                        >
                                            <BookOpen className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Full PDF</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setSplitMode('split')}
                                            className={cn("p-1 rounded text-muted-foreground hover:text-foreground transition-colors", splitMode === 'split' && "bg-background shadow-sm text-foreground")}
                                        >
                                            <LayoutPanelLeft className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Split (PDF & Text)</TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                )}
                
                {activeFile?.isLoading && (
                     <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                         <div className="p-4 rounded-full bg-blue-500/10 mb-4">
                             <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                         </div>
                         <h3 className="text-sm font-medium mb-1">Analyzing Document</h3>
                         <p className="text-xs text-muted-foreground max-w-[200px]">Extracting text and running AI analysis pipeline...</p>
                         <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full mt-6 overflow-hidden relative">
                             <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 via-blue-500 to-blue-500/50 animate-[shimmer_2s_infinite]" />
                         </div>
                     </div>
                )}

                {activeFile?.error && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-destructive">
                        <div className="p-3 rounded-full bg-destructive/10 mb-3">
                            <X className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">Failed to process</p>
                    </div>
                )}

                {activeFile && !activeFile.isLoading && !activeFile.error && (
                    <div className={cn("flex-1 min-h-0 flex", splitMode === 'split' ? 'flex-col lg:flex-row' : 'flex-col')}>
                         {/* PDF: show native viewer */}
                         {activeFile.name.toLowerCase().endsWith('.pdf') && (
                             <div className="flex-1 min-h-0 min-w-0 bg-black/5 flex flex-col">
                                  <iframe
                                      src={`${API_BASE}/blobs/${activeFile.id}`}
                                      className="w-full h-full flex-1 border-0"
                                      title={`PDF - ${activeFile.name}`}
                                  />
                             </div>
                         )}

                         {/* Non-PDF Office docs: always show markdown preview */}
                         {!activeFile.name.toLowerCase().endsWith('.pdf') && (
                             <OfficeDocPreview file={activeFile} />
                         )}

                         {/* Split mode extracted text (PDF only) */}
                         {splitMode === 'split' && activeFile.name.toLowerCase().endsWith('.pdf') && (
                             <div className="flex-1 min-h-0 min-w-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border/50 bg-background">
                                 {mdLoading ? (
                                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs gap-2">
                                          <Loader2 className="h-4 w-4 animate-spin" /> Load text...
                                      </div>
                                 ) : (
                                     <div className="flex-1 overflow-y-auto p-4 md-preview prose prose-sm dark:prose-invert prose-headings:font-medium prose-p:text-muted-foreground prose-a:text-primary max-w-none text-xs">
                                          <Markdown remarkPlugins={[remarkGfm]}>{mdContent ?? ''}</Markdown>
                                     </div>
                                 )}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={onResizeStart}
                className={cn("absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-20 group-hover:bg-primary/20", side === 'right' ? 'left-0' : 'right-0')}
            />
        </div>
    );
}

export default AttachmentPanel;
