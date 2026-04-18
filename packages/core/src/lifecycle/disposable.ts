/**
 * Disposable System
 *
 * VS Code-inspired lifecycle management. Every resource that needs cleanup
 * implements IDisposable. DisposableStore manages groups of disposables.
 *
 * @module lifecycle
 */

/**
 * An object that can release resources.
 */
export interface IDisposable {
    dispose(): void;
}

/**
 * Tracks disposables in development mode to detect leaks.
 * Enable by calling `enableLeakTracker()`.
 */
class LeakTracker {
    private _tracking = false;
    private _stacks = new Map<IDisposable, string>();

    enable(): void {
        this._tracking = true;
    }

    disable(): void {
        this._tracking = false;
        this._stacks.clear();
    }

    get isEnabled(): boolean {
        return this._tracking;
    }

    track(disposable: IDisposable): void {
        if (!this._tracking) return;
        this._stacks.set(disposable, new Error().stack ?? '');
    }

    untrack(disposable: IDisposable): void {
        this._stacks.delete(disposable);
    }

    getLeaks(): Array<{ disposable: IDisposable; stack: string }> {
        return Array.from(this._stacks.entries()).map(([disposable, stack]) => ({
            disposable,
            stack,
        }));
    }
}

/** Global leak tracker instance */
export const leakTracker = new LeakTracker();

/** Enable disposable leak tracking (development only) */
export function enableLeakTracker(): void {
    leakTracker.enable();
}

/** Disable disposable leak tracking */
export function disableLeakTracker(): void {
    leakTracker.disable();
}

/**
 * Check if an object is disposed.
 */
const DISPOSED = Symbol('disposed');

/**
 * Mark an object as disposed. Used internally.
 */
function markAsDisposed(disposable: IDisposable): void {
    (disposable as unknown as Record<symbol, boolean>)[DISPOSED] = true;
}

/**
 * Check if an object has been disposed.
 */
export function isDisposed(disposable: IDisposable): boolean {
    return (disposable as unknown as Record<symbol, boolean>)[DISPOSED] === true;
}

/**
 * Base class for disposable resources.
 * Subclass this and override `dispose()` to add cleanup logic.
 */
export class Disposable implements IDisposable {
    private _isDisposed = false;

    constructor() {
        leakTracker.track(this);
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    dispose(): void {
        if (this._isDisposed) return;
        this._isDisposed = true;
        markAsDisposed(this);
        leakTracker.untrack(this);
    }

    /**
     * Throw if this disposable has already been disposed.
     */
    protected throwIfDisposed(): void {
        if (this._isDisposed) {
            throw new Error('Object has been disposed');
        }
    }
}

/**
 * Manages a collection of disposables. Disposing the store disposes all its members.
 */
export class DisposableStore implements IDisposable {
    private _disposables = new Set<IDisposable>();
    private _isDisposed = false;

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * Add a disposable to the store. Returns the same disposable for chaining.
     */
    add<T extends IDisposable>(disposable: T): T {
        if (this._isDisposed) {
            console.warn('Adding to an already disposed DisposableStore');
            disposable.dispose();
            return disposable;
        }
        this._disposables.add(disposable);
        return disposable;
    }

    /**
     * Remove a disposable from the store without disposing it.
     */
    delete(disposable: IDisposable): void {
        this._disposables.delete(disposable);
    }

    /**
     * Dispose all members and clear the store. The store can be reused after clear.
     */
    clear(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables.clear();
    }

    /**
     * Dispose all members and mark the store as disposed. Cannot be reused.
     */
    dispose(): void {
        if (this._isDisposed) return;
        this._isDisposed = true;
        this.clear();
    }

    /**
     * Number of disposables in the store.
     */
    get size(): number {
        return this._disposables.size;
    }
}

/**
 * Holds a single disposable that can be replaced. Replacing disposes the previous one.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
    private _value: T | undefined;
    private _isDisposed = false;

    get value(): T | undefined {
        return this._isDisposed ? undefined : this._value;
    }

    set value(value: T | undefined) {
        if (this._isDisposed) {
            value?.dispose();
            return;
        }
        if (this._value === value) return;
        this._value?.dispose();
        this._value = value;
    }

    dispose(): void {
        if (this._isDisposed) return;
        this._isDisposed = true;
        this._value?.dispose();
        this._value = undefined;
    }
}

/**
 * Create a disposable from a dispose function.
 */
export function toDisposable(fn: () => void): IDisposable {
    const d: IDisposable = {
        dispose() {
            leakTracker.untrack(d);
            fn();
            markAsDisposed(d);
        },
    };
    leakTracker.track(d);
    return d;
}

/**
 * Combine multiple disposables into a single disposable.
 */
export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
    return toDisposable(() => {
        for (const d of disposables) {
            d.dispose();
        }
    });
}
