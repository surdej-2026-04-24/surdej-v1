/**
 * @surdej/frontend — Internationalization (i18n) System
 *
 * Lightweight, type-safe i18n with React context, supporting:
 * - English (en) and Danish (da) locales
 * - Template interpolation: t('home.welcomeBack', { name: 'Niels' })
 * - Dot-path key access with full TypeScript inference
 * - LocalStorage persistence
 * - Browser locale auto-detection
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useEffect,
    type ReactNode,
} from 'react';
import en, { type TranslationKeys } from './locales/en';
import da from './locales/da';

// ─── Types ──────────────────────────────────────────────────────

export type Locale = 'en' | 'da';

export interface LocaleInfo {
    code: Locale;
    label: string;
    nativeLabel: string;
    flag: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
    { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
    { code: 'da', label: 'Danish', nativeLabel: 'Dansk', flag: '🇩🇰' },
];

const LOCALE_MAP: Record<Locale, TranslationKeys> = { en, da };
const STORAGE_KEY = 'surdej:locale';

// ─── Deep dot-path accessor ─────────────────────────────────────

type PathsToStringProps<T> = T extends string
    ? []
    : {
        [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends []
    ? never
    : T extends [infer F]
    ? F
    : T extends [infer F, ...infer R]
    ? F extends string
    ? `${F}${D}${Join<Extract<R, string[]>, D>}`
    : never
    : string;

export type TranslationKey = Join<PathsToStringProps<TranslationKeys>, '.'>;

function getNestedValue(obj: Record<string, unknown>, path: string): string {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return path; // fallback to the key itself
        }
        current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'string' ? current : path;
}

// ─── Interpolation ──────────────────────────────────────────────

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
        return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
}

// ─── Context ────────────────────────────────────────────────────

interface I18nContextValue {
    /** Current locale code */
    locale: Locale;
    /** Switch locale (persists to localStorage) */
    setLocale: (locale: Locale) => void;
    /** Translate a key with optional interpolation params */
    t: (key: string, params?: Record<string, string | number>) => string;
    /** All supported locales */
    locales: LocaleInfo[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Detect browser locale ─────────────────────────────────────

function detectLocale(): Locale {
    // Query param takes priority (used by extension side panel ?lang=da)
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && (urlLang === 'en' || urlLang === 'da')) {
        // Persist so it survives navigations that drop the query param
        localStorage.setItem(STORAGE_KEY, urlLang);
        return urlLang;
    }

    // Check localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'da')) return stored;

    // Check browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'da') return 'da';

    return 'en';
}

// ─── Provider ───────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(detectLocale);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem(STORAGE_KEY, newLocale);
        document.documentElement.lang = newLocale;
    }, []);

    // Set initial lang attribute
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const t = useCallback(
        (key: string, params?: Record<string, string | number>): string => {
            const translations = LOCALE_MAP[locale];
            const raw = getNestedValue(translations as unknown as Record<string, unknown>, key);
            return interpolate(raw, params);
        },
        [locale],
    );

    const value = useMemo<I18nContextValue>(
        () => ({ locale, setLocale, t, locales: SUPPORTED_LOCALES }),
        [locale, setLocale, t],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useTranslation() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useTranslation must be used within <I18nProvider>');
    }
    return ctx;
}

// ─── Re-exports ─────────────────────────────────────────────────
export { SUPPORTED_LOCALES as locales };
