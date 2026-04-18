/**
 * System Status Store
 *
 * Polls /health and /workers/health periodically and exposes
 * a unified system status for the footer indicator.
 * Integrates with the same endpoints used by HomePage.
 */

import { create } from 'zustand';
import { api } from '@/lib/api';

export interface HealthData {
    status: string;
    version: string;
    uptime: number;
}

export interface WorkerHealth {
    natsConnected: boolean;
    total: number;
    online: number;
    degraded: number;
    unhealthy: number;
    offline: number;
    draining: number;
}

export type SystemStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface SystemStatusState {
    status: SystemStatus;
    apiHealth: HealthData | null;
    workerHealth: WorkerHealth | null;
    lastChecked: number | null;
    checking: boolean;
    panelOpen: boolean;
    error: string | null;

    checkHealth: () => Promise<void>;
    togglePanel: () => void;
    setPanelOpen: (open: boolean) => void;
}

function deriveStatus(apiHealth: HealthData | null, workerHealth: WorkerHealth | null): SystemStatus {
    if (!apiHealth) return 'unknown';
    if (workerHealth) {
        if (workerHealth.unhealthy > 0) return 'degraded';
        if (workerHealth.total > 0 && workerHealth.online === 0) return 'unhealthy';
    }
    return 'healthy';
}

export const useSystemStatusStore = create<SystemStatusState>((set, get) => ({
    status: 'unknown',
    apiHealth: null,
    workerHealth: null,
    lastChecked: null,
    checking: false,
    panelOpen: false,
    error: null,

    checkHealth: async () => {
        set({ checking: true, error: null });

        try {
            const [apiRes, workerRes] = await Promise.allSettled([
                api.get<HealthData>('/health'),
                api.get<WorkerHealth>('/workers/health'),
            ]);

            const apiHealth = apiRes.status === 'fulfilled' ? apiRes.value : null;
            const workerHealth = workerRes.status === 'fulfilled' ? workerRes.value : null;
            const status = deriveStatus(apiHealth, workerHealth);

            set({
                apiHealth,
                workerHealth,
                status,
                lastChecked: Date.now(),
                checking: false,
            });
        } catch (err) {
            set({
                status: 'unhealthy',
                error: err instanceof Error ? err.message : String(err),
                checking: false,
                lastChecked: Date.now(),
            });
        }
    },

    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    setPanelOpen: (open) => set({ panelOpen: open }),
}));

// ─── Auto-poll on import ────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startSystemStatusPolling(intervalMs = 30_000) {
    // Initial check
    useSystemStatusStore.getState().checkHealth();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        useSystemStatusStore.getState().checkHealth();
    }, intervalMs);
}

export function stopSystemStatusPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}
