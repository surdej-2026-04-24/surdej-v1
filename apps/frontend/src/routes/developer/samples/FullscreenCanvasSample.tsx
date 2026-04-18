/**
 * Fullscreen Canvas sample — edge-to-edge canvas with floating toolbar,
 * minimap overlay, and interactive nodes.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Maximize, ZoomIn, ZoomOut, RotateCcw,
    MousePointer2, Hand, Square, Circle, Type,
    Layers, Grid3X3, Move, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

/* ── Types ────────────────────────────────────────────── */

interface CanvasNode {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: 'rect' | 'circle' | 'text';
    label: string;
    color: string;
}

let nextId = 1;
function uid() {
    return `node-${nextId++}`;
}

const COLORS = [
    'bg-blue-500/20 border-blue-500/50',
    'bg-emerald-500/20 border-emerald-500/50',
    'bg-violet-500/20 border-violet-500/50',
    'bg-amber-500/20 border-amber-500/50',
    'bg-pink-500/20 border-pink-500/50',
    'bg-teal-500/20 border-teal-500/50',
];

const DEFAULT_NODES: CanvasNode[] = [
    { id: uid(), x: 120, y: 100, w: 180, h: 100, type: 'rect', label: 'Auth Module', color: COLORS[0] },
    { id: uid(), x: 400, y: 80, w: 200, h: 120, type: 'rect', label: 'API Gateway', color: COLORS[1] },
    { id: uid(), x: 250, y: 300, w: 160, h: 90, type: 'rect', label: 'Database', color: COLORS[2] },
    { id: uid(), x: 700, y: 150, w: 150, h: 150, type: 'circle', label: 'Cache', color: COLORS[3] },
    { id: uid(), x: 530, y: 320, w: 180, h: 80, type: 'rect', label: 'Worker Queue', color: COLORS[4] },
    { id: uid(), x: 120, y: 350, w: 100, h: 40, type: 'text', label: 'v1.0.0 Architecture', color: COLORS[5] },
];

/* ── Page ─────────────────────────────────────────────── */

export function FullscreenCanvasSample() {
    const navigate = useNavigate();

    const [nodes, setNodes] = useState<CanvasNode[]>(DEFAULT_NODES);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<'select' | 'pan' | 'rect' | 'circle' | 'text'>('select');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(true);
    const [showMinimap, setShowMinimap] = useState(true);

    const canvasRef = useRef<HTMLDivElement>(null);
    const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

    /* ── Zoom ──────────────────────────────────────── */
    const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
    const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));
    const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    /* ── Wheel zoom ────────────────────────────────── */
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setZoom((z) => Math.min(3, Math.max(0.3, z - e.deltaY * 0.002)));
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    /* ── Node drag ─────────────────────────────────── */
    const handleNodePointerDown = useCallback(
        (e: React.PointerEvent, node: CanvasNode) => {
            if (tool !== 'select') return;
            e.stopPropagation();
            setSelectedId(node.id);
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (!canvasRect) return;
            dragging.current = {
                id: node.id,
                offsetX: (e.clientX - canvasRect.left) / zoom - pan.x - node.x,
                offsetY: (e.clientY - canvasRect.top) / zoom - pan.y - node.y,
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [tool, zoom, pan],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (!canvasRect) return;

            if (dragging.current) {
                const x = (e.clientX - canvasRect.left) / zoom - pan.x - dragging.current.offsetX;
                const y = (e.clientY - canvasRect.top) / zoom - pan.y - dragging.current.offsetY;
                setNodes((prev) =>
                    prev.map((n) => (n.id === dragging.current!.id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)),
                );
            }

            if (panning.current) {
                const dx = e.clientX - panning.current.startX;
                const dy = e.clientY - panning.current.startY;
                setPan({
                    x: panning.current.panX + dx / zoom,
                    y: panning.current.panY + dy / zoom,
                });
            }
        },
        [zoom, pan],
    );

    const handlePointerUp = useCallback(() => {
        dragging.current = null;
        panning.current = null;
    }, []);

    /* ── Canvas click: create or pan ───────────────── */
    const handleCanvasPointerDown = useCallback(
        (e: React.PointerEvent) => {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (!canvasRect) return;
            const x = (e.clientX - canvasRect.left) / zoom - pan.x;
            const y = (e.clientY - canvasRect.top) / zoom - pan.y;

            if (tool === 'pan') {
                panning.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                return;
            }

            if (tool === 'rect' || tool === 'circle' || tool === 'text') {
                const color = COLORS[nodes.length % COLORS.length];
                const newNode: CanvasNode = {
                    id: uid(),
                    x: Math.round(x) - 60,
                    y: Math.round(y) - 30,
                    w: tool === 'text' ? 120 : 140,
                    h: tool === 'text' ? 36 : tool === 'circle' ? 100 : 80,
                    type: tool,
                    label: tool === 'text' ? 'Label' : `Node ${nodes.length + 1}`,
                    color,
                };
                setNodes((prev) => [...prev, newNode]);
                setSelectedId(newNode.id);
                setTool('select');
                return;
            }

            // select tool: deselect
            setSelectedId(null);
        },
        [tool, zoom, pan, nodes.length],
    );

    /* ── Delete selected ──────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                setNodes((prev) => prev.filter((n) => n.id !== selectedId));
                setSelectedId(null);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedId]);

    const deleteSelected = () => {
        if (!selectedId) return;
        setNodes((prev) => prev.filter((n) => n.id !== selectedId));
        setSelectedId(null);
    };

    /* ── Tool buttons ─────────────────────────────── */
    const tools: { id: typeof tool; icon: React.FC<{ className?: string }>; label: string }[] = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'pan', icon: Hand, label: 'Pan' },
        { id: 'rect', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'text', icon: Type, label: 'Text' },
    ];

    return (
        <div className="flex flex-col h-full animate-fade-in relative overflow-hidden bg-muted/20">
            {/* Floating toolbar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-background/90 backdrop-blur-lg border rounded-xl px-2 py-1.5 shadow-lg">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/developer/samples/layouts')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />

                {tools.map((t) => {
                    const Icon = t.icon;
                    return (
                        <Button
                            key={t.id}
                            variant={tool === t.id ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setTool(t.id)}
                            title={t.label}
                        >
                            <Icon className="h-4 w-4" />
                        </Button>
                    );
                })}

                <Separator orientation="vertical" className="h-5 mx-1" />

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
                    <ZoomIn className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-5 mx-1" />

                <Button
                    variant={showGrid ? 'secondary' : 'ghost'}
                    size="icon" className="h-8 w-8"
                    onClick={() => setShowGrid(!showGrid)}
                    title="Toggle grid"
                >
                    <Grid3X3 className="h-4 w-4" />
                </Button>

                <Button
                    variant={showMinimap ? 'secondary' : 'ghost'}
                    size="icon" className="h-8 w-8"
                    onClick={() => setShowMinimap(!showMinimap)}
                    title="Toggle minimap"
                >
                    <Layers className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Reset view">
                    <RotateCcw className="h-4 w-4" />
                </Button>

                {selectedId && (
                    <>
                        <Separator orientation="vertical" className="h-5 mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={deleteSelected} title="Delete">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </>
                )}
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={cn(
                    'flex-1 overflow-hidden relative',
                    tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : '',
                    tool === 'rect' || tool === 'circle' || tool === 'text' ? 'cursor-crosshair' : '',
                )}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {/* Grid pattern */}
                {showGrid && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
                        <defs>
                            <pattern
                                id="grid"
                                width={20 * zoom}
                                height={20 * zoom}
                                patternUnits="userSpaceOnUse"
                                x={(pan.x * zoom) % (20 * zoom)}
                                y={(pan.y * zoom) % (20 * zoom)}
                            >
                                <circle cx="1" cy="1" r="1" fill="currentColor" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                )}

                {/* Nodes */}
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                        transformOrigin: '0 0',
                    }}
                >
                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            className={cn(
                                'absolute transition-shadow border-2 flex items-center justify-center',
                                'hover:shadow-lg cursor-move select-none text-xs font-medium',
                                node.color,
                                node.type === 'circle' ? 'rounded-full' : node.type === 'text' ? 'border-transparent bg-transparent' : 'rounded-lg',
                                selectedId === node.id && 'ring-2 ring-primary shadow-lg shadow-primary/20',
                            )}
                            style={{
                                left: node.x,
                                top: node.y,
                                width: node.w,
                                height: node.h,
                            }}
                            onPointerDown={(e) => handleNodePointerDown(e, node)}
                        >
                            <span className={cn(
                                node.type === 'text' && 'text-sm font-semibold text-foreground',
                            )}>
                                {node.label}
                            </span>
                            {selectedId === node.id && (
                                <>
                                    {/* Resize handles (visual only for now) */}
                                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-sm" />
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-sm" />
                                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-primary rounded-sm" />
                                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary rounded-sm" />
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Minimap */}
            {showMinimap && (
                <div className="absolute bottom-4 right-4 w-48 h-32 z-20 rounded-lg border bg-background/90 backdrop-blur-lg shadow-lg overflow-hidden">
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground border-b flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Minimap
                        <span className="ml-auto">{nodes.length} nodes</span>
                    </div>
                    <div className="relative w-full h-[calc(100%-24px)]">
                        {nodes.map((node) => (
                            <div
                                key={node.id}
                                className={cn(
                                    'absolute border',
                                    node.type === 'circle' ? 'rounded-full' : 'rounded-sm',
                                    selectedId === node.id ? 'bg-primary/60 border-primary' : 'bg-muted-foreground/20 border-muted-foreground/30',
                                )}
                                style={{
                                    left: `${(node.x / 1000) * 100}%`,
                                    top: `${(node.y / 600) * 100}%`,
                                    width: `${(node.w / 1000) * 100}%`,
                                    height: `${(node.h / 600) * 100}%`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Status bar */}
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-1.5 bg-background/80 backdrop-blur border-t text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                    <span>Nodes: {nodes.length}</span>
                    <span>Zoom: {Math.round(zoom * 100)}%</span>
                    <span>Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})</span>
                </div>
                <div className="flex items-center gap-3">
                    {selectedId && <span>Selected: {nodes.find((n) => n.id === selectedId)?.label}</span>}
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Canvas Sample</Badge>
                </div>
            </div>
        </div>
    );
}
