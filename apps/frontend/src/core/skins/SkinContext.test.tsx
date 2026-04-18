import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { SkinProvider, useSkin } from './SkinContext';
import type { ReactNode } from 'react';

// Mock the API module
vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn().mockRejectedValue(new Error('API unavailable')),
        put: vi.fn().mockRejectedValue(new Error('API unavailable')),
    },
}));

// Mock useAuth
vi.mock('@/core/auth/AuthContext', () => ({
    useAuth: vi.fn().mockReturnValue({
        user: { id: 'test-user', role: 'admin' },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
    }),
}));

function wrapper({ children }: { children: ReactNode }) {
    return SkinProvider({ children });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('SkinContext', () => {
    describe('initial state', () => {
        it('should load the default skin when API is unavailable', async () => {
            const { result } = renderHook(() => useSkin(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.activeSkin).not.toBeNull();
            expect(result.current.activeSkin!.name).toBe('Default');
        });

        it('should have local skins available', async () => {
            const { result } = renderHook(() => useSkin(), { wrapper });

            await waitFor(() => {
                expect(result.current.allSkins.length).toBeGreaterThanOrEqual(2);
            });

            const skinNames = result.current.allSkins.map((s) => s.name);
            expect(skinNames).toContain('Default');
            expect(skinNames).toContain('Minimal');
        });
    });

    describe('switchSkin', () => {
        it('should switch to a local skin when API is unavailable', async () => {
            const { result } = renderHook(() => useSkin(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.switchSkin('minimal-local');
            });

            expect(result.current.activeSkin!.name).toBe('Minimal');
            expect(result.current.activeSkin!.sidebar).toHaveLength(2);
        });
    });

    describe('useSkin outside provider', () => {
        it('should throw when used outside SkinProvider', () => {
            expect(() => {
                renderHook(() => useSkin());
            }).toThrow('useSkin must be used within SkinProvider');
        });
    });

    describe('default skin structure', () => {
        it('should have the expected sidebar items', async () => {
            const { result } = renderHook(() => useSkin(), { wrapper });

            await waitFor(() => {
                expect(result.current.activeSkin).not.toBeNull();
            });

            const sidebarIds = result.current.activeSkin!.sidebar.map((s) => s.commandId);
            expect(sidebarIds).toContain('navigate.home');
            expect(sidebarIds.length).toBeGreaterThanOrEqual(1);
        });

        it('should have branding with appName', async () => {
            const { result } = renderHook(() => useSkin(), { wrapper });

            await waitFor(() => {
                expect(result.current.activeSkin).not.toBeNull();
            });

            expect(result.current.activeSkin!.branding.appName).toBe('Surdej');
        });
    });
});
