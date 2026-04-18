/**
 * Command System Types
 *
 * Every navigable page and user action is a registered command.
 * Command IDs follow the convention: `namespace.group.action`
 * (e.g. `domain.example.action`, `app.toggle-theme`).
 *
 * @module commands
 */

import type { IDisposable } from '../lifecycle/disposable.js';
import type { Event } from '../event/emitter.js';

/**
 * Full command definition including handler.
 */
export interface CommandDefinition {
    /** Unique command ID (namespace.group.action) */
    id: string;

    /** Metadata for display purposes */
    metadata: CommandMetadata;

    /** The function to execute when the command is invoked */
    handler: CommandHandler;
}

/**
 * Display metadata for a command (shown in palette, sidebar, etc.)
 */
export interface CommandMetadata {
    /** Human-readable title */
    title: string;

    /** Optional category for grouping in the palette */
    category?: string;

    /** Lucide icon name */
    icon?: string;

    /** Short description shown in the palette */
    description?: string;

    /** Keyboard shortcut (e.g. "mod+shift+r") */
    keybinding?: string;

    /** Context key expression controlling visibility */
    when?: string;

    /** Display order within category */
    order?: number;
}

/**
 * Command handler function.
 */
export type CommandHandler = (params?: Record<string, unknown>) => void | Promise<void>;

/**
 * Interface for the command registry (runtime implementation is in the frontend Zustand store).
 */
export interface ICommandRegistry {
    /**
     * Register a command. Returns IDisposable to unregister.
     */
    register(definition: CommandDefinition): IDisposable;

    /**
     * Execute a command by ID.
     */
    execute(id: string, params?: Record<string, unknown>): Promise<void>;

    /**
     * Search commands by query string.
     */
    search(query: string): CommandDefinition[];

    /**
     * Get all registered commands.
     */
    getAll(): CommandDefinition[];

    /**
     * Get a specific command by ID.
     */
    get(id: string): CommandDefinition | undefined;

    /**
     * Check if a command is registered.
     */
    has(id: string): boolean;

    /**
     * Event fired when a command is registered.
     */
    onDidRegisterCommand: Event<CommandDefinition>;

    /**
     * Event fired when a command is unregistered.
     */
    onDidUnregisterCommand: Event<string>;
}

/**
 * Well-known command ID prefixes.
 */
export const COMMAND_PREFIXES = {
    /** Navigation commands: navigate.* */
    NAVIGATE: 'navigate',
    /** App-level commands: app.* */
    APP: 'app',
    /** Domain commands: domain.<name>.* */
    DOMAIN: 'domain',
    /** Topology commands: topology.* */
    TOPOLOGY: 'topology',
} as const;

/**
 * Well-known core command IDs.
 */
export const CORE_COMMANDS = {
    // Navigation
    NAVIGATE_HOME: 'navigate.home',
    NAVIGATE_CHAT: 'navigate.chat',
    NAVIGATE_SETTINGS: 'navigate.settings',
    NAVIGATE_SETTINGS_FEATURES: 'navigate.settings.features',
    NAVIGATE_SETTINGS_ACCESSIBILITY: 'navigate.settings.accessibility',
    NAVIGATE_FEEDBACK: 'navigate.feedback',
    NAVIGATE_PRESENTATION: 'navigate.presentation',
    NAVIGATE_TOPOLOGY: 'navigate.topology',
    NAVIGATE_TOPOLOGY_VIEW: 'navigate.topology.view',

    // App actions
    APP_TOGGLE_THEME: 'app.toggle-theme',
    APP_TOGGLE_SIDEBAR: 'app.toggle-sidebar',
    APP_OPEN_PALETTE: 'app.open-palette',

    // Topology
    TOPOLOGY_TOGGLE_EXPLORER: 'topology.toggle-explorer',
    TOPOLOGY_TOGGLE_PROPERTIES: 'topology.toggle-properties',
    TOPOLOGY_FOCUS_NODE: 'topology.focus-node',
    TOPOLOGY_FIT_ALL: 'topology.fit-all',
    TOPOLOGY_TOGGLE_LAYER: 'topology.toggle-layer',
} as const;
