import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';

// ─── Types ───

type Theme = 'light' | 'dark' | 'system';
type FontScale = 100 | 110 | 120 | 130 | 140 | 150;

interface AccessibilityState {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    highContrast: boolean;
    fontScale: FontScale;
    reduceMotion: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    setHighContrast: (v: boolean) => void;
    setFontScale: (v: FontScale) => void;
    setReduceMotion: (v: boolean) => void;
}

// ─── Context ───

const AccessibilityContext = createContext<AccessibilityState | null>(null);

// ─── Helpers ───

function getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadPref<T>(key: string, fallback: T): T {
    try {
        const v = localStorage.getItem(`surdej_a11y_${key}`);
        return v !== null ? JSON.parse(v) : fallback;
    } catch {
        return fallback;
    }
}

function savePref<T>(key: string, value: T) {
    localStorage.setItem(`surdej_a11y_${key}`, JSON.stringify(value));
}

// ─── Provider ───

export function AccessibilityProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => loadPref('theme', 'system'));
    const [highContrast, setHighContrastState] = useState(() => loadPref('highContrast', false));
    const [fontScale, setFontScaleState] = useState<FontScale>(() => loadPref('fontScale', 100));
    const [reduceMotion, setReduceMotionState] = useState(() => loadPref('reduceMotion', false));
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    const resolvedTheme = theme === 'system' ? systemTheme : theme;

    // Watch system theme changes
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Apply to DOM
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', resolvedTheme);
        // shadcn uses .dark class for dark mode
        root.classList.toggle('dark', resolvedTheme === 'dark');
        root.setAttribute('data-high-contrast', String(highContrast));
        root.setAttribute('data-font-scale', String(fontScale));
        root.setAttribute('data-reduce-motion', String(reduceMotion));
    }, [resolvedTheme, highContrast, fontScale, reduceMotion]);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        savePref('theme', t);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }, [resolvedTheme, setTheme]);

    const setHighContrast = useCallback((v: boolean) => {
        setHighContrastState(v);
        savePref('highContrast', v);
    }, []);

    const setFontScale = useCallback((v: FontScale) => {
        setFontScaleState(v);
        savePref('fontScale', v);
    }, []);

    const setReduceMotion = useCallback((v: boolean) => {
        setReduceMotionState(v);
        savePref('reduceMotion', v);
    }, []);

    return (
        <AccessibilityContext value={{
            theme,
            resolvedTheme,
            highContrast,
            fontScale,
            reduceMotion,
            setTheme,
            toggleTheme,
            setHighContrast,
            setFontScale,
            setReduceMotion,
        }}>
            {children}
        </AccessibilityContext>
    );
}

// ─── Hook ───

export function useAccessibility(): AccessibilityState {
    const ctx = useContext(AccessibilityContext);
    if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
    return ctx;
}
