/**
 * Command definitions for the core-openai module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.openai.dashboard',
        title: 'AI Media — Dashboard',
        icon: 'Brain',
        category: 'Module',
    },
    {
        id: 'module.openai.text-to-image',
        title: 'AI — Text to Image',
        icon: 'ImagePlus',
        category: 'Module',
    },
    {
        id: 'module.openai.image-to-text',
        title: 'AI — Image to Text',
        icon: 'ScanText',
        category: 'Module',
    },
    {
        id: 'module.openai.image-to-image',
        title: 'AI — Image to Image',
        icon: 'ImageDown',
        category: 'Module',
    },
    {
        id: 'module.openai.video-analysis',
        title: 'AI — Video Analysis',
        icon: 'Video',
        category: 'Module',
    },
    {
        id: 'module.openai.chat',
        title: 'AI — Chat',
        icon: 'MessageSquare',
        category: 'Module',
    },
    {
        id: 'module.openai.benchmark',
        title: 'AI — Model Benchmark',
        icon: 'BarChart3',
        category: 'Module',
    },
    {
        id: 'module.openai.playground',
        title: 'AI — Prompt Playground',
        icon: 'FlaskConical',
        category: 'Module',
    },
    {
        id: 'module.openai.token-counter',
        title: 'AI — Token Counter',
        icon: 'Calculator',
        category: 'Module',
    },
    {
        id: 'module.openai.speech-to-text',
        title: 'AI — Speech to Text',
        icon: 'Mic',
        category: 'Module',
    },
    {
        id: 'module.openai.text-to-speech',
        title: 'AI — Text to Speech',
        icon: 'Volume2',
        category: 'Module',
    },
    {
        id: 'module.openai.embeddings',
        title: 'AI — Embeddings',
        icon: 'Waypoints',
        category: 'Module',
    },
    {
        id: 'module.openai.moderation',
        title: 'AI — Content Moderation',
        icon: 'ShieldCheck',
        category: 'Module',
    },
    {
        id: 'module.openai.models',
        title: 'AI — Model Catalog',
        icon: 'Library',
        category: 'Module',
    },
    {
        id: 'module.openai.jobs',
        title: 'AI — Job History',
        icon: 'History',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    // Core
    { commandId: 'module.openai.dashboard', group: 'AI Studio', order: 0 },
    // Generation
    { commandId: 'module.openai.text-to-image', group: 'Generation', order: 1 },
    { commandId: 'module.openai.image-to-text', group: 'Generation', order: 2 },
    { commandId: 'module.openai.image-to-image', group: 'Generation', order: 3 },
    { commandId: 'module.openai.video-analysis', group: 'Generation', order: 4 },
    { commandId: 'module.openai.chat', group: 'Generation', order: 5 },
    // Audio
    { commandId: 'module.openai.speech-to-text', group: 'Audio', order: 6 },
    { commandId: 'module.openai.text-to-speech', group: 'Audio', order: 7 },
    // Tools
    { commandId: 'module.openai.benchmark', group: 'Tools', order: 8 },
    { commandId: 'module.openai.playground', group: 'Tools', order: 9 },
    { commandId: 'module.openai.token-counter', group: 'Tools', order: 10 },
    { commandId: 'module.openai.embeddings', group: 'Tools', order: 11 },
    { commandId: 'module.openai.moderation', group: 'Tools', order: 12 },
    { commandId: 'module.openai.models', group: 'Tools', order: 13 },
    // History
    { commandId: 'module.openai.jobs', group: 'History', order: 14 },
];
