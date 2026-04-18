/**
 * Extension Debug Context
 *
 * Root-level context provider for the /extension route.
 * When debug mode is on (?debug=true query param):
 *   - Wide views (>480px): shows a right-side debug panel
 *   - Narrow views (≤480px): shows a sticky footer toolbar
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useBridge } from './useBridge';
import type { PageSnapshot, FormFieldsResult } from './bridge';
import * as bridge from './bridge';
import {
    Bug, Globe, Eye, MousePointer, Plug, Unplug,
    RefreshCw, Loader2, X, PanelRightOpen, PanelRightClose,
    Terminal, Copy, Check, FileInput, Video, Activity, ExternalLink,
} from 'lucide-react';
import { useExtensionSessionStore } from './extensionSessionStore';
import { getSession, type WorkflowSession } from '@/routes/modules/tool-management-tools/use-case-api';
import { cn } from '@/lib/utils';
import { useResizablePanel } from './useResizablePanel';
import { ResizeHandle } from './ResizeHandle';
import { useTranslation } from '@/core/i18n';

// ─── Context ────────────────────────────────────────────────────

interface ExtensionDebugState {
    enabled: boolean;
    /** Whether the right-side panel is visible (wide mode) */
    sidePanelOpen: boolean;
}

const ExtensionDebugContext = createContext<ExtensionDebugState>({
    enabled: false,
    sidePanelOpen: false,
});

export function useExtensionDebug() {
    return useContext(ExtensionDebugContext);
}

// ─── Responsive width hook ──────────────────────────────────────

function useIsWide(breakpoint = 480) {
    const [isWide, setIsWide] = useState(window.innerWidth > breakpoint);

    useEffect(() => {
        const mq = window.matchMedia(`(min-width: ${breakpoint + 1}px)`);
        const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
        mq.addEventListener('change', handler);
        setIsWide(mq.matches);
        return () => mq.removeEventListener('change', handler);
    }, [breakpoint]);

    return isWide;
}

// ─── Provider ───────────────────────────────────────────────────

const DEBUG_STORAGE_KEY = 'surdej-extension-debug';

export function ExtensionDebugProvider({ children }: { children: ReactNode }) {
    const params = new URLSearchParams(window.location.search);
    const urlDebug = params.get('debug');
    // Persist debug flag to sessionStorage so it survives navigations that drop the query param
    if (urlDebug === 'true') sessionStorage.setItem(DEBUG_STORAGE_KEY, 'true');
    else if (urlDebug === 'false') sessionStorage.removeItem(DEBUG_STORAGE_KEY);
    const enabled = urlDebug === 'true' || (urlDebug === null && sessionStorage.getItem(DEBUG_STORAGE_KEY) === 'true');
    const isWide = useIsWide(480);
    const [sidePanelOpen, setSidePanelOpen] = useState(true);
    const { t } = useTranslation();
    const { width: debugWidth, onMouseDown: debugResizeHandle } = useResizablePanel({
        storageKey: 'ext-debug-width', defaultWidth: 260, minWidth: 180, maxWidth: 450, side: 'right',
    });

    if (!enabled) {
        return (
            <ExtensionDebugContext.Provider value={{ enabled: false, sidePanelOpen: false }}>
                {children}
            </ExtensionDebugContext.Provider>
        );
    }

    return (
        <ExtensionDebugContext.Provider value={{ enabled, sidePanelOpen: isWide && sidePanelOpen }}>
            <div className="flex h-screen">
                {/* Main content */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    {/* Content area */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {children}
                    </div>

                    {/* Narrow mode debug footer — inline at bottom (not fixed) to avoid covering portal content */}
                    {!isWide && <DebugFooter />}
                </div>

                {/* Right panel (wide mode) */}
                {isWide && sidePanelOpen && (
                    <>
                        <ResizeHandle side="right" onMouseDown={debugResizeHandle} />
                        <DebugSidePanel width={debugWidth} onClose={() => setSidePanelOpen(false)} />
                    </>
                )}
            </div>

            {/* Toggle button for side panel (wide mode, when closed) */}
            {isWide && !sidePanelOpen && (
                <button
                    onClick={() => setSidePanelOpen(true)}
                    className="fixed top-2 right-2 z-50 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-colors"
                    title={t('debug.openPanel')}
                >
                    <PanelRightOpen className="h-3.5 w-3.5" />
                </button>
            )}
        </ExtensionDebugContext.Provider>
    );
}

// ─── Shared debug tools hook ────────────────────────────────────

function useDebugTools() {
    const bridgeHook = useBridge();
    const [activeTab, setActiveTab] = useState<string>('connection');
    const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
    const [formFields, setFormFields] = useState<FormFieldsResult | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectorQuery, setSelectorQuery] = useState('');
    const [selectorResult, setSelectorResult] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const fetchSnapshot = useCallback(async () => {
        setLoading(true);
        const s = await bridgeHook.fetchSnapshot();
        setSnapshot(s);
        setLoading(false);
        setActiveTab('snapshot');
    }, [bridgeHook]);

    const fetchFormFields = useCallback(async () => {
        setLoading(true);
        setFormError(null);
        try {
            const result = await bridge.getFormFields();
            setFormFields(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Surdej Debug] Form fields fetch failed:', msg);
            setFormFields(null);
            setFormError(msg);
        }
        setLoading(false);
        setActiveTab('forms');
    }, []);

    const runSelector = useCallback(async () => {
        if (!selectorQuery.trim()) return;
        setLoading(true);
        try {
            const res = await bridgeHook.querySelector(selectorQuery.trim());
            setSelectorResult(JSON.stringify(res, null, 2));
        } catch (err) {
            setSelectorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        setLoading(false);
    }, [bridgeHook, selectorQuery]);

    const testPing = useCallback(async () => {
        setLoading(true);
        const ok = await bridgeHook.checkConnection();
        setLoading(false);
        if (ok) await bridgeHook.fetchPageInfo();
    }, [bridgeHook]);

    const copyToClipboard = useCallback(async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, []);

    return {
        bridge: bridgeHook, activeTab, setActiveTab, snapshot, formFields, formError, loading, selectorQuery,
        setSelectorQuery, selectorResult, copied,
        fetchSnapshot, fetchFormFields, runSelector, testPing, copyToClipboard,
    };
}

// ─── Right-side Debug Panel (wide mode, ≥480px) ─────────────────

function DebugSidePanel({ onClose, width }: { onClose: () => void; width: number }) {
    const tools = useDebugTools();
    const { bridge, activeTab, setActiveTab, loading } = tools;
    const { t } = useTranslation();

    const tabs = [
        { id: 'connection', icon: bridge.connected ? Plug : Unplug, label: t('debug.tabBridge') },
        { id: 'page-info', icon: Globe, label: t('debug.tabPage') },
        { id: 'snapshot', icon: Eye, label: t('debug.tabSnapshot') },
        { id: 'forms', icon: FileInput, label: t('debug.tabForms') },
        { id: 'selector', icon: Terminal, label: t('debug.tabQuery') },
        { id: 'workflow', icon: Activity, label: 'Workflow' },
        { id: 'support', icon: Video, label: t('debug.tabSupport') },
    ];

    return (
        <div style={{ width }} className="border-l border-border/60 bg-muted/5 flex flex-col shrink-0 h-full">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                <Bug className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold text-amber-500 flex-1">DEBUG</span>
                <button
                    onClick={onClose}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                    title={t('debug.closePanel')}
                >
                    <PanelRightClose className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 px-1 overflow-x-auto"
                style={{ scrollbarWidth: 'none' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id === 'snapshot') tools.fetchSnapshot();
                            if (tab.id === 'page-info') bridge.fetchPageInfo();
                            if (tab.id === 'connection') tools.testPing();
                            if (tab.id === 'forms') tools.fetchFormFields();
                        }}
                        className={cn(
                            'flex items-center gap-1 px-2 py-1.5 text-[10px] whitespace-nowrap border-b-2 transition-colors',
                            activeTab === tab.id
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <tab.icon className="h-3 w-3" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto px-3 py-3 text-xs">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && <TabContent tools={tools} />}
            </div>

            {/* Connection status bar */}
            <div className="px-3 py-1.5 border-t border-border/40 text-[9px] text-muted-foreground flex items-center gap-1.5">
                <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    bridge.connected ? 'bg-emerald-500' : 'bg-red-500',
                )} />
                {bridge.connected ? t('debug.bridgeConnected') : t('debug.noBridge')}
                {bridge.pageInfo && (
                    <span className="truncate ml-1">• {bridge.pageInfo.hostname}</span>
                )}
            </div>
        </div>
    );
}

// ─── Shared tab content renderer ────────────────────────────────

function TabContent({ tools }: { tools: ReturnType<typeof useDebugTools> }) {
    const { bridge, activeTab, snapshot, formFields, formError, selectorQuery, setSelectorQuery, selectorResult, copied, runSelector, copyToClipboard, fetchFormFields } = tools;
    const { t } = useTranslation();

    if (activeTab === 'connection') {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        'w-3 h-3 rounded-full',
                        bridge.connected ? 'bg-emerald-500' : 'bg-red-500',
                    )} />
                    <span className="font-medium">
                        {bridge.connected ? t('debug.connected') : t('debug.disconnected')}
                    </span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                    {bridge.connected
                        ? t('debug.connectedDesc')
                        : t('debug.disconnectedDesc')}
                </p>
                <button
                    onClick={tools.testPing}
                    className="w-full px-3 py-1.5 bg-primary/10 text-primary rounded text-[11px] hover:bg-primary/20 transition-colors"
                >
                    <RefreshCw className="h-3 w-3 inline mr-1.5" />
                    {t('debug.retryConnection')}
                </button>
            </div>
        );
    }

    if (activeTab === 'page-info' && bridge.pageInfo) {
        const info = bridge.pageInfo;
        return (
            <div className="space-y-3">
                {/* Favicon + Title header */}
                <div className="flex items-start gap-2">
                    {info.favicon && (
                        <img
                            src={info.favicon}
                            alt=""
                            className="h-6 w-6 shrink-0 mt-0.5 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    )}
                    <div className="min-w-0">
                        <div className="font-medium text-[12px] break-words">{info.title}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">{info.hostname}{info.pathname}</div>
                    </div>
                </div>

                {/* Basic info */}
                <InfoRow label="URL" value={info.url} />
                <InfoRow label="Description" value={info.description || '—'} />
                <InfoRow label="Lang" value={info.lang || '—'} />

                {/* Open Graph section */}
                {info.og && Object.keys(info.og).length > 0 && (
                    <div className="border rounded p-2 space-y-2 bg-muted/10">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Open Graph</div>

                        {info.og.image && (
                            <img
                                src={info.og.image}
                                alt={info.og.title || 'OG Image'}
                                className="w-full rounded object-cover max-h-[120px]"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        )}

                        {info.og.title && <InfoRow label="og:title" value={info.og.title} />}
                        {info.og.description && <InfoRow label="og:description" value={info.og.description} />}
                        {info.og.type && <InfoRow label="og:type" value={info.og.type} />}
                        {info.og.siteName && <InfoRow label="og:site_name" value={info.og.siteName} />}
                        {info.og.url && <InfoRow label="og:url" value={info.og.url} />}
                        {info.og.image && <InfoRow label="og:image" value={info.og.image} />}
                    </div>
                )}

                <button
                    onClick={() => copyToClipboard(JSON.stringify(bridge.pageInfo, null, 2))}
                    className="w-full px-3 py-1.5 bg-muted/40 rounded text-[11px] hover:bg-muted/60 transition-colors flex items-center justify-center gap-1.5"
                >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? t('debug.copied') : t('debug.copyJson')}
                </button>
            </div>
        );
    }

    if (activeTab === 'snapshot' && snapshot) {
        return (
            <div className="space-y-2">
                <InfoRow label="URL" value={snapshot.url} />
                <InfoRow label="Title" value={snapshot.title} />
                <InfoRow label="Links" value={String(snapshot.linkCount)} />
                <InfoRow label="Images" value={String(snapshot.imageCount)} />
                <InfoRow label="Inputs" value={String(snapshot.inputCount)} />

                {snapshot.headings.length > 0 && (
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Headings</div>
                        <div className="space-y-0.5">
                            {snapshot.headings.slice(0, 8).map((h, i) => (
                                <div key={i} className="text-[11px] font-mono">{h}</div>
                            ))}
                        </div>
                    </div>
                )}

                {snapshot.textContent && (
                    <details className="mt-2">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer">
                            {t('debug.textContent', { chars: String(snapshot.textContent.length) })}
                        </summary>
                        <pre className="mt-1 p-2 bg-muted/30 rounded text-[10px] max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                            {snapshot.textContent.slice(0, 3000)}
                        </pre>
                    </details>
                )}

                <button
                    onClick={() => copyToClipboard(JSON.stringify(snapshot, null, 2))}
                    className="w-full px-3 py-1.5 bg-muted/40 rounded text-[11px] hover:bg-muted/60 transition-colors flex items-center justify-center gap-1.5"
                >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? t('debug.copied') : t('debug.copyJson')}
                </button>
            </div>
        );
    }

    if (activeTab === 'selector') {
        return (
            <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">CSS Selector</div>
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        value={selectorQuery}
                        onChange={(e) => setSelectorQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runSelector()}
                        placeholder="h1, .class, #id"
                        className="flex-1 px-2 py-1.5 bg-muted/30 border border-border rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
                    />
                    <button
                        onClick={runSelector}
                        disabled={!selectorQuery.trim()}
                        className="px-2.5 py-1.5 bg-primary text-primary-foreground rounded text-[11px] disabled:opacity-50 shrink-0"
                    >
                        {t('debug.run')}
                    </button>
                </div>
                {selectorResult && (
                    <pre className="p-2 bg-muted/30 rounded text-[10px] font-mono max-h-48 overflow-auto whitespace-pre-wrap">
                        {selectorResult}
                    </pre>
                )}
                <div className="text-[10px] text-muted-foreground mt-1">
                    {t('debug.tryExamples')} <code className="px-1 bg-muted/40 rounded">h1</code>{' '}
                    <code className="px-1 bg-muted/40 rounded">a[href]</code>{' '}
                    <code className="px-1 bg-muted/40 rounded">img</code>
                </div>
            </div>
        );
    }

    if (activeTab === 'forms') {
        if (!formFields) {
            return (
                <div className="text-center py-4 space-y-2">
                    {formError ? (
                        <>
                            <p className="text-red-400 text-[11px]">⚠ {formError}</p>
                            <p className="text-muted-foreground text-[10px]">
                                {t('debug.ensureLoaded')}
                            </p>
                            <button
                                onClick={() => fetchFormFields()}
                                className="px-3 py-1 rounded text-[10px] bg-muted hover:bg-muted/80 transition-colors"
                            >
                                {t('debug.tryAgain')}
                            </button>
                        </>
                    ) : (
                        <p className="text-muted-foreground text-[11px]">{t('debug.scanningFields')}</p>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span><strong className="text-foreground">{formFields.fields.length}</strong> fields</span>
                    <span><strong className="text-foreground">{formFields.formCount}</strong> forms</span>
                    <span>
                        <strong className="text-foreground">{formFields.iframeCount}</strong> iframes
                        ({formFields.iframesAccessible} accessible)
                    </span>
                </div>

                {formFields.fields.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-[11px]">{t('debug.noFormFields')}</p>
                ) : (
                    <div className="space-y-2">
                        {formFields.fields.map((field, i) => (
                            <div key={i} className="group border rounded p-2 space-y-1 bg-muted/10 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                        'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase',
                                        field.tagName === 'SELECT' ? 'bg-purple-500/20 text-purple-400' :
                                            field.tagName === 'TEXTAREA' ? 'bg-blue-500/20 text-blue-400' :
                                                field.type === 'checkbox' || field.type === 'radio' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-emerald-500/20 text-emerald-400'
                                    )}>
                                        {field.type}
                                    </span>
                                    {field.required && (
                                        <span className="text-red-400 text-[9px] font-bold">required</span>
                                    )}
                                    {field.disabled && (
                                        <span className="text-muted-foreground text-[9px]">disabled</span>
                                    )}
                                    {field.source !== 'page' && (
                                        <span className="text-[8px] bg-sky-500/20 text-sky-400 px-1 rounded truncate max-w-[120px]" title={field.source}>
                                            {field.source}
                                        </span>
                                    )}
                                </div>

                                {field.label && (
                                    <div className="text-[11px] font-medium">{field.label}</div>
                                )}

                                <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-0.5 text-[10px]">
                                    {field.name && (
                                        <>
                                            <span className="text-muted-foreground">name</span>
                                            <span className="font-mono truncate" title={field.name}>{field.name}</span>
                                            <button onClick={() => copyToClipboard(field.name)} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity" title="Copy name"><Copy className="h-2.5 w-2.5" /></button>
                                        </>
                                    )}
                                    {field.id && (
                                        <>
                                            <span className="text-muted-foreground">id</span>
                                            <span className="font-mono truncate" title={field.id}>{field.id}</span>
                                        </>
                                    )}
                                    {field.value && (
                                        <>
                                            <span className="text-muted-foreground">value</span>
                                            <span className="font-mono truncate" title={field.value}>{field.value}</span>
                                            <button onClick={() => copyToClipboard(field.value)} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity" title="Copy value"><Copy className="h-2.5 w-2.5" /></button>
                                        </>
                                    )}
                                    {field.placeholder && (
                                        <>
                                            <span className="text-muted-foreground">hint</span>
                                            <span className="text-muted-foreground/70 truncate">{field.placeholder}</span>
                                        </>
                                    )}
                                    <>
                                        <span className="text-muted-foreground">selector</span>
                                        <span className="font-mono text-[9px] truncate" title={field.selector}>{field.selector}</span>
                                        <button onClick={() => copyToClipboard(field.selector)} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity" title="Copy selector"><Copy className="h-2.5 w-2.5" /></button>
                                    </>
                                </div>

                                {field.options && field.options.length > 0 && (
                                    <details className="mt-1">
                                        <summary className="text-[9px] text-muted-foreground cursor-pointer">
                                            {field.options.length} options
                                        </summary>
                                        <div className="mt-1 max-h-24 overflow-y-auto text-[9px] font-mono space-y-0.5">
                                            {field.options.map((opt, j) => (
                                                <div key={j} className={cn('px-1 rounded', opt.selected && 'bg-primary/10 text-primary')}>
                                                    {opt.selected ? '● ' : '○ '}{opt.text}
                                                    {opt.value !== opt.text && <span className="text-muted-foreground ml-1">({opt.value})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => copyToClipboard(JSON.stringify(formFields, null, 2))}
                    className="w-full px-3 py-1.5 bg-muted/40 rounded text-[11px] hover:bg-muted/60 transition-colors flex items-center justify-center gap-1.5"
                >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? t('debug.copied') : t('debug.copyJson')}
                </button>
            </div>
        );
    }

    if (activeTab === 'support') {
        const wherebyUrl = 'https://whereby.com/your-room';
        return (
            <div
                className="flex flex-col items-center justify-center h-full -mx-3 -mt-1 relative overflow-hidden rounded-b-lg"
                style={{
                    backgroundImage: 'url(/happy-mates-team-1k.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    minHeight: 280,
                }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
                <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                    <Video className="h-10 w-10 text-emerald-400 drop-shadow-lg" />
                    <div>
                        <h3 className="text-base font-semibold text-white drop-shadow">
                            {t('debug.liveSupport')}
                        </h3>
                        <p className="text-xs text-white/70 mt-1 max-w-[220px]">
                            {t('debug.liveSupportDesc')}
                        </p>
                    </div>
                    <button
                        onClick={() => window.open(wherebyUrl, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105"
                    >
                        <Video className="h-4 w-4" />
                        {t('debug.startSupport')}
                    </button>
                    <p className="text-[9px] text-white/40">
                        {t('debug.opensWherebyTab')}
                    </p>
                </div>
            </div>
        );
    }

    if (activeTab === 'workflow') {
        return <WorkflowDebugTab />;
    }

    return (
        <p className="text-muted-foreground text-center py-4 text-[11px]">
            {t('debug.selectTab')}
        </p>
    );
}

function WorkflowDebugTab() {
    const { activeWorkflowSessionId } = useExtensionSessionStore();
    const [session, setSession] = useState<WorkflowSession | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeWorkflowSessionId) return;
        setLoading(true);
        getSession(activeWorkflowSessionId)
            .then(s => setSession(s))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [activeWorkflowSessionId]);

    if (!activeWorkflowSessionId) {
        return (
            <div className="text-center py-4 space-y-2">
                <Activity className="h-6 w-6 text-muted-foreground mx-auto opacity-50" />
                <p className="text-muted-foreground text-[11px]">No active workflow session.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="font-semibold text-xs truncate">Current Workflow Session</span>
                {session?.status === 'active' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
            </div>

            {loading && !session ? (
                <div className="flex justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            ) : session ? (
                <>
                    <InfoRow label="Session ID" value={session.id} />
                    <InfoRow label="Steps" value={`${session.currentStepIdx + 1} of ${session.tasks.length}`} />
                    <InfoRow label="Status" value={session.status} />

                    <div className="space-y-1 mt-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected Data Count</div>
                        <div className="font-mono text-[11px] bg-muted/40 px-2 py-1.5 rounded">
                            {Object.keys(session.formData).length} fields
                        </div>
                    </div>

                    <button
                        onClick={() => window.open(`${window.location.origin}/modules/workflow/debug/${activeWorkflowSessionId}`, '_blank', 'noopener')}
                        className="w-full mt-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded text-[11px] hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1.5 font-medium"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Open Debug Details
                    </button>
                </>
            ) : (
                <p className="text-red-400 text-[10px]">Failed to load session details.</p>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="font-mono text-[11px] break-all mt-0.5">{value}</div>
        </div>
    );
}

// ─── Footer toolbar (narrow mode, ≤480px) ───────────────────────

function DebugFooter() {
    const tools = useDebugTools();
    const { bridge, activeTab, setActiveTab, loading } = tools;
    const [expanded, setExpanded] = useState(false);

    const controls = [
        {
            id: 'connection',
            icon: bridge.connected ? Plug : Unplug,
            label: bridge.connected ? 'OK' : 'Off',
            color: bridge.connected ? 'text-emerald-400' : 'text-red-400',
            onClick: () => { tools.testPing(); setActiveTab('connection'); },
        },
        {
            id: 'page-info',
            icon: Globe,
            label: 'Page',
            onClick: () => { bridge.fetchPageInfo(); setActiveTab('page-info'); setExpanded(true); },
        },
        {
            id: 'snapshot',
            icon: Eye,
            label: 'Snap',
            onClick: () => { tools.fetchSnapshot(); setExpanded(true); },
        },
        {
            id: 'forms',
            icon: FileInput,
            label: 'Forms',
            onClick: () => { tools.fetchFormFields(); setExpanded(true); },
        },
        {
            id: 'selector',
            icon: Terminal,
            label: 'Query',
            onClick: () => { setActiveTab('selector'); setExpanded(true); },
        },
        {
            id: 'workflow',
            icon: Activity,
            label: 'Workflow',
            onClick: () => { setActiveTab('workflow'); setExpanded(true); },
        },
    ];

    return (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-sm shrink-0">
            {/* Expanded content */}
            {expanded && (
                <div className="max-h-[40vh] overflow-auto border-b border-border/40 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                            {activeTab}
                        </span>
                        <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <TabContent tools={tools} />
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center px-2 py-1.5 gap-1">
                <Bug className="h-3 w-3 text-amber-500 shrink-0" />
                <div className="w-px h-4 bg-border/60 mx-0.5 shrink-0" />
                <div className="flex items-center gap-0.5 flex-1 overflow-x-auto min-w-0"
                    style={{ scrollbarWidth: 'none' }}>
                    {controls.map((ctrl) => (
                        <button
                            key={ctrl.id}
                            onClick={ctrl.onClick}
                            className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] whitespace-nowrap transition-all shrink-0',
                                activeTab === ctrl.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                                ctrl.color,
                            )}
                        >
                            {loading && activeTab === ctrl.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <ctrl.icon className="h-3 w-3" />
                            )}
                            {ctrl.label}
                        </button>
                    ))}
                </div>
                <button onClick={tools.testPing} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                    <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                </button>
            </div>
        </div>
    );
}
