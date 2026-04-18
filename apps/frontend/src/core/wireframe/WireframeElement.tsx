import { type ReactNode } from 'react';
import { useWireframe } from './WireframeContext';
import { cn } from '@/lib/utils';

// Depth-based colors for nested wireframe regions
const DEPTH_COLORS = [
    { border: 'border-red-500/60', bg: 'bg-red-500/5', label: 'bg-red-500', text: 'text-white' },
    { border: 'border-blue-500/60', bg: 'bg-blue-500/5', label: 'bg-blue-500', text: 'text-white' },
    { border: 'border-emerald-500/60', bg: 'bg-emerald-500/5', label: 'bg-emerald-500', text: 'text-white' },
    { border: 'border-amber-500/60', bg: 'bg-amber-500/5', label: 'bg-amber-500', text: 'text-white' },
    { border: 'border-purple-500/60', bg: 'bg-purple-500/5', label: 'bg-purple-500', text: 'text-white' },
];

interface WireframeElementProps {
    name: string;
    description?: string;
    depth?: number;
    children: ReactNode;
    className?: string;
}

/**
 * Wraps children with a wireframe overlay when wireframe mode is active.
 * When inactive, still renders the wrapper div with its className to preserve layout.
 */
export function WireframeElement({
    name,
    description,
    depth = 0,
    children,
    className,
}: WireframeElementProps) {
    const { isActive } = useWireframe();

    const colors = DEPTH_COLORS[depth % DEPTH_COLORS.length];

    return (
        <div
            className={cn(
                className,
                isActive && 'relative border-2 border-dashed',
                isActive && colors.border,
                isActive && colors.bg,
            )}
            data-component={name}
        >
            {/* Floating label — only when wireframe mode is active */}
            {isActive && (
                <div
                    className={cn(
                        'absolute top-0 left-0 z-50 px-2 py-0.5 text-[10px] font-mono font-bold leading-tight rounded-br-md',
                        colors.label,
                        colors.text,
                    )}
                >
                    {name}
                    {description && (
                        <span className="font-normal opacity-80 ml-1.5">— {description}</span>
                    )}
                </div>
            )}
            {children}
        </div>
    );
}
