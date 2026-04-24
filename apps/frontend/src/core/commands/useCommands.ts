import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCommandRegistry, type CommandDefinition } from './CommandRegistry';
import { useAuth } from '@/core/auth/AuthContext';
import { useAccessibility } from '@/core/accessibility/AccessibilityContext';


/**
 * Registers all core commands on mount and cleans up on unmount.
 * Call this once from App.tsx or RootLayout.
 */
export function useCoreCommands() {
    const register = useCommandRegistry((s) => s.register);
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { setTheme, theme } = useAccessibility();

    useEffect(() => {
        const disposers: (() => void)[] = [];

        const commands: CommandDefinition[] = [
            // ─── Navigation ───
            {
                id: 'navigate.home',
                label: 'Go to Home',
                group: 'Navigation',
                icon: 'Home',
                execute: () => navigate('/'),
            },
            {
                id: 'navigate.topology',
                label: 'Go to Topology',
                group: 'Navigation',
                icon: 'Layers',
                execute: () => navigate('/topology'),
            },
            {
                id: 'navigate.chat',
                label: 'Go to Chat',
                group: 'Navigation',
                icon: 'MessageSquare',
                execute: () => navigate('/chat'),
            },
            {
                id: 'navigate.settings',
                label: 'Go to Settings',
                group: 'Navigation',
                icon: 'Settings',
                keybinding: '⌘,',
                execute: () => navigate('/settings'),
            },
            {
                id: 'navigate.settings.features',
                label: 'Feature Flags',
                group: 'Settings',
                icon: 'Zap',
                execute: () => navigate('/settings/features'),
            },
            {
                id: 'navigate.settings.accessibility',
                label: 'Accessibility',
                group: 'Settings',
                icon: 'Eye',
                execute: () => navigate('/settings/accessibility'),
            },
            {
                id: 'navigate.settings.skins',
                label: 'Skins & Branding',
                group: 'Settings',
                icon: 'Palette',
                execute: () => navigate('/settings/skins'),
            },
            {
                id: 'navigate.settings.keyvault',
                label: 'Key Vault — API Keys & Secrets',
                group: 'Settings',
                icon: 'KeyRound',
                execute: () => navigate('/settings/keyvault'),
            },
            {
                id: 'navigate.developer',
                label: 'Developer Tools',
                group: 'Tools',
                icon: 'Code2',
                execute: () => navigate('/developer'),
            },
            {
                id: 'navigate.feedback',
                label: 'Send Feedback',
                group: 'Tools',
                icon: 'MessageCircle',
                execute: () => navigate('/feedback'),
            },
            {
                id: 'navigate.workers',
                label: 'Workers Dashboard',
                group: 'Tools',
                icon: 'Cpu',
                execute: () => navigate('/workers'),
            },

            // ─── App Actions ───
            {
                id: 'app.toggle-theme',
                label: 'Toggle Theme',
                group: 'Appearance',
                icon: 'Moon',
                keybinding: '⌘⇧T',
                execute: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
            },
            {
                id: 'app.toggle-sidebar',
                label: 'Toggle Sidebar',
                group: 'Appearance',
                icon: 'PanelLeft',
                keybinding: '⌘B',
                execute: () => {
                    // Dispatch a custom event the sidebar can listen for
                    window.dispatchEvent(new CustomEvent('surdej:toggle-sidebar'));
                },
            },
            {
                id: 'app.toggle-wireframe',
                label: 'Toggle Wireframe Mode',
                group: 'Developer',
                icon: 'Code2',
                execute: () => {
                    window.dispatchEvent(new CustomEvent('surdej:toggle-wireframe'));
                },
            },
            {
                id: 'app.toggle-dev-inspector',
                label: 'Toggle Dev Inspector',
                group: 'Developer',
                icon: 'Eye',
                execute: () => {
                    window.dispatchEvent(new CustomEvent('surdej:toggle-dev-inspector'));
                },
            },
            {
                id: 'app.logout',
                label: 'Sign Out',
                group: 'Account',
                icon: 'LogOut',
                execute: () => logout(),
            },

            // ─── Admin ───
            {
                id: 'navigate.admin.operations',
                label: 'Admin Operations',
                group: 'Admin',
                icon: 'Cog',
                execute: () => navigate('/admin/operations'),
            },

            // ─── Tool Management ───
            {
                id: 'module.tools.list',
                label: 'Tool Management',
                group: 'Tools',
                icon: 'Wrench',
                execute: () => navigate('/modules/tool-management-tools'),
            },
            {
                id: 'module.tools.create',
                label: 'New Tool Definition',
                group: 'Tools',
                icon: 'Plus',
                execute: () => navigate('/modules/tool-management-tools/new'),
            },
            {
                id: 'module.tools.usecases',
                label: 'Use Case Management',
                group: 'Tools',
                icon: 'FlaskConical',
                execute: () => navigate('/modules/workflow/directory'),
            },
            {
                id: 'module.tools.usecases.create',
                label: 'New Use Case',
                group: 'Tools',
                icon: 'Plus',
                execute: () => navigate('/modules/workflow/new'),
            },
            {
                id: 'module.tools.workflows',
                label: 'Workflow Management',
                group: 'Tools',
                icon: 'Workflow',
                execute: () => navigate('/modules/workflow'),
            },
            {
                id: 'module.tools.workflows.directory',
                label: 'Workflow Directory',
                group: 'Tools',
                icon: 'BookOpen',
                execute: () => navigate('/modules/workflow/directory'),
            },
            {
                id: 'admin.workflows.tags',
                label: 'Workflow Tags',
                group: 'Admin',
                icon: 'Tags',
                execute: () => navigate('/admin/workflows/tags'),
            },

            // ─── Developer Samples ───
            {
                id: 'developer.samples.spread-sandbox',
                label: 'Spread Sandbox Sample',
                group: 'Developer',
                icon: 'Box',
                execute: () => navigate('/developer/samples/integration/spread-sandbox'),
            },

            // ─── Core Issues (Ticket Master) ───
            {
                id: 'module.core-issues.dashboard',
                label: 'Ticket Master — Dashboard',
                group: 'Core Issues',
                icon: 'CircleDot',
                execute: () => navigate('/modules/core-issues'),
            },
            {
                id: 'module.core-issues.new',
                label: 'Ticket Master — New Issue',
                group: 'Core Issues',
                icon: 'PlusCircle',
                execute: () => navigate('/modules/core-issues/new'),
            },
            {
                id: 'module.core-issues.list',
                label: 'Ticket Master — All Issues',
                group: 'Core Issues',
                icon: 'ListTodo',
                execute: () => navigate('/modules/core-issues/issues'),
            },

            // ─── NoSQL Store ───
            {
                id: 'module.nosql.admin',
                label: 'NoSQL Store — Admin Dashboard',
                group: 'NoSQL Store',
                icon: 'Database',
                execute: () => navigate('/modules/nosql'),
            },
            {
                id: 'module.nosql.collections',
                label: 'NoSQL Store — Collections',
                group: 'NoSQL Store',
                icon: 'FolderOpen',
                execute: () => navigate('/modules/nosql/collections'),
            },
            {
                id: 'module.nosql.new-collection',
                label: 'NoSQL — New Collection',
                group: 'NoSQL Store',
                icon: 'FolderPlus',
                execute: () => navigate('/modules/nosql/collections?action=new'),
            },

            // ─── Digital Køleskab (Food Tracker) ───
            {
                id: 'domain.food-tracker.dashboard',
                label: 'Digital Køleskab — Oversigt',
                group: 'Digital Køleskab',
                icon: 'Refrigerator',
                execute: () => navigate('/modules/food-tracker'),
            },
            {
                id: 'domain.food-tracker.scan',
                label: 'Digital Køleskab — Scan Kvittering',
                group: 'Digital Køleskab',
                icon: 'ScanLine',
                execute: () => navigate('/modules/food-tracker/scan'),
            },
            {
                id: 'domain.food-tracker.recipes',
                label: 'Digital Køleskab — Opskriftforslag',
                group: 'Digital Køleskab',
                icon: 'ChefHat',
                execute: () => navigate('/modules/food-tracker/recipes'),
            },

            // ─── Poster Tracker ───
            {
                id: 'domain.poster-tracker.dashboard',
                label: 'Valgplakater — Oversigt',
                group: 'Valgplakater',
                icon: 'MapPin',
                execute: () => navigate('/modules/poster-tracker'),
            },
            {
                id: 'domain.poster-tracker.add',
                label: 'Valgplakater — Tilføj Plakat',
                group: 'Valgplakater',
                icon: 'Plus',
                execute: () => navigate('/modules/poster-tracker/add'),
            },
            {
                id: 'domain.poster-tracker.teams',
                label: 'Valgplakater — Teams & Organisationer',
                group: 'Valgplakater',
                icon: 'Users',
                execute: () => navigate('/modules/poster-tracker/teams'),
            },
            {
                id: 'domain.poster-tracker.pant',
                label: 'Valgplakater — Pant (til salg)',
                group: 'Valgplakater',
                icon: 'Coins',
                execute: () => navigate('/modules/poster-tracker/pant'),
            },
        ];

        for (const cmd of commands) {
            disposers.push(register(cmd));
        }

        return () => {
            for (const dispose of disposers) dispose();
        };
    }, [register, navigate, logout, setTheme, theme]);
}
