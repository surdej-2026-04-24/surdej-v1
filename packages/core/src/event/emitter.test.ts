import { describe, it, expect } from 'vitest';
import { Emitter, onceEvent, debounceEvent } from './emitter.js';

describe('Emitter', () => {
    it('should fire event to listeners', () => {
        const emitter = new Emitter<string>();
        const received: string[] = [];
        emitter.event((e) => received.push(e));
        emitter.fire('hello');
        emitter.fire('world');
        expect(received).toEqual(['hello', 'world']);
    });

    it('should remove listener on dispose', () => {
        const emitter = new Emitter<string>();
        const received: string[] = [];
        const sub = emitter.event((e) => received.push(e));
        emitter.fire('before');
        sub.dispose();
        emitter.fire('after');
        expect(received).toEqual(['before']);
    });

    it('should support multiple listeners', () => {
        const emitter = new Emitter<number>();
        const a: number[] = [];
        const b: number[] = [];
        emitter.event((e) => a.push(e));
        emitter.event((e) => b.push(e));
        emitter.fire(42);
        expect(a).toEqual([42]);
        expect(b).toEqual([42]);
    });

    it('should report hasListeners correctly', () => {
        const emitter = new Emitter<void>();
        expect(emitter.hasListeners).toBe(false);
        const sub = emitter.event(() => { });
        expect(emitter.hasListeners).toBe(true);
        sub.dispose();
        expect(emitter.hasListeners).toBe(false);
    });

    it('should clear listeners on dispose', () => {
        const emitter = new Emitter<string>();
        const received: string[] = [];
        emitter.event((e) => received.push(e));
        emitter.dispose();
        emitter.fire('ignored');
        expect(received).toEqual([]);
        expect(emitter.listenerCount).toBe(0);
    });

    it('should handle errors in listeners without crashing', () => {
        const emitter = new Emitter<number>();
        const received: number[] = [];
        emitter.event(() => {
            throw new Error('boom');
        });
        emitter.event((e) => received.push(e));
        emitter.fire(1);
        expect(received).toEqual([1]);
    });

    it('should warn when subscribing to disposed emitter', () => {
        const emitter = new Emitter<void>();
        emitter.dispose();
        const sub = emitter.event(() => { });
        // Should return a no-op disposable
        sub.dispose(); // should not throw
    });
});

describe('onceEvent', () => {
    it('should fire only once', () => {
        const emitter = new Emitter<number>();
        const received: number[] = [];
        onceEvent(emitter.event)((e) => received.push(e));
        emitter.fire(1);
        emitter.fire(2);
        emitter.fire(3);
        expect(received).toEqual([1]);
    });
});

describe('debounceEvent', () => {
    it('should debounce events', async () => {
        const emitter = new Emitter<number>();
        const received: number[] = [];
        debounceEvent(emitter.event, 50)((e) => received.push(e));

        emitter.fire(1);
        emitter.fire(2);
        emitter.fire(3);

        // Should not have fired yet
        expect(received).toEqual([]);

        // Wait for debounce
        await new Promise((r) => setTimeout(r, 100));
        expect(received).toEqual([3]); // Only last value
    });
});
