import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FeedbackProvider, useFeedback } from './FeedbackContext';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
    return FeedbackProvider({ children });
}

beforeEach(() => {
    localStorage.clear();
});

describe('FeedbackContext', () => {
    describe('createEntry', () => {
        it('should create a new feedback entry', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => {
                entry = result.current.createEntry();
            });
            expect(entry!).toBeDefined();
            expect(entry!.id).toMatch(/^fb-/);
            expect(entry!.status).toBe('draft');
            expect(entry!.type).toBe('bug');
            expect(entry!.priority).toBe('medium');
        });

        it('should add entry to the entries list', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            act(() => { result.current.createEntry(); });
            expect(result.current.entries).toHaveLength(1);
        });

        it('should set the new entry as active', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            expect(result.current.activeEntry?.id).toBe(entry!.id);
        });

        it('should persist entries to localStorage', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            act(() => { result.current.createEntry(); });
            const stored = localStorage.getItem('surdej_feedback_entries');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed).toHaveLength(1);
        });
    });

    describe('updateEntry', () => {
        it('should update an existing entry', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            act(() => {
                result.current.updateEntry(entry!.id, { title: 'Bug Report' });
            });
            expect(result.current.entries[0].title).toBe('Bug Report');
        });

        it('should update the active entry if it matches', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            act(() => {
                result.current.updateEntry(entry!.id, { title: 'Updated' });
            });
            expect(result.current.activeEntry?.title).toBe('Updated');
        });
    });

    describe('deleteEntry', () => {
        it('should remove entry from list', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            act(() => { result.current.deleteEntry(entry!.id); });
            expect(result.current.entries).toHaveLength(0);
        });

        it('should clear activeEntry if deleted entry was active', () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            act(() => { result.current.deleteEntry(entry!.id); });
            expect(result.current.activeEntry).toBeNull();
        });
    });

    describe('submitEntry', () => {
        it('should mark entry as submitted', async () => {
            const { result } = renderHook(() => useFeedback(), { wrapper });
            let entry: ReturnType<typeof result.current.createEntry>;
            act(() => { entry = result.current.createEntry(); });
            await act(async () => {
                await result.current.submitEntry(entry!.id);
            });
            expect(result.current.entries[0].status).toBe('submitted');
        });
    });

    describe('useFeedback outside provider', () => {
        it('should throw when used outside FeedbackProvider', () => {
            expect(() => {
                renderHook(() => useFeedback());
            }).toThrow('useFeedback must be used within FeedbackProvider');
        });
    });
});
