/**
 * Command types — mirrors @surdej/core/commands
 */

export interface CommandDefinition {
    id: string;
    title: string;
    icon?: string;
    handler: CommandHandler;
    when?: string;
    keybinding?: string;
    metadata?: CommandMetadata;
}

export type CommandHandler = (...args: unknown[]) => void | Promise<void>;

export interface CommandMetadata {
    category?: string;
    description?: string;
    source?: string;
}

export interface ICommandRegistry {
    register(command: CommandDefinition): void;
    unregister(id: string): void;
    execute(id: string, ...args: unknown[]): Promise<void>;
    has(id: string): boolean;
    getAll(): CommandDefinition[];
}
