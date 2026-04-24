/**
 * Module Registry
 *
 * Central registry of all domain modules.
 * Each module has a stable GUID, friendly name, icon, description,
 * and its own activity-bar items for in-module navigation.
 * Used by routing, breadcrumbs, sidebar, ModuleLayout, and the Modules Hub page.
 */

export interface ModuleActivityItem {
    /** Unique id within the module */
    id: string;
    /** Display label shown in tooltip & status bar */
    label: string;
    /** Lucide icon name */
    icon: string;
    /** Relative path within the module ('' = index) */
    path: string;
}

export interface ModuleDefinition {
    /** Stable GUID for the module — used in URLs */
    id: string;
    /** Internal slug (e.g. 'core-issues') — for code references */
    slug: string;
    /** Friendly display name */
    name: string;
    /** Short description */
    description: string;
    /** Lucide icon name */
    icon: string;
    /** Gradient color classes for card backgrounds */
    color: string;
    /** Version string */
    version: string;
    /** Optional override for navigation (defaults to /modules/:id) */
    href?: string;
    /** Feature flag ID — when set, the module is only visible if this feature is enabled */
    featureId?: string;
    /** Activity bar items for in-module navigation */
    activityItems: ModuleActivityItem[];
}

/**
 * All registered modules.
 * GUIDs are stable — they survive renames and refactors.
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
    {
        id: 'c4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
        slug: 'core-issues',
        name: 'Ticket Master',
        description: 'Intern issue-tracker med labels, tildeling, kommentarer og historik',
        icon: 'CircleDot',
        color: 'from-indigo-500 to-violet-600',
        version: '0.1.0',
        href: '/modules/core-issues',
        activityItems: [
            { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '' },
            { id: 'issues', label: 'Issues', icon: 'ListTodo', path: '/issues' },
            { id: 'create', label: 'Ny Issue', icon: 'PlusCircle', path: '/new' },
            { id: 'labels', label: 'Labels', icon: 'Tags', path: '/labels' },
        ],
    },
    {
        id: 'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
        slug: 'tool-management-tools',
        name: 'Tool Management',
        description: 'Administrér tool-definitioner, kategorier, aktivering og routing for portal/extension use cases',
        icon: 'Wrench',
        color: 'from-teal-500 to-cyan-600',
        version: '0.1.0',
        href: '/modules/tool-management-tools',
        activityItems: [
            { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '' },
            { id: 'new-mcp-server', label: 'Ny MCP Server', icon: 'PlusCircle', path: '/mcp-servers/new' },
        ],
    },
    {
        id: 'a7b8c9d0-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
        slug: 'member-nosql',
        name: 'NoSQL Store',
        description: 'Document-orienteret NoSQL storage med collections, dokumenter og forespørgsler',
        icon: 'Database',
        color: 'from-emerald-500 to-green-600',
        version: '0.1.0',
        href: '/modules/nosql',
        activityItems: [
            { id: 'admin', label: 'Admin', icon: 'Database', path: '' },
            { id: 'collections', label: 'Collections', icon: 'FolderOpen', path: '/collections' },
        ],
    },
    {
        id: 'f6a7b8c9-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
        slug: 'workflow',
        name: 'Workflows',
        description: 'Multi-step AI workflows med session tracking, schema-drevne formularer og step-scoped prompts',
        icon: 'Workflow',
        color: 'from-amber-500 to-orange-600',
        version: '0.1.0',
        href: '/modules/workflow',
        featureId: 'workflows',
        activityItems: [
            { id: 'home', label: 'Workflows', icon: 'Workflow', path: '' },
            { id: 'directory', label: 'Directory', icon: 'Library', path: '/directory' },
            { id: 'new', label: 'New Workflow', icon: 'PlusCircle', path: '/new' },
            { id: 'sessions', label: 'My Sessions', icon: 'Activity', path: '/sessions' },
        ],
    },
    {
        id: 'd9e0f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a',
        slug: 'poster-tracker',
        name: 'Poster Tracker',
        description: 'Track poster placement locations with one-tap GPS registration',
        icon: 'MapPin',
        color: 'from-orange-500 to-red-500',
        version: '0.1.0',
        href: '/modules/poster-tracker',
        activityItems: [
            { id: 'dashboard', label: 'Dashboard', icon: 'MapPin', path: '' },
        ],
    },
    {
        id: 'b8c9d0e1-2f3a-4b5c-6d7e-8f9a0b1c2d3e',
        slug: 'core-openai',
        name: 'AI Studio',
        description: 'OpenAI multi-modal AI: image generation, vision, audio, benchmarks, playground, embeddings og moderation',
        icon: 'Brain',
        color: 'from-purple-500 to-pink-600',
        version: '0.1.0',
        href: '/modules/core-openai',
        activityItems: [
            { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '' },
            { id: 'text-to-image', label: 'Text to Image', icon: 'ImagePlus', path: '/text-to-image' },
            { id: 'image-to-text', label: 'Image to Text', icon: 'ScanText', path: '/image-to-text' },
            { id: 'image-to-image', label: 'Image to Image', icon: 'ImageDown', path: '/image-to-image' },
            { id: 'video-analysis', label: 'Video Analysis', icon: 'Video', path: '/video-analysis' },
            { id: 'chat', label: 'Chat', icon: 'MessageSquare', path: '/chat' },
            { id: 'speech-to-text', label: 'Speech to Text', icon: 'Mic', path: '/speech-to-text' },
            { id: 'text-to-speech', label: 'Text to Speech', icon: 'Volume2', path: '/text-to-speech' },
            { id: 'benchmark', label: 'Benchmark', icon: 'BarChart3', path: '/benchmark' },
            { id: 'playground', label: 'Playground', icon: 'FlaskConical', path: '/playground' },
            { id: 'token-counter', label: 'Token Counter', icon: 'Calculator', path: '/token-counter' },
            { id: 'embeddings', label: 'Embeddings', icon: 'Waypoints', path: '/embeddings' },
            { id: 'moderation', label: 'Moderation', icon: 'ShieldCheck', path: '/moderation' },
            { id: 'models', label: 'Model Catalog', icon: 'Library', path: '/models' },
            { id: 'jobs', label: 'Job History', icon: 'History', path: '/jobs' },
        ],
    },
];

/** Look up a module by its GUID */
export function getModuleById(id: string): ModuleDefinition | undefined {
    return MODULE_REGISTRY.find((m) => m.id === id);
}

/** Look up a module by its slug */
export function getModuleBySlug(slug: string): ModuleDefinition | undefined {
    return MODULE_REGISTRY.find((m) => m.slug === slug);
}

/** Map of GUID → friendly name for breadcrumb resolution */
export const MODULE_GUID_LABELS: Record<string, string> = Object.fromEntries(
    MODULE_REGISTRY.map((m) => [m.id, m.name]),
);
