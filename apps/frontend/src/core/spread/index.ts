/**
 * Spread Architecture — Public API
 *
 * Core infrastructure for the Surdej Spread plugin system.
 *
 * Host-side:
 *   SecureSandbox — loads a Spread inside a sandboxed iframe and routes
 *                   capability requests to configurable handlers.
 *
 * Spread-side SDK (bundled into the Spread's single-file output):
 *   SurdejClient  — async bridge that wraps postMessage into Promises.
 *   SurdejProvider — React context provider that initializes the client
 *                    and upgrades it when the INIT_PORT handshake arrives.
 *   useSurdej     — hook for accessing the client inside a Spread app.
 */

export { SecureSandbox } from './SecureSandbox';
export type { SecureSandboxProps, SpreadCapabilities } from './SecureSandbox';

export { SurdejClient } from './SurdejClient';

export { SurdejProvider, useSurdej } from './SurdejProvider';

export type { SurdejAction, HostResponse, SpreadRequest } from './types';
