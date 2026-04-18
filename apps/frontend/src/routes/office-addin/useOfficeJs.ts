/**
 * useOfficeJs — Hook to dynamically load Office.js and detect the Office app type.
 *
 * This hook is only used on the /office-addin route. It:
 * 1. Dynamically loads the Office.js CDN script
 * 2. Initialises Office.context
 * 3. Detects the host application type (Word, Excel, PowerPoint)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

type OfficeAppType = 'Word' | 'Excel' | 'PowerPoint' | 'Unknown';

interface OfficeJsState {
    /** Whether Office.js has been loaded and initialised */
    ready: boolean;
    /** The detected Office host application */
    app: OfficeAppType;
    /** File name of the open document */
    fileName: string;
    /** Loading state */
    loading: boolean;
    /** Error message if Office.js failed to load */
    error: string | null;
}

// We share protocol types via a local import for dev convenience.
// In production, these types are duplicated — the protocol file is in extension/src/shared/.

export function useOfficeJs(): OfficeJsState {
    const [state, setState] = useState<OfficeJsState>({
        ready: false,
        app: 'Unknown',
        fileName: '',
        loading: true,
        error: null,
    });
    const initialised = useRef(false);

    useEffect(() => {
        if (initialised.current) return;
        initialised.current = true;

        // Check if Office.js is already loaded (e.g. via manifest or previous load)
        if (typeof window !== 'undefined' && (window as any).Office) {
            initOffice();
            return;
        }

        // Dynamically inject Office.js CDN script
        const script = document.createElement('script');
        script.src = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';
        script.async = true;
        script.onload = () => initOffice();
        script.onerror = () => {
            setState((s) => ({
                ...s,
                loading: false,
                error: 'Failed to load Office.js. Are you running inside an Office application?',
            }));
        };
        document.head.appendChild(script);
    }, []);

    const initOffice = useCallback(() => {
        const Office = (window as any).Office;
        if (!Office) {
            setState((s) => ({ ...s, loading: false, error: 'Office.js not available' }));
            return;
        }

        Office.onReady((info: { host: string; platform: string }) => {
            let app: OfficeAppType = 'Unknown';
            const host = info.host?.toLowerCase() ?? '';
            if (host.includes('word')) app = 'Word';
            else if (host.includes('excel')) app = 'Excel';
            else if (host.includes('powerpoint') || host.includes('presentation')) app = 'PowerPoint';

            // Try to get the file name
            let fileName = '';
            try {
                const ctx = Office.context;
                if (ctx?.document?.url) {
                    const parts = ctx.document.url.split('/');
                    fileName = decodeURIComponent(parts[parts.length - 1] || '');
                }
            } catch {
                // File name detection is best-effort
            }

            setState({
                ready: true,
                app,
                fileName,
                loading: false,
                error: null,
            });
        });
    }, []);

    return state;
}
