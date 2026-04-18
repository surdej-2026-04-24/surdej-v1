/**
 * Feature Flags
 *
 * Ring-based feature flag system. Features progress through rings:
 * Internal (1) → Beta (2) → Preview (3) → Stable (4)
 *
 * @module features
 */

/**
 * Feature ring levels. Lower numbers = more restricted access.
 */
export enum FeatureRing {
    /** Internal use only — developers and testers */
    Internal = 1,
    /** Beta — trusted early adopters */
    Beta = 2,
    /** Preview — broader audience, may have rough edges */
    Preview = 3,
    /** Stable — generally available */
    Stable = 4,
}

/**
 * Feature flag definition.
 */
export interface FeatureDefinition {
    /** Unique feature identifier (e.g. "topology-viewer", "ai-chat") */
    id: string;

    /** Human-readable title */
    title: string;

    /** Description of what this feature does */
    description?: string;

    /** Current ring level */
    ring: FeatureRing;

    /** Whether the feature is enabled by default at its ring level */
    enabledByDefault: boolean;

    /** Optional link to documentation or issue tracker */
    documentationUrl?: string;

    /** Category for grouping in the feature flags UI */
    category?: string;

    /** Date when the feature was introduced (ISO) */
    introducedAt?: string;
}

/**
 * Feature flag evaluation result.
 */
export interface FeatureEvaluation {
    /** Feature ID */
    featureId: string;

    /** Whether the feature is enabled for the current user */
    enabled: boolean;

    /** The ring that granted access (if enabled) */
    grantedByRing?: FeatureRing;

    /** Whether the user has a manual override */
    isOverride: boolean;
}

/**
 * Well-known feature flags.
 */
export const CORE_FEATURES: FeatureDefinition[] = [
    {
        id: 'topology-viewer',
        title: 'Topology Viewer',
        description: 'Interactive infrastructure and codebase topology explorer',
        ring: FeatureRing.Internal,
        enabledByDefault: true,
        category: 'Developer Tools',
    },
    {
        id: 'command-palette',
        title: 'Command Palette',
        description: 'Quick command access via ⌘K',
        ring: FeatureRing.Stable,
        enabledByDefault: true,
        category: 'Core',
    },
    {
        id: 'wireframe-mode',
        title: 'Wireframe Mode',
        description: 'Visual debugging mode showing component boundaries',
        ring: FeatureRing.Internal,
        enabledByDefault: true,
        category: 'Developer Tools',
    },
    {
        id: 'dev-inspector',
        title: 'Dev Inspector',
        description: 'Ctrl+Option hover to inspect component source',
        ring: FeatureRing.Internal,
        enabledByDefault: true,
        category: 'Developer Tools',
    },
    {
        id: 'feedback-system',
        title: 'Feedback System',
        description: 'Screenshot, voice, and video feedback with annotation',
        ring: FeatureRing.Beta,
        enabledByDefault: true,
        category: 'Core',
    },
    {
        id: 'skin-editor',
        title: 'Skin Editor',
        description: 'Visual sidebar customisation editor',
        ring: FeatureRing.Beta,
        enabledByDefault: true,
        category: 'Core',
    },
    {
        id: 'workflows',
        title: 'Workflows',
        description: 'Workflow management, directory, and sessions',
        ring: FeatureRing.Internal,
        enabledByDefault: true,
        category: 'Modules',
    },
];
