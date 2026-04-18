/**
 * Tracer Panel
 *
 * Slide-out panel on the right side, outside the main layout,
 * showing a live log of all API calls with status, timing, and bodies.
 */

import { useState, useCallback } from 'react';
import { useTracerStore, type TracedRequest } from '@/core/tracer/tracerStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    X, Trash2, ChevronDown, ChevronRight, Loader2,
    ArrowDownToLine, ArrowUpFromLine, Clock, Zap,
    FileText, Globe, Copy, Download, CheckSquare, Square, CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { stringify as yamlStringify } from 'yaml';

function formatBody(body: unknown): string {
    if (typeof body === 'string') return body;
    try { return JSON.stringify(body, null, 2); } catch { return String(body); }
}

/** Mask sensitive header values */
function maskHeaderValue(key: string, value: string): string {
    const lower = key.toLowerCase();
    if (lower === 'authorization') {
        // Show "Bearer " prefix + first 8 chars, mask the rest
        if (value.startsWith('Bearer ') && value.length > 15) {
            return `Bearer ${value.slice(7, 15)}…`;
        }
        return `${value.slice(0, 8)}…`;
    }
    if (lower === 'cookie' || lower === 'set-cookie') {
        return value.length > 30 ? `${value.slice(0, 30)}…` : value;
    }
    return value;
}

const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    PATCH: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
};

function statusColor(status: number | null): string {
    if (status === null) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-emerald-500';
    if (status >= 300 && status < 400) return 'text-blue-500';
    if (status >= 400 && status < 500) return 'text-amber-500';
    if (status >= 500) return 'text-red-500';
    if (status === 0) return 'text-red-500';
    return 'text-muted-foreground';
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Collapsible header table */
function HeadersSection({ headers, label, icon }: { headers: Record<string, string>; label: string; icon: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const entries = Object.entries(headers);
    if (entries.length === 0) return null;

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1 hover:text-foreground transition-colors w-full text-left"
            >
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {icon}
                {label}
                <span className="text-muted-foreground/50 font-normal ml-1">({entries.length})</span>
            </button>
            {open && (
                <div className="bg-muted/40 rounded overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    <table className="w-full text-[10px] font-mono">
                        <tbody>
                            {entries.map(([key, value]) => (
                                <tr key={key} className="border-b border-border/30 last:border-0">
                                    <td className="px-2 py-0.5 text-muted-foreground font-semibold whitespace-nowrap align-top w-[140px]">
                                        {key}
                                    </td>
                                    <td className="px-2 py-0.5 text-foreground/80 break-all">
                                        {maskHeaderValue(key, value)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** Serialize traced requests into a clean object array for export */
function serializeRequests(reqs: TracedRequest[]) {
    return reqs.map((r) => ({
        method: r.method,
        path: r.path,
        url: r.url,
        pageUrl: r.pageUrl || undefined,
        status: r.status,
        statusText: r.statusText || undefined,
        duration_ms: r.duration,
        timestamp: new Date(r.timestamp).toISOString(),
        error: r.error || undefined,
        request: {
            headers: r.requestHeaders && Object.keys(r.requestHeaders).length ? r.requestHeaders : undefined,
            body: r.requestBody ?? undefined,
        },
        response: {
            headers: r.responseHeaders && Object.keys(r.responseHeaders).length ? r.responseHeaders : undefined,
            body: r.responseBody ?? undefined,
        },
    }));
}

function downloadYaml(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function TracerPanel() {
    const { panelOpen, setPanelOpen, requests, clearRequests, enabled, toggleEnabled } = useTracerStore();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [copied, setCopied] = useState(false);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(requests.map((r) => r.id)));
    }, [requests]);

    const deselectAll = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const selectedRequests = requests.filter((r) => selectedIds.has(r.id));
    const allSelected = requests.length > 0 && selectedIds.size === requests.length;

    const handleCopy = useCallback(async () => {
        if (selectedRequests.length === 0) return;
        const yaml = yamlStringify(serializeRequests(selectedRequests));
        await navigator.clipboard.writeText(yaml);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [selectedRequests]);

    const handleDownload = useCallback(() => {
        if (selectedRequests.length === 0) return;
        const yaml = yamlStringify(serializeRequests(selectedRequests));
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        downloadYaml(yaml, `tracer-export-${ts}.yaml`);
    }, [selectedRequests]);

    if (!panelOpen) return null;

    const pendingCount = requests.filter((r) => r.pending).length;
    const errorCount = requests.filter((r) => !r.pending && r.status !== null && (r.status >= 400 || r.status === 0)).length;

    return (
        <div className="fixed top-0 right-0 bottom-0 w-[420px] z-50 bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold flex-1">API Tracer</span>

                {pendingCount > 0 && (
                    <Badge variant="default" className="text-[9px] gap-1 animate-pulse">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        {pendingCount} in-flight
                    </Badge>
                )}
                {errorCount > 0 && (
                    <Badge variant="destructive" className="text-[9px]">
                        {errorCount} errors
                    </Badge>
                )}

                <Separator orientation="vertical" className="h-5" />

                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearRequests} title="Clear all">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 text-xs">
                <button
                    onClick={toggleEnabled}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-md transition-all',
                        enabled
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    <div className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        enabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
                    )} />
                    {enabled ? 'Recording' : 'Paused'}
                </button>
                <span className="text-muted-foreground flex-1">
                    {requests.length} requests captured
                </span>
            </div>

            {/* Selection toolbar */}
            {requests.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-muted/5 text-xs">
                    <button
                        onClick={allSelected ? deselectAll : selectAll}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                    >
                        {allSelected
                            ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            : <Square className="h-3.5 w-3.5" />
                        }
                        {allSelected ? 'Deselect all' : 'Select all'}
                    </button>

                    {selectedIds.size > 0 && (
                        <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="text-muted-foreground">{selectedIds.size} selected</span>
                            <span className="flex-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] gap-1"
                                onClick={handleCopy}
                            >
                                {copied
                                    ? <><CheckCheck className="h-3 w-3 text-emerald-500" /> Copied!</>
                                    : <><Copy className="h-3 w-3" /> Copy YAML</>}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] gap-1"
                                onClick={handleDownload}
                            >
                                <Download className="h-3 w-3" /> Download
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* Request list */}
            <div className="flex-1 overflow-y-auto">
                {requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-center px-8">
                        <Zap className="h-8 w-8 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No requests captured</p>
                        <p className="text-xs mt-1">
                            {enabled
                                ? 'API calls will appear here as they are made'
                                : 'Enable the tracer to start capturing API calls'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {requests.map((req) => (
                            <RequestRow
                                key={req.id}
                                request={req}
                                selected={selectedIds.has(req.id)}
                                onToggleSelect={() => toggleSelect(req.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Request Row ────────────────────────────────────────────────

function RequestRow({ request, selected, onToggleSelect }: { request: TracedRequest; selected: boolean; onToggleSelect: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [rowCopied, setRowCopied] = useState(false);

    const handleCopyRow = useCallback(async () => {
        const yaml = yamlStringify(serializeRequests([request]));
        await navigator.clipboard.writeText(yaml);
        setRowCopied(true);
        setTimeout(() => setRowCopied(false), 2000);
    }, [request]);

    return (
        <div className={cn(
            'transition-colors',
            request.pending && 'bg-primary/[0.03]',
            request.error && 'bg-red-500/[0.03]',
            selected && 'bg-primary/[0.06]',
        )}>
            <div className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    className="shrink-0 focus-visible:outline-none"
                    title={selected ? 'Deselect' : 'Select'}
                >
                    {selected
                        ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        : <Square className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground" />
                    }
                </button>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                >
                    {expanded
                        ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    }

                    <Badge variant="outline" className={cn('text-[9px] font-mono shrink-0 px-1.5', METHOD_COLORS[request.method])}>
                        {request.method}
                    </Badge>

                    <span className="text-xs font-mono truncate flex-1" title={request.path}>
                        {request.path || '/'}
                    </span>

                    {request.pending ? (
                        <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
                    ) : (
                        <>
                            <span className={cn('text-[10px] font-mono font-semibold shrink-0', statusColor(request.status))}>
                                {request.status}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                {formatDuration(request.duration)}
                            </span>
                        </>
                    )}

                    <span className="text-[9px] text-muted-foreground/60 shrink-0">
                        {formatTime(request.timestamp)}
                    </span>
                </button>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="px-4 pb-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(request.timestamp).toLocaleTimeString()}
                        </span>
                        {!request.pending && (
                            <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {formatDuration(request.duration)}
                            </span>
                        )}
                        {request.error && (
                            <span className="text-red-500">{request.error}</span>
                        )}
                        <span className="flex-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] gap-1"
                            onClick={handleCopyRow}
                        >
                            {rowCopied
                                ? <><CheckCheck className="h-3 w-3 text-emerald-500" /> Copied</>
                                : <><Copy className="h-3 w-3" /> Copy</>}
                        </Button>
                    </div>

                    {/* Full URL */}
                    <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded break-all">
                        {request.url}
                    </div>

                    {/* Page URL */}
                    {request.pageUrl && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="font-mono break-all">{request.pageUrl}</span>
                        </div>
                    )}

                    {/* Request headers */}
                    {request.requestHeaders && (
                        <HeadersSection
                            headers={request.requestHeaders}
                            label="Request Headers"
                            icon={<ArrowUpFromLine className="h-3 w-3" />}
                        />
                    )}

                    {/* Request body */}
                    {request.requestBody !== undefined && request.requestBody !== null && (
                        <div>
                            <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                                <FileText className="h-3 w-3" />
                                Request Body
                            </div>
                            <pre className="text-[10px] font-mono bg-muted/40 px-2 py-1.5 rounded overflow-x-auto max-h-40 text-foreground/80">
                                {formatBody(request.requestBody)}
                            </pre>
                        </div>
                    )}

                    {/* Response headers */}
                    {request.responseHeaders && !request.pending && (
                        <HeadersSection
                            headers={request.responseHeaders}
                            label="Response Headers"
                            icon={<Globe className="h-3 w-3" />}
                        />
                    )}

                    {/* Response body */}
                    {request.responseBody !== undefined && request.responseBody !== null && !request.pending && (
                        <div>
                            <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                                <ArrowDownToLine className="h-3 w-3" />
                                Response Body
                            </div>
                            <pre className="text-[10px] font-mono bg-muted/40 px-2 py-1.5 rounded overflow-x-auto max-h-48 text-foreground/80">
                                {formatBody(request.responseBody)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
