/**
 * useResizablePanel — drag-to-resize hook for side panels
 *
 * Returns a ref for the drag handle and the current panel width.
 * Persists the width to localStorage.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizablePanelOptions {
    /** localStorage key for persisting width */
    storageKey: string;
    /** Default width in px */
    defaultWidth: number;
    /** Minimum width in px */
    minWidth?: number;
    /** Maximum width in px */
    maxWidth?: number;
    /** 'left' = drag right edge, 'right' = drag left edge */
    side: 'left' | 'right';
}

export function useResizablePanel({
    storageKey,
    defaultWidth,
    minWidth = 140,
    maxWidth = 500,
    side,
}: UseResizablePanelOptions) {
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        return saved ? Math.max(minWidth, Math.min(maxWidth, parseInt(saved, 10))) : defaultWidth;
    });

    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [width]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = side === 'left'
                ? e.clientX - startX.current
                : startX.current - e.clientX;
            const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta));
            setWidth(newWidth);
        };

        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Persist
            localStorage.setItem(storageKey, String(width));
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [minWidth, maxWidth, side, storageKey, width]);

    // Persist on width change (debounced via mouseup handler above)
    // Also save when component unmounts
    useEffect(() => {
        return () => localStorage.setItem(storageKey, String(width));
    }, [storageKey, width]);

    return { width, onMouseDown };
}
