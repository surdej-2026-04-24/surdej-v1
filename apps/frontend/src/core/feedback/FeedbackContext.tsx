import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface FeedbackEntry {
    id: string;
    title: string;
    description: string;
    type: 'bug' | 'feature' | 'improvement' | 'question';
    priority: 'low' | 'medium' | 'high' | 'critical';
    screenshot?: string; // base64 data URL
    annotations?: AnnotationItem[];
    url: string;
    userAgent: string;
    createdAt: string;
    status: 'draft' | 'submitted';
}

export interface AnnotationItem {
    id: string;
    type: 'arrow' | 'rect' | 'circle' | 'text' | 'blur';
    x: number;
    y: number;
    width?: number;
    height?: number;
    endX?: number;
    endY?: number;
    text?: string;
    color: string;
}

interface FeedbackContextValue {
    entries: FeedbackEntry[];
    activeEntry: FeedbackEntry | null;
    createEntry: () => FeedbackEntry;
    updateEntry: (id: string, updates: Partial<FeedbackEntry>) => void;
    deleteEntry: (id: string) => void;
    submitEntry: (id: string) => Promise<void>;
    setActiveEntry: (entry: FeedbackEntry | null) => void;
    captureScreenshot: () => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
    const ctx = useContext(FeedbackContext);
    if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
    return ctx;
}

function generateId(): string {
    return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = 'surdej_feedback_entries';

function loadEntries(): FeedbackEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveEntries(entries: FeedbackEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<FeedbackEntry[]>(loadEntries);
    const [activeEntry, setActiveEntry] = useState<FeedbackEntry | null>(null);

    const createEntry = useCallback((): FeedbackEntry => {
        const entry: FeedbackEntry = {
            id: generateId(),
            title: '',
            description: '',
            type: 'bug',
            priority: 'medium',
            url: window.location.href,
            userAgent: navigator.userAgent,
            createdAt: new Date().toISOString(),
            status: 'draft',
        };
        setEntries((prev) => {
            const next = [entry, ...prev];
            saveEntries(next);
            return next;
        });
        setActiveEntry(entry);
        return entry;
    }, []);

    const updateEntry = useCallback((id: string, updates: Partial<FeedbackEntry>) => {
        setEntries((prev) => {
            const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
            saveEntries(next);
            return next;
        });
        setActiveEntry((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
    }, []);

    const deleteEntry = useCallback((id: string) => {
        setEntries((prev) => {
            const next = prev.filter((e) => e.id !== id);
            saveEntries(next);
            return next;
        });
        setActiveEntry((prev) => (prev?.id === id ? null : prev));
    }, []);

    const submitEntry = useCallback(async (id: string) => {
        // In production: POST to /api/feedback
        // For now, mark as submitted locally
        setEntries((prev) => {
            const next = prev.map((e) =>
                e.id === id ? { ...e, status: 'submitted' as const } : e,
            );
            saveEntries(next);
            return next;
        });
        setActiveEntry((prev) =>
            prev?.id === id ? { ...prev, status: 'submitted' as const } : prev,
        );
    }, []);

    const captureScreenshot = useCallback(async (): Promise<string | null> => {
        try {
            // Use html2canvas if available, otherwise try native API
            if ('html2canvas' in window) {
                // @ts-expect-error dynamic import
                const canvas = await window.html2canvas(document.body);
                return canvas.toDataURL('image/png');
            }
            // Fallback: return null (no screenshot capability without html2canvas)
            console.warn('html2canvas not available for screenshot capture');
            return null;
        } catch (err) {
            console.error('Screenshot capture failed:', err);
            return null;
        }
    }, []);

    return (
        <FeedbackContext value={{
            entries,
            activeEntry,
            createEntry,
            updateEntry,
            deleteEntry,
            submitEntry,
            setActiveEntry,
            captureScreenshot,
        }}>
            {children}
        </FeedbackContext>
    );
}
