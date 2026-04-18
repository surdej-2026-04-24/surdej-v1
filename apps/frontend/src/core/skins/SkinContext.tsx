import {
    createContext, useContext, useEffect, useState, useCallback,
    type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';

// ─── Types ───

export interface SkinBranding {
    appName: string;
    logo?: string;
    primaryColor?: string;
    fontFamily?: string;
}

export interface SkinSidebarItem {
    commandId: string;
    group?: string;
}

export interface SkinTheme {
    defaultMode?: 'light' | 'dark';
}

export interface SkinActivityBarItem {
    id: string;
    label: string;
    icon: string;    // lucide icon name, e.g. 'Home', 'Database'
    path: string;    // relative path segment, e.g. '' or '/database'
}

export interface Skin {
    id: string;
    name: string;
    description?: string;
    isBuiltIn: boolean;
    branding: SkinBranding;
    sidebar: SkinSidebarItem[];
    activityBar?: SkinActivityBarItem[];
    homepageConfig?: any; // JSON layout config
    theme?: SkinTheme;
    createdAt: string;
    updatedAt: string;
}

interface SkinContextValue {
    activeSkin: Skin | null;
    allSkins: Skin[];
    isLoading: boolean;
    switchSkin: (skinId: string) => Promise<void>;
    setDefaultSkin: (skinId: string) => Promise<void>;
    refreshSkins: () => Promise<void>;
}

const SkinContext = createContext<SkinContextValue | null>(null);

// ─── Default fallback skin ───

const DEFAULT_ACTIVITY_BAR: SkinActivityBarItem[] = [
    { id: 'home', label: 'Overview', icon: 'Home', path: '' },
    { id: 'database', label: 'Database', icon: 'Database', path: '/database' },
];

const DEFAULT_SKIN: Skin = {
    id: 'default-local',
    name: 'Default',
    description: 'Platform default skin',
    isBuiltIn: true,
    branding: {
        appName: 'Surdej',
    },
    sidebar: [
        { commandId: 'navigate.home', group: 'Core' },
        { commandId: 'navigate.chat', group: 'Core' },
        { commandId: 'module.tools.list', group: 'Modules' },
        { commandId: 'module.tools.workflows', group: 'Modules' },
        { commandId: 'module.nosql.admin', group: 'NoSQL Store' },
        { commandId: 'module.nosql.collections', group: 'NoSQL Store' },
    ],
    activityBar: DEFAULT_ACTIVITY_BAR,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const MINIMAL_SKIN: Skin = {
    id: 'minimal-local',
    name: 'Minimal',
    description: 'Minimal sidebar — essentials only',
    isBuiltIn: true,
    branding: {
        appName: 'Surdej',
    },
    sidebar: [
        { commandId: 'navigate.home', group: 'Core' },
        { commandId: 'navigate.settings', group: 'System' },
    ],
    activityBar: [
        { id: 'home', label: 'Overview', icon: 'Home', path: '' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const LOCAL_SKINS = [DEFAULT_SKIN, MINIMAL_SKIN];

// ─── Helpers: hex → HSL conversion for CSS variables ───

function hexToHsl(hex: string): string | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    let r = parseInt(result[1]!, 16) / 255;
    let g = parseInt(result[2]!, 16) / 255;
    let b = parseInt(result[3]!, 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Google Fonts that need to be loaded dynamically */
const GOOGLE_FONT_FAMILIES = new Set([
    'Inter',
    'Roboto',
    'Outfit',
    'JetBrains Mono',
    'Plus Jakarta Sans',
]);

const loadedFonts = new Set<string>();

function loadGoogleFont(fontFamily: string) {
    // Extract the first font name (before comma)
    const primary = fontFamily.split(',')[0]?.trim().replace(/['"]/g, '');
    if (!primary || !GOOGLE_FONT_FAMILIES.has(primary) || loadedFonts.has(primary)) return;
    loadedFonts.add(primary);
    const encoded = primary.replace(/ /g, '+');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
}

// ─── Provider ───

export function SkinProvider({ children }: { children: ReactNode }) {
    const [activeSkin, setActiveSkin] = useState<Skin | null>(null);
    const [allSkins, setAllSkins] = useState<Skin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { isAuthenticated } = useAuth();

    // Apply primaryColor and fontFamily from active skin to CSS custom properties
    useEffect(() => {
        if (!activeSkin) return;
        const root = document.documentElement;

        // Apply primary color
        const color = activeSkin.branding.primaryColor;
        if (color) {
            const hsl = hexToHsl(color);
            if (hsl) {
                root.style.setProperty('--primary', `hsl(${hsl})`);
                root.style.setProperty('--ring', `hsl(${hsl})`);
                root.style.setProperty('--sidebar-primary', `hsl(${hsl})`);
                root.style.setProperty('--sidebar-ring', `hsl(${hsl})`);
            }
        } else {
            // Reset to default (remove inline overrides)
            root.style.removeProperty('--primary');
            root.style.removeProperty('--ring');
            root.style.removeProperty('--sidebar-primary');
            root.style.removeProperty('--sidebar-ring');
        }

        // Apply font family
        // Regex: allows font names with alphanumeric, spaces, hyphens, commas, and
        // quotes around font names (e.g., "'Plus Jakarta Sans', sans-serif").
        // Safe: style.setProperty only sets a single CSS property value.
        const font = activeSkin.branding.fontFamily;
        if (font && /^[a-zA-Z0-9\s,\-'"]+$/.test(font) && font.length <= 200) {
            loadGoogleFont(font);
            root.style.setProperty('--font-sans', font);
        } else {
            root.style.removeProperty('--font-sans');
        }

        return () => {
            // Cleanup on unmount
            root.style.removeProperty('--primary');
            root.style.removeProperty('--ring');
            root.style.removeProperty('--sidebar-primary');
            root.style.removeProperty('--sidebar-ring');
            root.style.removeProperty('--font-sans');
        };
    }, [activeSkin]);

    // Fetch user's active skin on mount
    useEffect(() => {
        (async () => {
            if (!isAuthenticated) {
                setActiveSkin(DEFAULT_SKIN);
                setIsLoading(false);
                return;
            }
            try {
                const skin = await api.get<Skin>('/skins/me');
                if (skin) {
                    setActiveSkin(normalizeSkin(skin));
                } else {
                    setActiveSkin(DEFAULT_SKIN);
                }
            } catch {
                // API not available — use default
                setActiveSkin(DEFAULT_SKIN);
            }
            setIsLoading(false);
        })();
    }, [isAuthenticated]);

    // Fetch all skins
    const refreshSkins = useCallback(async () => {
        if (!isAuthenticated) {
            setAllSkins(LOCAL_SKINS);
            return;
        }
        try {
            const skins = await api.get<Skin[]>('/skins');
            const normalized = skins.map(normalizeSkin);
            setAllSkins(normalized);
            // Also update activeSkin if it was refreshed (e.g. after save)
            setActiveSkin((prev) => {
                if (!prev) return prev;
                const updated = normalized.find((s) => s.id === prev.id);
                // If the active skin was deleted (not in refreshed list), fall back to Default
                return updated ?? normalized.find((s) => s.name === 'Default' && s.isBuiltIn) ?? DEFAULT_SKIN;
            });

            // Re-fetch the individual active skin to ensure fresh data
            // (e.g. after editing sidebar items in the skin editor)
            try {
                const freshActive = await api.get<Skin>('/skins/me');
                if (freshActive) {
                    setActiveSkin(normalizeSkin(freshActive));
                }
            } catch {
                // /skins/me may fail if not authenticated — ignore
            }
        } catch {
            setAllSkins(LOCAL_SKINS);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        refreshSkins();
    }, [refreshSkins]);

    // Switch active skin
    const switchSkin = useCallback(
        async (skinId: string) => {
            // Try API first, fallback to local
            try {
                const skin = await api.put<Skin>('/skins/me', { skinId });
                setActiveSkin(normalizeSkin(skin));
            } catch {
                // API not available — switch locally
                const localSkin = LOCAL_SKINS.find((s) => s.id === skinId);
                if (localSkin) setActiveSkin(localSkin);
            }
        },
        [],
    );

    // Set default skin
    const setDefaultSkin = useCallback(async (skinId: string) => {
        try {
            await api.put('/skins/me/default', { skinId });
        } catch (err) {
            console.error('[SkinContext] Failed to set default skin:', err);
        }
    }, []);

    return (
        <SkinContext.Provider
            value={{ activeSkin, allSkins, isLoading, switchSkin, setDefaultSkin, refreshSkins }}
        >
            {children}
        </SkinContext.Provider>
    );
}

export function useSkin() {
    const ctx = useContext(SkinContext);
    if (!ctx) throw new Error('useSkin must be used within SkinProvider');
    return ctx;
}

// ─── Helpers ───

/** Normalize skin fields from API response */
function normalizeSkin(skin: Skin): Skin {
    // Ensure branding/sidebar are objects (API may return them as strings)
    const branding = typeof skin.branding === 'string'
        ? JSON.parse(skin.branding as unknown as string)
        : skin.branding;
    const sidebar = typeof skin.sidebar === 'string'
        ? JSON.parse(skin.sidebar as unknown as string)
        : skin.sidebar;
    const activityBar = typeof skin.activityBar === 'string'
        ? JSON.parse(skin.activityBar as unknown as string)
        : skin.activityBar;
    return {
        ...skin,
        branding: branding ?? DEFAULT_SKIN.branding,
        sidebar: Array.isArray(sidebar) ? sidebar : DEFAULT_SKIN.sidebar,
        activityBar: Array.isArray(activityBar) ? activityBar : DEFAULT_ACTIVITY_BAR,
    };
}
