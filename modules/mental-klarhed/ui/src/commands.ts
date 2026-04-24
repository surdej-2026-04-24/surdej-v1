/**
 * Command definitions for the mental-klarhed module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'mental-klarhed.admin.programmes',
        title: 'Mental Klarhed — Forløbsoversigt',
        icon: 'Brain',
        category: 'Mental Klarhed',
    },
    {
        id: 'mental-klarhed.admin.create',
        title: 'Mental Klarhed — Nyt forløb',
        icon: 'Plus',
        category: 'Mental Klarhed',
    },
    {
        id: 'mental-klarhed.client.portal',
        title: 'Mental Klarhed — Klientportal',
        icon: 'LayoutDashboard',
        category: 'Mental Klarhed',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'mental-klarhed.admin.programmes', group: 'Mental Klarhed', order: 1 },
    { commandId: 'mental-klarhed.admin.create', group: 'Mental Klarhed', order: 2 },
] as const;
