/**
 * Shared Office.js document handlers
 *
 * Universal read/write operations that work across Word, Excel, and PowerPoint.
 * These are called when the extension sends commands via the bridge.
 */

import type { IncomingCommand } from '../useOfficeBridge';

type SendResponse = (id: string, ok: boolean, data?: unknown, error?: string) => void;

/** Handle universal document commands */
export async function handleSharedCommand(
    cmd: IncomingCommand,
    sendResponse: SendResponse,
): Promise<boolean> {
    const Office = (window as any).Office;
    if (!Office?.context) {
        sendResponse(cmd.id, false, undefined, 'Office.js not available');
        return true;
    }

    switch (cmd.type) {
        case 'GET_DOCUMENT_INFO':
            return handleGetDocumentInfo(cmd, sendResponse, Office);

        case 'GET_DOCUMENT_CONTENT':
            return handleGetDocumentContent(cmd, sendResponse, Office);

        case 'GET_SELECTION':
            return handleGetSelection(cmd, sendResponse, Office);

        case 'GET_PROPERTIES':
            return handleGetProperties(cmd, sendResponse, Office);

        case 'INSERT_TEXT':
            return handleInsertText(cmd, sendResponse, Office);

        case 'SEARCH_TEXT':
            return handleSearchText(cmd, sendResponse, Office);

        default:
            return false; // Not handled here
    }
}

// ─── GET_DOCUMENT_INFO ──────────────────────────────────────────

async function handleGetDocumentInfo(
    cmd: IncomingCommand,
    send: SendResponse,
    Office: any,
): Promise<boolean> {
    try {
        const ctx = Office.context;
        const host = ctx.host?.toString()?.toLowerCase() ?? '';
        let app = 'Unknown';
        if (host.includes('word')) app = 'Word';
        else if (host.includes('excel')) app = 'Excel';
        else if (host.includes('powerpoint')) app = 'PowerPoint';

        let fileName = '';
        try {
            if (ctx.document?.url) {
                const parts = ctx.document.url.split('/');
                fileName = decodeURIComponent(parts[parts.length - 1] || '');
            }
        } catch { /* best effort */ }

        send(cmd.id, true, {
            app,
            fileName,
            filePath: ctx.document?.url ?? '',
            isSaved: ctx.document?.mode === Office.DocumentMode?.ReadOnly,
            readOnly: ctx.document?.mode === Office.DocumentMode?.ReadOnly,
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}

// ─── GET_DOCUMENT_CONTENT ───────────────────────────────────────

async function handleGetDocumentContent(
    cmd: IncomingCommand,
    send: SendResponse,
    Office: any,
): Promise<boolean> {
    try {
        const maxLength = (cmd.payload as any)?.maxLength ?? 10000;

        await new Promise<void>((resolve, reject) => {
            Office.context.document.getFileAsync(
                Office.FileType.Text,
                { sliceSize: 65536 },
                (result: any) => {
                    if (result.status === Office.AsyncResultStatus.Failed) {
                        reject(new Error(result.error?.message ?? 'Failed to get file'));
                        return;
                    }

                    const file = result.value;
                    let content = '';
                    let slicesRead = 0;

                    const readSlice = () => {
                        file.getSliceAsync(slicesRead, (sliceResult: any) => {
                            if (sliceResult.status === Office.AsyncResultStatus.Failed) {
                                file.closeAsync();
                                reject(new Error(sliceResult.error?.message ?? 'Failed to read slice'));
                                return;
                            }

                            content += sliceResult.value.data;
                            slicesRead++;

                            if (slicesRead < file.sliceCount && content.length < maxLength) {
                                readSlice();
                            } else {
                                file.closeAsync();
                                send(cmd.id, true, {
                                    content: content.slice(0, maxLength),
                                    totalLength: content.length,
                                    truncated: content.length > maxLength,
                                });
                                resolve();
                            }
                        });
                    };

                    if (file.sliceCount > 0) {
                        readSlice();
                    } else {
                        file.closeAsync();
                        send(cmd.id, true, { content: '', totalLength: 0, truncated: false });
                        resolve();
                    }
                },
            );
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}

// ─── GET_SELECTION ──────────────────────────────────────────────

async function handleGetSelection(
    cmd: IncomingCommand,
    send: SendResponse,
    Office: any,
): Promise<boolean> {
    try {
        await new Promise<void>((resolve) => {
            Office.context.document.getSelectedDataAsync(
                Office.CoercionType.Text,
                (result: any) => {
                    if (result.status === Office.AsyncResultStatus.Succeeded) {
                        send(cmd.id, true, { text: result.value, type: 'text' });
                    } else {
                        send(cmd.id, false, undefined, result.error?.message ?? 'Failed to get selection');
                    }
                    resolve();
                },
            );
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}

// ─── GET_PROPERTIES ─────────────────────────────────────────────

async function handleGetProperties(
    cmd: IncomingCommand,
    send: SendResponse,
    Office: any,
): Promise<boolean> {
    try {
        await new Promise<void>((resolve) => {
            Office.context.document.getActiveViewAsync((result: any) => {
                const viewType = result.status === Office.AsyncResultStatus.Succeeded
                    ? result.value : 'unknown';

                send(cmd.id, true, {
                    viewType,
                    url: Office.context.document?.url ?? '',
                    mode: Office.context.document?.mode ?? 'unknown',
                });
                resolve();
            });
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}

// ─── INSERT_TEXT ─────────────────────────────────────────────────

async function handleInsertText(
    cmd: IncomingCommand,
    send: SendResponse,
    Office: any,
): Promise<boolean> {
    try {
        const payload = cmd.payload as { text: string; location?: string } | undefined;
        if (!payload?.text) {
            send(cmd.id, false, undefined, 'Missing required parameter: text');
            return true;
        }

        await new Promise<void>((resolve) => {
            Office.context.document.setSelectedDataAsync(
                payload.text,
                { coercionType: Office.CoercionType.Text },
                (result: any) => {
                    if (result.status === Office.AsyncResultStatus.Succeeded) {
                        send(cmd.id, true, { inserted: true, length: payload.text.length });
                    } else {
                        send(cmd.id, false, undefined, result.error?.message ?? 'Failed to insert text');
                    }
                    resolve();
                },
            );
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}

// ─── SEARCH_TEXT ─────────────────────────────────────────────────

async function handleSearchText(
    cmd: IncomingCommand,
    send: SendResponse,
    _Office: any,
): Promise<boolean> {
    // Search requires Word-specific or Excel-specific APIs.
    // For universal fallback, we read the document content and search in-memory.
    try {
        const payload = cmd.payload as { query: string } | undefined;
        if (!payload?.query) {
            send(cmd.id, false, undefined, 'Missing required parameter: query');
            return true;
        }

        // This is a simplified in-memory search. Word/Excel handlers can override with native search.
        send(cmd.id, true, {
            note: 'Universal search not yet implemented — use Word/Excel-specific search.',
            query: payload.query,
        });
    } catch (err) {
        send(cmd.id, false, undefined, err instanceof Error ? err.message : 'Unknown error');
    }
    return true;
}
