// Inline types from contracts/domain-manifest.d.ts to avoid .d.ts import issues
interface DomainManifest {
    id: string;
    name: string;
    version: string;
    commands: { id: string; title: string; icon?: string; when?: string; keybinding?: string }[];
    routes: { path: string; commandId: string; component: string }[];
    contextKeys?: string[];
    sidebarItems?: { commandId: string; order?: number; group?: string }[];
    topologies?: string[];
    activateOn?: string;
}

export const manifest: DomainManifest = {
    version: '0.1.0',
    id: 'nosql',
    name: 'NoSQL Store',
    commands: [
        {
            id: 'module.nosql.admin',
            title: 'NoSQL Store — Admin Dashboard',
            icon: 'Database',
        },
        {
            id: 'module.nosql.collections',
            title: 'NoSQL Store — Collections',
            icon: 'FolderOpen',
        },
        {
            id: 'module.nosql.new-collection',
            title: 'NoSQL — New Collection',
            icon: 'FolderPlus',
        },
    ],
    routes: [
        {
            path: '/modules/nosql',
            commandId: 'module.nosql.admin',
            component: 'NosqlAdminPage',
        },
        {
            path: '/modules/nosql/collections/:collectionId',
            commandId: 'module.nosql.collections',
            component: 'NosqlCollectionPage',
        },
        {
            path: '/modules/nosql/documents/:documentId',
            commandId: 'module.nosql.collections',
            component: 'NosqlDocumentPage',
        },
    ],
    sidebarItems: [
        { commandId: 'module.nosql.admin', group: 'NoSQL Store', order: 1 },
        { commandId: 'module.nosql.collections', group: 'NoSQL Store', order: 2 },
    ],
    activateOn: 'isAuthenticated',
};
