/**
 * @surdej/core — Shared types, utils, constants, and lifecycle primitives.
 *
 * This package is the foundation that all other Surdej packages and apps depend on.
 */

// Lifecycle
export {
    type IDisposable,
    Disposable,
    DisposableStore,
    MutableDisposable,
    toDisposable,
    combinedDisposable,
    isDisposed,
    enableLeakTracker,
    disableLeakTracker,
    leakTracker,
} from './lifecycle/index.js';

// Events
export { Emitter, onceEvent, debounceEvent, type Event } from './event/index.js';

// Commands
export {
    type CommandDefinition,
    type CommandMetadata,
    type CommandHandler,
    type ICommandRegistry,
    COMMAND_PREFIXES,
    CORE_COMMANDS,
} from './commands/index.js';

// Context Keys
export {
    RawContextKey,
    CONTEXT_KEYS,
    type ContextKeyExpr,
    type ContextKeyExprOperator,
    parseContextKeyExpr,
    evaluateContextKeyExpr,
    evaluateWhenClause,
    type IContextKeyService,
    type IContextKeyBinding,
} from './context-keys/index.js';

// Features
export {
    FeatureRing,
    type FeatureDefinition,
    type FeatureEvaluation,
    CORE_FEATURES,
} from './features/index.js';

// Topology
export type {
    TopologyDefinition,
    TopologyLayer,
    TopologyNode,
    TopologyProperty,
    TopologyUrl,
    TopologyActor,
    TopologyConnection,
} from './topology/index.js';

export {
    flattenNodes,
    findNodeById,
    getNodeBreadcrumb,
    countNodes,
    validateTopology,
} from './topology/index.js';

// Domains
export type {
    DomainManifest,
    DomainRoute,
    DomainTopologyRef,
    DomainRegistry,
} from './domains/index.js';

export { validateDomainManifest } from './domains/index.js';

// Workers
export type {
    WorkerConfig,
    WorkerMetrics,
    JobMessage,
    JobHandler,
    WorkerRegistrationPayload,
    WorkerHeartbeatPayload,
    WorkerDeregisterPayload,
    WorkerHealthState,
} from './worker/index.js';

export { statusToHealthState } from './worker/index.js';

// NOTE: Tracing (OTel) and NATS trace propagation are Node.js-only.
// Import them from '@surdej/core/node' in server-side code.
