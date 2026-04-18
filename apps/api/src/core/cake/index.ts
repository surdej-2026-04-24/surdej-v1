/**
 * CAKE Integration — Customer Authentication & Knowledge Exchange
 *
 * CAKE is Surdej's protocol for exchanging authentication tokens and
 * knowledge data between tenant instances and the central platform.
 *
 * Features:
 *   - Token exchange: Azure AD / Entra ID tokens → Surdej session tokens
 *   - Tenant provisioning: auto-create tenant on first login
 *   - Knowledge sync: push/pull articles between instances
 *   - Webhook delivery: notify tenants of knowledge updates
 *
 * Environment:
 *   CAKE_ENABLED=true
 *   CAKE_HUB_URL=https://hub.surdej.app
 *   CAKE_API_KEY=<platform-api-key>
 *   CAKE_TENANT_SECRET=<per-tenant-secret>
 *
 * @module core/cake
 */

// ─── Types ──────────────────────────────────────────────────────

export interface CakeConfig {
    enabled: boolean;
    hubUrl: string;
    apiKey: string;
    tenantSecret?: string;
}

export interface CakeTokenExchangeRequest {
    /** The incoming external token (e.g. Azure AD JWT) */
    externalToken: string;
    /** External identity provider */
    provider: 'azure-ad' | 'entra-id' | 'google' | 'okta' | 'custom';
    /** Tenant slug to authenticate against */
    tenantSlug: string;
}

export interface CakeTokenExchangeResponse {
    /** Surdej session token */
    sessionToken: string;
    /** Token expiry (ISO timestamp) */
    expiresAt: string;
    /** User information from the external provider */
    user: {
        externalId: string;
        email: string;
        name?: string;
        avatarUrl?: string;
    };
    /** Tenant information */
    tenant: {
        id: string;
        slug: string;
        name: string;
        isNew: boolean; // True if tenant was auto-provisioned
    };
}

export interface CakeKnowledgePushPayload {
    /** Source tenant slug */
    sourceTenant: string;
    /** Articles to push */
    articles: Array<{
        externalId: string;
        title: string;
        content: string;
        contentType: 'markdown' | 'html' | 'plain';
        tags?: string[];
        metadata?: Record<string, unknown>;
    }>;
}

export interface CakeKnowledgePullRequest {
    /** Target tenant slug */
    tenantSlug: string;
    /** Article IDs to pull */
    articleIds?: string[];
    /** Pull all articles since this timestamp */
    since?: string;
    /** Maximum number of articles to pull */
    limit?: number;
}

export interface CakeWebhookEvent {
    eventType: 'article.created' | 'article.updated' | 'article.deleted' | 'tenant.provisioned' | 'sync.completed';
    tenantSlug: string;
    payload: Record<string, unknown>;
    timestamp: string;
    signature: string;
}

// ─── Client ─────────────────────────────────────────────────────

export class CakeClient {
    private config: CakeConfig;

    constructor(config?: Partial<CakeConfig>) {
        this.config = {
            enabled: config?.enabled ?? (process.env.CAKE_ENABLED === 'true'),
            hubUrl: config?.hubUrl ?? process.env.CAKE_HUB_URL ?? 'https://hub.surdej.app',
            apiKey: config?.apiKey ?? process.env.CAKE_API_KEY ?? '',
            tenantSecret: config?.tenantSecret ?? process.env.CAKE_TENANT_SECRET,
        };
    }

    get isEnabled(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    // ── Token Exchange ──────────────────────────────────────────

    /**
     * Exchange an external identity provider token for a Surdej session token.
     *
     * Flow:
     *   1. Client sends external token (Azure AD JWT, etc.)
     *   2. CAKE validates the token with the identity provider
     *   3. CAKE maps the user to a Surdej user (creates if new)
     *   4. CAKE maps the tenant (creates if new)
     *   5. Returns a Surdej session token
     */
    async exchangeToken(request: CakeTokenExchangeRequest): Promise<CakeTokenExchangeResponse> {
        this.assertEnabled();

        const res = await fetch(`${this.config.hubUrl}/api/cake/token/exchange`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`CAKE token exchange failed (${res.status}): ${text}`);
        }

        return res.json() as Promise<CakeTokenExchangeResponse>;
    }

    /**
     * Validate a CAKE session token.
     */
    async validateToken(sessionToken: string): Promise<{
        valid: boolean;
        userId?: string;
        tenantId?: string;
        expiresAt?: string;
    }> {
        this.assertEnabled();

        const res = await fetch(`${this.config.hubUrl}/api/cake/token/validate`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ token: sessionToken }),
        });

        if (!res.ok) {
            return { valid: false };
        }

        return res.json();
    }

    // ── Knowledge Sync ──────────────────────────────────────────

    /**
     * Push articles to the CAKE hub for cross-tenant distribution.
     */
    async pushKnowledge(payload: CakeKnowledgePushPayload): Promise<{
        accepted: number;
        rejected: number;
        errors: string[];
    }> {
        this.assertEnabled();

        const res = await fetch(`${this.config.hubUrl}/api/cake/knowledge/push`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`CAKE push failed (${res.status}): ${await res.text()}`);
        }

        return res.json();
    }

    /**
     * Pull articles from the CAKE hub.
     */
    async pullKnowledge(request: CakeKnowledgePullRequest): Promise<{
        articles: Array<{
            externalId: string;
            title: string;
            content: string;
            contentType: string;
            tags?: string[];
            metadata?: Record<string, unknown>;
            lastModified: string;
        }>;
        total: number;
    }> {
        this.assertEnabled();

        const res = await fetch(`${this.config.hubUrl}/api/cake/knowledge/pull`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            throw new Error(`CAKE pull failed (${res.status}): ${await res.text()}`);
        }

        return res.json();
    }

    // ── Webhooks ────────────────────────────────────────────────

    /**
     * Register a webhook URL to receive CAKE events.
     */
    async registerWebhook(
        tenantSlug: string,
        webhookUrl: string,
        events: CakeWebhookEvent['eventType'][]
    ): Promise<{ webhookId: string }> {
        this.assertEnabled();

        const res = await fetch(`${this.config.hubUrl}/api/cake/webhooks`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ tenantSlug, webhookUrl, events }),
        });

        if (!res.ok) {
            throw new Error(`Webhook registration failed (${res.status}): ${await res.text()}`);
        }

        return res.json();
    }

    /**
     * Verify a webhook signature.
     * Uses HMAC-SHA256 with the tenant secret.
     */
    async verifyWebhookSignature(
        payload: string,
        signature: string
    ): Promise<boolean> {
        if (!this.config.tenantSecret) {
            console.warn('[CAKE] No tenantSecret configured — cannot verify webhook signatures');
            return false;
        }

        // Use Web Crypto for HMAC-SHA256
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.config.tenantSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        const computed = Array.from(new Uint8Array(sig))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return computed === signature;
    }

    // ── Health ──────────────────────────────────────────────────

    /**
     * Check CAKE hub connectivity.
     */
    async healthCheck(): Promise<{
        reachable: boolean;
        version?: string;
        error?: string;
    }> {
        if (!this.isEnabled) {
            return { reachable: false, error: 'CAKE is not enabled' };
        }

        try {
            const res = await fetch(`${this.config.hubUrl}/api/cake/health`, {
                headers: this.headers(),
            });

            if (!res.ok) {
                return { reachable: false, error: `Hub returned ${res.status}` };
            }

            const data = await res.json() as { version?: string };
            return { reachable: true, version: data.version };
        } catch (e) {
            return { reachable: false, error: (e as Error).message };
        }
    }

    // ── Private ─────────────────────────────────────────────────

    private assertEnabled() {
        if (!this.isEnabled) {
            throw new Error(
                'CAKE integration is not enabled. Set CAKE_ENABLED=true and CAKE_API_KEY.'
            );
        }
    }

    private headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-CAKE-API-Key': this.config.apiKey,
            ...(this.config.tenantSecret
                ? { 'X-CAKE-Tenant-Secret': this.config.tenantSecret }
                : {}),
        };
    }
}

// ─── Singleton ──────────────────────────────────────────────────

let _client: CakeClient | null = null;

/**
 * Get the CAKE client singleton.
 * Initialised lazily from environment variables.
 */
export function getCakeClient(): CakeClient {
    if (!_client) {
        _client = new CakeClient();
    }
    return _client;
}

/**
 * Check if CAKE is available.
 */
export function isCakeEnabled(): boolean {
    return getCakeClient().isEnabled;
}
