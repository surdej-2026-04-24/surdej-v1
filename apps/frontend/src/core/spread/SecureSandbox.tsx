/**
 * SecureSandbox — Host-side Spread Loader
 *
 * Loads a Spread (a self-contained HTML string) inside a sandboxed
 * iframe via a Blob URL, then establishes a MessageChannel handshake
 * so the Spread can request capabilities from this host.
 *
 * Security:
 *   - sandbox="allow-scripts" only — no same-origin, no forms, no popups
 *   - Blob URL isolates the Spread to a null origin
 *   - All capability calls are routed through configurable handlers
 *
 * Usage:
 *   <SecureSandbox
 *     appSource={mySpreadHtmlString}
 *     capabilities={{ onProxyFetch, onScrapePage }}
 *   />
 */

import { useEffect, useRef } from 'react';
import type { SurdejAction } from './types';

// ─── Types ──────────────────────────────────────────────────────────

export interface SpreadCapabilities {
    /** Extract DOM element text from the host/content page */
    onScrapePage?: (selector: string) => Promise<unknown>;
    /** Perform DOM automation on the host/content page */
    onAutomate?: (
        action: 'FILL' | 'CLICK',
        selector: string,
        value?: string,
    ) => Promise<void>;
    /** Make a proxied HTTP request via the extension background */
    onProxyFetch?: (url: string, options?: RequestInit) => Promise<unknown>;
    /** Retrieve a session token from the active tab */
    onGetAuthToken?: (provider: string) => Promise<string>;
    /** Execute an MCP tool */
    onCallMcpTool?: (toolName: string, args: unknown) => Promise<unknown>;
}

export interface SecureSandboxProps {
    /** The full HTML source of the Spread app (single-file bundle) */
    appSource: string;
    /** Capability handlers wired up by the host */
    capabilities?: SpreadCapabilities;
    className?: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function SecureSandbox({ appSource, capabilities = {}, className }: SecureSandboxProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Load the Spread via a Blob URL so it gets a null origin
        const blob = new Blob([appSource], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        iframe.src = blobUrl;

        function handleLoad() {
            if (!iframeRef.current) return;
            const channel = new MessageChannel();

            // ── Route incoming Spread requests ──────────────────────
            channel.port1.onmessage = async (event: MessageEvent) => {
                const message = event.data as { messageId?: string } & SurdejAction;
                const { messageId } = message;
                if (!messageId) return;

                try {
                    const result = await routeAction(message, capabilities);
                    channel.port1.postMessage({ messageId, success: true, data: result });
                } catch (err: unknown) {
                    const errorMessage =
                        err instanceof Error ? err.message : 'Unknown host error';
                    channel.port1.postMessage({ messageId, success: false, error: errorMessage });
                }
            };

            // ── Send the port to the Spread via INIT_PORT handshake ─
            iframeRef.current.contentWindow?.postMessage({ type: 'INIT_PORT' }, '*', [channel.port2]);
        }

        iframe.addEventListener('load', handleLoad);

        return () => {
            iframe.removeEventListener('load', handleLoad);
            URL.revokeObjectURL(blobUrl);
        };
    }, [appSource, capabilities]);

    return (
        <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            title="Spread Sandbox"
            className={className}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
    );
}

// ─── Internal capability router ─────────────────────────────────────

async function routeAction(
    message: { messageId?: string } & SurdejAction,
    caps: SpreadCapabilities,
): Promise<unknown> {
    switch (message.type) {
        case 'SCRAPE_PAGE': {
            if (!caps.onScrapePage) throw new Error('SCRAPE_PAGE capability not provided');
            return caps.onScrapePage(message.payload.selector);
        }
        case 'AUTOMATE': {
            if (!caps.onAutomate) throw new Error('AUTOMATE capability not provided');
            return caps.onAutomate(
                message.payload.action,
                message.payload.selector,
                message.payload.value,
            );
        }
        case 'PROXY_FETCH': {
            if (!caps.onProxyFetch) throw new Error('PROXY_FETCH capability not provided');
            return caps.onProxyFetch(message.payload.url, message.payload.options);
        }
        case 'GET_AUTH_TOKEN': {
            if (!caps.onGetAuthToken) throw new Error('GET_AUTH_TOKEN capability not provided');
            return caps.onGetAuthToken(message.payload.provider);
        }
        case 'CALL_MCP_TOOL': {
            if (!caps.onCallMcpTool) throw new Error('CALL_MCP_TOOL capability not provided');
            return caps.onCallMcpTool(message.payload.toolName, message.payload.args);
        }
        default:
            throw new Error(`Unknown action type`);
    }
}
