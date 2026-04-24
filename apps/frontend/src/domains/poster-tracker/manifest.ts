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
    version: '0.2.0',
    id: 'poster-tracker',
    name: 'Valgplakater',
    commands: [
        {
            id: 'domain.poster-tracker.dashboard',
            title: 'Valgplakater — Oversigt',
            icon: 'MapPin',
        },
        {
            id: 'domain.poster-tracker.add',
            title: 'Valgplakater — Tilføj Plakat',
            icon: 'Plus',
        },
        {
            id: 'domain.poster-tracker.teams',
            title: 'Valgplakater — Teams & Organisationer',
            icon: 'Users',
        },
        {
            id: 'domain.poster-tracker.pant',
            title: 'Valgplakater — Pant (til salg)',
            icon: 'Coins',
        },
    ],
    routes: [
        {
            path: '/modules/poster-tracker',
            commandId: 'domain.poster-tracker.dashboard',
            component: 'PosterTrackerDashboardPage',
        },
        {
            path: '/modules/poster-tracker/add',
            commandId: 'domain.poster-tracker.add',
            component: 'PosterAddPage',
        },
        {
            path: '/modules/poster-tracker/teams',
            commandId: 'domain.poster-tracker.teams',
            component: 'PosterTeamsPage',
        },
        {
            path: '/modules/poster-tracker/pant',
            commandId: 'domain.poster-tracker.pant',
            component: 'PosterPantPage',
        },
    ],
    sidebarItems: [
        { commandId: 'domain.poster-tracker.dashboard', group: 'Valgplakater', order: 1 },
        { commandId: 'domain.poster-tracker.add', group: 'Valgplakater', order: 2 },
        { commandId: 'domain.poster-tracker.teams', group: 'Valgplakater', order: 3 },
        { commandId: 'domain.poster-tracker.pant', group: 'Valgplakater', order: 4 },
    ],
    activateOn: 'isAuthenticated',
};
