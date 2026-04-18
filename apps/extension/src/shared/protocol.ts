/**
 * Extension Bridge Protocol
 *
 * Shared message types for communication between the Surdej frontend
 * iframe (/extension) and the host page content script.
 *
 * Flow:  iframe ←→ postMessage ←→ content script ←→ chrome.runtime ←→ background
 */

// ─── Namespace to prevent collisions with other postMessage traffic ─────
export const BRIDGE_NAMESPACE = 'surdej-bridge';

// ─── Request types (iframe → content script) ──────────────────────────

export type BridgeRequestType =
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
    | 'FETCH_IMAGE'
    | 'CAPTURE_TAB';

export interface BridgeRequest {
    /** Always 'surdej-bridge' to filter out other postMessage traffic */
    namespace: typeof BRIDGE_NAMESPACE;
    /** Unique ID for correlating request ↔ response */
    id: string;
    /** Direction indicator */
    direction: 'iframe-to-host';
    /** The action to perform */
    type: BridgeRequestType;
    /** Action-specific payload */
    payload?: unknown;
}

// ─── Response types (content script → iframe) ─────────────────────────

export interface BridgeResponse {
    namespace: typeof BRIDGE_NAMESPACE;
    /** Correlation ID matching the request */
    id: string;
    direction: 'host-to-iframe';
    /** Whether the action succeeded */
    ok: boolean;
    /** Result data (on success) */
    data?: unknown;
    /** Error message (on failure) */
    error?: string;
}

// ─── Typed payloads ───────────────────────────────────────────────────

export interface PageInfo {
    url: string;
    title: string;
    description: string;
    hostname: string;
    pathname: string;
    lang: string;
    favicon: string;
    /** Open Graph metadata */
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
    /** Cleaned visible text content of the page */
    textContent: string;
    /** Selected text, if any */
    selectedText: string;
    /** Number of links on the page */
    linkCount: number;
    /** Number of images on the page */
    imageCount: number;
    /** Number of form inputs on the page */
    inputCount: number;
    /** Top-level headings */
    headings: string[];
}

export interface QuerySelectorResult {
    /** Number of matching elements */
    count: number;
    /** Text content of first matching element */
    text: string | null;
    /** HTML of first matching element (truncated) */
    html: string | null;
    /** Tag name of first matching element */
    tagName: string | null;
    /** Attributes of first matching element */
    attributes: Record<string, string>;
}

export interface QuerySelectorAllResult {
    count: number;
    elements: Array<{
        text: string;
        tagName: string;
        attributes: Record<string, string>;
    }>;
}

// ─── Form fields ───────────────────────────────────────────────────────

export interface FormFieldInfo {
    /** CSS selector path to the element */
    selector: string;
    /** Tag name (INPUT, SELECT, TEXTAREA) */
    tagName: string;
    /** Input type (text, email, password, checkbox, etc.) */
    type: string;
    /** name attribute */
    name: string;
    /** id attribute */
    id: string;
    /** Placeholder text */
    placeholder: string;
    /** Current value (passwords are masked) */
    value: string;
    /** Label text if associated */
    label: string;
    /** Whether the field is required */
    required: boolean;
    /** Whether the field is disabled */
    disabled: boolean;
    /** For selects: available options */
    options?: Array<{ value: string; text: string; selected: boolean }>;
    /** Source context: 'page' or iframe src */
    source: string;
}

export interface FormFieldsResult {
    fields: FormFieldInfo[];
    formCount: number;
    iframeCount: number;
    iframesAccessible: number;
}

// ─── Helper ────────────────────────────────────────────────────────────

let _counter = 0;
export function createRequestId(): string {
    return `req-${Date.now()}-${++_counter}`;
}
