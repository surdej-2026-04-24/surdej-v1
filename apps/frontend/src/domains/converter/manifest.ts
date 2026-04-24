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
    id: 'converter',
    name: 'Opskrift-Konverter',
    commands: [
        {
            id: 'domain.converter.page',
            title: 'Opskrift-Konverter — Modernisér Strikkeopskrift',
            icon: 'RefreshCw',
        },
    ],
    routes: [
        {
            path: '/modules/converter',
            commandId: 'domain.converter.page',
            component: 'ConverterPage',
        },
    ],
    sidebarItems: [
        { commandId: 'domain.converter.page', group: 'Opskrift-Konverter', order: 1 },
    ],
    activateOn: 'isAuthenticated',
};
