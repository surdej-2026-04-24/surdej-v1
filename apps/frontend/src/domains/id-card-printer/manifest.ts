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
    id: 'id-card-printer',
    name: 'ID Kort Printer',
    commands: [
        {
            id: 'domain.id-card-printer.editor',
            title: 'ID Kort Printer — Kort Designer',
            icon: 'CreditCard',
        },
    ],
    routes: [
        {
            path: '/modules/id-card-printer',
            commandId: 'domain.id-card-printer.editor',
            component: 'IdCardPrinterPage',
        },
    ],
    sidebarItems: [
        { commandId: 'domain.id-card-printer.editor', group: 'ID Kort', order: 1 },
    ],
    activateOn: 'isAuthenticated',
};
