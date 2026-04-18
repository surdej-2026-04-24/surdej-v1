/**
 * Command definitions for the tool-management-tools module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.tools.list',
        title: 'MCP Tool Registry — Oversigt',
        icon: 'Server',
        category: 'Module',
    },
    {
        id: 'module.tools.create',
        title: 'Ny Tool Definition',
        icon: 'Plus',
        category: 'Module',
    },
    {
        id: 'module.tools.mcp-server.create',
        title: 'Tilføj MCP Server',
        icon: 'Plus',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.tools.list', group: 'MCP Tool Registry', order: 1 },
    { commandId: 'module.tools.mcp-server.create', group: 'MCP Tool Registry', order: 2 },
    { commandId: 'module.tools.create', group: 'MCP Tool Registry', order: 3 },
];
