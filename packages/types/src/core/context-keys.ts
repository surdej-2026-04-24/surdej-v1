/**
 * Context key types — mirrors @surdej/core/context-keys
 */

export type ContextKeyExpr =
    | { type: 'equals'; key: string; value: string | boolean }
    | { type: 'not'; expr: ContextKeyExpr }
    | { type: 'and'; exprs: ContextKeyExpr[] }
    | { type: 'or'; exprs: ContextKeyExpr[] };

export interface IContextKeyBinding {
    key: string;
    get(): string | boolean | undefined;
    set(value: string | boolean): void;
    reset(): void;
}

export interface IContextKeyService {
    createKey<T extends string | boolean>(key: string, defaultValue: T): IContextKeyBinding;
    getContextKeyValue(key: string): string | boolean | undefined;
    evaluate(expr: ContextKeyExpr): boolean;
}
