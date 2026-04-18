import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommandRegistry } from './CommandRegistry';

// Reset the store before each test
beforeEach(() => {
    const state = useCommandRegistry.getState();
    // Clear all commands
    for (const id of state.commands.keys()) {
        state.unregister(id);
    }
    // Reset recent
    useCommandRegistry.setState({ recentIds: [] });
});

function makeCommand(id: string, label?: string) {
    return {
        id,
        label: label ?? id.replace(/\./g, ' '),
        execute: vi.fn(),
    };
}

describe('CommandRegistry', () => {
    describe('register', () => {
        it('should register a command', () => {
            const { register, getById } = useCommandRegistry.getState();
            register(makeCommand('test.cmd'));
            expect(getById('test.cmd')).toBeDefined();
            expect(getById('test.cmd')!.id).toBe('test.cmd');
        });

        it('should return a dispose function', () => {
            const { register, getById } = useCommandRegistry.getState();
            const dispose = register(makeCommand('test.tmp'));
            expect(getById('test.tmp')).toBeDefined();
            dispose();
            expect(useCommandRegistry.getState().getById('test.tmp')).toBeUndefined();
        });

        it('should overwrite existing command with same id', () => {
            const { register, getById } = useCommandRegistry.getState();
            register(makeCommand('dup', 'First'));
            register(makeCommand('dup', 'Second'));
            expect(getById('dup')!.label).toBe('Second');
        });
    });

    describe('unregister', () => {
        it('should remove a registered command', () => {
            const { register, unregister, getById } = useCommandRegistry.getState();
            register(makeCommand('to.remove'));
            unregister('to.remove');
            expect(getById('to.remove')).toBeUndefined();
        });

        it('should be idempotent for non-existent commands', () => {
            const { unregister } = useCommandRegistry.getState();
            expect(() => unregister('does.not.exist')).not.toThrow();
        });
    });

    describe('execute', () => {
        it('should call the command handler', async () => {
            const handler = vi.fn();
            const { register, execute } = useCommandRegistry.getState();
            register({ id: 'run.me', label: 'Run', execute: handler });
            await execute('run.me');
            expect(handler).toHaveBeenCalledOnce();
        });

        it('should pass params to the handler', async () => {
            const handler = vi.fn();
            const { register, execute } = useCommandRegistry.getState();
            register({ id: 'with.params', label: 'Params', execute: handler });
            await execute('with.params', { key: 'val' });
            expect(handler).toHaveBeenCalledWith({ key: 'val' });
        });

        it('should track recent command ids', async () => {
            const { register, execute } = useCommandRegistry.getState();
            register(makeCommand('cmd.a'));
            register(makeCommand('cmd.b'));
            await execute('cmd.a');
            await execute('cmd.b');
            const { recentIds } = useCommandRegistry.getState();
            expect(recentIds[0]).toBe('cmd.b');
            expect(recentIds[1]).toBe('cmd.a');
        });

        it('should de-duplicate recent ids', async () => {
            const { register, execute } = useCommandRegistry.getState();
            register(makeCommand('cmd.x'));
            await execute('cmd.x');
            await execute('cmd.x');
            const { recentIds } = useCommandRegistry.getState();
            expect(recentIds.filter((id) => id === 'cmd.x')).toHaveLength(1);
        });

        it('should cap recent list at 10', async () => {
            const { register, execute } = useCommandRegistry.getState();
            for (let i = 0; i < 15; i++) {
                register(makeCommand('cmd.' + i));
            }
            for (let i = 0; i < 15; i++) {
                await execute('cmd.' + i);
            }
            const { recentIds } = useCommandRegistry.getState();
            expect(recentIds.length).toBeLessThanOrEqual(10);
        });

        it('should warn on unknown command', async () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const { execute } = useCommandRegistry.getState();
            await execute('unknown.cmd');
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('Command not found'),
            );
            spy.mockRestore();
        });
    });

    describe('search', () => {
        it('should return all commands when query is empty', () => {
            const { register, search } = useCommandRegistry.getState();
            register(makeCommand('a'));
            register(makeCommand('b'));
            const results = useCommandRegistry.getState().search('');
            expect(results.length).toBe(2);
        });

        it('should match by label', () => {
            const { register } = useCommandRegistry.getState();
            register(makeCommand('nav.home', 'Navigate Home'));
            register(makeCommand('nav.settings', 'Open Settings'));
            const results = useCommandRegistry.getState().search('home');
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('nav.home');
        });

        it('should match by id', () => {
            const { register } = useCommandRegistry.getState();
            register(makeCommand('navigate.settings', 'Settings'));
            const results = useCommandRegistry.getState().search('navigate');
            expect(results.length).toBe(1);
        });

        it('should match by group', () => {
            const { register } = useCommandRegistry.getState();
            register({ id: 'grouped', label: 'Test', group: 'Navigation', execute: vi.fn() });
            const results = useCommandRegistry.getState().search('navigation');
            expect(results.length).toBe(1);
        });

        it('should be case-insensitive', () => {
            const { register } = useCommandRegistry.getState();
            register(makeCommand('test', 'Hello World'));
            expect(useCommandRegistry.getState().search('HELLO')).toHaveLength(1);
            expect(useCommandRegistry.getState().search('hello')).toHaveLength(1);
        });
    });

    describe('getAll', () => {
        it('should return all registered commands as array', () => {
            const { register, getAll } = useCommandRegistry.getState();
            register(makeCommand('a'));
            register(makeCommand('b'));
            register(makeCommand('c'));
            const all = useCommandRegistry.getState().getAll();
            expect(all).toHaveLength(3);
            expect(all.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
        });
    });

    describe('getById', () => {
        it('should return undefined for unknown id', () => {
            expect(useCommandRegistry.getState().getById('nope')).toBeUndefined();
        });
    });
});
