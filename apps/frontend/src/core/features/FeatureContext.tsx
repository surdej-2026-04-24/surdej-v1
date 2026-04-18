import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';

// ─── Types ───

export interface Feature {
    id: string;
    featureId: string;
    title: string;
    description: string;
    ring: number; // 1=Internal, 2=Beta, 3=Preview, 4=Stable
    enabled: boolean;
}

interface FeatureState {
    features: Feature[];
    isLoading: boolean;
    userRing: number;
    setUserRing: (ring: number) => void;
    isEnabled: (featureId: string) => boolean;
    toggleFeature: (featureId: string) => void;
}

// ─── Ring Labels ───

export const RING_LABELS: Record<number, string> = {
    1: 'Internal',
    2: 'Beta',
    3: 'Preview',
    4: 'Stable',
};

// ─── Default feature definitions (used when API is unavailable) ───

const DEFAULT_FEATURES: Feature[] = [
    {
        id: '1', featureId: 'command-palette',
        title: 'Command Palette', description: 'Quick command access via ⌘K',
        ring: 4, enabled: true,
    },
    {
        id: '2', featureId: 'feedback-system',
        title: 'Feedback System', description: 'Screenshot, voice, and video feedback with annotation',
        ring: 2, enabled: false,
    },
    {
        id: '3', featureId: 'skin-editor',
        title: 'Skin Editor', description: 'Visual sidebar customisation editor',
        ring: 2, enabled: false,
    },
    {
        id: '4', featureId: 'dev-inspector',
        title: 'Dev Inspector', description: 'Ctrl+Option hover to inspect component source',
        ring: 1, enabled: false,
    },
    {
        id: '5', featureId: 'topology-viewer',
        title: 'Topology Viewer', description: 'Interactive infrastructure and codebase topology explorer',
        ring: 1, enabled: false,
    },
    {
        id: '6', featureId: 'wireframe-mode',
        title: 'Wireframe Mode', description: 'Overlay layout region outlines for debugging',
        ring: 1, enabled: false,
    },
    {
        id: '7', featureId: 'pdf-refinery',
        title: 'PDF Refinery', description: 'End-to-end document processing — extraction, OCR, AI analysis, and embedding pipeline',
        ring: 1, enabled: true,
    },
    {
        id: '8', featureId: 'workflows',
        title: 'Workflows', description: 'Workflow management, directory, and sessions',
        ring: 1, enabled: true,
    },
];

// ─── Context ───

const FeatureContext = createContext<FeatureState | null>(null);

// ─── Provider ───

export function FeatureProvider({ children }: { children: ReactNode }) {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userRing, setUserRingState] = useState<number>(() => {
        const stored = localStorage.getItem('surdej_user_ring');
        return stored ? Number(stored) : 3; // Default to Ring 3 (Preview)
    });

    // Persist user ring
    const setUserRing = useCallback((ring: number) => {
        setUserRingState(ring);
        localStorage.setItem('surdej_user_ring', String(ring));
    }, []);

    useEffect(() => {
        api.get<Feature[]>('/features')
            .then(data => setFeatures(data.length > 0 ? data : DEFAULT_FEATURES))
            .catch(() => setFeatures(DEFAULT_FEATURES))
            .finally(() => setIsLoading(false));
    }, []);

    // Resolve enabled state: considers user ring + localStorage overrides
    const isEnabled = useCallback((featureId: string): boolean => {
        // Check localStorage overrides first
        const override = localStorage.getItem(`surdej_feature_${featureId}`);
        if (override !== null) return override === 'true';

        const feature = features.find(f => f.featureId === featureId);
        if (!feature) return false;

        // Feature is enabled if its ring <= user's ring level
        return feature.ring <= userRing;
    }, [features, userRing]);

    // Toggle feature override in localStorage
    const toggleFeature = useCallback((featureId: string) => {
        const key = `surdej_feature_${featureId}`;
        const current = isEnabled(featureId);
        localStorage.setItem(key, String(!current));
        // Force re-render by updating features with new enabled states
        setFeatures(prev => prev.map(f =>
            f.featureId === featureId ? { ...f, enabled: !current } : f
        ));
    }, [isEnabled]);

    return (
        <FeatureContext value={{ features, isLoading, userRing, setUserRing, isEnabled, toggleFeature }}>
            {children}
        </FeatureContext>
    );
}

// ─── Hooks ───

export function useFeature(featureId: string): boolean {
    const ctx = useContext(FeatureContext);
    if (!ctx) throw new Error('useFeature must be used within FeatureProvider');
    return ctx.isEnabled(featureId);
}

export function useFeatures(): FeatureState {
    const ctx = useContext(FeatureContext);
    if (!ctx) throw new Error('useFeatures must be used within FeatureProvider');
    return ctx;
}
