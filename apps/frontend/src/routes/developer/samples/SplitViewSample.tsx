/**
 * Split View sample — horizontal & vertical resizable split panels.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Columns, GripVertical, GripHorizontal,
    FileText, Terminal, Code2, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';

/* ── Resizable split hook ───────────────────────────────── */

function useSplitResize(
    direction: 'horizontal' | 'vertical',
    initialRatio = 0.5,
    minRatio = 0.15,
    maxRatio = 0.85,
) {
    const [ratio, setRatio] = useState(initialRatio);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            let newRatio: number;
            if (direction === 'horizontal') {
                newRatio = (e.clientX - rect.left) / rect.width;
            } else {
                newRatio = (e.clientY - rect.top) / rect.height;
            }
            setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)));
        },
        [direction, minRatio, maxRatio],
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    return { ratio, setRatio, containerRef, onPointerDown, onPointerMove, onPointerUp };
}

/* ── Fake editor content ─────────────────────────────── */

const SAMPLE_CODE = `import { createApp } from '@/core/app';
import { loadPlugins } from '@/core/plugins';

export async function bootstrap() {
    const app = createApp({
        name: 'Surdej',
        version: '1.0.0',
        mode: process.env.NODE_ENV,
    });

    await loadPlugins(app, [
        'auth',
        'routing',
        'skin-system',
        'i18n',
    ]);

    app.mount('#root');
    console.log('✓ Application started');
}

bootstrap().catch(console.error);`;

const SAMPLE_OUTPUT = `[vite] Dev server running at http://localhost:6003/
[vite] ready in 342ms.

✓ Application started
✓ Plugins loaded: auth, routing, skin-system, i18n
✓ Routes registered: 24 paths
✓ Skin "Default" applied

[HMR] connected.`;

/* ── Page ─────────────────────────────────────────────── */

export function SplitViewSample() {
    const navigate = useNavigate();
    const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');

    const split = useSplitResize(layout, 0.5);

    const isHorizontal = layout === 'horizontal';

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/developer/samples/layouts')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Columns className="h-5 w-5 text-primary" />
                <h1 className="font-semibold text-sm">Split View</h1>
                <Badge variant="secondary" className="text-[10px]">Sample</Badge>
                <div className="flex-1" />
                <div className="flex items-center gap-1 border rounded-lg p-0.5">
                    <Button
                        variant={isHorizontal ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setLayout('horizontal')}
                    >
                        <GripVertical className="h-3 w-3 mr-1" /> Horizontal
                    </Button>
                    <Button
                        variant={!isHorizontal ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setLayout('vertical')}
                    >
                        <GripHorizontal className="h-3 w-3 mr-1" /> Vertical
                    </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => split.setRatio(0.5)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
            </div>

            {/* Split panels */}
            <div
                ref={split.containerRef}
                className={cn('flex-1 flex overflow-hidden', !isHorizontal && 'flex-col')}
                onPointerMove={split.onPointerMove}
                onPointerUp={split.onPointerUp}
            >
                {/* Panel A — Editor */}
                <div
                    className="overflow-auto"
                    style={isHorizontal ? { width: `${split.ratio * 100}%` } : { height: `${split.ratio * 100}%` }}
                >
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                        <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">bootstrap.ts</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">Editor</Badge>
                    </div>
                    <pre className="p-4 text-xs font-mono leading-relaxed text-foreground/80 select-text">
                        {SAMPLE_CODE.split('\n').map((line, i) => (
                            <div key={i} className="flex hover:bg-accent/30 transition-colors">
                                <span className="w-8 text-right pr-3 text-muted-foreground/50 select-none">{i + 1}</span>
                                <span>{line || ' '}</span>
                            </div>
                        ))}
                    </pre>
                </div>

                {/* Divider handle */}
                <div
                    className={cn(
                        'flex items-center justify-center shrink-0 bg-border/50 hover:bg-primary/30 active:bg-primary/50 transition-colors',
                        isHorizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
                    )}
                    onPointerDown={split.onPointerDown}
                >
                    {isHorizontal ? (
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    ) : (
                        <GripHorizontal className="h-4 w-4 text-muted-foreground/40" />
                    )}
                </div>

                {/* Panel B — Output */}
                <div className="flex-1 overflow-auto min-w-0 min-h-0">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Output</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">Terminal</Badge>
                    </div>
                    <pre className="p-4 text-xs font-mono leading-relaxed text-green-400 bg-black/80 h-full select-text">
                        {SAMPLE_OUTPUT}
                    </pre>
                </div>
            </div>
        </div>
    );
}
