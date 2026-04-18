/**
 * @surdej/types — Standalone type-only package
 *
 * Re-exports all contract types and core type definitions so that consumers
 * (e.g. workers, CLI, extensions) can import types without pulling in the
 * full @surdej/core runtime + its dependencies.
 *
 * Usage:
 *   import type { TopologyDefinition } from '@surdej/types';
 *   import type { DomainManifest } from '@surdej/types/contracts/domain-manifest';
 */

// ─── Contracts ────────────────────────────────────────────────

// Domain Manifest
export type {
    DomainManifest,
    DomainCommandDefinition,
    DomainRouteDefinition,
    DomainSidebarItem,
} from './contracts/domain-manifest.js';

// Skin Manifest
export type {
    SkinManifest,
    SkinBranding,
    SkinSidebarItem,
} from './contracts/skin-manifest.js';

// Worker Messages
export type {
    WorkerRegistration,
    WorkerHeartbeat,
} from './contracts/worker-messages.js';
export { NATS_SUBJECTS } from './contracts/worker-messages.js';

// Analyze
export type {
    AnalyzeMediaType,
    AnalyzeJobStatus,
    AnalyzeResult,
    AnalyzeJob,
    AnalyzeJobPayload,
    AnalyzeSubmitResponse,
    AnalyzeListResponse,
} from './contracts/analyze.js';
export { ANALYZE_NATS } from './contracts/analyze.js';

// API Plugin
export type {
    DomainPlugin,
    DomainPluginMeta,
} from './contracts/api-plugin.js';

// Topology
export type {
    TopologyDefinition,
    TopologyLayer,
    TopologyNode,
    TopologyProperty,
    TopologyUrl,
    TopologyActor,
    TopologyConnection,
} from './contracts/topology.js';

// ─── Core types (re-exported from @surdej/core interfaces) ────

export type {
    IDisposable,
} from './core/lifecycle.js';

export type {
    CommandDefinition,
    CommandMetadata,
    CommandHandler,
    ICommandRegistry,
} from './core/commands.js';

export type {
    ContextKeyExpr,
    IContextKeyService,
    IContextKeyBinding,
} from './core/context-keys.js';

export type {
    FeatureDefinition,
    FeatureEvaluation,
} from './core/features.js';

export { FeatureRing } from './core/features.js';

export type {
    WorkerConfig,
    WorkerMetrics,
    JobMessage,
    JobHandler,
    WorkerRegistrationPayload,
    WorkerHeartbeatPayload,
    WorkerDeregisterPayload,
    WorkerHealthState,
} from './core/worker.js';

export type {
    DomainRegistry,
    DomainRoute,
    DomainTopologyRef,
} from './core/domains.js';
