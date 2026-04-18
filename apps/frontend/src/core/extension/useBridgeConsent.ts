/**
 * Bridge Consent API Client & Hook
 *
 * Two consent levels:
 *   READ       – page info, text, snapshot, forms (passive)
 *   READ_WRITE – all above + click, fill, fetch (active)
 */

import { useState, useCallback, useRef } from 'react';
import { api, BASE_URL } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

export type ConsentLevel = 'READ' | 'READ_WRITE';

export interface ConsentCheckResult {
    consented: boolean;
    source: 'tenant' | 'user' | 'none';
    domain: string;
    pattern: string | null;
    level: ConsentLevel | null;
    status?: string;
}

export interface MergedConsent {
    id: string;
    domain: string;
    pattern: string;
    description: string | null;
    level: ConsentLevel;
    status: 'ALLOWED' | 'DENIED' | 'REVOKED';
    source: 'tenant' | 'user';
    createdAt: string;
    userOverride: string | null;
}

// ─── API calls ──────────────────────────────────────────────────

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
    const token = api.getToken() || '';
    const tenantId = api.getTenantId() || '';

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
            ...options?.headers,
        },
    });

    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    return res.json();
}

export async function checkDomainConsent(domain: string): Promise<ConsentCheckResult> {
    return apiCall<ConsentCheckResult>(`/bridge-consent/check?domain=${encodeURIComponent(domain)}`);
}

export async function grantUserConsent(
    domain: string,
    level: ConsentLevel = 'READ',
    status: 'ALLOWED' | 'DENIED' = 'ALLOWED',
): Promise<void> {
    await apiCall('/bridge-consent/user', {
        method: 'POST',
        body: JSON.stringify({ domain, pattern: domain, level, status }),
    });
}

export async function listUserConsents(): Promise<MergedConsent[]> {
    return apiCall<MergedConsent[]>('/bridge-consent/user');
}

export async function removeUserConsent(id: string): Promise<void> {
    await apiCall(`/bridge-consent/user/${id}`, { method: 'DELETE' });
}

export async function updateUserConsentStatus(
    id: string,
    status: 'ALLOWED' | 'DENIED' | 'REVOKED',
    level?: ConsentLevel,
): Promise<void> {
    await apiCall(`/bridge-consent/user/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(level ? { level } : {}) }),
    });
}

// ─── Cached consent state ───────────────────────────────────────

export interface CachedConsent {
    decision: 'allowed' | 'denied';
    level: ConsentLevel;
    source: 'tenant' | 'user' | 'session';
}

export type ConsentDecision = 'allowed' | 'denied' | 'pending' | 'unchecked';

export function useBridgeConsent() {
    const cache = useRef(new Map<string, CachedConsent>());
    const [pendingDomain, setPendingDomain] = useState<string | null>(null);
    const [currentConsent, setCurrentConsent] = useState<CachedConsent | null>(null);
    const [checking, setChecking] = useState(false);

    const checkConsent = useCallback(async (hostname: string): Promise<ConsentDecision> => {
        const cached = cache.current.get(hostname);
        if (cached) {
            setCurrentConsent(cached);
            return cached.decision;
        }

        setChecking(true);
        try {
            const result = await checkDomainConsent(hostname);
            if (result.consented) {
                const consent: CachedConsent = {
                    decision: 'allowed',
                    level: result.level || 'READ',
                    source: result.source as 'tenant' | 'user',
                };
                cache.current.set(hostname, consent);
                setCurrentConsent(consent);
                return 'allowed';
            } else {
                setCurrentConsent(null);
                setPendingDomain(hostname);
                return 'pending';
            }
        } catch {
            // API unreachable — allow to not break UX
            const fallback: CachedConsent = { decision: 'allowed', level: 'READ', source: 'session' };
            cache.current.set(hostname, fallback);
            setCurrentConsent(fallback);
            return 'allowed';
        } finally {
            setChecking(false);
        }
    }, []);

    const grantConsent = useCallback(async (domain: string, level: ConsentLevel, permanent: boolean) => {
        if (permanent) {
            try { await grantUserConsent(domain, level, 'ALLOWED'); } catch { /* ok */ }
        }
        const consent: CachedConsent = {
            decision: 'allowed',
            level,
            source: permanent ? 'user' : 'session',
        };
        cache.current.set(domain, consent);
        setCurrentConsent(consent);
        setPendingDomain(null);
    }, []);

    const denyConsent = useCallback(async (domain: string, permanent: boolean) => {
        if (permanent) {
            try { await grantUserConsent(domain, 'READ', 'DENIED'); } catch { /* ok */ }
        }
        const consent: CachedConsent = { decision: 'denied', level: 'READ', source: permanent ? 'user' : 'session' };
        cache.current.set(domain, consent);
        setCurrentConsent(consent);
        setPendingDomain(null);
    }, []);

    const revokeConsent = useCallback(async (domain: string) => {
        cache.current.delete(domain);
        setCurrentConsent(null);
        setPendingDomain(domain);
    }, []);

    const dismissConsent = useCallback(() => {
        setPendingDomain(null);
    }, []);

    const clearCache = useCallback(() => {
        cache.current.clear();
        setCurrentConsent(null);
    }, []);

    return {
        checkConsent,
        grantConsent,
        denyConsent,
        revokeConsent,
        dismissConsent,
        clearCache,
        pendingDomain,
        currentConsent,
        checking,
    };
}
