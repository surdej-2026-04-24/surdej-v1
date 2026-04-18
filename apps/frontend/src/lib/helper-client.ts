/**
 * Helper Client
 *
 * Singleton client for communicating with the Surdej Helper Server.
 * The helper server runs on localhost and provides development utilities
 * like opening files in VS Code and reading file contents.
 *
 * @module helper-client
 */

interface HelperConfig {
    baseUrl: string;
    token: string;
}

interface HealthResponse {
    status: string;
    service: string;
    uptime: number;
    projectRoot: string;
}

interface OpenOptions {
    file: string;
    line?: number;
    column?: number;
}

interface ReadOptions {
    file: string;
    encoding?: 'utf-8' | 'base64';
}

interface ReadResponse {
    file: string;
    encoding: string;
    size: number;
    content: string;
}

class HelperClient {
    private config: HelperConfig | null = null;
    private available: boolean | null = null;

    /** Configure the helper client. Call once at app startup. */
    configure(config: HelperConfig): void {
        this.config = config;
        this.available = null; // Reset availability check
    }

    /** Auto-configure from environment or defaults. */
    autoConfig(): void {
        // In development, try standard ports and env vars
        const port = import.meta.env?.VITE_HELPER_PORT || '5050';
        const token = import.meta.env?.VITE_HELPER_TOKEN || '';
        this.configure({
            baseUrl: 'http://127.0.0.1:' + port,
            token,
        });
    }

    /** Check if the helper server is reachable. Caches the result. */
    async isAvailable(): Promise<boolean> {
        if (this.available !== null) return this.available;

        try {
            await this.health();
            this.available = true;
        } catch {
            this.available = false;
        }

        return this.available;
    }

    /** Reset the availability cache (e.g., after config change). */
    resetAvailability(): void {
        this.available = null;
    }

    /** GET /health */
    async health(): Promise<HealthResponse> {
        return this.request<HealthResponse>('GET', '/health', undefined, false);
    }

    /**
     * POST /open — Open a file in VS Code.
     * Uses `code --goto file:line:column`.
     */
    async openInEditor(options: OpenOptions): Promise<{ ok: boolean; opened: string }> {
        return this.request('POST', '/open', options);
    }

    /**
     * POST /read — Read a file from the project.
     * Path is validated server-side to be within the project root.
     */
    async readFile(options: ReadOptions): Promise<ReadResponse> {
        return this.request('POST', '/read', options);
    }

    /**
     * POST /token — Token exchange (stub).
     * For future SSO / Entra integration.
     */
    async exchangeToken(provider: string): Promise<{ provider: string; status: string; message: string }> {
        return this.request('POST', '/token', { provider });
    }

    // ─── Private ───────────────────────────────────────────────

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        requireAuth = true,
    ): Promise<T> {
        if (!this.config) {
            throw new Error('HelperClient not configured. Call configure() or autoConfig() first.');
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (requireAuth && this.config.token) {
            headers['Authorization'] = 'Bearer ' + this.config.token;
        }

        const url = this.config.baseUrl + path;

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const message = (errorBody as { error?: string }).error || response.statusText;
            throw new HelperError(message, response.status, path);
        }

        return response.json() as Promise<T>;
    }
}

/** Error thrown by the helper client when the server returns non-2xx. */
export class HelperError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly endpoint: string,
    ) {
        super('[Helper ' + status + '] ' + endpoint + ': ' + message);
        this.name = 'HelperError';
    }
}

/** Singleton helper client instance. */
export const helper = new HelperClient();

/** Re-export the class for testing / custom instances. */
export { HelperClient };

export type { HelperConfig, HealthResponse, OpenOptions, ReadOptions, ReadResponse };
