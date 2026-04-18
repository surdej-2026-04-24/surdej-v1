/**
 * Surdej Mixin SDK — Types
 *
 * Communication protocol between an iframe mixin tool and the Surdej host.
 * Uses postMessage with a secure handshake via MessageChannel.
 */

// ─── Permissions ────────────────────────────────────────────────

export type MixinPermission =
    | 'bridge:read'       // Page content bridge — read only (pageInfo, text, snapshot)
    | 'bridge:readwrite'  // Page content bridge — read + write (click, fill, fetch)
    | 'nosql:read'        // NoSQL API — read only
    | 'nosql:readwrite'   // NoSQL API — read + write
    | 'kv:read'           // Mixin KV store — read only
    | 'kv:readwrite';     // Mixin KV store — read + write

// ─── Actions (Mixin → Host) ────────────────────────────────────

export type MixinAction =
    // Bridge actions (read)
    | { type: 'BRIDGE_GET_PAGE_INFO' }
    | { type: 'BRIDGE_GET_PAGE_TEXT' }
    | { type: 'BRIDGE_GET_SELECTION' }
    | { type: 'BRIDGE_GET_SNAPSHOT' }
    | { type: 'BRIDGE_QUERY_SELECTOR'; payload: { selector: string } }
    | { type: 'BRIDGE_QUERY_SELECTOR_ALL'; payload: { selector: string } }
    // Bridge actions (write)
    | { type: 'BRIDGE_CLICK'; payload: { selector: string } }
    | { type: 'BRIDGE_FILL'; payload: { selector: string; value: string } }
    | { type: 'BRIDGE_FETCH_PAGE'; payload: { url: string } }
    // NoSQL actions (read)
    | { type: 'NOSQL_LIST_COLLECTIONS'; payload?: { parentId?: string } }
    | { type: 'NOSQL_GET_COLLECTION'; payload: { id: string } }
    | { type: 'NOSQL_LIST_DOCUMENTS'; payload: { collectionId: string; limit?: number; offset?: number } }
    | { type: 'NOSQL_GET_DOCUMENT'; payload: { id: string } }
    // NoSQL actions (write)
    | { type: 'NOSQL_CREATE_COLLECTION'; payload: { name: string; slug: string; description?: string; parentId?: string } }
    | { type: 'NOSQL_CREATE_DOCUMENT'; payload: { collectionId: string; data: unknown } }
    | { type: 'NOSQL_UPDATE_DOCUMENT'; payload: { id: string; data: unknown } }
    | { type: 'NOSQL_DELETE_DOCUMENT'; payload: { id: string } }
    // KV actions (read)
    | { type: 'KV_GET'; payload: { key: string } }
    | { type: 'KV_LIST'; payload?: { prefix?: string } }
    // KV actions (write)
    | { type: 'KV_SET'; payload: { key: string; value: unknown } }
    | { type: 'KV_DELETE'; payload: { key: string } }
    // Auth / meta
    | { type: 'GET_CONTEXT' }
    | { type: 'PING' };

// ─── Response (Host → Mixin) ───────────────────────────────────

export interface MixinResponse<T = unknown> {
    messageId: string;
    success: boolean;
    data?: T;
    error?: string;
}

// ─── Outbound message envelope ──────────────────────────────────

export type MixinRequest = MixinAction & { messageId: string };

// ─── Handshake ──────────────────────────────────────────────────

export interface HandshakeInit {
    type: 'SURDEJ_MIXIN_INIT';
    permissions: MixinPermission[];
    mixinId: string;
}

export interface HandshakeAck {
    type: 'SURDEJ_MIXIN_ACK';
    success: boolean;
    permissions: MixinPermission[];
    context?: MixinContext;
    error?: string;
}

// ─── Context ────────────────────────────────────────────────────

export interface MixinContext {
    userId: string;
    tenantId: string;
    mixinId: string;
    permissions: MixinPermission[];
}

// ─── Iframe Tool Registration ───────────────────────────────────

export interface IframeToolDefinition {
    slug: string;
    name: string;
    description?: string;
    url: string;
    icon?: string;
    permissions: MixinPermission[];
}
