/**
 * Spread Architecture — Shared Types
 *
 * Defines the communication protocol between a Spread (sandboxed micro-app)
 * and the Surdej host. All interactions cross the MessageChannel bridge.
 *
 * The Spread has no direct access to the network, localStorage, cookies,
 * or the parent window. All external interactions must be requested via
 * these typed actions.
 */

// ─── Actions (Spread → Host) ────────────────────────────────────────

export type SurdejAction =
    | { type: 'SCRAPE_PAGE'; payload: { selector: string } }
    | { type: 'AUTOMATE'; payload: { action: 'FILL' | 'CLICK'; selector: string; value?: string } }
    | { type: 'PROXY_FETCH'; payload: { url: string; options?: RequestInit } }
    | { type: 'GET_AUTH_TOKEN'; payload: { provider: string } }
    | { type: 'CALL_MCP_TOOL'; payload: { toolName: string; args: unknown } };

// ─── Response (Host → Spread) ──────────────────────────────────────

export interface HostResponse<T = unknown> {
    messageId: string;
    success: boolean;
    data?: T;
    error?: string;
}

// ─── Outbound message (tagged request envelope) ─────────────────────

export type SpreadRequest = SurdejAction & { messageId: string };
