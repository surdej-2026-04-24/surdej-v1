/**
 * @surdej/core/node — Node.js-only exports (tracing, NATS trace propagation).
 *
 * Import from '@surdej/core/node' in server-side code (API, workers).
 * NEVER import this from browser code — it pulls in Node.js-only dependencies.
 */

// OpenTelemetry SDK bootstrap
export { otelSdk } from './tracing.js';

// NATS Trace Propagation
export {
    injectTraceHeaders,
    extractTraceContext,
    startNatsSpan,
    startNatsPublishSpan,
} from './nats-tracing.js';
