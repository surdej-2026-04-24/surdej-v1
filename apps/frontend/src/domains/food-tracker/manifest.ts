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
    id: 'food-tracker',
    name: 'Digital Køleskab',
    commands: [
        {
            id: 'domain.food-tracker.dashboard',
            title: 'Digital Køleskab — Oversigt',
            icon: 'Refrigerator',
        },
        {
            id: 'domain.food-tracker.scan',
            title: 'Digital Køleskab — Scan Kvittering',
            icon: 'ScanLine',
        },
        {
            id: 'domain.food-tracker.recipes',
            title: 'Digital Køleskab — Opskriftforslag',
            icon: 'ChefHat',
        },
    ],
    routes: [
        {
            path: '/modules/food-tracker',
            commandId: 'domain.food-tracker.dashboard',
            component: 'FoodTrackerDashboardPage',
        },
        {
            path: '/modules/food-tracker/scan',
            commandId: 'domain.food-tracker.scan',
            component: 'ReceiptScanPage',
        },
        {
            path: '/modules/food-tracker/recipes',
            commandId: 'domain.food-tracker.recipes',
            component: 'RecipeSuggestionsPage',
        },
    ],
    sidebarItems: [
        { commandId: 'domain.food-tracker.dashboard', group: 'Digital Køleskab', order: 1 },
        { commandId: 'domain.food-tracker.scan', group: 'Digital Køleskab', order: 2 },
        { commandId: 'domain.food-tracker.recipes', group: 'Digital Køleskab', order: 3 },
    ],
    activateOn: 'isAuthenticated',
};
