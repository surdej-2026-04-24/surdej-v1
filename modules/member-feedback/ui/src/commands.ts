/**
 * Command definitions for the member-feedback module.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.feedback.tickets',
        title: 'Feedback Tickets — Oversigt',
        icon: 'Ticket',
        category: 'Module',
    },
    {
        id: 'module.feedback.create',
        title: 'Ny Feedback Ticket',
        icon: 'Plus',
        category: 'Module',
    },
    {
        id: 'module.feedback.stats',
        title: 'Feedback Dashboard',
        icon: 'BarChart3',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.feedback.tickets', group: 'Feedback', order: 1 },
    { commandId: 'module.feedback.create', group: 'Feedback', order: 2 },
    { commandId: 'module.feedback.stats', group: 'Feedback', order: 3 },
];
