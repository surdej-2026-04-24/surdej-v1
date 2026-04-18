import { describe, it, expect } from 'vitest';
import {
    RawContextKey,
    parseContextKeyExpr,
    evaluateContextKeyExpr,
    evaluateWhenClause,
    CONTEXT_KEYS,
} from './context-keys.js';

describe('RawContextKey', () => {
    it('should create a context key with defaults', () => {
        const key = new RawContextKey('test.key', true, 'A test key');
        expect(key.key).toBe('test.key');
        expect(key.defaultValue).toBe(true);
        expect(key.description).toBe('A test key');
    });

    it('should generate when expressions', () => {
        const key = new RawContextKey('isAdmin', false);
        expect(key.toWhen()).toBe('isAdmin');
        expect(key.negate()).toBe('!isAdmin');
        expect(key.isEqualTo(true)).toBe("isAdmin == 'true'");
    });
});

describe('parseContextKeyExpr', () => {
    it('should parse simple key', () => {
        const expr = parseContextKeyExpr('isAuthenticated');
        expect(expr).toEqual({ type: 'key', key: 'isAuthenticated' });
    });

    it('should parse negation', () => {
        const expr = parseContextKeyExpr('!isDemo');
        expect(expr).toEqual({
            type: 'not',
            expr: { type: 'key', key: 'isDemo' },
        });
    });

    it('should parse equality', () => {
        const expr = parseContextKeyExpr("skinId == 'dark'");
        expect(expr).toEqual({ type: 'equals', key: 'skinId', value: 'dark' });
    });

    it('should parse inequality', () => {
        const expr = parseContextKeyExpr("role != 'guest'");
        expect(expr).toEqual({ type: 'notEquals', key: 'role', value: 'guest' });
    });

    it('should parse AND expressions', () => {
        const expr = parseContextKeyExpr('isAuthenticated && !isDemo');
        expect(expr).toEqual({
            type: 'and',
            exprs: [
                { type: 'key', key: 'isAuthenticated' },
                { type: 'not', expr: { type: 'key', key: 'isDemo' } },
            ],
        });
    });

    it('should parse OR expressions', () => {
        const expr = parseContextKeyExpr('isAdmin || isSuperAdmin');
        expect(expr).toEqual({
            type: 'or',
            exprs: [
                { type: 'key', key: 'isAdmin' },
                { type: 'key', key: 'isSuperAdmin' },
            ],
        });
    });
});

describe('evaluateContextKeyExpr', () => {
    const ctx = new Map<string, unknown>([
        ['isAuthenticated', true],
        ['isDemo', false],
        ['skinId', 'dark'],
        ['role', 'admin'],
    ]);

    it('should evaluate truthy key', () => {
        expect(evaluateContextKeyExpr({ type: 'key', key: 'isAuthenticated' }, ctx)).toBe(true);
    });

    it('should evaluate falsy key', () => {
        expect(evaluateContextKeyExpr({ type: 'key', key: 'isDemo' }, ctx)).toBe(false);
    });

    it('should evaluate missing key as falsy', () => {
        expect(evaluateContextKeyExpr({ type: 'key', key: 'nonexistent' }, ctx)).toBe(false);
    });

    it('should evaluate not', () => {
        expect(
            evaluateContextKeyExpr({ type: 'not', expr: { type: 'key', key: 'isDemo' } }, ctx),
        ).toBe(true);
    });

    it('should evaluate equals', () => {
        expect(evaluateContextKeyExpr({ type: 'equals', key: 'skinId', value: 'dark' }, ctx)).toBe(
            true,
        );
        expect(evaluateContextKeyExpr({ type: 'equals', key: 'skinId', value: 'light' }, ctx)).toBe(
            false,
        );
    });

    it('should evaluate notEquals', () => {
        expect(
            evaluateContextKeyExpr({ type: 'notEquals', key: 'role', value: 'guest' }, ctx),
        ).toBe(true);
    });

    it('should evaluate and', () => {
        expect(
            evaluateContextKeyExpr(
                {
                    type: 'and',
                    exprs: [
                        { type: 'key', key: 'isAuthenticated' },
                        { type: 'not', expr: { type: 'key', key: 'isDemo' } },
                    ],
                },
                ctx,
            ),
        ).toBe(true);
    });

    it('should evaluate or', () => {
        expect(
            evaluateContextKeyExpr(
                {
                    type: 'or',
                    exprs: [
                        { type: 'key', key: 'isDemo' },
                        { type: 'key', key: 'isAuthenticated' },
                    ],
                },
                ctx,
            ),
        ).toBe(true);
    });
});

describe('evaluateWhenClause', () => {
    const ctx = new Map<string, unknown>([
        ['isAuthenticated', true],
        ['isDemo', false],
    ]);

    it('should return true for empty/undefined when clause', () => {
        expect(evaluateWhenClause(undefined, ctx)).toBe(true);
        expect(evaluateWhenClause('', ctx)).toBe(true);
    });

    it('should evaluate string when clauses', () => {
        expect(evaluateWhenClause('isAuthenticated', ctx)).toBe(true);
        expect(evaluateWhenClause('isDemo', ctx)).toBe(false);
        expect(evaluateWhenClause('isAuthenticated && !isDemo', ctx)).toBe(true);
    });
});

describe('CONTEXT_KEYS', () => {
    it('should have well-known keys defined', () => {
        expect(CONTEXT_KEYS.IS_AUTHENTICATED.key).toBe('isAuthenticated');
        expect(CONTEXT_KEYS.IS_DEMO.key).toBe('isDemo');
        expect(CONTEXT_KEYS.SKIN_ID.key).toBe('skinId');
        expect(CONTEXT_KEYS.CURRENT_ROUTE.key).toBe('currentRoute');
        expect(CONTEXT_KEYS.SIDEBAR_COLLAPSED.key).toBe('sidebar.collapsed');
        expect(CONTEXT_KEYS.PALETTE_OPEN.key).toBe('palette.open');
        expect(CONTEXT_KEYS.TOPOLOGY_EXPLORER_OPEN.key).toBe('topology.explorer.open');
        expect(CONTEXT_KEYS.TOPOLOGY_PROPERTIES_OPEN.key).toBe('topology.properties.open');
    });
});
