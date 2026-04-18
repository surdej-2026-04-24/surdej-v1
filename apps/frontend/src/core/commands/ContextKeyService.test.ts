import { describe, it, expect, beforeEach } from 'vitest';
import { useContextKeys } from './ContextKeyService';

beforeEach(() => {
    useContextKeys.setState({ keys: {} });
});

describe('ContextKeyService', () => {
    describe('set / get', () => {
        it('should set and get a boolean key', () => {
            const s = useContextKeys.getState();
            s.set('isAuthenticated', true);
            expect(useContextKeys.getState().get('isAuthenticated')).toBe(true);
        });

        it('should set and get a string key', () => {
            const s = useContextKeys.getState();
            s.set('role', 'SUPER_ADMIN');
            expect(useContextKeys.getState().get('role')).toBe('SUPER_ADMIN');
        });

        it('should return undefined for unknown keys', () => {
            expect(useContextKeys.getState().get('unknown')).toBeUndefined();
        });

        it('should overwrite existing keys', () => {
            const s = useContextKeys.getState();
            s.set('key', 'first');
            s.set('key', 'second');
            expect(useContextKeys.getState().get('key')).toBe('second');
        });
    });

    describe('reset', () => {
        it('should remove a key', () => {
            const s = useContextKeys.getState();
            s.set('toRemove', true);
            s.reset('toRemove');
            expect(useContextKeys.getState().get('toRemove')).toBeUndefined();
        });

        it('should be safe to reset non-existent keys', () => {
            expect(() => useContextKeys.getState().reset('nope')).not.toThrow();
        });
    });

    describe('evaluate', () => {
        describe('simple truthy', () => {
            it('should return true for truthy key', () => {
                useContextKeys.getState().set('isActive', true);
                expect(useContextKeys.getState().evaluate('isActive')).toBe(true);
            });

            it('should return false for falsy key', () => {
                useContextKeys.getState().set('isActive', false);
                expect(useContextKeys.getState().evaluate('isActive')).toBe(false);
            });

            it('should return false for undefined key', () => {
                expect(useContextKeys.getState().evaluate('missing')).toBe(false);
            });

            it('should return true for empty/blank expression', () => {
                expect(useContextKeys.getState().evaluate('')).toBe(true);
                expect(useContextKeys.getState().evaluate('  ')).toBe(true);
            });
        });

        describe('negation (!)', () => {
            it('should negate truthy key', () => {
                useContextKeys.getState().set('isDemo', true);
                expect(useContextKeys.getState().evaluate('!isDemo')).toBe(false);
            });

            it('should negate falsy key', () => {
                useContextKeys.getState().set('isDemo', false);
                expect(useContextKeys.getState().evaluate('!isDemo')).toBe(true);
            });

            it('should negate undefined key (truthy)', () => {
                expect(useContextKeys.getState().evaluate('!undefined_key')).toBe(true);
            });
        });

        describe('AND (&&)', () => {
            it('should return true when all parts are truthy', () => {
                const s = useContextKeys.getState();
                s.set('a', true);
                s.set('b', true);
                expect(useContextKeys.getState().evaluate('a && b')).toBe(true);
            });

            it('should return false when any part is falsy', () => {
                const s = useContextKeys.getState();
                s.set('a', true);
                s.set('b', false);
                expect(useContextKeys.getState().evaluate('a && b')).toBe(false);
            });

            it('should handle multiple AND parts', () => {
                const s = useContextKeys.getState();
                s.set('a', true);
                s.set('b', true);
                s.set('c', true);
                expect(useContextKeys.getState().evaluate('a && b && c')).toBe(true);
            });
        });

        describe('OR (||)', () => {
            it('should return true when any part is truthy', () => {
                const s = useContextKeys.getState();
                s.set('a', false);
                s.set('b', true);
                expect(useContextKeys.getState().evaluate('a || b')).toBe(true);
            });

            it('should return false when all parts are falsy', () => {
                const s = useContextKeys.getState();
                s.set('a', false);
                s.set('b', false);
                expect(useContextKeys.getState().evaluate('a || b')).toBe(false);
            });
        });

        describe('equality (==)', () => {
            it('should compare string values', () => {
                useContextKeys.getState().set('role', 'SUPER_ADMIN');
                expect(useContextKeys.getState().evaluate("role == 'SUPER_ADMIN'")).toBe(true);
                expect(useContextKeys.getState().evaluate("role == 'USER'")).toBe(false);
            });

            it('should handle double-quoted values', () => {
                useContextKeys.getState().set('role', 'ADMIN');
                expect(useContextKeys.getState().evaluate('role == "ADMIN"')).toBe(true);
            });
        });

        describe('inequality (!=)', () => {
            it('should return true for non-matching values', () => {
                useContextKeys.getState().set('env', 'dev');
                expect(useContextKeys.getState().evaluate("env != 'prod'")).toBe(true);
            });

            it('should return false for matching values', () => {
                useContextKeys.getState().set('env', 'prod');
                expect(useContextKeys.getState().evaluate("env != 'prod'")).toBe(false);
            });
        });
    });
});
