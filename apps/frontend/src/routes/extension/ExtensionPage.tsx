/**
 * Extension Page
 *
 * Minimal, layout-free page designed to be embedded in the browser
 * extension's side panel iframe. Provides:
 *
 * 1. A compact AI chat interface with markdown rendering
 * 2. Chat history panel (side panel >480px, burger menu on narrow)
 * 3. Bridge connection indicator + host page context
 * 4. Tool/reasoning step display (same as /chat)
 *
 * Route: /extension
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, BASE_URL } from '@/lib/api';
import { useAuth } from '@/core/auth/AuthContext';
import { useBridge } from '@/core/extension/useBridge';
import { ExtensionDebugProvider, useExtensionDebug } from '@/core/extension/ExtensionDebugContext';
import { useResizablePanel } from '@/core/extension/useResizablePanel';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
    Send,
    Bot,
    User,
    Loader2,
    ExternalLink,
    MessageSquare,
    Plus,
    Globe,
    Unplug,
    Plug,
    Menu,
    X,
    Trash2,
    Clock,
    PanelLeftClose,
    PanelLeftOpen,
    Copy,
    Check,
    Wrench,
    BookOpen,
    Database,
    Layers,
    FileSearch,
    Building2,
    Sparkles,
    FileText,
    ChevronDown,
    Image,
    Building,
    ChevronsUpDown,
    LogOut,
    Settings,
    AlertTriangle,
    Puzzle,
    ArrowRight,
    ArrowLeft,
    Activity,
    LayoutList,
} from 'lucide-react';
import { BUILT_IN_USE_CASES, type UseCase } from '@surdej/module-tool-management-tools-shared';
import { fetchActiveUseCases, getSession, type ActiveUseCase } from '@/routes/modules/tool-management-tools/use-case-api';
import { useExtensionSessionStore } from '@/core/extension/extensionSessionStore';
import { useTenant } from '@/core/tenants/TenantContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, enhanceMarkdown } from '@/lib/utils';
import { ResizeHandle } from '@/core/extension/ResizeHandle';
import { useBridgeConsent } from '@/core/extension/useBridgeConsent';
import { ConsentPrompt, ConsentStatusIcon } from './ConsentPrompt';
import type { FormFieldsResult } from '@/core/extension/bridge';
import ToolDirectory from './ToolDirectory';
import { IframeToolHost } from '@/core/iframe-tools';
import type { IframeToolDef } from '@/core/iframe-tools';
import { SessionRunner } from './components/SessionRunner';
import { WorkflowSimulator, type SimulationData } from '@/routes/modules/tool-management-tools/WorkflowSimulator';
import { useTranslation } from '@/core/i18n';
import { UseCasesDialog } from '@/routes/layout/Header';
import { FeedbackToolbar } from '@/core/feedback/FeedbackToolbar';
import { useFeedbackStore, type FeedbackChatMessage } from '@/core/feedback/feedbackStore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ──────────────────────────────────────────────────────

interface ReasoningStep {
    id: string;
    type: 'tool_call' | 'tool_result' | 'thinking';
    toolName: string;
    args?: Record<string, any>;
    summary?: string;
    timestamp: number;
}

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
    reasoningSteps?: ReasoningStep[];
}

interface Conversation {
    id: string;
    title: string | null;
    model: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

// ─── Responsive hook ────────────────────────────────────────────

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

// ─── Auth helper ────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = api.getTenantId();
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    return headers;
}
// ─── Context detection ──────────────────────────────────────────

interface ContextTool {
    id: string;
    icon: typeof Globe;
    label: string;
    description: string;
    /** Prompt to inject into the chat when activated */
    prompt?: string;
}

function getContextTools(
    hostname: string | undefined,
    connected: boolean,
    t: (key: string) => string,
    formFields?: FormFieldsResult | null,
): ContextTool[] {
    const tools: ContextTool[] = [];

    // SharePoint Word tool — only when on *.sharepoint.com with docx + access_token
    if (hostname && hostname.endsWith('sharepoint.com') && formFields) {
        const hasAccessToken = formFields.fields.some((f) => f.name === 'access_token');
        const hasDocx = formFields.fields.some((f) => f.name === 'fileextension' && f.value === 'docx');
        if (hasAccessToken && hasDocx) {
            const filename = formFields.fields.find((f) => f.name === 'filename')?.value ?? 'dokument';
            tools.push({
                id: 'sharepoint-word',
                icon: FileText,
                label: t('extension.toolWord'),
                description: `${t('extension.toolWordDesc')}: ${filename}`,
                prompt: `Analysér indholdet af Word-dokumentet "${filename}" fra SharePoint. Opsummér dokumentets indhold, hovedpunkter og eventuelle handlinger.`,
            });
        }
    }

    return tools;
}

// ─── Tool helpers (shared with ChatPage) ────────────────────────

function getToolIcon(toolName: string) {
    switch (toolName) {
        case 'search_web':
            return <Globe className="h-3 w-3" />;
        case 'rag_search':
            return <BookOpen className="h-3 w-3" />;
        case 'search_properties':
            return <Database className="h-3 w-3" />;
        default:
            return <Wrench className="h-3 w-3" />;
    }
}

function getToolLabel(step: ReasoningStep): string {
    if (step.type === 'tool_result' && step.summary) return step.summary;
    switch (step.toolName) {
        case 'search_web':
            return step.type === 'tool_call'
                ? `Searching "${step.args?.query ?? ''}"`
                : 'Web search done';
        case 'rag_search':
            return step.type === 'tool_call'
                ? `Searching docs "${step.args?.query ?? ''}"`
                : 'Doc search done';
        default:
            return step.type === 'tool_call' ? `Running ${step.toolName}…` : `${step.toolName} done`;
    }
}

// ─── Word Preview Panel ─────────────────────────────────────────

interface WordDocInfo {
    filename: string;
    filesize?: string;
    accessToken: string;
    fileGetUrl?: string;
    fileUrlNoAuth?: string;
    docId?: string;
    etag?: string;
    hostname: string;
}

function WordPreviewPanel({ docInfo }: { docInfo: WordDocInfo }) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        const errors: string[] = [];
        try {
            const { fetchImage } = await import('@/core/extension/bridge');

            // Extract item GUID from etag (format: "{8E924659-CB53-4B69-...}")
            const itemGuid = docInfo.etag?.match(/\{([^}]+)\}/)?.[1];

            // Strategy 1: getpreview.ashx with server-relative URL (most reliable)
            if (docInfo.fileUrlNoAuth) {
                try {
                    // Extract the server-relative path from the full URL
                    const url = new URL(docInfo.fileUrlNoAuth);
                    const previewUrl = `https://${docInfo.hostname}/_layouts/15/getpreview.ashx?path=${encodeURIComponent(url.pathname)}&resolution=2`;
                    const result = await fetchImage(previewUrl);
                    setPreviewUrl(result.dataUrl);
                    setLoading(false);
                    return;
                } catch (e) {
                    errors.push(`getpreview: ${e instanceof Error ? e.message : e}`);
                }
            }

            // Strategy 2: Graph API via SharePoint _api/v2.0 with etag GUID
            if (itemGuid) {
                try {
                    const spGraphUrl = `https://${docInfo.hostname}/_api/v2.0/me/drive/items/${itemGuid}/thumbnails/0/large/content`;
                    const result = await fetchImage(spGraphUrl);
                    setPreviewUrl(result.dataUrl);
                    setLoading(false);
                    return;
                } catch (e) {
                    errors.push(`graph-etag: ${e instanceof Error ? e.message : e}`);
                }
            }

            // Strategy 3: Graph API with docId (different format)
            if (docInfo.docId) {
                try {
                    const spGraphUrl = `https://${docInfo.hostname}/_api/v2.0/me/drive/items/${docInfo.docId}/thumbnails/0/large/content`;
                    const result = await fetchImage(spGraphUrl);
                    setPreviewUrl(result.dataUrl);
                    setLoading(false);
                    return;
                } catch (e) {
                    errors.push(`graph-docid: ${e instanceof Error ? e.message : e}`);
                }
            }

            console.warn('[Surdej] All preview strategies failed:', errors);
            setError(`Preview ikke tilgængelig (${errors.length} forsøg fejlet)`);
        } catch (err) {
            console.warn('[Surdej] Word preview failed:', err);
            setError(err instanceof Error ? err.message : 'Preview not available');
        }
        setLoading(false);
    }, [docInfo]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    return (
        <div className="p-3 space-y-3">
            {/* Doc info */}
            <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{docInfo.filename}</div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        {docInfo.filesize && <span>{(parseInt(docInfo.filesize) / 1024).toFixed(0)} KB</span>}
                        {docInfo.docId && (
                            <span className="font-mono truncate max-w-[120px]" title={docInfo.docId}>
                                {docInfo.docId.slice(0, 16)}…
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview area */}
            <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden min-h-[120px] flex items-center justify-center">
                {loading ? (
                    <div className="flex flex-col items-center gap-2 py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        <span className="text-[10px] text-muted-foreground">Henter forhåndsvisning…</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center px-4">
                        <Image className="h-5 w-5 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground">{error}</span>
                        <button onClick={loadPreview} className="text-[9px] text-blue-500 hover:underline">
                            Prøv igen
                        </button>
                    </div>
                ) : previewUrl ? (
                    <img src={previewUrl} alt={`Preview: ${docInfo.filename}`} className="w-full h-auto" />
                ) : null}
            </div>

            {/* Access token (truncated, copyable) */}
            <details className="text-[9px]">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Access token & metadata
                </summary>
                <div className="mt-1.5 space-y-1.5 font-mono text-[8px] break-all bg-muted/20 rounded p-2">
                    <div className="flex items-start gap-1">
                        <div className="flex-1">
                            <span className="text-muted-foreground">token: </span>
                            <span className="select-all">{docInfo.accessToken.slice(0, 60)}…</span>
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(docInfo.accessToken)}
                            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy full token"
                        >
                            <Copy className="h-2.5 w-2.5" />
                        </button>
                    </div>
                    {docInfo.fileGetUrl && (
                        <div className="flex items-start gap-1">
                            <div className="flex-1">
                                <span className="text-muted-foreground">url: </span>
                                <span className="select-all">{docInfo.fileGetUrl}</span>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(docInfo.fileGetUrl!)}
                                className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy URL"
                            >
                                <Copy className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    )}
                </div>
            </details>
        </div>
    );
}

// ─── Component ──────────────────────────────────────────────────

export function ExtensionPage() {
    return (
        <ExtensionDebugProvider>
            <ExtensionPageInner />
        </ExtensionDebugProvider>
    );
}

function ExtensionPageInner() {
    const { user, logout } = useAuth();
    const { activeTenant } = useTenant();
    const navigate = useNavigate();
    const location = useLocation();
    const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
    const bridge = useBridge();
    const { enabled: debugEnabled } = useExtensionDebug();
    const i18n = useTranslation();
    const activeSession = useFeedbackStore((s) => s.activeSession);
    const startSessionFromChat = useFeedbackStore((s) => s.startSessionFromChat);
    const completeSession = useFeedbackStore((s) => s.completeSession);
    const [showFeedbackConfirm, setShowFeedbackConfirm] = useState(false);
    const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
    const [useCasesDialogOpen, setUseCasesDialogOpen] = useState(false);
    const [toolDirectoryOpen, setToolDirectoryOpen] = useState(false);
    const [activeIframeTool, setActiveIframeTool] = useState<IframeToolDef | null>(null);
    const isWide = useIsWide(480);

    const [activeUseCase, setActiveUseCase] = useState<UseCase | null>(null);
    const [activeUseCaseTasks, setActiveUseCaseTasks] = useState<ActiveUseCase['tasks']>(undefined);
    const [simulateMode, setSimulateMode] = useState(false);
    const [simulationData, setSimulationData] = useState<SimulationData>({});
    const activeWorkflowSessionId = useExtensionSessionStore((s) => s.activeWorkflowSessionId);
    const setActiveWorkflowSessionId = useExtensionSessionStore((s) => s.setActiveWorkflowSessionId);
    const setWorkflowInStore = useExtensionSessionStore((s) => s.setActiveWorkflow);
    const activeUseCaseLabelStore = useExtensionSessionStore((s) => s.activeUseCaseLabel);
    const [availableUseCases, setAvailableUseCases] = useState<ActiveUseCase[]>([]);

    useEffect(() => {
        if (activeWorkflowSessionId && activeUseCase) {
            setWorkflowInStore(activeUseCase.id, activeUseCase.label);
        }
    }, [activeWorkflowSessionId, activeUseCase, setWorkflowInStore]);

    // Sync URL to reflect current workflow session
    useEffect(() => {
        if (activeWorkflowSessionId) {
            const targetPath = `/extension/workflow/${activeWorkflowSessionId}`;
            if (!location.pathname.endsWith(activeWorkflowSessionId)) {
                navigate(targetPath, { replace: true });
            }
        } else if (location.pathname.startsWith('/extension/workflow/')) {
            navigate('/extension', { replace: true });
        }
    }, [activeWorkflowSessionId, navigate, location.pathname]);

    // Fetch active use cases from API on mount
    useEffect(() => {
        fetchActiveUseCases().then((items) => {
            if (items.length > 0) {
                setAvailableUseCases(items);
            }
        });
    }, []);

    // Restore session from URL param on mount
    useEffect(() => {
        if (urlSessionId && !activeWorkflowSessionId) {
            setActiveWorkflowSessionId(urlSessionId);
        }
    }, [urlSessionId]);

    // Resolve ?useCase= parameter from URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const useCaseId = params.get('useCase');
        if (useCaseId) {
            // Try API-fetched use cases first
            const fromApi = availableUseCases.find(
                (uc) => uc.id === useCaseId || uc.slug === useCaseId,
            );
            if (fromApi) {
                setActiveUseCase({
                    id: fromApi.id,
                    label: fromApi.label,
                    description: fromApi.description,
                    icon: fromApi.icon,
                    promptTemplate: fromApi.promptTemplate,
                    tools: fromApi.tools,
                    workflowMode: fromApi.workflowMode ?? false,
                });
                setActiveUseCaseTasks(fromApi.tasks);
                return;
            }
            // Fallback to built-in constants
            const fromBuiltIn = BUILT_IN_USE_CASES.find((uc) => uc.id === useCaseId);
            if (fromBuiltIn) {
                setActiveUseCase(fromBuiltIn);
                return;
            }
            // Not found locally — re-fetch from API (may have been provisioned after initial load)
            fetchActiveUseCases().then((items) => {
                if (items.length > 0) setAvailableUseCases(items);
                const freshMatch = items.find((uc) => uc.id === useCaseId || uc.slug === useCaseId);
                if (freshMatch) {
                    setActiveUseCase({
                        id: freshMatch.id,
                        label: freshMatch.label,
                        description: freshMatch.description,
                        icon: freshMatch.icon,
                        promptTemplate: freshMatch.promptTemplate,
                        tools: freshMatch.tools,
                        workflowMode: freshMatch.workflowMode ?? false,
                    });
                    setActiveUseCaseTasks(freshMatch.tasks);
                }
            });
        }
    }, [location.search, availableUseCases]);

    // Helper: resolve a use case slug/id into a UseCase object
    const resolveUseCase = useCallback(
        (slug: string): UseCase | null => {
            const fromApi = availableUseCases.find(
                (uc) => uc.id === slug || uc.slug === slug,
            );
            if (fromApi) {
                return {
                    id: fromApi.id,
                    label: fromApi.label,
                    description: fromApi.description,
                    icon: fromApi.icon,
                    promptTemplate: fromApi.promptTemplate,
                    tools: fromApi.tools,
                    workflowMode: fromApi.workflowMode ?? false,
                    _tasks: fromApi.tasks,
                } as UseCase & { _tasks?: ActiveUseCase['tasks'] };
            }
            return BUILT_IN_USE_CASES.find((uc) => uc.id === slug) ?? null;
        },
        [availableUseCases],
    );

    // Restore activeUseCase when we have a session ID but no use case (e.g. direct URL navigation)
    useEffect(() => {
        if (!activeWorkflowSessionId || activeUseCase) return;

        // Try persisted store first
        const storedUseCaseId = useExtensionSessionStore.getState().activeUseCaseId;
        if (storedUseCaseId && availableUseCases.length > 0) {
            const uc = resolveUseCase(storedUseCaseId);
            if (uc) {
                setActiveUseCase(uc);
                setActiveUseCaseTasks((uc as any)._tasks);
                return;
            }
        }

        // Fetch session from API to get its useCaseId
        getSession(activeWorkflowSessionId)
            .then((session) => {
                const uc = resolveUseCase(session.useCaseId);
                if (uc) {
                    setActiveUseCase(uc);
                    setActiveUseCaseTasks((uc as any)._tasks);
                }
            })
            .catch(() => {
                // Session not found or expired — navigate back
                setActiveWorkflowSessionId(null);
                navigate('/extension', { replace: true });
            });
    }, [activeWorkflowSessionId, activeUseCase, availableUseCases, resolveUseCase]);

    // Listen for use case selection from the Chrome extension sidepanel
    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            if (event.data?.type !== 'SURDEJ_SET_USE_CASE') return;
            const slug = event.data.useCase as string;
            if (!slug) return;
            const uc = resolveUseCase(slug);
            if (uc) {
                setActiveUseCase(uc);
                setActiveUseCaseTasks((uc as any)._tasks);
            } else {
                // Not found locally — re-fetch from API (may have been provisioned after initial load)
                fetchActiveUseCases().then((items) => {
                    if (items.length > 0) setAvailableUseCases(items);
                    const freshMatch = items.find((u) => u.id === slug || u.slug === slug);
                    if (freshMatch) {
                        setActiveUseCase({
                            id: freshMatch.id,
                            label: freshMatch.label,
                            description: freshMatch.description,
                            icon: freshMatch.icon,
                            promptTemplate: freshMatch.promptTemplate,
                            tools: freshMatch.tools,
                            workflowMode: freshMatch.workflowMode ?? false,
                        });
                        setActiveUseCaseTasks(freshMatch.tasks);
                    }
                });
            }
        }
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [resolveUseCase]);

    // Extension version check
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [updateDismissed, setUpdateDismissed] = useState(false);

    // Read installed extension version from manifest
    const installedVersion = useMemo(() => {
        try {
            // chrome.runtime.getManifest() is available inside extensions
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cr = (window as any).chrome;
            if (cr?.runtime?.getManifest) {
                return cr.runtime.getManifest().version as string;
            }
        } catch { /* not in extension context */ }
        return null;
    }, []);

    useEffect(() => {
        // Fetch latest bundled version from the frontend's static manifest
        const apiBase = typeof window !== 'undefined' && window.location.origin || '';
        fetch(`${apiBase}/extensions/versions.json`)
            .then(r => r.json())
            .then((data: { latest: string }) => setLatestVersion(data.latest))
            .catch(() => { /* ignore */ });
    }, []);

    const isOutdated = useMemo(() => {
        if (!installedVersion || !latestVersion) return false;
        const pa = installedVersion.split('.').map(Number);
        const pb = latestVersion.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const va = pa[i] ?? 0;
            const vb = pb[i] ?? 0;
            if (va < vb) return true;
            if (va > vb) return false;
        }
        return false;
    }, [installedVersion, latestVersion]);

    // Chat state
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Conversation history state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyCollapsed, setHistoryCollapsed] = useState(true);
    const { width: historyWidth, onMouseDown: historyResizeHandle } = useResizablePanel({
        storageKey: 'ext-history-width',
        defaultWidth: 200,
        minWidth: 140,
        maxWidth: 360,
        side: 'left',
    });
    const [historyLoading, setHistoryLoading] = useState(false);

    // Form fields for context tools (auto-fetch on sharepoint)
    const [formFieldsForTools, setFormFieldsForTools] = useState<FormFieldsResult | null>(null);

    useEffect(() => {
        if (bridge.connected && bridge.pageInfo?.hostname?.endsWith('sharepoint.com')) {
            import('@/core/extension/bridge').then((b) => {
                b.getFormFields()
                    .then(setFormFieldsForTools)
                    .catch(() => setFormFieldsForTools(null));
            });
        } else {
            setFormFieldsForTools(null);
        }
    }, [bridge.connected, bridge.pageInfo?.hostname]);

    // Context-sensitive tools based on the host page
    const contextTools = getContextTools(
        bridge.pageInfo?.hostname,
        bridge.connected,
        i18n.t,
        formFieldsForTools,
    );

    // SharePoint Word document detection
    const wordDocInfo = (() => {
        if (!formFieldsForTools || !bridge.pageInfo?.hostname?.endsWith('sharepoint.com')) return null;
        const fields = formFieldsForTools.fields;
        const accessToken = fields.find((f) => f.name === 'access_token')?.value;
        const fileExt = fields.find((f) => f.name === 'fileextension')?.value;
        if (!accessToken || fileExt !== 'docx') return null;
        const filename = fields.find((f) => f.name === 'filename')?.value ?? 'document.docx';
        const filesize = fields.find((f) => f.name === 'filesize')?.value;
        const fileGetUrl = fields.find((f) => f.name === 'filegeturl')?.value;
        const fileUrlNoAuth = fields.find((f) => f.name === 'fileurlnoauth')?.value;
        const docId = fields.find((f) => f.name === 'docid')?.value;
        const etag = fields.find((f) => f.name === 'etag')?.value; // contains {GUID}
        const hostname = bridge.pageInfo.hostname;
        return { filename, filesize, accessToken, fileGetUrl, fileUrlNoAuth, docId, etag, hostname };
    })();

    const [wordOpen, setWordOpen] = useState(false);


    // Bridge consent
    const consent = useBridgeConsent();

    // Check consent when page info changes
    useEffect(() => {
        if (bridge.pageInfo?.hostname) {
            consent.checkConsent(bridge.pageInfo.hostname);
        }
    }, [bridge.pageInfo?.hostname]); // consent.checkConsent is stable

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Fetch conversations on mount
    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/ai/conversations`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch {
            // non-critical
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadConversation = async (id: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/ai/conversations/${id}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setConversationId(id);
                setMessages(data.messages ?? []);
                setHistoryOpen(false);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const deleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`${BASE_URL}/ai/conversations/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (conversationId === id) {
                setConversationId(null);
                setMessages([]);
            }
        } catch {
            // ignore
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const buildContextPrefix = useCallback(async (): Promise<string> => {
        if (!bridge.connected) return '';
        try {
            const snapshot = await bridge.fetchSnapshot();
            if (!snapshot) return '';
            const lines = [`[Page Context]`, `URL: ${snapshot.url}`, `Title: ${snapshot.title}`];
            if (snapshot.description) lines.push(`Description: ${snapshot.description}`);
            if (snapshot.headings.length > 0)
                lines.push(`Headings: ${snapshot.headings.slice(0, 5).join(', ')}`);
            if (snapshot.selectedText) lines.push(`Selected text: "${snapshot.selectedText}"`);
            if (snapshot.textContent) {
                lines.push(`Page content (excerpt): ${snapshot.textContent.slice(0, 2000)}`);
            }
            return lines.join('\n') + '\n\n';
        } catch {
            return '';
        }
    }, [bridge]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        // Build enriched message with page context
        const contextPrefix = await buildContextPrefix();
        const langHint = `[Language Preference: ${i18n.locale === 'da' ? 'Danish (da)' : 'English (en)'}. Always respond in this language unless the user writes in another language.]\n`;
        // Prepend active use case prompt template if set
        const useCasePrefix = activeUseCase?.promptTemplate ?? '';
        const enrichedContent = `${langHint}${contextPrefix}${useCasePrefix}User message: ${text}`;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        if (inputRef.current) inputRef.current.style.height = 'auto';

        try {
            const res = await fetch(`${BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message: enrichedContent,
                    conversationId,
                    model: 'default',
                    locale: i18n.locale,
                }),
            });

            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(errBody);
            }

            // Parse SSE stream
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            let newConversationId = conversationId;
            const steps: ReasoningStep[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        if (event.type === 'meta') {
                            newConversationId = event.conversationId;
                            setConversationId(newConversationId);
                        } else if (event.type === 'text') {
                            accumulatedText += event.content;
                        } else if (event.type === 'tool_call') {
                            steps.push({
                                id: `tc-${Date.now()}-${event.toolName}`,
                                type: 'tool_call',
                                toolName: event.toolName,
                                args: event.args,
                                timestamp: Date.now(),
                            });
                        } else if (event.type === 'tool_result') {
                            steps.push({
                                id: `tr-${Date.now()}-${event.toolName}`,
                                type: 'tool_result',
                                toolName: event.toolName,
                                summary: event.summary,
                                timestamp: Date.now(),
                            });
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }

            // Add completed assistant message
            setMessages((prev) => [
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: accumulatedText,
                    createdAt: new Date().toISOString(),
                    reasoningSteps: steps.length > 0 ? steps : undefined,
                },
            ]);

            // Refresh conversations list
            loadConversations();
            setTimeout(() => loadConversations(), 5000);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: i18n.t('extension.errorResponse') },
            ]);
            console.error('[Extension] Chat error:', err);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        setConversationId(null);
        setMessages([]);
        setInput('');
        setHistoryOpen(false);
        inputRef.current?.focus();
    };

    const startFeedbackFromChat = async () => {
        if (!conversationId || messages.length === 0) return;

        // If there's already an active session, complete it first then show its result
        if (activeSession) {
            const sessionId = await completeSession();
            setFeedbackSessionId(sessionId);
            setShowFeedbackConfirm(true);
            return;
        }

        const conv = conversations.find(c => c.id === conversationId);
        const chatMessages: FeedbackChatMessage[] = messages.map(m => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
        }));

        const session = await startSessionFromChat({
            conversationId,
            conversationTitle: conv?.title ?? null,
            model: conv?.model ?? 'default',
            messages: chatMessages,
            url: window.location.href,
        });

        setFeedbackSessionId(session.id);
        setShowFeedbackConfirm(true);
    };

    const closeFeedbackAndNavigate = async () => {
        if (activeSession) await completeSession();
        setShowFeedbackConfirm(false);
        setHistoryOpen(false);
        setHistoryCollapsed(true);
        // Open feedback page in a new tab (since we're inside the extension iframe)
        if (feedbackSessionId) {
            window.open(`${window.location.origin}/feedback/${feedbackSessionId}`, '_blank');
        }
    };

    // ─── Conversation list component ────────────────────────────

    const conversationList = (
        <div className="flex flex-col h-full">
            {/* Header — Brand + Tenant */}
            <div className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-0 animate-fade-in">
                    {activeTenant?.logoUrl ? (
                        <img
                            src={activeTenant.logoUrl}
                            alt={activeTenant.name}
                            className="h-7 w-7 object-contain shrink-0"
                        />
                    ) : (
                        <div className="h-7 w-7 bg-primary flex items-center justify-center shrink-0 rounded">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                        <h1 className="text-sm font-semibold tracking-tight leading-none truncate">Surdej</h1>
                        {activeTenant && (
                            <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                {activeTenant.name}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleNewChat}
                        title={i18n.t('extension.newConversation')}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    {isWide ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setHistoryCollapsed(true)}
                            title={i18n.t('extension.collapse')}
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setHistoryOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* History Label */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30 shrink-0">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold">{i18n.t('extension.history')}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">No conversations yet</div>
                ) : (
                    <div className="py-1">
                        {conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => loadConversation(conv.id)}
                                className={cn(
                                    'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors group flex items-start gap-2',
                                    conversationId === conv.id && 'bg-primary/5 border-l-2 border-primary',
                                )}
                            >
                                <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{conv.title || i18n.t('extension.untitled')}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {conv.messageCount} msg • {formatTimeAgo(conv.updatedAt)}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deleteConversation(conv.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all shrink-0"
                                    title={i18n.t('extension.deleteChat')}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer — User menu */}
            <div className="p-3 border-t bg-muted/10 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
                                    {user?.displayName?.charAt(0) ?? '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate">{user?.displayName ?? 'User'}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{user?.role}</span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email ?? user?.role}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => window.open('/settings', '_blank')}>
                            <Settings className="mr-2 h-4 w-4" />
                            {i18n.t('extension.settings')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            {i18n.t('extension.signOut')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

    // ─── Render ─────────────────────────────────────────────────

    return (
        <div className="flex h-full pb-5 bg-background text-foreground">
            {/* Left: History panel (wide) */}
            {isWide && !historyCollapsed && (
                <>
                    <div
                        style={{ width: historyWidth }}
                        className="border-r border-border/40 shrink-0 bg-muted/5 flex flex-col overflow-hidden"
                    >
                        {conversationList}
                    </div>
                    <ResizeHandle side="left" onMouseDown={historyResizeHandle} />
                </>
            )}

            {/* Mobile history overlay */}
            {!isWide && historyOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
                        onClick={() => setHistoryOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 w-[260px] bg-background border-r border-border z-50 shadow-xl animate-in slide-in-from-left duration-200 overflow-hidden">
                        {conversationList}
                    </div>
                </>
            )}

            {/* Version update banner */}
            {isOutdated && !updateDismissed && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400 shrink-0 animate-fade-in">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">
                        Update: v{latestVersion} available (you have v{installedVersion})
                    </span>
                    <a
                        href="/extensions/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 font-semibold hover:underline"
                    >
                        Download
                    </a>
                    <button
                        onClick={() => setUpdateDismissed(true)}
                        className="shrink-0 p-0.5 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Center: Main chat */}
            <div className="flex-1 flex flex-col min-w-0">
                {activeIframeTool ? (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => setActiveIframeTool(null)}
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-medium">{activeIframeTool.name}</span>
                        </div>
                        <div className="flex-1 min-h-0">
                            <IframeToolHost tool={activeIframeTool} />
                        </div>
                    </div>
                ) : toolDirectoryOpen ? (
                    <ToolDirectory
                        onBack={() => setToolDirectoryOpen(false)}
                        onInjectPrompt={(prompt) => {
                            setToolDirectoryOpen(false);
                            setInput(prompt);
                            inputRef.current?.focus();
                        }}
                        onSelectIframeTool={(tool) => {
                            setToolDirectoryOpen(false);
                            setActiveIframeTool(tool);
                        }}
                    />
                ) : (
                <>
                {/* Compact toolbar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30 shrink-0 overflow-hidden">
                    {(!isWide || historyCollapsed) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                                if (isWide) setHistoryCollapsed(false);
                                else setHistoryOpen(true);
                                loadConversations();
                            }}
                            title={i18n.t('extension.chatHistory')}
                        >
                            {isWide ? (
                                <PanelLeftOpen className="h-3.5 w-3.5" />
                            ) : (
                                <Menu className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}

                    <div className="flex-1 min-w-0" />

                    {/* Active WORKFLOW session indicator dropdown */}
                    {activeWorkflowSessionId ? (
                        <div className="flex items-center gap-1 shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/20 transition-all cursor-pointer max-w-[140px]"
                                        title="Active Workflow Session"
                                    >
                                        <Activity className="h-3 w-3 shrink-0 animate-pulse" />
                                        <span className="truncate">{activeUseCase ? activeUseCase.label : activeUseCaseLabelStore || 'Workflow'}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 text-xs">
                                    <DropdownMenuLabel className="text-xs">Active Workflow</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="cursor-pointer py-2"
                                        onClick={() => window.open(`${window.location.origin}/modules/workflow/debug/${activeWorkflowSessionId}`, '_blank')}
                                    >
                                        <Activity className="mr-2 h-4 w-4 text-blue-500" />
                                        <span>Open Full Inspector</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="cursor-pointer py-2 text-red-500 focus:bg-red-50 focus:text-red-600"
                                        onClick={() => {
                                            setActiveWorkflowSessionId(null);
                                            setWorkflowInStore(null, null);
                                            if (activeUseCase?.workflowMode) {
                                                setActiveUseCase(null);
                                                setActiveUseCaseTasks(undefined);
                                                setSimulateMode(false);
                                                navigate('/extension', { replace: true });
                                            }
                                        }}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        <span>Stop Session</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : activeUseCase ? (
                        <div className="flex items-center gap-1 shrink-0">
                            <div
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-medium text-primary max-w-[100px]"
                                title={`Use case: ${activeUseCase.label}`}
                            >
                                <Puzzle className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{activeUseCase.label}</span>
                            </div>
                            <button
                                onClick={() => {
                                    setActiveUseCase(null);
                                    setActiveUseCaseTasks(undefined);
                                    setSimulateMode(false);
                                    navigate('/extension', { replace: true });
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Clear use case"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ) : null}



                    {/* Context-sensitive tools */}
                    {contextTools.length > 0 && (
                        <div className="flex items-center gap-0.5 shrink-0">
                            {contextTools.map((tool) => (
                                <Button
                                    key={tool.id}
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                        if (tool.prompt) {
                                            setInput(tool.prompt);
                                            inputRef.current?.focus();
                                        }
                                    }}
                                    title={`${tool.label} — ${tool.description}`}
                                >
                                    <tool.icon className="h-3.5 w-3.5" />
                                </Button>
                            ))}
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setToolDirectoryOpen(true)}
                        title={i18n.t('extension.toolDirectory')}
                    >
                        <LayoutList className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setUseCasesDialogOpen(true)}
                        title="Vælg use case"
                    >
                        <Puzzle className="h-3.5 w-3.5" />
                    </Button>

                    <FeedbackToolbar />
                    <Button
                        variant={activeSession ? 'default' : 'ghost'}
                        size="icon"
                        className={cn(
                            "h-6 w-6 shrink-0 relative transition-all",
                            !activeSession && messages.length === 0 && "opacity-40 grayscale hover:opacity-40 cursor-not-allowed"
                        )}
                        onClick={startFeedbackFromChat}
                        disabled={!activeSession && messages.length === 0}
                        title={
                            activeSession
                                ? i18n.t('extension.feedbackActive')
                                : messages.length === 0
                                    ? "Start en chat for at give feedback"
                                    : i18n.t('extension.startFeedback')
                        }
                    >
                        <img src="/happy-mates-logo.png" alt="Feedback" className="h-[18px] w-[18px] rounded-full" />
                        {activeSession && (
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse border border-background" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={handleNewChat}
                        title={i18n.t('extension.newConversation')}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <a
                        href={window.location.origin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={i18n.t('extension.openFullApp')}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>

                {/* Conditionally render Workflow Session Runner or Standard Chat */}
                {activeUseCase && activeUseCase.workflowMode ? (
                    <div className="flex-1 overflow-hidden flex flex-col" data-use-case-id={activeUseCase.id} data-session-id={activeWorkflowSessionId ?? undefined}>
                        {/* Simulate / Session toggle */}
                        {activeUseCaseTasks && activeUseCaseTasks.length > 0 && (
                            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-muted-foreground font-medium truncate">
                                        {activeUseCase.label}
                                    </span>
                                    {activeWorkflowSessionId && (
                                        <span className="text-[9px] font-mono text-muted-foreground/60 truncate">
                                            session: {activeWorkflowSessionId}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setSimulateMode(false)}
                                        className={cn(
                                            'px-2 py-0.5 text-[10px] rounded-l-md border transition-colors',
                                            !simulateMode
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-card text-muted-foreground border-border hover:bg-muted',
                                        )}
                                    >
                                        Session
                                    </button>
                                    <button
                                        onClick={() => setSimulateMode(true)}
                                        className={cn(
                                            'px-2 py-0.5 text-[10px] rounded-r-md border border-l-0 transition-colors',
                                            simulateMode
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-card text-muted-foreground border-border hover:bg-muted',
                                        )}
                                    >
                                        Simulate
                                    </button>
                                </div>
                            </div>
                        )}
                        {simulateMode && activeUseCaseTasks && activeUseCaseTasks.length > 0 ? (
                            <div className="flex-1 overflow-y-auto p-4">
                                <WorkflowSimulator
                                    tasks={activeUseCaseTasks}
                                    onDataChange={setSimulationData}
                                />
                            </div>
                        ) : (
                            <SessionRunner 
                                useCaseId={activeUseCase.id}
                                workflowLabel={activeUseCase.label}
                                onComplete={() => { setActiveUseCase(null); setActiveUseCaseTasks(undefined); setSimulateMode(false); }}
                                onAbort={() => { setActiveUseCase(null); setActiveUseCaseTasks(undefined); setSimulateMode(false); }}
                                onSessionChange={setActiveWorkflowSessionId}
                            />
                        )}
                    </div>
                ) : (
                    <>
                {/* Host page context bar */}
                {bridge.connected && bridge.pageInfo && (
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 border-b text-[10px] text-muted-foreground bg-muted/10',
                        )}
                    >
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1" title={bridge.pageInfo.url}>
                            {bridge.pageInfo.title || bridge.pageInfo.hostname}
                        </span>
                        <button
                            onClick={() => bridge.fetchPageInfo()}
                            className="text-[9px] text-primary hover:underline shrink-0"
                        >
                            {i18n.t('extension.refresh')}
                        </button>
                    </div>
                )}

                {/* Feedback confirmation dialog (chat attached) */}
                <Dialog open={showFeedbackConfirm} onOpenChange={setShowFeedbackConfirm}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Feedbacksession startet</DialogTitle>
                            <DialogDescription>
                                Chatten er vedhæftet som dokument. Vil du tilføje mere
                                (skærmbilleder, optagelser) eller afslutte sessionen?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                                <span className="font-medium">{messages.length} beskeder vedhæftet</span>
                            </div>
                            <p className="text-muted-foreground">
                                Du kan nu tage skærmbilleder, lydoptagelser eller
                                videooptagelser via feedback-værktøjslinjen i headeren.
                            </p>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setShowFeedbackConfirm(false)}>
                                Tilføj mere
                            </Button>
                            <Button onClick={closeFeedbackAndNavigate}>
                                Afslut og vis feedback
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* SharePoint Word document bar */}
                {wordDocInfo && (
                    <>
                        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-blue-500/5 border-blue-500/20">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span
                                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 truncate flex-1"
                                title={wordDocInfo.filename}
                            >
                                {wordDocInfo.filename}
                            </span>
                            {wordDocInfo.filesize && (
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                    {(parseInt(wordDocInfo.filesize) / 1024).toFixed(0)} KB
                                </span>
                            )}
                            <button onClick={() => setWordOpen(!wordOpen)} className="shrink-0">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'text-[8px] px-1.5 py-0 cursor-pointer transition-colors',
                                        wordOpen
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'border-blue-500/30 text-blue-500 hover:bg-blue-500/10',
                                    )}
                                >
                                    <Image className="h-2 w-2 mr-0.5" />
                                    Word {wordOpen ? '▾' : '▸'}
                                </Badge>
                            </button>
                        </div>

                        {/* Word preview panel (collapsible) */}
                        {wordOpen && (
                            <div className="border-b border-blue-500/20 bg-blue-500/5">
                                <WordPreviewPanel docInfo={wordDocInfo} />
                            </div>
                        )}
                    </>
                )}

                {/* Use Cases Dialog */}
                <UseCasesDialog
                    open={useCasesDialogOpen}
                    onOpenChange={setUseCasesDialogOpen}
                    onSelect={(useCaseId) => {
                        const uc = resolveUseCase(useCaseId);
                        if (uc) {
                            setActiveUseCase(uc);
                            setActiveUseCaseTasks((uc as any)._tasks);
                            setSimulateMode(false);
                        }
                        setUseCasesDialogOpen(false);
                    }}
                />

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 gap-4">
                            <MessageSquare className="h-8 w-8 opacity-30" />
                            <div>
                                <p className="text-sm font-medium">
                                    {i18n.t('extension.greeting', { name: user?.displayName ? `, ${user.displayName.split(' ')[0]}` : '' })}
                                </p>
                                <p className="text-xs mt-1">
                                    {bridge.connected
                                        ? i18n.t('extension.welcomeConnected')
                                        : i18n.t('extension.welcomeDisconnected')}
                                </p>
                            </div>

                            {/* Context-sensitive quick actions */}
                            {contextTools.length > 0 && (
                                <div className="w-full max-w-[320px] grid grid-cols-2 gap-2 mt-2">
                                    {contextTools.map((tool) => (
                                        <button
                                            key={tool.id}
                                            onClick={() => {
                                                if (tool.prompt) {
                                                    setInput(tool.prompt);
                                                    inputRef.current?.focus();
                                                }
                                            }}
                                            className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all text-left group"
                                        >
                                            <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="text-[11px] font-medium text-foreground/80">
                                                {tool.label}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground leading-tight">
                                                {tool.description}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <ExtensionMessageBubble 
                            key={msg.id ?? i} 
                            message={msg} 
                            onProposalClick={(text) => {
                                setInput(text);
                                inputRef.current?.focus();
                            }}
                        />
                    ))}

                    {loading && (
                        <div className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="bg-muted/50 rounded-xl px-3 py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t px-3 py-2 bg-muted/10 shrink-0">
                    {/* MCP Tool selector */}
                    <div className="flex items-center gap-1 mb-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                        {[
                            { id: 'search_web', icon: Globe, label: i18n.t('extension.mcpWeb') },
                            { id: 'rag_search', icon: BookOpen, label: i18n.t('extension.mcpDocs') },
                            { id: 'search_properties', icon: Database, label: i18n.t('extension.mcpData') },
                            ...(bridge.connected
                                ? [{ id: 'page_context', icon: FileSearch, label: i18n.t('extension.mcpPage') }]
                                : []),
                        ].map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => {
                                    setInput((prev) => {
                                        const tag = `@${tool.id}`;
                                        return prev.includes(tag)
                                            ? prev.replace(tag, '').trim()
                                            : `${tag} ${prev}`.trim();
                                    });
                                    inputRef.current?.focus();
                                }}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all shrink-0',
                                    input.includes(`@${tool.id}`)
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground',
                                )}
                                title={tool.id}
                            >
                                <tool.icon className="h-2.5 w-2.5" />
                                {tool.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={bridge.connected ? i18n.t('extension.placeholderConnected') : i18n.t('extension.placeholderDisconnected')}
                            disabled={loading}
                            rows={1}
                            className="flex-1 resize-none bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
                        />
                        <Button
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg"
                            disabled={!input.trim() || loading}
                            onClick={handleSend}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                </>)}
                </>
                )}

                {/* URL footer — always visible, pinned to bottom */}
                <div className="fixed bottom-0 left-0 right-0 px-3 py-1 border-t bg-background/90 backdrop-blur-sm shrink-0 flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono truncate select-all z-30">
                    <Globe className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{location.pathname}{location.search}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Message Bubble ─────────────────────────────────────────────

function ExtensionMessageBubble({ message, onProposalClick }: { 
    message: Message;
    onProposalClick?: (text: string) => void;
}) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);
    const i18n = useTranslation();

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    };

    return (
        <div className={cn('group flex gap-2', isUser ? 'flex-row-reverse' : '')}>
            <div
                className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    isUser ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-primary/10',
                )}
            >
                {isUser ? (
                    <User className="h-3 w-3 text-white" />
                ) : (
                    <Bot className="h-3.5 w-3.5 text-primary" />
                )}
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
                {/* Reasoning steps / tool calls */}
                {!isUser && message.reasoningSteps && message.reasoningSteps.length > 0 && (
                    <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1 select-none">
                            <Wrench className="h-3 w-3" />
                            {message.reasoningSteps.length} tool{message.reasoningSteps.length !== 1 ? 's' : ''}{' '}
                            used
                        </summary>
                        <div className="mt-1 space-y-0.5">
                            {message.reasoningSteps.map((step) => (
                                <div
                                    key={step.id}
                                    className={cn(
                                        'flex items-center gap-1.5 py-0.5 px-2 rounded text-[10px]',
                                        step.type === 'tool_result'
                                            ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                            : 'text-muted-foreground/60',
                                    )}
                                >
                                    {getToolIcon(step.toolName)}
                                    <span className="truncate">{getToolLabel(step)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}

                {/* Message content */}
                <div
                    className={cn(
                        'rounded-xl px-3 py-2 text-sm leading-relaxed',
                        isUser
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted/50 border border-border/50 rounded-bl-sm',
                    )}
                >
                    {isUser ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                        <div className="chat-markdown">
                            <Markdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    a: ({ href, children, ...props }) => {
                                        const extractText = (node: any): string => {
                                            if (typeof node === 'string') return node;
                                            if (typeof node === 'number') return String(node);
                                            if (Array.isArray(node)) return node.map(extractText).join('');
                                            if (node && node.props && node.props.children) return extractText(node.props.children);
                                            return '';
                                        };
                                        const text = extractText(children).trim();
                                        
                                        // Proposals handling
                                        if (href === '#proposal' && onProposalClick) {
                                            return (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); onProposalClick(text); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 my-0.5 -ml-1 rounded-md text-primary hover:bg-primary/5 transition-all cursor-pointer text-sm font-medium text-left w-auto max-w-full"
                                                    title={text}
                                                >
                                                    <ArrowRight className="h-3.5 w-3.5 opacity-70 shrink-0" />
                                                    <span className="truncate whitespace-normal leading-tight">{children}</span>
                                                </button>
                                            );
                                        }

                                        // Sources handling
                                        const isSource = href === '#source' || href?.startsWith('#source-') || text.match(/\.(pdf|docx|xlsx|csv)$/i) || text.match(/^\[?\d+\]?$/);
                                        if (isSource && onProposalClick) {
                                            return (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); onProposalClick(text); }}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer text-xs font-mono border border-primary/20 align-text-bottom mx-0.5"
                                                    title={`Ask about source: ${text}`}
                                                >
                                                    <FileText className="h-3 w-3 inline shrink-0" />
                                                    {children}
                                                </button>
                                            );
                                        }

                                        return (
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4 font-medium" {...props}>
                                                {children}
                                            </a>
                                        );
                                    },
                                }}
                            >
                                {enhanceMarkdown(message.content)}
                            </Markdown>
                        </div>
                    )}
                </div>

                {/* Meta row */}
                <div className={cn('flex items-center gap-2 px-1', isUser ? 'flex-row-reverse' : '')}>
                    {message.createdAt && (
                        <span className="text-[10px] text-muted-foreground/60">
                            {formatTimeAgo(message.createdAt)}
                        </span>
                    )}
                    {!isUser && (
                        <button
                            onClick={copyToClipboard}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            title={i18n.t('extension.copyMessage')}
                        >
                            {copied ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                                <Copy className="h-3 w-3" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}
