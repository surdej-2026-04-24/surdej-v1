/**
 * ResizeHandle — visual drag handle for resizable panels
 */

import { cn } from '@/lib/utils';

interface ResizeHandleProps {
    side: 'left' | 'right';
    onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ side, onMouseDown }: ResizeHandleProps) {
    return (
        <div
            onMouseDown={onMouseDown}
            className={cn(
                'w-[3px] shrink-0 cursor-col-resize group relative transition-colors hover:bg-primary/30 active:bg-primary/50',
                side === 'left' ? '-ml-[1.5px]' : '-mr-[1.5px]',
            )}
            title="Drag to resize"
        >
            {/* Wider invisible hit area */}
            <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
    );
}
