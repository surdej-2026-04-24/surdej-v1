/**
 * Command definitions for the member-nosql module.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.nosql.admin',
        title: 'NoSQL Store — Admin',
        icon: 'Database',
        category: 'Module',
    },
    {
        id: 'module.nosql.collections',
        title: 'NoSQL Store — Collections',
        icon: 'FolderOpen',
        category: 'Module',
    },
    {
        id: 'module.nosql.new-collection',
        title: 'NoSQL — New Collection',
        icon: 'FolderPlus',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.nosql.admin', group: 'NoSQL Store', order: 1 },
    { commandId: 'module.nosql.collections', group: 'NoSQL Store', order: 2 },
];
