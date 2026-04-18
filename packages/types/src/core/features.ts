/**
 * Feature flag types — mirrors @surdej/core/features
 */

export enum FeatureRing {
    Internal = 1,
    Beta = 2,
    Preview = 3,
    Stable = 4,
}

export interface FeatureDefinition {
    id: string;
    title: string;
    description?: string;
    ring: FeatureRing;
    enabledByDefault: boolean;
    category?: string;
    documentationUrl?: string;
}

export interface FeatureEvaluation {
    featureId: string;
    enabled: boolean;
    ring: FeatureRing;
    source: 'default' | 'server' | 'override';
}
