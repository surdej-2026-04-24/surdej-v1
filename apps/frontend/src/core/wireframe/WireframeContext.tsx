import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface WireframeContextValue {
    isActive: boolean;
    toggle: () => void;
    setActive: (active: boolean) => void;
}

const WireframeContext = createContext<WireframeContextValue>({
    isActive: false,
    toggle: () => { },
    setActive: () => { },
});

export function WireframeProvider({ children }: { children: ReactNode }) {
    const [isActive, setActive] = useState(false);

    const toggle = useCallback(() => setActive(prev => !prev), []);

    // Listen for toggle events from command palette / developer page
    useEffect(() => {
        const handler = () => toggle();
        window.addEventListener('surdej:toggle-wireframe', handler);
        return () => window.removeEventListener('surdej:toggle-wireframe', handler);
    }, [toggle]);

    // Keyboard shortcuts: Ctrl+Option+Cmd to toggle, Escape to exit
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Ctrl+Option+Cmd (any key, we just need all three modifiers)
            if (e.ctrlKey && e.altKey && e.metaKey && e.code === 'KeyW') {
                e.preventDefault();
                toggle();
                return;
            }
            if (isActive && e.key === 'Escape') {
                setActive(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isActive, toggle]);

    return (
        <WireframeContext value={{ isActive, toggle, setActive }}>
            {children}
        </WireframeContext>
    );
}

export function useWireframe() {
    return useContext(WireframeContext);
}
