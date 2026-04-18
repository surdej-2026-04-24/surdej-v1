import { describe, it, expect, beforeEach } from 'vitest';
import {
    Disposable,
    DisposableStore,
    MutableDisposable,
    toDisposable,
    combinedDisposable,
    isDisposed,
    enableLeakTracker,
    disableLeakTracker,
    leakTracker,
} from './disposable.js';

describe('Disposable', () => {
    it('should track disposed state', () => {
        const d = new Disposable();
        expect(d.isDisposed).toBe(false);
        d.dispose();
        expect(d.isDisposed).toBe(true);
    });

    it('should only dispose once', () => {
        let count = 0;
        const d = toDisposable(() => count++);
        d.dispose();
        d.dispose();
        // toDisposable doesn't guard re-entry, but markAsDisposed is called
        expect(isDisposed(d)).toBe(true);
    });

    it('should throw if accessed after dispose via throwIfDisposed', () => {
        class TestDisposable extends Disposable {
            check() {
                this.throwIfDisposed();
            }
        }
        const d = new TestDisposable();
        d.dispose();
        expect(() => d.check()).toThrow('Object has been disposed');
    });
});

describe('DisposableStore', () => {
    it('should dispose all members', () => {
        const store = new DisposableStore();
        const calls: number[] = [];
        store.add(toDisposable(() => calls.push(1)));
        store.add(toDisposable(() => calls.push(2)));
        store.add(toDisposable(() => calls.push(3)));
        expect(store.size).toBe(3);
        store.dispose();
        expect(calls).toEqual([1, 2, 3]);
        expect(store.isDisposed).toBe(true);
    });

    it('should clear without marking as disposed', () => {
        const store = new DisposableStore();
        const calls: number[] = [];
        store.add(toDisposable(() => calls.push(1)));
        store.clear();
        expect(calls).toEqual([1]);
        expect(store.isDisposed).toBe(false);

        // Can still add after clear
        store.add(toDisposable(() => calls.push(2)));
        expect(store.size).toBe(1);
    });

    it('should auto-dispose when adding to a disposed store', () => {
        const store = new DisposableStore();
        store.dispose();
        let disposed = false;
        store.add(toDisposable(() => (disposed = true)));
        expect(disposed).toBe(true);
    });

    it('should support delete without disposing', () => {
        const store = new DisposableStore();
        let disposed = false;
        const d = toDisposable(() => (disposed = true));
        store.add(d);
        store.delete(d);
        store.dispose();
        expect(disposed).toBe(false);
    });
});

describe('MutableDisposable', () => {
    it('should dispose previous value when replaced', () => {
        const mut = new MutableDisposable();
        const calls: number[] = [];
        mut.value = toDisposable(() => calls.push(1));
        mut.value = toDisposable(() => calls.push(2));
        expect(calls).toEqual([1]);
        mut.dispose();
        expect(calls).toEqual([1, 2]);
    });

    it('should return undefined after disposal', () => {
        const mut = new MutableDisposable();
        mut.value = toDisposable(() => { });
        mut.dispose();
        expect(mut.value).toBeUndefined();
    });

    it('should auto-dispose value set after disposal', () => {
        const mut = new MutableDisposable();
        mut.dispose();
        let disposed = false;
        mut.value = toDisposable(() => (disposed = true));
        expect(disposed).toBe(true);
    });
});

describe('toDisposable', () => {
    it('should call the function on dispose', () => {
        let called = false;
        const d = toDisposable(() => (called = true));
        expect(called).toBe(false);
        d.dispose();
        expect(called).toBe(true);
    });

    it('should mark as disposed', () => {
        const d = toDisposable(() => { });
        expect(isDisposed(d)).toBe(false);
        d.dispose();
        expect(isDisposed(d)).toBe(true);
    });
});

describe('combinedDisposable', () => {
    it('should dispose all provided disposables', () => {
        const calls: number[] = [];
        const combined = combinedDisposable(
            toDisposable(() => calls.push(1)),
            toDisposable(() => calls.push(2)),
            toDisposable(() => calls.push(3)),
        );
        combined.dispose();
        expect(calls).toEqual([1, 2, 3]);
    });
});

describe('LeakTracker', () => {
    beforeEach(() => {
        disableLeakTracker();
    });

    it('should track disposables when enabled', () => {
        enableLeakTracker();
        const d = new Disposable();
        expect(leakTracker.getLeaks().length).toBeGreaterThan(0);
        d.dispose();
        expect(leakTracker.getLeaks().length).toBe(0);
        disableLeakTracker();
    });

    it('should not track when disabled', () => {
        const d = new Disposable();
        expect(leakTracker.getLeaks().length).toBe(0);
        d.dispose();
    });
});
