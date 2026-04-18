/**
 * Command definitions for the core-issues module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.issues.list',
        title: 'Issues — Oversigt',
        icon: 'Ticket',
        category: 'Module',
    },
    {
        id: 'module.issues.create',
        title: 'Ny Issue',
        icon: 'Plus',
        category: 'Module',
    },
    {
        id: 'module.issues.search',
        title: 'Søg Issues',
        icon: 'Search',
        category: 'Module',
    },
    {
        id: 'module.issues.labels',
        title: 'Administrer Labels',
        icon: 'Tag',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.issues.list', group: 'Issues', order: 1 },
    { commandId: 'module.issues.create', group: 'Issues', order: 2 },
    { commandId: 'module.issues.search', group: 'Issues', order: 3 },
    { commandId: 'module.issues.labels', group: 'Issues', order: 4 },
];
