/**
 * Extension Bridge Client
 *
 * Used by the frontend's /extension page (running inside the side panel iframe)
 * to communicate with the content script on the host page.
 *
 * Sends postMessage requests and waits for correlated responses.
 */

// ─── Protocol constants (duplicated to avoid cross-workspace imports) ──

const BRIDGE_NAMESPACE = 'surdej-bridge';

type BridgeRequestType =
    | 'PING'
    | 'GET_PAGE_INFO'
    | 'GET_PAGE_TEXT'
    | 'GET_SELECTION'
    | 'QUERY_SELECTOR'
    | 'QUERY_SELECTOR_ALL'
    | 'CLICK_ELEMENT'
    | 'FILL_INPUT'
    | 'GET_PAGE_SNAPSHOT'
    | 'EXECUTE_SCRIPT'
    | 'FETCH_PAGE'
    | 'GET_XSRF_TOKEN'
    | 'GET_FORM_FIELDS'
    | 'FETCH_IMAGE';

interface BridgeResponse {
    namespace: typeof BRIDGE_NAMESPACE;
    id: string;
    direction: 'host-to-iframe';
    ok: boolean;
    data?: unknown;
    error?: string;
}

// ─── Typed result interfaces ───────────────────────────────────────

export interface PageInfo {
    url: string;
    title: string;
    description: string;
    hostname: string;
    pathname: string;
    lang: string;
    favicon: string;
    og?: {
        title?: string;
        description?: string;
        image?: string;
        type?: string;
        url?: string;
        siteName?: string;
    };
}

export interface PageSnapshot {
    url: string;
    title: string;
    description: string;
    textContent: string;
    selectedText: string;
    linkCount: number;
    imageCount: number;
    inputCount: number;
    headings: string[];
}

export interface QueryResult {
    count: number;
    text: string | null;
    html: string | null;
    tagName: string | null;
    attributes: Record<string, string>;
}

export interface QueryAllResult {
    count: number;
    elements: Array<{
        text: string;
        tagName: string;
        attributes: Record<string, string>;
    }>;
}

// ─── Bridge Client ─────────────────────────────────────────────────

let _counter = 0;

function createId(): string {
    return `req-${Date.now()}-${++_counter}`;
}

/**
 * Send a request to the host page's content script and await a response.
 * Times out after `timeoutMs` (default 5s).
 */
function sendRequest<T = unknown>(
    type: BridgeRequestType,
    payload?: unknown,
    timeoutMs = 5000,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const id = createId();

        const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error(`Bridge timeout: ${type} (${timeoutMs}ms)`));
        }, timeoutMs);

        function handler(event: MessageEvent) {
            const data = event.data as BridgeResponse;
            if (data?.namespace !== BRIDGE_NAMESPACE) return;
            if (data?.direction !== 'host-to-iframe') return;
            if (data?.id !== id) return;

            window.removeEventListener('message', handler);
            clearTimeout(timer);

            if (data.ok) {
                resolve(data.data as T);
            } else {
                reject(new Error(data.error ?? 'Bridge request failed'));
            }
        }

        window.addEventListener('message', handler);

        // Send to parent window (the host page that contains the side panel)
        // In Chrome side panel, window.parent posts to the host page
        // But side panel is NOT an iframe — it's a separate window.
        // We need to use chrome.tabs.sendMessage instead.
        // However, that requires the extension APIs.
        //
        // Strategy: Post message to window.parent (works if in iframe),
        // and also try chrome.runtime.sendMessage as fallback.
        window.parent.postMessage(
            {
                namespace: BRIDGE_NAMESPACE,
                id,
                direction: 'iframe-to-host',
                type,
                payload,
            },
            '*',
        );
    });
}

// ─── Public API ────────────────────────────────────────────────────

/** Check if the bridge is connected to a content script */
export async function ping(): Promise<boolean> {
    try {
        await sendRequest('PING', undefined, 2000);
        return true;
    } catch {
        return false;
    }
}

/** Get basic page information (URL, title, description, etc.) */
export function getPageInfo(): Promise<PageInfo> {
    return sendRequest<PageInfo>('GET_PAGE_INFO');
}

/** Get visible text content of the page (up to ~10k chars) */
export async function getPageText(): Promise<string> {
    const res = await sendRequest<{ text: string }>('GET_PAGE_TEXT');
    return res.text;
}

/** Get the user's currently selected text */
export async function getSelection(): Promise<string> {
    const res = await sendRequest<{ text: string }>('GET_SELECTION');
    return res.text;
}

/** Query a single element by CSS selector */
export function querySelector(selector: string): Promise<QueryResult> {
    return sendRequest<QueryResult>('QUERY_SELECTOR', { selector });
}

/** Query all matching elements by CSS selector */
export function querySelectorAll(selector: string, limit?: number): Promise<QueryAllResult> {
    return sendRequest<QueryAllResult>('QUERY_SELECTOR_ALL', { selector, limit });
}

/** Click an element by CSS selector */
export async function clickElement(selector: string): Promise<void> {
    await sendRequest('CLICK_ELEMENT', { selector });
}

/** Fill an input element by CSS selector */
export async function fillInput(selector: string, value: string): Promise<void> {
    await sendRequest('FILL_INPUT', { selector, value });
}

/** Get a comprehensive snapshot of the current page */
export function getPageSnapshot(): Promise<PageSnapshot> {
    return sendRequest<PageSnapshot>('GET_PAGE_SNAPSHOT');
}

/**
 * Check whether we're running inside an extension context
 * (i.e. as the /extension route loaded in the side panel iframe).
 */
export function isExtensionContext(): boolean {
    // If we're in an iframe, or the referrer policy suggests extension context
    return window !== window.parent || window.location.pathname === '/extension';
}

// ─── Extension API ──────────────────────────────────────────

export interface FetchPageRequest {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface FetchPageResponse {
    data?: unknown;
    error?: string;
    rateLimit: { remaining: number; limit: number };
}

/** Make an authenticated fetch request via the content script (uses the host page's cookies) */
export function fetchPage(request: FetchPageRequest): Promise<FetchPageResponse> {
    return sendRequest<FetchPageResponse>('FETCH_PAGE', request, 30000);
}

/** Get the XSRF token from the host page's cookies */
export async function getXsrfToken(): Promise<string | null> {
    try {
        const res = await sendRequest<{ token: string | null }>('GET_XSRF_TOKEN', undefined, 5000);
        return res.token;
    } catch {
        return null;
    }
}

// ─── Form fields ───────────────────────────────────────────────────

export interface FormFieldInfo {
    selector: string;
    tagName: string;
    type: string;
    name: string;
    id: string;
    placeholder: string;
    value: string;
    label: string;
    required: boolean;
    disabled: boolean;
    options?: Array<{ value: string; text: string; selected: boolean }>;
    source: string;
}

export interface FormFieldsResult {
    fields: FormFieldInfo[];
    formCount: number;
    iframeCount: number;
    iframesAccessible: number;
}

/** Get all form fields from the page and accessible iframes */
export function getFormFields(): Promise<FormFieldsResult> {
    return sendRequest<FormFieldsResult>('GET_FORM_FIELDS', undefined, 5000);
}

export interface FetchImageResult {
    dataUrl: string;
    contentType: string;
    size: number;
}

/** Fetch an image URL via the content script's authenticated session, returns base64 data URL */
export function fetchImage(url: string, headers?: Record<string, string>): Promise<FetchImageResult> {
    return sendRequest<FetchImageResult>('FETCH_IMAGE', { url, headers }, 10000);
}
