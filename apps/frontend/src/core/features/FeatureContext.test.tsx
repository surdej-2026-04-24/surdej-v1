import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FeatureProvider, useFeature, useFeatures, RING_LABELS } from './FeatureContext';
import type { ReactNode } from 'react';

// Mock the API module
vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn().mockRejectedValue(new Error('API unavailable')),
    },
}));

function wrapper({ children }: { children: ReactNode }) {
    return FeatureProvider({ children });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe('FeatureContext', () => {
    describe('initial load', () => {
        it('should load default features when API is unavailable', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.features.length).toBeGreaterThan(0);
        });

        it('should default to ring 1 (Internal)', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.userRing).toBe(1);
        });
    });

    describe('ring labels', () => {
        it('should have labels for all 4 rings', () => {
            expect(RING_LABELS[1]).toBe('Internal');
            expect(RING_LABELS[2]).toBe('Beta');
            expect(RING_LABELS[3]).toBe('Preview');
            expect(RING_LABELS[4]).toBe('Stable');
        });
    });

    describe('isEnabled', () => {
        it('should enable features at or below user ring', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Ring 1 user: all ring-1 features are accessible
            // command-palette is ring 4, so it should be enabled for ring 1
            // Wait... ring 1 <= 1 is true, but ring 4 <= 1 is false
            // So with userRing=1, only ring-1 features should be enabled
            const devInspectorEnabled = result.current.isEnabled('dev-inspector');
            // dev-inspector is ring 1, user is ring 1: should be enabled
            expect(devInspectorEnabled).toBe(true);
        });

        it('should not enable features above user ring', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // command-palette is ring 4, user ring is 1
            const paletteEnabled = result.current.isEnabled('command-palette');
            expect(paletteEnabled).toBe(false);
        });

        it('should return false for unknown feature ids', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.isEnabled('non-existent-feature')).toBe(false);
        });
    });

    describe('setUserRing', () => {
        it('should change the user ring level', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setUserRing(4);
            });

            expect(result.current.userRing).toBe(4);
        });

        it('should persist ring to localStorage', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setUserRing(3);
            });

            expect(localStorage.getItem('surdej_user_ring')).toBe('3');
        });
    });

    describe('toggleFeature', () => {
        it('should toggle a feature override in localStorage', async () => {
            const { result } = renderHook(() => useFeatures(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // command-palette is ring 4, user ring 1 — initially disabled
            expect(result.current.isEnabled('command-palette')).toBe(false);

            act(() => {
                result.current.toggleFeature('command-palette');
            });

            // After toggle, should be enabled via localStorage override
            expect(result.current.isEnabled('command-palette')).toBe(true);
        });
    });

    describe('useFeature hook', () => {
        it('should return boolean for a specific feature', async () => {
            const { result } = renderHook(() => useFeature('dev-inspector'), { wrapper });

            await waitFor(() => {
                // dev-inspector is ring 1, user ring is 1: enabled
                expect(result.current).toBe(true);
            });
        });

        it('should throw outside provider', () => {
            expect(() => {
                renderHook(() => useFeature('any'));
            }).toThrow('useFeature must be used within FeatureProvider');
        });
    });
});
