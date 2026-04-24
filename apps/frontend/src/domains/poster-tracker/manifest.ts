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
    id: 'poster-tracker',
    name: 'Poster Tracker',
    commands: [
        {
            id: 'domain.poster-tracker.dashboard',
            title: 'Poster Tracker — Dashboard',
            icon: 'MapPin',
        },
    ],
    routes: [
        {
            path: '/modules/poster-tracker',
            commandId: 'domain.poster-tracker.dashboard',
            component: 'PosterTrackerDashboardPage',
        },
    ],
    sidebarItems: [
        { commandId: 'domain.poster-tracker.dashboard', group: 'Poster Tracker', order: 1 },
    ],
    activateOn: 'isAuthenticated',
};
