/**
 * Context Key System
 *
 * VS Code-inspired context keys for conditional UI.
 * Context keys are reactive values that control `when` clause evaluation.
 *
 * @module context-keys
 */

import type { IDisposable } from '../lifecycle/disposable.js';
import type { Event } from '../event/emitter.js';

/**
 * A typed context key declaration.
 */
export class RawContextKey<T> {
    constructor(
        public readonly key: string,
        public readonly defaultValue: T,
        public readonly description?: string,
    ) { }

    /**
     * Creates a `when` expression that checks if this key equals a value.
     */
    isEqualTo(value: T): string {
        return `${this.key} == '${String(value)}'`;
    }

    /**
     * Creates a `when` expression that checks if this key is truthy.
     */
    toWhen(): string {
        return this.key;
    }

    /**
     * Creates a negated `when` expression.
     */
    negate(): string {
        return `!${this.key}`;
    }
}

/**
 * Well-known context keys used across the platform.
 */
export const CONTEXT_KEYS = {
    /** Whether the user is authenticated */
    IS_AUTHENTICATED: new RawContextKey<boolean>('isAuthenticated', false),

    /** Whether the app is in demo mode */
    IS_DEMO: new RawContextKey<boolean>('isDemo', false),

    /** The currently active skin ID */
    SKIN_ID: new RawContextKey<string>('skinId', 'default'),

    /** The current route path */
    CURRENT_ROUTE: new RawContextKey<string>('currentRoute', '/'),

    /** Whether the sidebar is collapsed */
    SIDEBAR_COLLAPSED: new RawContextKey<boolean>('sidebar.collapsed', false),

    /** Whether the command palette is open */
    PALETTE_OPEN: new RawContextKey<boolean>('palette.open', false),

    /** Whether the topology explorer panel is open */
    TOPOLOGY_EXPLORER_OPEN: new RawContextKey<boolean>('topology.explorer.open', true),

    /** Whether the topology property pane is open */
    TOPOLOGY_PROPERTIES_OPEN: new RawContextKey<boolean>('topology.properties.open', false),
} as const;

/**
 * Supported operators in context key expressions.
 */
export type ContextKeyExprOperator = '==' | '!=' | '&&' | '||' | '!' | 'in';

/**
 * Parsed context key expression node.
 */
export type ContextKeyExpr =
    | { type: 'key'; key: string }
    | { type: 'not'; expr: ContextKeyExpr }
    | { type: 'equals'; key: string; value: string }
    | { type: 'notEquals'; key: string; value: string }
    | { type: 'and'; exprs: ContextKeyExpr[] }
    | { type: 'or'; exprs: ContextKeyExpr[] }
    | { type: 'in'; key: string; values: string[] };

/**
 * Parse a `when` clause string into a ContextKeyExpr.
 *
 * Supported syntax:
 * - `key` — true if key is truthy
 * - `!key` — negated
 * - `key == 'value'` — equality
 * - `key != 'value'` — inequality
 * - `expr && expr` — conjunction
 * - `expr || expr` — disjunction
 */
export function parseContextKeyExpr(expression: string): ContextKeyExpr {
    const trimmed = expression.trim();

    // OR expressions (lowest precedence)
    if (trimmed.includes('||')) {
        const parts = trimmed.split('||').map((p) => p.trim());
        return { type: 'or', exprs: parts.map(parseContextKeyExpr) };
    }

    // AND expressions
    if (trimmed.includes('&&')) {
        const parts = trimmed.split('&&').map((p) => p.trim());
        return { type: 'and', exprs: parts.map(parseContextKeyExpr) };
    }

    // Negation
    if (trimmed.startsWith('!')) {
        return { type: 'not', expr: parseContextKeyExpr(trimmed.slice(1)) };
    }

    // Equality
    if (trimmed.includes('==')) {
        const [key, value] = trimmed.split('==').map((p) => p.trim());
        return { type: 'equals', key, value: value.replace(/['"]/g, '') };
    }

    // Inequality
    if (trimmed.includes('!=')) {
        const [key, value] = trimmed.split('!=').map((p) => p.trim());
        return { type: 'notEquals', key, value: value.replace(/['"]/g, '') };
    }

    // Simple key check
    return { type: 'key', key: trimmed };
}

/**
 * Evaluate a ContextKeyExpr against a context values map.
 */
export function evaluateContextKeyExpr(
    expr: ContextKeyExpr,
    context: ReadonlyMap<string, unknown>,
): boolean {
    switch (expr.type) {
        case 'key':
            return !!context.get(expr.key);
        case 'not':
            return !evaluateContextKeyExpr(expr.expr, context);
        case 'equals':
            return String(context.get(expr.key) ?? '') === expr.value;
        case 'notEquals':
            return String(context.get(expr.key) ?? '') !== expr.value;
        case 'and':
            return expr.exprs.every((e) => evaluateContextKeyExpr(e, context));
        case 'or':
            return expr.exprs.some((e) => evaluateContextKeyExpr(e, context));
        case 'in':
            return expr.values.includes(String(context.get(expr.key) ?? ''));
    }
}

/**
 * Evaluate a `when` clause string against a context values map.
 * Returns true if the expression is empty or evaluates to true.
 */
export function evaluateWhenClause(
    when: string | undefined,
    context: ReadonlyMap<string, unknown>,
): boolean {
    if (!when || when.trim() === '') return true;
    return evaluateContextKeyExpr(parseContextKeyExpr(when), context);
}

/**
 * Interface for the context key service (runtime implementation is in frontend Zustand store).
 */
export interface IContextKeyService {
    /**
     * Get the current value of a context key.
     */
    get<T>(key: RawContextKey<T>): T;

    /**
     * Set a context key value.
     */
    set<T>(key: RawContextKey<T>, value: T): void;

    /**
     * Reset a context key to its default value.
     */
    reset<T>(key: RawContextKey<T>): void;

    /**
     * Bind to a context key—returns an object with `set()` and `reset()` methods.
     */
    bindTo<T>(key: RawContextKey<T>): IContextKeyBinding<T>;

    /**
     * Event fired when any context key changes.
     */
    onDidChangeContext: Event<string>;
}

/**
 * A binding to a specific context key.
 */
export interface IContextKeyBinding<T> extends IDisposable {
    set(value: T): void;
    reset(): void;
    get(): T;
}
