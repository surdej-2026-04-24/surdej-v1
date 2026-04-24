/**
 * Command definitions for the core-comms module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.comms.log',
        title: 'Kommunikationslog',
        icon: 'MessageSquare',
        category: 'Module',
    },
    {
        id: 'module.comms.send-email',
        title: 'Send Email',
        icon: 'Mail',
        category: 'Module',
    },
    {
        id: 'module.comms.send-sms',
        title: 'Send SMS',
        icon: 'Smartphone',
        category: 'Module',
    },
    {
        id: 'module.comms.webhooks',
        title: 'Webhook Endpoints',
        icon: 'Webhook',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.comms.log', group: 'Kommunikation', order: 1 },
    { commandId: 'module.comms.send-email', group: 'Kommunikation', order: 2 },
    { commandId: 'module.comms.send-sms', group: 'Kommunikation', order: 3 },
    { commandId: 'module.comms.webhooks', group: 'Kommunikation', order: 4 },
];
