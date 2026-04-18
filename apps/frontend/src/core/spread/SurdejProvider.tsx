/**
 * SurdejProvider — React Context for Spread Apps
 *
 * Wrap the Spread's root component with this provider. It initialises
 * a SurdejClient in mock mode and upgrades to a live host connection
 * when the INIT_PORT handshake message arrives from the Surdej host.
 *
 * Usage inside a Spread:
 *   const client = useSurdej();
 *   const data = await client.request({ type: 'PROXY_FETCH', payload: { url } });
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SurdejClient } from './SurdejClient';

// ─── Context ────────────────────────────────────────────────────────

const SurdejContext = createContext<SurdejClient | null>(null);

// ─── Provider ───────────────────────────────────────────────────────

export const SurdejProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [client, setClient] = useState<SurdejClient>(() => new SurdejClient());

    useEffect(() => {
        function handleHandshake(event: MessageEvent) {
            if (event.data?.type !== 'INIT_PORT') return;
            const port = event.ports[0];
            if (!port) return;
            console.log('[SurdejProvider] Host connected — upgrading to live port.');
            setClient(new SurdejClient(port));
        }

        window.addEventListener('message', handleHandshake);
        return () => window.removeEventListener('message', handleHandshake);
    }, []);

    return <SurdejContext value={client}>{children}</SurdejContext>;
};

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * Access the SurdejClient within a Spread app.
 * Must be used inside a <SurdejProvider>.
 */
export function useSurdej(): SurdejClient {
    const ctx = useContext(SurdejContext);
    if (!ctx) throw new Error('[useSurdej] Must be used inside <SurdejProvider>.');
    return ctx;
}
