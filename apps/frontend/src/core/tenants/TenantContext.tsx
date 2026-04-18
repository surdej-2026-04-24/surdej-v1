import {
    createContext, useContext, useEffect, useState, useCallback,
    type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';

// ─── Types ───

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logoUrl?: string;
    backgroundUrl?: string;
    metadata?: Record<string, unknown>;
    isDemo: boolean;
    deletedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface TenantContextValue {
    activeTenant: Tenant | null;
    /** Active tenants only (excludes soft-deleted) — used by the footer selector */
    allTenants: Tenant[];
    /** All tenants including soft-deleted — used by management page */
    allTenantsIncludingDeleted: Tenant[];
    isLoading: boolean;
    switchTenant: (tenantId: string) => Promise<void>;
    refreshTenants: () => Promise<void>;
    /** Monotonically increasing counter — bumped on every tenant switch.
     *  Add to useEffect deps to re-fetch data when tenant changes. */
    tenantVersion: number;
}

const TenantContext = createContext<TenantContextValue | null>(null);

// ─── Default fallback tenant ───

const DEMO_TENANT: Tenant = {
    id: 'tenant-demo-burger',
    name: 'Demo - Burger Restaurant',
    slug: 'demo-burger',
    description: 'A fictional fast-food franchise for demonstration purposes',
    isDemo: true,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const LOCAL_TENANTS: Tenant[] = [DEMO_TENANT];

const TENANT_STORAGE_KEY = 'surdej_active_tenant';

// Restore the tenant ID on the api client IMMEDIATELY (synchronous)
// so that the first API calls already carry the correct X-Tenant-Id header.
const storedTenantJson = localStorage.getItem(TENANT_STORAGE_KEY);
if (storedTenantJson) {
    try {
        const parsed = JSON.parse(storedTenantJson);
        if (parsed?.id) api.setTenantId(parsed.id);
    } catch { /* ignore corrupt data */ }
}

// ─── Provider ───

export function TenantProvider({ children }: { children: ReactNode }) {
    const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
    const [allTenantsRaw, setAllTenantsRaw] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tenantVersion, setTenantVersion] = useState(0);
    const { isAuthenticated } = useAuth();

    // Sync api client whenever the active tenant changes + persist to localStorage
    const applyTenant = useCallback((tenant: Tenant | null) => {
        setActiveTenant(tenant);
        api.setTenantId(tenant?.id ?? null);
        if (tenant) {
            localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify({ id: tenant.id, slug: tenant.slug }));
        } else {
            localStorage.removeItem(TENANT_STORAGE_KEY);
        }
    }, []);

    // Fetch user's active tenant on mount
    useEffect(() => {
        (async () => {
            if (!isAuthenticated) {
                applyTenant(DEMO_TENANT);
                setIsLoading(false);
                return;
            }
            try {
                const tenant = await api.get<Tenant>('/tenants/me');
                if (tenant) {
                    applyTenant(tenant);
                } else {
                    applyTenant(DEMO_TENANT);
                }
            } catch {
                // API not available — use demo tenant
                applyTenant(DEMO_TENANT);
            }
            setIsLoading(false);
            // Bump version after initial load so data-fetching components re-fetch
            // with the now-correct tenant context
            setTenantVersion((v) => v + 1);
        })();
    }, [isAuthenticated, applyTenant]);

    // Fetch all tenants
    const refreshTenants = useCallback(async () => {
        if (!isAuthenticated) {
            setAllTenantsRaw(LOCAL_TENANTS);
            return;
        }
        try {
            const tenants = await api.get<Tenant[]>('/tenants');
            setAllTenantsRaw(tenants.length > 0 ? tenants : LOCAL_TENANTS);
        } catch {
            setAllTenantsRaw(LOCAL_TENANTS);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        refreshTenants();
    }, [refreshTenants]);

    // Switch active tenant — invalidates all client-side caches
    const switchTenant = useCallback(
        async (tenantId: string) => {
            try {
                const tenant = await api.put<Tenant>('/tenants/me', { tenantId });
                applyTenant(tenant);
            } catch {
                // API not available — switch locally
                const localTenant = allTenantsRaw.find((t) => t.id === tenantId)
                    ?? LOCAL_TENANTS.find((t) => t.id === tenantId);
                if (localTenant) applyTenant(localTenant);
            }
            // Bump version — all components watching tenantVersion will re-fetch
            setTenantVersion((v) => v + 1);
        },
        [allTenantsRaw, applyTenant],
    );

    // Active tenants (excludes soft-deleted) — for footer selector
    const allTenants = allTenantsRaw.filter((t) => !t.deletedAt);

    // Block rendering until tenant is resolved — prevents data-fetching
    // components from firing API calls with a stale/fallback tenant ID.
    if (isLoading) {
        return null;
    }

    return (
        <TenantContext.Provider
            value={{
                activeTenant,
                allTenants,
                allTenantsIncludingDeleted: allTenantsRaw,
                isLoading,
                switchTenant,
                refreshTenants,
                tenantVersion,
            }}
        >
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const ctx = useContext(TenantContext);
    if (!ctx) throw new Error('useTenant must be used within TenantProvider');
    return ctx;
}
