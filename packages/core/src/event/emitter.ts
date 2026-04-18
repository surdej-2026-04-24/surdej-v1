/**
 * Event System
 *
 * VS Code-inspired event emitter. Events follow the naming convention:
 * - `onDid*` — event fired after something happened
 * - `onWill*` — event fired before something is about to happen
 *
 * All subscriptions return IDisposable for automatic cleanup.
 *
 * @module event
 */

import type { IDisposable } from '../lifecycle/disposable.js';

/**
 * A function that represents an event you can subscribe to.
 * Call it with a listener to subscribe. Returns IDisposable to unsubscribe.
 */
export type Event<T> = (listener: (e: T) => void) => IDisposable;

/**
 * Create an Event from an Emitter.
 */
export class Emitter<T> implements IDisposable {
    private _listeners = new Set<(e: T) => void>();
    private _disposed = false;

    /**
     * The event that consumers can subscribe to.
     *
     * @example
     * ```ts
     * const emitter = new Emitter<string>();
     * const subscription = emitter.event((value) => console.log(value));
     * emitter.fire('hello'); // logs: hello
     * subscription.dispose(); // unsubscribes
     * ```
     */
    readonly event: Event<T> = (listener: (e: T) => void): IDisposable => {
        if (this._disposed) {
            console.warn('Subscribing to a disposed Emitter');
            return { dispose: () => { } };
        }

        this._listeners.add(listener);

        return {
            dispose: () => {
                this._listeners.delete(listener);
            },
        };
    };

    /**
     * Fire the event, notifying all listeners.
     */
    fire(event: T): void {
        if (this._disposed) return;
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error('Error in event listener:', err);
            }
        }
    }

    /**
     * Check if the emitter has any listeners.
     */
    get hasListeners(): boolean {
        return this._listeners.size > 0;
    }

    /**
     * Number of active listeners.
     */
    get listenerCount(): number {
        return this._listeners.size;
    }

    /**
     * Dispose the emitter and remove all listeners.
     */
    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        this._listeners.clear();
    }
}

/**
 * An event that fires only once — auto-disposes after the first fire.
 */
export function onceEvent<T>(event: Event<T>): Event<T> {
    return (listener: (e: T) => void): IDisposable => {
        let didFire = false;
        const sub = event((e) => {
            if (didFire) return;
            didFire = true;
            sub.dispose();
            listener(e);
        });
        return sub;
    };
}

/**
 * Debounce an event — only fires after the event stops for `delay` ms.
 */
export function debounceEvent<T>(event: Event<T>, delay: number): Event<T> {
    return (listener: (e: T) => void): IDisposable => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const sub = event((e) => {
            clearTimeout(timer);
            timer = setTimeout(() => listener(e), delay);
        });
        return {
            dispose: () => {
                clearTimeout(timer);
                sub.dispose();
            },
        };
    };
}
