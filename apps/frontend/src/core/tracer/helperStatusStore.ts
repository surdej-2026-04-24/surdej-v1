/**
 * Helper Status Store
 *
 * Polls the Surdej Helper Server at localhost:5050/health
 * to track whether the MCP helper is available.
 */

import { create } from 'zustand';

export type HelperStatus = 'connected' | 'disconnected' | 'checking';

interface HelperStatusState {
    status: HelperStatus;
    uptime: number | null;
    lastChecked: number | null;

    checkHealth: () => Promise<void>;
}

const HELPER_PORT = import.meta.env?.VITE_HELPER_PORT || '5050';
const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;

export const useHelperStatusStore = create<HelperStatusState>((set) => ({
    status: 'checking',
    uptime: null,
    lastChecked: null,

    checkHealth: async () => {
        set({ status: 'checking' });
        try {
            const res = await fetch(`${HELPER_URL}/health`, {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                const data = await res.json();
                set({
                    status: 'connected',
                    uptime: data.uptime ?? null,
                    lastChecked: Date.now(),
                });
            } else {
                set({ status: 'disconnected', lastChecked: Date.now() });
            }
        } catch {
            set({ status: 'disconnected', lastChecked: Date.now() });
        }
    },
}));

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startHelperPolling(intervalMs = 15_000): void {
    if (intervalId) return;
    // Check immediately
    useHelperStatusStore.getState().checkHealth();
    intervalId = setInterval(() => {
        useHelperStatusStore.getState().checkHealth();
    }, intervalMs);
}

export function stopHelperPolling(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
