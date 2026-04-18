import { create } from 'zustand';

// ─── Types ───

export interface CommandDefinition {
    id: string;
    label: string;
    group?: string;
    icon?: string;             // Lucide icon name
    keybinding?: string;       // e.g. "⌘K", "⌘,", "⌘⇧P"
    when?: string;             // Context-key expression
    execute: (params?: Record<string, unknown>) => void | Promise<void>;
}

export interface CommandRegistryState {
    commands: Map<string, CommandDefinition>;
    recentIds: string[];       // Most recent first, max 10

    // Actions
    register: (def: CommandDefinition) => () => void; // Returns dispose fn
    unregister: (id: string) => void;
    execute: (id: string, params?: Record<string, unknown>) => Promise<void>;
    search: (query: string) => CommandDefinition[];
    getAll: () => CommandDefinition[];
    getById: (id: string) => CommandDefinition | undefined;
}

const MAX_RECENT = 10;

export const useCommandRegistry = create<CommandRegistryState>((set, get) => ({
    commands: new Map(),
    recentIds: [],

    register: (def) => {
        set((state) => {
            const next = new Map(state.commands);
            next.set(def.id, def);
            return { commands: next };
        });
        // Return dispose function
        return () => get().unregister(def.id);
    },

    unregister: (id) => {
        set((state) => {
            const next = new Map(state.commands);
            next.delete(id);
            return { commands: next };
        });
    },

    execute: async (id, params) => {
        const cmd = get().commands.get(id);
        if (!cmd) {
            console.warn(`[CommandRegistry] Command not found: ${id}`);
            return;
        }
        // Track recent usage
        set((state) => {
            const recent = [id, ...state.recentIds.filter((r) => r !== id)].slice(0, MAX_RECENT);
            return { recentIds: recent };
        });
        await cmd.execute(params);
    },

    search: (query) => {
        const q = query.toLowerCase().trim();
        if (!q) return get().getAll();
        const all = Array.from(get().commands.values());
        return all.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(q) ||
                cmd.id.toLowerCase().includes(q) ||
                (cmd.group?.toLowerCase().includes(q) ?? false),
        );
    },

    getAll: () => Array.from(get().commands.values()),

    getById: (id) => get().commands.get(id),
}));
