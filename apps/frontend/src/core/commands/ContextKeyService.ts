import { create } from 'zustand';

// ─── Types ───

export interface ContextKeyState {
    keys: Record<string, unknown>;

    set: (key: string, value: unknown) => void;
    get: (key: string) => unknown;
    reset: (key: string) => void;
    evaluate: (expr: string) => boolean;
}

/**
 * ContextKeyService — manages boolean/string context keys used by `when` clauses.
 *
 * Supports simple expressions:
 *   - `isAuthenticated`           → truthy check
 *   - `!isDemo`                   → negation
 *   - `isAdmin && isAuthenticated` → AND
 *   - `isAdmin || isDemo`         → OR
 *   - `role == 'SUPER_ADMIN'`     → equality
 */
export const useContextKeys = create<ContextKeyState>((set, get) => ({
    keys: {},

    set: (key, value) => {
        set((state) => ({
            keys: { ...state.keys, [key]: value },
        }));
    },

    get: (key) => get().keys[key],

    reset: (key) => {
        set((state) => {
            const next = { ...state.keys };
            delete next[key];
            return { keys: next };
        });
    },

    evaluate: (expr) => {
        if (!expr || !expr.trim()) return true;

        const keys = get().keys;

        // Handle OR (lowest precedence)
        if (expr.includes('||')) {
            return expr.split('||').some((part) => evaluateSimple(part.trim(), keys));
        }

        // Handle AND
        if (expr.includes('&&')) {
            return expr.split('&&').every((part) => evaluateSimple(part.trim(), keys));
        }

        return evaluateSimple(expr.trim(), keys);
    },
}));

function evaluateSimple(expr: string, keys: Record<string, unknown>): boolean {
    // Negation: !key
    if (expr.startsWith('!')) {
        return !evaluateSimple(expr.slice(1).trim(), keys);
    }

    // Equality: key == 'value' or key == value
    if (expr.includes('==')) {
        const [left, right] = expr.split('==').map((s) => s.trim());
        const leftVal = keys[left!];
        const rightVal = right!.replace(/^['"]|['"]$/g, '');
        return String(leftVal) === rightVal;
    }

    // Inequality: key != 'value'
    if (expr.includes('!=')) {
        const [left, right] = expr.split('!=').map((s) => s.trim());
        const leftVal = keys[left!];
        const rightVal = right!.replace(/^['"]|['"]$/g, '');
        return String(leftVal) !== rightVal;
    }

    // Truthy check
    return Boolean(keys[expr]);
}
