import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { IframeToolDef } from './IframeToolHost';

export function useIframeTools() {
    const [tools, setTools] = useState<IframeToolDef[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get<IframeToolDef[]>('/iframe-tools/enabled');
            setTools(data);
        } catch {
            // silently fail — iframe tools are optional
            setTools([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { tools, loading, refresh };
}
