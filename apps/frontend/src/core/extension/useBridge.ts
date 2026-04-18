/**
 * useBridge — React hook for the Extension Bridge
 *
 * Provides reactive state for the bridge connection and convenience
 * methods for interacting with the host page.
 *
 * Retries connection automatically if the initial ping fails (the
 * content script / relay chain may not be ready yet on first load).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as bridge from './bridge';
import type { PageInfo, PageSnapshot } from './bridge';

export interface BridgeState {
    /** Whether the bridge is connected to a content script */
    connected: boolean;
    /** Whether a connection check is in progress */
    checking: boolean;
    /** Current host page info (null until fetched) */
    pageInfo: PageInfo | null;
    /** Refresh the connection status */
    checkConnection: () => Promise<boolean>;
    /** Fetch page info from the host */
    fetchPageInfo: () => Promise<PageInfo | null>;
    /** Get a full page snapshot */
    fetchSnapshot: () => Promise<PageSnapshot | null>;
    /** Get selected text from the host page */
    getSelection: () => Promise<string>;
    /** Query a CSS selector on the host page */
    querySelector: typeof bridge.querySelector;
    /** Query all matching CSS selectors on the host page */
    querySelectorAll: typeof bridge.querySelectorAll;
    /** Click an element on the host page */
    clickElement: typeof bridge.clickElement;
    /** Fill an input on the host page */
    fillInput: typeof bridge.fillInput;
}

/** Retry intervals (ms): 1s, 2s, 3s, 5s, then stop */
const RETRY_DELAYS = [1000, 2000, 3000, 5000];

export function useBridge(): BridgeState {
    const [connected, setConnected] = useState(false);
    const [checking, setChecking] = useState(true);
    const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
    const retryRef = useRef(0);

    const checkConnection = useCallback(async () => {
        setChecking(true);
        const ok = await bridge.ping();
        setConnected(ok);
        setChecking(false);
        return ok;
    }, []);

    const fetchPageInfo = useCallback(async () => {
        try {
            const info = await bridge.getPageInfo();
            setPageInfo(info);
            return info;
        } catch {
            return null;
        }
    }, []);

    const fetchSnapshot = useCallback(async () => {
        try {
            return await bridge.getPageSnapshot();
        } catch {
            return null;
        }
    }, []);

    const getSelection = useCallback(async () => {
        try {
            return await bridge.getSelection();
        } catch {
            return '';
        }
    }, []);

    // Auto-check connection on mount, with retries
    useEffect(() => {
        let cancelled = false;

        async function tryConnect() {
            const ok = await checkConnection();
            if (ok) {
                fetchPageInfo();
                return;
            }

            // Retry if not yet exhausted
            if (!cancelled && retryRef.current < RETRY_DELAYS.length) {
                const delay = RETRY_DELAYS[retryRef.current];
                retryRef.current++;
                setTimeout(() => {
                    if (!cancelled) tryConnect();
                }, delay);
            }
        }

        tryConnect();

        return () => { cancelled = true; };
    }, [checkConnection, fetchPageInfo]);

    // Re-check when active tab changes (notified by side panel app)
    useEffect(() => {
        function handleTabChange(event: MessageEvent) {
            if (event.data?.namespace !== 'surdej-bridge') return;
            if (event.data?.type !== 'TAB_CHANGED') return;

            // Small delay to let content script initialize on the new tab
            setTimeout(async () => {
                retryRef.current = 0; // reset retries
                const ok = await checkConnection();
                if (ok) fetchPageInfo();
                else setPageInfo(null);
            }, 300);
        }

        window.addEventListener('message', handleTabChange);
        return () => window.removeEventListener('message', handleTabChange);
    }, [checkConnection, fetchPageInfo]);

    return {
        connected,
        checking,
        pageInfo,
        checkConnection,
        fetchPageInfo,
        fetchSnapshot,
        getSelection,
        querySelector: bridge.querySelector,
        querySelectorAll: bridge.querySelectorAll,
        clickElement: bridge.clickElement,
        fillInput: bridge.fillInput,
    };
}
