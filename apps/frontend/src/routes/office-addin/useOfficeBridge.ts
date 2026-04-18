/**
 * useOfficeBridge — WebSocket connection from Office Add-in task pane to
 * the Surdej browser extension background service worker.
 *
 * Manages:
 * - Connection lifecycle (connect / reconnect / heartbeat)
 * - Request/response correlation
 * - Incoming command handling (extension → add-in)
 * - Event pushing (add-in → extension)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

type OfficeAppType = 'Word' | 'Excel' | 'PowerPoint' | 'Unknown';

const NAMESPACE = 'surdej-office-bridge';
const WS_PORT = 19850;
const HEARTBEAT_INTERVAL = 15_000;
const RECONNECT_DELAY = 3_000;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface OfficeBridgeHook {
    status: ConnectionStatus;
    /** Send a response back to the extension for a received command */
    sendResponse: (id: string, ok: boolean, data?: unknown, error?: string) => void;
    /** Push an event to the extension (e.g. DOCUMENT_CHANGED) */
    pushEvent: (type: string, payload?: unknown) => void;
    /** Register a handler for incoming commands from the extension */
    onCommand: (handler: CommandHandler) => void;
    /** Current latency (ms) to the extension */
    latencyMs: number;
}

export interface IncomingCommand {
    id: string;
    type: string;
    payload?: unknown;
}

type CommandHandler = (cmd: IncomingCommand) => void;

let _counter = 0;
function createId(): string {
    return `office-${Date.now()}-${++_counter}`;
}

export function useOfficeBridge(app: OfficeAppType, fileName: string, ready: boolean): OfficeBridgeHook {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [latencyMs, setLatencyMs] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const commandHandlerRef = useRef<CommandHandler | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanup = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.onerror = null;
            wsRef.current.onmessage = null;
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        if (!ready) return;
        cleanup();
        setStatus('connecting');

        try {
            const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus('connected');

                // Send HELLO handshake
                ws.send(JSON.stringify({
                    namespace: NAMESPACE,
                    id: createId(),
                    direction: 'addin-to-extension',
                    type: 'HELLO',
                    payload: { app, fileName, version: '1.0.0' },
                }));

                // Start heartbeat
                heartbeatRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        const pingId = createId();
                        const pingTime = Date.now();
                        ws.send(JSON.stringify({
                            namespace: NAMESPACE,
                            id: pingId,
                            direction: 'addin-to-extension',
                            type: 'HEARTBEAT',
                            payload: { timestamp: pingTime },
                        }));
                    }
                }, HEARTBEAT_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.namespace !== NAMESPACE) return;

                    // Handle heartbeat response → measure latency
                    if (msg.type === 'HEARTBEAT' && msg.payload?.timestamp) {
                        setLatencyMs(Date.now() - msg.payload.timestamp);
                        return;
                    }

                    // Handle HELLO_ACK
                    if (msg.type === 'HELLO_ACK') {
                        console.log('[OfficeBridge] Handshake complete');
                        return;
                    }

                    // Forward to command handler (extension → add-in commands)
                    if (msg.direction === 'extension-to-addin' && commandHandlerRef.current) {
                        commandHandlerRef.current({
                            id: msg.id,
                            type: msg.type,
                            payload: msg.payload,
                        });
                    }
                } catch (err) {
                    console.warn('[OfficeBridge] Failed to parse message:', err);
                }
            };

            ws.onerror = () => {
                setStatus('error');
            };

            ws.onclose = () => {
                setStatus('disconnected');
                // Auto-reconnect
                reconnectRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
            };
        } catch (err) {
            console.error('[OfficeBridge] Connection failed:', err);
            setStatus('error');
            reconnectRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
        }
    }, [ready, app, fileName, cleanup]);

    useEffect(() => {
        if (ready) connect();
        return cleanup;
    }, [ready, connect, cleanup]);

    const sendResponse = useCallback((id: string, ok: boolean, data?: unknown, error?: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                namespace: NAMESPACE,
                id,
                direction: 'addin-to-extension',
                ok,
                data,
                error,
            }));
        }
    }, []);

    const pushEvent = useCallback((type: string, payload?: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                namespace: NAMESPACE,
                id: createId(),
                direction: 'addin-to-extension',
                type,
                payload,
            }));
        }
    }, []);

    const onCommand = useCallback((handler: CommandHandler) => {
        commandHandlerRef.current = handler;
    }, []);

    return { status, sendResponse, pushEvent, onCommand, latencyMs };
}
