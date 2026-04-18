/**
 * @surdej/mixin-sdk
 *
 * SDK for building iframe mixin tools that integrate with the Surdej platform.
 * Provides a secure postMessage + MessageChannel bridge for:
 *   - Page content bridge (read/write)
 *   - NoSQL API (read/write)
 *   - Per-user key/value storage (read/write)
 *
 * Usage:
 *   import { SurdejMixinClient } from '@surdej/mixin-sdk';
 *
 *   const client = new SurdejMixinClient();
 *   await client.connect();
 *   const info = await client.bridge.getPageInfo();
 */

export { SurdejMixinClient } from './client';

export type {
    MixinPermission,
    MixinAction,
    MixinResponse,
    MixinRequest,
    MixinContext,
    HandshakeInit,
    HandshakeAck,
    IframeToolDefinition,
} from './types';
