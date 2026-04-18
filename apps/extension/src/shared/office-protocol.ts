/**
 * Office Bridge Protocol
 *
 * Shared message types for communication between the Office Add-in
 * task pane (/office-addin) and the Surdej browser extension.
 *
 * Transport: WebSocket on localhost:19850
 * Flow:  Office Add-in ←→ WebSocket ←→ Extension Background ←→ Side Panel
 */

// ─── Namespace ─────────────────────────────────────────────────
export const OFFICE_BRIDGE_NAMESPACE = 'surdej-office-bridge';
export const OFFICE_WS_PORT = 19850;

// ─── Direction ─────────────────────────────────────────────────
export type OfficeDirection = 'addin-to-extension' | 'extension-to-addin';

// ─── App type ──────────────────────────────────────────────────
export type OfficeAppType = 'Word' | 'Excel' | 'PowerPoint' | 'Unknown';

// ─── Message Types ─────────────────────────────────────────────
export type OfficeBridgeMessageType =
    // Handshake
    | 'HELLO'
    | 'HELLO_ACK'
    | 'HEARTBEAT'

    // Document Read (extension → add-in)
    | 'GET_DOCUMENT_INFO'
    | 'GET_DOCUMENT_CONTENT'
    | 'GET_SELECTION'
    | 'GET_PROPERTIES'
    | 'SEARCH_TEXT'

    // Word-specific read
    | 'WORD_GET_PARAGRAPHS'
    | 'WORD_GET_TABLES'
    | 'WORD_GET_HEADERS'
    | 'WORD_GET_COMMENTS'
    | 'WORD_GET_BOOKMARKS'

    // Excel-specific read
    | 'EXCEL_GET_SHEETS'
    | 'EXCEL_GET_RANGE'
    | 'EXCEL_GET_USED_RANGE'
    | 'EXCEL_GET_CHARTS'
    | 'EXCEL_GET_NAMED_RANGES'
    | 'EXCEL_GET_FORMULAS'

    // PowerPoint-specific read
    | 'PPTX_GET_SLIDES'
    | 'PPTX_GET_SLIDE'
    | 'PPTX_GET_NOTES'

    // Document Write (extension → add-in)
    | 'INSERT_TEXT'
    | 'REPLACE_TEXT'
    | 'INSERT_TABLE'
    | 'SET_RANGE'
    | 'INSERT_IMAGE'
    | 'ADD_COMMENT'
    | 'SET_PROPERTY'

    // Word-specific write
    | 'WORD_INSERT_PARAGRAPH'
    | 'WORD_INSERT_HEADER'
    | 'WORD_APPLY_STYLE'

    // Excel-specific write
    | 'EXCEL_SET_FORMULA'
    | 'EXCEL_ADD_SHEET'
    | 'EXCEL_ADD_CHART'
    | 'EXCEL_AUTO_FIT'
    | 'EXCEL_SET_FORMAT'

    // PowerPoint-specific write
    | 'PPTX_ADD_SLIDE'
    | 'PPTX_SET_NOTES'
    | 'PPTX_INSERT_SHAPE'

    // Events (add-in → extension, push-based)
    | 'DOCUMENT_CHANGED'
    | 'SELECTION_CHANGED'
    | 'DOCUMENT_SAVED'
    | 'DOCUMENT_CLOSED';

// ─── Request ───────────────────────────────────────────────────
export interface OfficeBridgeMessage {
    namespace: typeof OFFICE_BRIDGE_NAMESPACE;
    id: string;
    direction: OfficeDirection;
    type: OfficeBridgeMessageType;
    payload?: unknown;
}

// ─── Response ──────────────────────────────────────────────────
export interface OfficeBridgeResponse {
    namespace: typeof OFFICE_BRIDGE_NAMESPACE;
    id: string;
    direction: OfficeDirection;
    ok: boolean;
    data?: unknown;
    error?: string;
    durationMs?: number;
}

// ─── Document Info ─────────────────────────────────────────────
export interface OfficeDocumentInfo {
    app: OfficeAppType;
    fileName: string;
    filePath?: string;
    isSaved: boolean;
    readOnly: boolean;
}

// ─── HELLO payload ─────────────────────────────────────────────
export interface HelloPayload {
    app: OfficeAppType;
    fileName: string;
    version: string;
}

// ─── Helper ────────────────────────────────────────────────────
let _officeCounter = 0;
export function createOfficeRequestId(): string {
    return `office-${Date.now()}-${++_officeCounter}`;
}
