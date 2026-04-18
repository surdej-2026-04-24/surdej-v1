/**
 * IframeToolHost — Host-side Mixin Loader
 *
 * Loads a registered iframe tool inside a sandboxed iframe,
 * then establishes a secure MessageChannel handshake with the
 * @surdej/mixin-sdk running inside the iframe.
 *
 * Security:
 *   - sandbox="allow-scripts allow-same-origin" (needed for the mixin's own origin APIs)
 *   - Origin-checked postMessage for handshake
 *   - Permission-gated action routing — only granted permissions are executable
 *   - All bridge/nosql/kv actions proxied through the host
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as bridge from '@/core/extension/bridge';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

type MixinPermission =
    | 'bridge:read'
    | 'bridge:readwrite'
    | 'nosql:read'
    | 'nosql:readwrite'
    | 'kv:read'
    | 'kv:readwrite';

interface MixinAction {
    messageId: string;
    type: string;
    payload?: Record<string, unknown>;
}

export interface IframeToolDef {
    slug: string;
    name: string;
    description?: string | null;
    url: string;
    icon: string;
    permissions: string[];
    enabled: boolean;
}

export interface IframeToolHostProps {
    tool: IframeToolDef;
    className?: string;
    onError?: (error: string) => void;
}

// ─── Permission helpers ─────────────────────────────────────────

function hasPermission(granted: MixinPermission[], required: MixinPermission): boolean {
    return granted.includes(required);
}

function hasBridgeRead(p: MixinPermission[]): boolean {
    return hasPermission(p, 'bridge:read') || hasPermission(p, 'bridge:readwrite');
}

function hasBridgeWrite(p: MixinPermission[]): boolean {
    return hasPermission(p, 'bridge:readwrite');
}

function hasNosqlRead(p: MixinPermission[]): boolean {
    return hasPermission(p, 'nosql:read') || hasPermission(p, 'nosql:readwrite');
}

function hasNosqlWrite(p: MixinPermission[]): boolean {
    return hasPermission(p, 'nosql:readwrite');
}

function hasKvRead(p: MixinPermission[]): boolean {
    return hasPermission(p, 'kv:read') || hasPermission(p, 'kv:readwrite');
}

function hasKvWrite(p: MixinPermission[]): boolean {
    return hasPermission(p, 'kv:readwrite');
}

// ─── Action Router ──────────────────────────────────────────────

async function routeAction(
    action: MixinAction,
    permissions: MixinPermission[],
    mixinId: string,
): Promise<unknown> {
    switch (action.type) {
        // ── Bridge read actions ──
        case 'BRIDGE_GET_PAGE_INFO': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.getPageInfo();
        }
        case 'BRIDGE_GET_PAGE_TEXT': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.getPageText();
        }
        case 'BRIDGE_GET_SELECTION': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.getSelection();
        }
        case 'BRIDGE_GET_SNAPSHOT': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.getPageSnapshot();
        }
        case 'BRIDGE_QUERY_SELECTOR': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.querySelector(action.payload?.selector as string);
        }
        case 'BRIDGE_QUERY_SELECTOR_ALL': {
            if (!hasBridgeRead(permissions)) throw new Error('Permission denied: bridge:read');
            return bridge.querySelectorAll(action.payload?.selector as string);
        }
        // ── Bridge write actions ──
        case 'BRIDGE_CLICK': {
            if (!hasBridgeWrite(permissions)) throw new Error('Permission denied: bridge:readwrite');
            return bridge.clickElement(action.payload?.selector as string);
        }
        case 'BRIDGE_FILL': {
            if (!hasBridgeWrite(permissions)) throw new Error('Permission denied: bridge:readwrite');
            return bridge.fillInput(action.payload?.selector as string, action.payload?.value as string);
        }
        case 'BRIDGE_FETCH_PAGE': {
            if (!hasBridgeWrite(permissions)) throw new Error('Permission denied: bridge:readwrite');
            return bridge.fetchPage({ url: action.payload?.url as string });
        }
        // ── NoSQL read actions ──
        case 'NOSQL_LIST_COLLECTIONS': {
            if (!hasNosqlRead(permissions)) throw new Error('Permission denied: nosql:read');
            const parentId = action.payload?.parentId as string | undefined;
            const qs = parentId ? `?parentId=${parentId}` : '';
            return api.get(`/module/member-nosql/collections${qs}`);
        }
        case 'NOSQL_GET_COLLECTION': {
            if (!hasNosqlRead(permissions)) throw new Error('Permission denied: nosql:read');
            return api.get(`/module/member-nosql/collections/${action.payload?.id}`);
        }
        case 'NOSQL_LIST_DOCUMENTS': {
            if (!hasNosqlRead(permissions)) throw new Error('Permission denied: nosql:read');
            const { collectionId, limit, offset } = action.payload ?? {};
            const qs = new URLSearchParams();
            if (limit) qs.set('limit', String(limit));
            if (offset) qs.set('offset', String(offset));
            const q = qs.toString();
            return api.get(`/module/member-nosql/collections/${collectionId}/documents${q ? `?${q}` : ''}`);
        }
        case 'NOSQL_GET_DOCUMENT': {
            if (!hasNosqlRead(permissions)) throw new Error('Permission denied: nosql:read');
            return api.get(`/module/member-nosql/documents/${action.payload?.id}`);
        }
        // ── NoSQL write actions ──
        case 'NOSQL_CREATE_COLLECTION': {
            if (!hasNosqlWrite(permissions)) throw new Error('Permission denied: nosql:readwrite');
            return api.post('/module/member-nosql/collections', action.payload);
        }
        case 'NOSQL_CREATE_DOCUMENT': {
            if (!hasNosqlWrite(permissions)) throw new Error('Permission denied: nosql:readwrite');
            const { collectionId, data } = action.payload ?? {};
            return api.post(`/module/member-nosql/collections/${collectionId}/documents`, { data });
        }
        case 'NOSQL_UPDATE_DOCUMENT': {
            if (!hasNosqlWrite(permissions)) throw new Error('Permission denied: nosql:readwrite');
            const { id, data } = action.payload ?? {};
            return api.put(`/module/member-nosql/documents/${id}`, { data });
        }
        case 'NOSQL_DELETE_DOCUMENT': {
            if (!hasNosqlWrite(permissions)) throw new Error('Permission denied: nosql:readwrite');
            return api.del(`/module/member-nosql/documents/${action.payload?.id}`);
        }
        // ── KV read actions ──
        case 'KV_GET': {
            if (!hasKvRead(permissions)) throw new Error('Permission denied: kv:read');
            return api.get(`/mixin-kv/${mixinId}/keys/${encodeURIComponent(action.payload?.key as string)}`);
        }
        case 'KV_LIST': {
            if (!hasKvRead(permissions)) throw new Error('Permission denied: kv:read');
            const prefix = action.payload?.prefix as string | undefined;
            const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
            return api.get(`/mixin-kv/${mixinId}/keys${qs}`);
        }
        // ── KV write actions ──
        case 'KV_SET': {
            if (!hasKvWrite(permissions)) throw new Error('Permission denied: kv:readwrite');
            return api.put(
                `/mixin-kv/${mixinId}/keys/${encodeURIComponent(action.payload?.key as string)}`,
                { value: action.payload?.value },
            );
        }
        case 'KV_DELETE': {
            if (!hasKvWrite(permissions)) throw new Error('Permission denied: kv:readwrite');
            return api.del(`/mixin-kv/${mixinId}/keys/${encodeURIComponent(action.payload?.key as string)}`);
        }
        // ── Meta actions ──
        case 'GET_CONTEXT': {
            return {
                mixinId,
                permissions,
                userId: api.getTenantId(), // context only
            };
        }
        case 'PING':
            return 'pong';

        default:
            throw new Error(`Unknown action type: ${action.type}`);
    }
}

// ─── Component ──────────────────────────────────────────────────

export function IframeToolHost({ tool, className, onError }: IframeToolHostProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const channelRef = useRef<MessageChannel | null>(null);
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');

    const permissions = tool.permissions as MixinPermission[];
    const toolOrigin = new URL(tool.url).origin;

    const handleHandshake = useCallback(() => {
        function onMessage(event: MessageEvent) {
            // Only accept SURDEJ_MIXIN_READY from the tool's origin
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (event.data?.type !== 'SURDEJ_MIXIN_READY') return;

            // Create a dedicated MessageChannel for this mixin
            const channel = new MessageChannel();
            channelRef.current = channel;

            // Route incoming requests from the mixin
            channel.port1.onmessage = async (msgEvent: MessageEvent) => {
                const action = msgEvent.data as MixinAction;
                if (!action.messageId) return;

                try {
                    const result = await routeAction(action, permissions, tool.slug);
                    channel.port1.postMessage({
                        messageId: action.messageId,
                        success: true,
                        data: result,
                    });
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown host error';
                    channel.port1.postMessage({
                        messageId: action.messageId,
                        success: false,
                        error: errorMessage,
                    });
                }
            };

            // Send handshake ACK with the MessagePort
            iframeRef.current?.contentWindow?.postMessage(
                {
                    type: 'SURDEJ_MIXIN_ACK',
                    success: true,
                    permissions,
                    context: {
                        mixinId: tool.slug,
                        permissions,
                    },
                },
                toolOrigin,
                [channel.port2],
            );

            setStatus('connected');
        }

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [permissions, tool.slug, toolOrigin]);

    useEffect(() => {
        const cleanup = handleHandshake();

        // Timeout: if no handshake within 15s, mark as error
        const timer = setTimeout(() => {
            if (status === 'loading') {
                setStatus('error');
                onError?.('Mixin handshake timeout — SDK may not be loaded');
            }
        }, 15_000);

        return () => {
            cleanup();
            clearTimeout(timer);
        };
    }, [handleHandshake, status, onError]);

    return (
        <div className={`relative w-full h-full ${className ?? ''}`}>
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Connecting to {tool.name}…
                    </div>
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="text-xs text-destructive text-center px-4">
                        <p className="font-medium">Connection failed</p>
                        <p className="mt-1 text-muted-foreground">Could not establish handshake with {tool.name}</p>
                    </div>
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={tool.url}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={tool.name}
                className="w-full h-full border-none"
                style={{ display: 'block' }}
            />
        </div>
    );
}
