import { useEffect, useState, useRef } from 'react';

/**
 * DevInspector — hold Ctrl+Option and hover over elements to see their
 * React component source file / element tag in a floating tooltip.
 *
 * Uses data-component attributes when available, otherwise shows the
 * nearest element's tag name, class list, and id.
 */
export function DevInspector() {
    const [active, setActive] = useState(false);
    const [info, setInfo] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Listen for custom toggle events
    useEffect(() => {
        const handler = () => setActive(prev => !prev);
        window.addEventListener('surdej:toggle-dev-inspector', handler);
        return () => window.removeEventListener('surdej:toggle-dev-inspector', handler);
    }, []);

    // Mouse move — inspect element (read modifiers directly from MouseEvent)
    useEffect(() => {
        if (!active) {
            setInfo(null);
            return;
        }

        const handler = (e: MouseEvent) => {
            // Check Ctrl+Option directly on the mouse event
            if (!e.ctrlKey || !e.altKey) {
                setInfo(null);
                return;
            }

            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
            if (!el || overlayRef.current?.contains(el)) return;

            const lines: string[] = [];

            // Walk up to find data-component (set by WireframeElement or manual)
            let walk: HTMLElement | null = el;
            while (walk) {
                const comp = walk.getAttribute('data-component');
                if (comp) {
                    lines.push(`📦 ${comp}`);
                    break;
                }
                walk = walk.parentElement;
            }

            // Element info
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = Array.from(el.classList).slice(0, 5).map(c => `.${c}`).join('');
            lines.push(`🏷️ <${tag}${id}${classes}>`);

            // Dimensions
            const rect = el.getBoundingClientRect();
            lines.push(`📐 ${Math.round(rect.width)}×${Math.round(rect.height)}px`);

            // Role / aria-label
            const role = el.getAttribute('role');
            const ariaLabel = el.getAttribute('aria-label');
            if (role) lines.push(`♿ role="${role}"`);
            if (ariaLabel) lines.push(`♿ aria-label="${ariaLabel}"`);

            setInfo({ x: e.clientX, y: e.clientY, lines });
        };

        window.addEventListener('mousemove', handler);
        return () => window.removeEventListener('mousemove', handler);
    }, [active]);

    // Escape to deactivate
    useEffect(() => {
        if (!active) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActive(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [active]);

    if (!active || !info) return null;

    // Position tooltip near cursor, clamped to viewport
    const tooltipX = Math.min(info.x + 16, window.innerWidth - 320);
    const tooltipY = Math.min(info.y + 16, window.innerHeight - 120);

    return (
        <div
            ref={overlayRef}
            className="fixed z-[9999] pointer-events-none"
            style={{
                left: tooltipX,
                top: tooltipY,
            }}
        >
            <div className="bg-gray-900 text-gray-100 text-[11px] font-mono px-3 py-2 rounded-lg shadow-xl border border-gray-700 max-w-[300px] space-y-0.5">
                {info.lines.map((line, i) => (
                    <div key={i} className="truncate">{line}</div>
                ))}
                <div className="text-gray-500 text-[9px] mt-1 pt-1 border-t border-gray-700">
                    Ctrl+Option hover · Esc to exit
                </div>
            </div>
        </div>
    );
}
