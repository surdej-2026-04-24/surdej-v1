/**
 * Office Add-in Task Pane Page
 *
 * Route: /office-addin
 *
 * This page runs inside the Office task pane web view. It:
 * 1. Loads Office.js dynamically and detects the host app
 * 2. Connects to the Surdej extension via WebSocket bridge
 * 3. Handles incoming commands from the extension (read/write document)
 * 4. Shows connection status and document info
 */

import { useEffect, useCallback } from 'react';
import { useOfficeJs } from './useOfficeJs';
import { useOfficeBridge, type IncomingCommand } from './useOfficeBridge';
import { handleSharedCommand } from './handlers/shared';
import { useTranslation } from '@/core/i18n';
import {
    FileText, Plug, Unplug, Loader2, AlertTriangle,
    FileSpreadsheet, Presentation, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfficeAddinPage() {
    const office = useOfficeJs();
    const bridge = useOfficeBridge(office.app, office.fileName, office.ready);
    const { t } = useTranslation();

    // Route incoming commands to appropriate handlers
    const handleCommand = useCallback(
        async (cmd: IncomingCommand) => {
            const start = Date.now();

            // Try shared handlers first
            const handled = await handleSharedCommand(cmd, bridge.sendResponse);

            if (!handled) {
                // TODO: Route to Word/Excel/PowerPoint-specific handlers
                bridge.sendResponse(
                    cmd.id,
                    false,
                    undefined,
                    `Unsupported command: ${cmd.type}`,
                );
            }

            const duration = Date.now() - start;
            console.log(`[OfficeAddin] ${cmd.type} handled in ${duration}ms`);
        },
        [bridge],
    );

    // Register command handler
    useEffect(() => {
        bridge.onCommand(handleCommand);
    }, [bridge, handleCommand]);

    const AppIcon = office.app === 'Word' ? FileText
        : office.app === 'Excel' ? FileSpreadsheet
            : office.app === 'PowerPoint' ? Presentation
                : FileText;

    // Loading state
    if (office.loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                    {t('common.loading')}
                </p>
            </div>
        );
    }

    // Error state — not inside Office
    if (office.error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground gap-4 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                    <p className="text-sm font-medium">Office.js not available</p>
                    <p className="text-xs text-muted-foreground mt-1">{office.error}</p>
                </div>
                <p className="text-[10px] text-muted-foreground max-w-xs">
                    This page is designed to run inside a Microsoft Office application
                    (Word, Excel, or PowerPoint) as a task pane add-in.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                        <AppIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-semibold truncate">Surdej Bridge</h1>
                        <p className="text-[10px] text-muted-foreground truncate">
                            {office.app} • {office.fileName || 'Untitled'}
                        </p>
                    </div>
                    <div
                        className={cn(
                            'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium',
                            bridge.status === 'connected'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : bridge.status === 'connecting'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-red-500/10 text-red-600',
                        )}
                    >
                        {bridge.status === 'connected'
                            ? <Plug className="h-3 w-3" />
                            : bridge.status === 'connecting'
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Unplug className="h-3 w-3" />}
                        {bridge.status === 'connected'
                            ? 'Connected'
                            : bridge.status === 'connecting'
                                ? 'Connecting…'
                                : 'Disconnected'}
                    </div>
                </div>
            </div>

            {/* Status content */}
            <div className="flex-1 overflow-auto px-4 py-6">
                <div className="space-y-4">
                    {/* Connection card */}
                    <div className={cn(
                        'border rounded-lg p-4 space-y-3',
                        bridge.status === 'connected'
                            ? 'border-emerald-500/30 bg-emerald-50/5'
                            : 'border-border',
                    )}>
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                'w-2.5 h-2.5 rounded-full',
                                bridge.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500',
                            )} />
                            <span className="text-sm font-medium">
                                Extension Bridge
                            </span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {bridge.status === 'connected'
                                ? 'Connected to Surdej extension. The AI can now read and write to your document through the chat interface.'
                                : bridge.status === 'connecting'
                                    ? 'Connecting to the Surdej browser extension…'
                                    : 'Not connected. Make sure the Surdej browser extension is running and the side panel is open.'}
                        </p>

                        {bridge.status === 'connected' && bridge.latencyMs > 0 && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <RefreshCw className="h-2.5 w-2.5" />
                                Latency: {bridge.latencyMs}ms
                            </div>
                        )}
                    </div>

                    {/* Document info card */}
                    <div className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <AppIcon className="h-4 w-4 text-muted-foreground" />
                            Document Info
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                            <span className="text-muted-foreground">App</span>
                            <span>{office.app}</span>
                            <span className="text-muted-foreground">File</span>
                            <span className="truncate">{office.fileName || '—'}</span>
                            <span className="text-muted-foreground">Status</span>
                            <span>{office.ready ? 'Ready' : 'Not ready'}</span>
                        </div>
                    </div>

                    {/* Available tools card */}
                    {bridge.status === 'connected' && (
                        <div className="border rounded-lg p-4 space-y-2">
                            <div className="text-sm font-medium">Available AI Tools</div>
                            <p className="text-xs text-muted-foreground">
                                The AI can use these tools to interact with your document:
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {getAvailableTools(office.app).map((tool) => (
                                    <span
                                        key={tool}
                                        className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium"
                                    >
                                        {tool}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t text-[9px] text-muted-foreground text-center">
                Surdej Office Bridge v1.0.0
            </div>
        </div>
    );
}

function getAvailableTools(app: string): string[] {
    const universal = [
        'office_get_document_info',
        'office_get_content',
        'office_get_selection',
        'office_insert_text',
        'office_replace_text',
        'office_search',
    ];

    switch (app) {
        case 'Word':
            return [...universal, 'word_get_paragraphs', 'word_get_tables', 'word_insert_paragraph'];
        case 'Excel':
            return [...universal, 'excel_get_sheets', 'excel_get_range', 'excel_set_formula', 'excel_add_chart'];
        case 'PowerPoint':
            return [...universal, 'pptx_get_slides', 'pptx_get_slide', 'pptx_add_slide', 'pptx_set_notes'];
        default:
            return universal;
    }
}

export default OfficeAddinPage;
