import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Send, Bot, User, Loader2, Plus, Trash2, MessageSquare,
    Sparkles, Clock, Hash, Zap, Copy, Check, Link2, ChevronDown, Search, X,
    Wrench, Info, ClipboardList, FileText, MessageSquareMore, Paperclip,
    Globe, BookOpen, Database, ArrowRight, Menu, PanelLeftClose, PanelLeftOpen, Folder, Edit2, ChevronRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import yaml from 'yaml';
import { useTranslation } from '@/core/i18n';
import { useAuth } from '@/core/auth/AuthContext';
import { BASE_URL, api } from '@/lib/api';
import { cn, enhanceMarkdown } from '@/lib/utils';
import { useFeedbackStore, type FeedbackChatMessage } from '@/core/feedback/feedbackStore';
import { fetchActiveUseCases, type ActiveUseCase } from '../modules/tool-management-tools/use-case-api';
import { AttachmentPanel, type AttachedFile } from './AttachmentPanel';

// ─── Custom Hooks ──────────────────────────────────────────────
const usePanelResizer = (width: number, setWidth: (w: number) => void, min = 200, max = 800, direction: 'left' | 'right' = 'left') => {
    const resizing = useRef(false);
    const startX = useRef(0);
    const startW = useRef(0);
    return useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizing.current = true;
        startX.current = e.clientX;
        startW.current = width;
        const sign = direction === 'right' ? -1 : 1;
        const onMove = (ev: MouseEvent) => {
            if (!resizing.current) return;
            setWidth(Math.max(min, Math.min(max, startW.current + sign * (ev.clientX - startX.current))));
        };
        const onUp = () => {
            resizing.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [width]);
};

// MCP Tool definitions
const MCP_TOOLS = [
    { id: 'search_web', label: 'Websøgning', icon: '🌐', description: 'Søg på internettet' },
    { id: 'rag_search', label: 'Dokumentsøgning', icon: '📄', description: 'Søg i uploadede prospekter' },
    { id: 'search_properties', label: 'Ejendomme', icon: '🏢', description: 'Søg i ejendomsdata' },
    { id: 'generate_document', label: 'Eksport Documenter', icon: '💾', description: 'Generer Word/Excel/PDF filer' },
] as const;

const API_BASE = BASE_URL;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = api.getTenantId();
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    return headers;
}

// ─── Types ─────────────────────────────────────────────────────

interface ReasoningStep {
    id: string;
    type: 'tool_call' | 'tool_result' | 'status';
    toolName?: string;
    args?: Record<string, any>;
    summary?: string;
    message?: string;
    timestamp: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
    tokenCount?: number;
    reasoningSteps?: ReasoningStep[];
}

interface Conversation {
    id: string;
    title: string | null;
    model: string;
    messageCount: number;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

interface UsageData {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

interface ModelInfo {
    id: string;
    tier: 'low' | 'medium' | 'high' | 'reasoning';
    provider: string;
    maxTokens: number;
    supportsStreaming: boolean;
}

export interface ChatPageProps {
    basePath?: string;
    isExtensionMode?: boolean;
    headerAddons?: React.ReactNode;
    emptyStateContextTools?: React.ReactNode;
    onBeforeSend?: () => Promise<string>;
}

export function ChatPage({ 
    basePath = '/chat', 
    isExtensionMode = false, 
    headerAddons, 
    emptyStateContextTools,
    onBeforeSend 
}: ChatPageProps = {}) {
    const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();
    const { user } = useAuth();

    const TIER_LABELS: Record<string, string> = {
        low: t('chat.tierLow'),
        medium: t('chat.tierMedium'),
        high: t('chat.tierHigh'),
        reasoning: t('chat.tierReasoning'),
    };

    const TIER_DESCRIPTIONS: Record<string, string> = {
        low: t('chat.tierLowDesc'),
        medium: t('chat.tierMediumDesc'),
        high: t('chat.tierHighDesc'),
        reasoning: t('chat.tierReasoningDesc'),
    };

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
    const [lastUsage, setLastUsage] = useState<UsageData | null>(null);
    const [totalTokens, setTotalTokens] = useState(0);
    const [totalRequests, setTotalRequests] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(!!urlConversationId);
    const [selectedModel, setSelectedModel] = useState<string>('medium');
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
    const [editTarget, setEditTarget] = useState<Conversation | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editFolder, setEditFolder] = useState('');
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
    const [linkCopied, setLinkCopied] = useState(false);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set(MCP_TOOLS.map(t => t.id)));
    const [showToolPanel, setShowToolPanel] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [debugInfo, setDebugInfo] = useState<{ systemPrompt: string; tools: { id: string; description: string }[]; version: string; model: string } | null>(null);
    const [debugCopied, setDebugCopied] = useState(false);
    const [docRefs, setDocRefs] = useState<Record<string, string>>({});
    const [showFeedbackConfirm, setShowFeedbackConfirm] = useState(false);
    const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
    const [pendingFeedbackPayload, setPendingFeedbackPayload] = useState<Parameters<typeof startSessionFromChat>[0] | null>(null);

    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [leftPanelWidth, setLeftPanelWidth] = useState(400);
    const onLeftPanelResizeStart = usePanelResizer(leftPanelWidth, setLeftPanelWidth, 300, 800, 'right');
    const [showSidebarMobile, setShowSidebarMobile] = useState(false);
    const [showSidebarDesktop, setShowSidebarDesktop] = useState(() => {
        return localStorage.getItem('surdej-chat-sidebar-collapsed') !== 'true';
    });

    useEffect(() => {
        localStorage.setItem('surdej-chat-sidebar-collapsed', (!showSidebarDesktop).toString());
    }, [showSidebarDesktop]);

    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isNewUploadRef = useRef(false);
    const analyzedFileIds = useRef<Set<string>>(new Set());

    // Derived: true when any attached file is still uploading/processing
    const hasFilesProcessing = attachedFiles.some(f => f.isLoading);

    // Slash menu state
    const [activeUseCases, setActiveUseCases] = useState<ActiveUseCase[]>([]);
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [slashSearch, setSlashSearch] = useState('');
    const [slashIndex, setSlashIndex] = useState(0);

    // Feedback store
    const activeSession = useFeedbackStore((s) => s.activeSession);
    const startSessionFromChat = useFeedbackStore((s) => s.startSessionFromChat);
    const completeSession = useFeedbackStore((s) => s.completeSession);
    const resumeSessionById = useFeedbackStore((s) => s.resumeSessionById);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    // Load models and use cases once on mount
    useEffect(() => {
        loadModels();
        fetchActiveUseCases().then(setActiveUseCases);
    }, []);

    // Handle ?useCase= parameter from URL (e.g. from Extension Use Cases popup)
    useEffect(() => {
        const queryUseCase = searchParams.get('useCase');
        if (queryUseCase && activeUseCases.length > 0) {
            const uc = activeUseCases.find((u) => u.slug === queryUseCase || u.id === queryUseCase);
            if (uc) {
                // Pre-fill input with slash command if not already present
                if (!input.includes(`/${uc.slug}`)) {
                    setInput(`/${uc.slug} `);
                }
            }
            // Strip param to avoid re-triggering
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('useCase');
            setSearchParams(newParams, { replace: true });
            
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [searchParams, activeUseCases, setSearchParams, input]);

    // Load conversations + handle deep-link navigation (also re-fires on URL change)
    useEffect(() => {
        loadConversations();
        if (urlConversationId) {
            if (isNewUploadRef.current) {
                isNewUploadRef.current = false;
            } else {
                loadConversation(urlConversationId);
            }
        }
    }, [urlConversationId]);

    // Sync attached files to conversation metadata
    useEffect(() => {
        if (!activeConversationId) return;
        // Only sync successfully uploaded files
        const validFiles = attachedFiles.filter(f => !f.isLoading && !f.error).map(f => ({
            id: f.id,
            name: f.name,
            storagePath: f.storagePath
        }));
        fetch(`${API_BASE}/ai/conversations/${activeConversationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ metadata: { attachedFiles: validFiles } })
        }).catch(console.error);
    }, [attachedFiles, activeConversationId]);

    // Handle global injections (e.g., from extension context tools)
    useEffect(() => {
        const handleInject = (e: Event) => {
            const ev = e as CustomEvent<string>;
            if (ev.detail) {
                setInput(ev.detail);
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        };
        window.addEventListener('EXTENSION_INJECT_INPUT', handleInject);
        return () => window.removeEventListener('EXTENSION_INJECT_INPUT', handleInject);
    }, []);

    // ─── Auto-Analysis on Document Upload ──────────────────────
    // When all attached files finish processing, auto-send an analysis request
    const pendingAutoAnalysis = useRef<string | null>(null);

    useEffect(() => {
        // Only trigger when we have files, none are loading, and we haven't already analyzed this batch
        const completedFiles = attachedFiles.filter(f => !f.isLoading && !f.error);
        const anyStillLoading = attachedFiles.some(f => f.isLoading);
        
        if (completedFiles.length === 0 || anyStillLoading || isStreaming) return;

        // Check if any of these files haven't been analyzed yet
        const newFiles = completedFiles.filter(f => !analyzedFileIds.current.has(f.id));
        if (newFiles.length === 0) return;

        // Mark all as analyzed
        newFiles.forEach(f => analyzedFileIds.current.add(f.id));

        // Build the auto-analysis prompt
        const fileNames = newFiles.map(f => f.name).join(', ');
        const autoPrompt = newFiles.length === 1
            ? `Analysér venligst det uploadede dokument "${newFiles[0].name}". Giv et kort overblik over indholdet og foreslå relevante spørgsmål eller handlinger.`
            : `Analysér venligst de ${newFiles.length} uploadede dokumenter (${fileNames}). Giv et kort overblik over indholdet af hvert dokument og foreslå relevante spørgsmål eller handlinger.`;

        // Set the input and mark that we need an auto-send
        pendingAutoAnalysis.current = autoPrompt;
        setInput(autoPrompt);
    }, [attachedFiles, isStreaming]);

    // ─── API Calls ─────────────────────────────────────────────

    const loadConversations = async () => {
        try {
            const res = await fetch(`${API_BASE}/ai/conversations`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch {
            // Conversations loading is non-critical
        }
    };

    const loadModels = async () => {
        try {
            const res = await fetch(`${API_BASE}/ai/models`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAvailableModels(data.models ?? []);
            }
        } catch {
            // Models loading is non-critical
        }
    };

    const loadConversation = async (id: string, force = false) => {
        setShowSidebarMobile(false);
        // Skip re-fetch if this conversation is already loaded (unless forced)
        if (!force && activeConversationId === id) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai/conversations/${id}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages ?? []);
                if (data.metadata?.attachedFiles) {
                    setAttachedFiles(data.metadata.attachedFiles);
                    // Mark pre-existing files as already analyzed to prevent re-trigger
                    data.metadata.attachedFiles.forEach((f: any) => analyzedFileIds.current.add(f.id));
                    if (data.metadata.attachedFiles.length > 0) {
                        setActiveTabId(data.metadata.attachedFiles[0].id);
                    }
                } else {
                    setAttachedFiles([]);
                }
                setActiveConversationId(id);
                navigate(`${basePath}/${id}`, { replace: true });
            }
        } catch {
            setError(t('chat.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = (conv: Conversation) => {
        setDeleteTarget(conv);
    };

    const openEdit = (conv: Conversation) => {
        setEditTarget(conv);
        setEditTitle(conv.title ?? '');
        setEditFolder((conv.metadata as any)?.folder ?? '');
    };

    const saveEdit = async () => {
        if (!editTarget) return;
        try {
            const res = await fetch(`${API_BASE}/ai/conversations/${editTarget.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    title: editTitle.trim() || undefined,
                    metadata: {
                        ...(editTarget.metadata ?? {}),
                        titleLocked: true,
                        folder: editFolder.trim() || undefined
                    }
                })
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(prev => prev.map(c => c.id === data.id ? { ...c, title: data.title, metadata: data.metadata } : c));
            }
        } catch (e) { console.error('Failed to update chat', e); }
        setEditTarget(null);
    };

    const deleteConversation = async (id: string) => {
        setDeleteTarget(null);
        try {
            await fetch(`${API_BASE}/ai/conversations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (activeConversationId === id) {
                setActiveConversationId(null);
                setMessages([]);
                navigate(basePath, { replace: true });
            }
        } catch {
            setError(t('chat.deleteFailed'));
        }
    };

    const startNewChat = () => {
        setShowSidebarMobile(false);
        setActiveConversationId(null);
        setMessages([]);
        setAttachedFiles([]);
        setStreamingText('');
        setError(null);
        navigate(basePath, { replace: true });
        inputRef.current?.focus();
    };

    // ─── Streaming Chat ────────────────────────────────────────

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if ((!text && attachedFiles.length === 0) || isStreaming) return;

        // Block send while files are still processing
        if (attachedFiles.some(f => f.isLoading)) {
            setError(t('chat.filesStillProcessing') ?? 'Files are still processing — please wait.');
            return;
        }

        setInput('');
        setError(null);
        setIsStreaming(true);
        setStreamingText('');
        setReasoningSteps([]);

        // Capture files currently attached
        const currentFiles = [...attachedFiles];
        const validFileIds = currentFiles.filter(f => !f.isLoading && !f.error).map(f => f.id);

        // Do not clear files immediately, allowing user to discuss them repeatedly.
        // But we do stop any running pollers (which should have finished if valid anyway).
        attachedFiles.forEach(f => f.pollInterval && window.clearInterval(f.pollInterval));

        // Add user message to local state
        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);

        let useCaseContext: any = undefined;
        const queryParams = '';
        for (const uc of activeUseCases) {
            const prefix = `/${uc.slug}`;
            if (text.toLowerCase().startsWith(prefix)) {
                useCaseContext = {
                    id: uc.id,
                    promptTemplate: uc.promptTemplate,
                };
                break;
            }
        }

        let finalMessage = text;
        if (onBeforeSend) {
            try {
                const prefix = await onBeforeSend();
                if (prefix) finalMessage = prefix + finalMessage;
            } catch { /* ignore */ }
        }

        try {
            const res = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message: finalMessage,
                    conversationId: activeConversationId,
                    model: selectedModel,
                    useCaseContext,
                    tools: Array.from(enabledTools),
                    files: validFileIds.length > 0 ? validFileIds : undefined,
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
            let conversationId = activeConversationId;

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
                            conversationId = event.conversationId;
                            setActiveConversationId(conversationId);
                            navigate(`${basePath}/${conversationId}`, { replace: true });
                            if (event.systemPrompt) {
                                setDebugInfo(prev => prev ? { ...prev, systemPrompt: event.systemPrompt } : {
                                    systemPrompt: event.systemPrompt,
                                    tools: [],
                                    version: 'live',
                                    model: selectedModel,
                                });
                            }
                        } else if (event.type === 'text') {
                            accumulatedText += event.content;
                            setStreamingText(accumulatedText);
                        } else if (event.type === 'status') {
                            // Show reasoning step: general system status (like reading files)
                            setReasoningSteps(prev => [...prev, {
                                id: `status-${Date.now()}-${Math.random()}`,
                                type: 'status',
                                message: event.message,
                                timestamp: Date.now(),
                            }]);
                        } else if (event.type === 'tool_call') {
                            // Show reasoning step: tool is being called
                            setReasoningSteps(prev => [...prev, {
                                id: `tc-${Date.now()}-${event.toolName}`,
                                type: 'tool_call',
                                toolName: event.toolName,
                                args: event.args,
                                timestamp: Date.now(),
                            }]);
                        } else if (event.type === 'tool_result') {
                            // Show reasoning step: tool returned results
                            setReasoningSteps(prev => [...prev, {
                                id: `tr-${Date.now()}-${event.toolName}`,
                                type: 'tool_result',
                                toolName: event.toolName,
                                summary: event.summary,
                                timestamp: Date.now(),
                            }]);
                        } else if (event.type === 'refs') {
                            // Document references from tool results
                            if (event.documents) {
                                setDocRefs(prev => ({ ...prev, ...event.documents }));
                            }
                        } else if (event.type === 'done') {
                            if (event.usage) {
                                setLastUsage(event.usage);
                                setTotalTokens((prev) => prev + (event.usage.totalTokens ?? 0));
                            }
                            setTotalRequests((prev) => prev + 1);
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        }
                    } catch (e) {
                        // Skip malformed JSON lines
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }

            // Add assistant message (with reasoning steps attached)
            const finalSteps = [...reasoningSteps];
            const assistantMsg: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: accumulatedText,
                createdAt: new Date().toISOString(),
                reasoningSteps: finalSteps.length > 0 ? finalSteps : undefined,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setStreamingText('');

            // Refresh conversations list immediately + again after a delay
            // (title is generated asynchronously after the stream ends)
            await loadConversations();
            setTimeout(() => loadConversations(), 5000);
        } catch (err) {
            setError(String(err));
        } finally {
            setIsStreaming(false);
        }
    }, [input, isStreaming, activeConversationId, selectedModel, enabledTools, attachedFiles, activeUseCases]);

    // Fire pending auto-analysis once sendMessage is available and input is set
    useEffect(() => {
        if (pendingAutoAnalysis.current && input === pendingAutoAnalysis.current && !isStreaming) {
            pendingAutoAnalysis.current = null;
            const timer = setTimeout(() => sendMessage(), 200);
            return () => clearTimeout(timer);
        }
    }, [input, isStreaming, sendMessage]);

    const toggleTool = (toolId: string) => {
        setEnabledTools(prev => {
            const next = new Set(prev);
            if (next.has(toolId)) {
                next.delete(toolId);
            } else {
                next.add(toolId);
            }
            return next;
        });
    };

    const loadDebugInfo = async () => {
        if (debugInfo) { setShowDebugPanel(!showDebugPanel); return; }
        try {
            const res = await fetch(`${API_BASE}/ai/debug`, { headers: getAuthHeaders() });
            if (res.ok) {
                setDebugInfo(await res.json());
                setShowDebugPanel(true);
            }
        } catch { /* ignore */ }
    };

    const addTab = useCallback((id: string, name: string, storagePath?: string) => {
        setAttachedFiles(prev => {
            if (!prev.find(f => f.id === id)) {
                return [...prev, { id, name, isLoading: false, storagePath }];
            }
            return prev;
        });
        setActiveTabId(id);
    }, []);

    const openDocPreview = async (filename: string) => {
        // Check if we already have the blobId from tool results
        const knownId = docRefs[filename];
        if (knownId) {
            addTab(knownId, filename);
            return;
        }
        // Otherwise look it up by filename
        try {
            const res = await fetch(`${API_BASE}/blobs/lookup?filename=${encodeURIComponent(filename)}`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const blob = await res.json();
                setDocRefs(prev => ({ ...prev, [filename]: blob.id }));
                addTab(blob.id, filename, blob.storagePath);
            }
        } catch { /* ignore */ }
    };

    const removeFile = useCallback((id: string) => {
        setAttachedFiles(prev => {
            const fileToRemove = prev.find(f => f.id === id);
            if (fileToRemove?.pollInterval) window.clearInterval(fileToRemove.pollInterval);
            return prev.filter(f => f.id !== id);
        });
    }, []);

    const onReorderFiles = useCallback((draggedId: string, targetId: string) => {
        setAttachedFiles(prev => {
            const dragIdx = prev.findIndex(f => f.id === draggedId);
            const dropIdx = prev.findIndex(f => f.id === targetId);
            if (dragIdx < 0 || dropIdx < 0) return prev;
            const next = [...prev];
            const [item] = next.splice(dragIdx, 1);
            next.splice(dropIdx, 0, item);
            return next;
        });
    }, []);

    const copyFullChat = async () => {
        const conv = conversations.find(c => c.id === activeConversationId);
        
        const exportData = {
            metadata: {
                version: debugInfo?.version ?? 'unknown',
                model: `${debugInfo?.model ?? 'unknown'} (${selectedModel})`,
                conversationId: activeConversationId ?? 'new',
                title: conv?.title ?? 'Untitled',
                url: window.location.href,
                user: `${user?.displayName ?? user?.name ?? 'unknown'} (${user?.email ?? 'unknown'})`,
                role: user?.role ?? 'unknown',
                userAgent: navigator.userAgent,
                enabledTools: Array.from(enabledTools),
                totalTokens,
                requests: totalRequests,
                exportedAt: new Date().toISOString(),
            },
            systemPrompt: debugInfo?.systemPrompt ?? '(not loaded)',
            messages: messages.map(m => ({
                role: m.role,
                createdAt: m.createdAt,
                content: m.content
            }))
        };

        try {
            const yamlString = yaml.stringify(exportData);
            await navigator.clipboard.writeText(yamlString);
            setDebugCopied(true);
            setTimeout(() => setDebugCopied(false), 2000);
        } catch { /* ignore */ }
    };

    // Slash menu logic
    const filteredUseCases = activeUseCases.filter(uc =>
        uc.slug.toLowerCase().includes(slashSearch) ||
        uc.label.toLowerCase().includes(slashSearch) ||
        (uc.tags && uc.tags.some(t => t.toLowerCase().includes(slashSearch)))
    );

    const applySlashCommand = useCallback((uc: ActiveUseCase) => {
        const lastWordRegex = /(^|\s)\/([a-z0-9-]*)$/i;
        const newVal = input.replace(lastWordRegex, `$1/${uc.slug} `);
        setInput(newVal);
        setShowSlashMenu(false);
        setTimeout(() => inputRef.current?.focus(), 10);
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);

        const lastWordMatch = val.match(/(^|\s)\/([a-z0-9-]*)$/i);
        if (lastWordMatch && activeUseCases.length > 0) {
            setShowSlashMenu(true);
            setSlashSearch(lastWordMatch[2].toLowerCase());
            setSlashIndex(0);
        } else {
            setShowSlashMenu(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSlashMenu) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex(i => Math.min(i + 1, filteredUseCases.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex(i => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selected = filteredUseCases[slashIndex];
                if (selected) applySlashCommand(selected);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSlashMenu(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Global keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Escape — clear input or close search
            if (e.key === 'Escape') {
                if (sidebarSearch) {
                    setSidebarSearch('');
                    searchRef.current?.blur();
                } else if (input) {
                    setInput('');
                } else {
                    inputRef.current?.blur();
                }
                return;
            }
            // / — focus chat input (when not already typing)
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [input, sidebarSearch]);

    const copyShareLink = async () => {
        if (!activeConversationId) return;
        const url = `${window.location.origin}/chat/${activeConversationId}`;
        try {
            await navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch { /* ignore */ }
    };

    // Filter conversations by sidebar search
    const filteredConversations = sidebarSearch.trim()
        ? conversations.filter(c =>
            (c.title ?? t('chat.untitled')).toLowerCase().includes(sidebarSearch.toLowerCase()) || 
            ((c.metadata as any)?.folder || '').toLowerCase().includes(sidebarSearch.toLowerCase())
        )
        : conversations;

    const groupedConversations = useMemo(() => {
        const groups: Record<string, Conversation[]> = { '': [] };
        filteredConversations.forEach(c => {
            const folder = (c.metadata as any)?.folder || '';
            if (!groups[folder]) groups[folder] = [];
            groups[folder].push(c);
        });
        return groups;
    }, [filteredConversations]);

    const suggestions = [
        t('chat.suggestion1'),
        t('chat.suggestion2'),
        t('chat.suggestion3'),
        t('chat.suggestion4'),
    ];

    // ─── File Uploads ──────────────────────────────────────────

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsDragging(false);

        let currentConvId = activeConversationId;
        if (!currentConvId) {
            try {
                const resConv = await fetch(`${API_BASE}/ai/conversations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ model: selectedModel })
                });
                if (resConv.ok) {
                    const data = await resConv.json();
                    currentConvId = data.id;
                    isNewUploadRef.current = true;
                    setActiveConversationId(currentConvId);
                    navigate(`${basePath}/${currentConvId}`, { replace: true });
                }
            } catch (err) {
                 console.error('[AI] Failed to pre-create conversation', err);
            }
        }

        const newFiles = Array.from(files).map(file => ({
            id: `temp-${Date.now()}-${file.name}`,
            name: file.name,
            isLoading: true,
            file,
        }));

        setAttachedFiles(prev => [...prev, ...newFiles.map(f => ({ id: f.id, name: f.name, isLoading: true }))]);

        // Upload each file
        for (const f of newFiles) {
            try {
                const formData = new FormData();
                formData.append('file', f.file);

                // Cleanup undefined headers to prevent fetch errors
                const fetchHeaders = new Headers(getAuthHeaders());
                fetchHeaders.delete('Content-Type');

                const resUpload = await fetch(`${API_BASE}/blobs`, {
                    method: 'POST',
                    headers: fetchHeaders,
                    body: formData,
                });

                if (!resUpload.ok) throw new Error('Upload failed');

                const blob = await resUpload.json();

                const pollInterval = window.setInterval(async () => {
                    try {
                        const statusRes = await fetch(`${API_BASE}/blobs/${blob.id}/status`, {
                            headers: getAuthHeaders()
                        });
                        if (statusRes.ok) {
                            const { status } = await statusRes.json();
                            if (status === 'completed' || status === 'failed') {
                                window.clearInterval(pollInterval);
                                setAttachedFiles(prev => prev.map(item =>
                                    item.id === blob.id ? { ...item, isLoading: false, error: status === 'failed' ? 'Failed extraction' : undefined } : item
                                ));
                            }
                        }
                    } catch (e) {
                         // ignore and retry later
                    }
                }, 2000);

                setAttachedFiles(prev => prev.map(item =>
                    item.id === f.id ? { ...item, id: blob.id, isLoading: true, pollInterval: pollInterval as unknown as number, storagePath: blob.storagePath } : item
                ));
                setActiveTabId(blob.id);
            } catch (err) {
                setAttachedFiles(prev => prev.map(item =>
                    item.id === f.id ? { ...item, isLoading: false, error: 'Failed' } : item
                ));
            }
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    // ─── Feedback from Chat ────────────────────────────────────

    const startFeedbackFromChat = async () => {
        if (!activeConversationId || messages.length === 0) return;

        // If there's already an active session, complete it and show its result
        if (activeSession) {
            const sessionId = await completeSession();
            setFeedbackSessionId(sessionId);
            setShowFeedbackConfirm(true);
            return;
        }

        // If we previously created a session for this chat, resume it instead of creating a new one
        if (feedbackSessionId) {
            await resumeSessionById(feedbackSessionId);
            setShowFeedbackConfirm(true);
            return;
        }

        // Store the payload and show the dialog — session is NOT created yet.
        // The user's choice in the dialog determines when (and whether) recording starts.
        const conv = conversations.find(c => c.id === activeConversationId);
        const chatMessages: FeedbackChatMessage[] = messages.map(m => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
        }));
        setPendingFeedbackPayload({
            conversationId: activeConversationId,
            conversationTitle: conv?.title ?? null,
            model: conv?.model ?? selectedModel,
            messages: chatMessages,
            url: window.location.href,
        });
        setShowFeedbackConfirm(true);
    };

    // "Tilføj mere" — create session now so the toolbar activates for recording
    const confirmFeedbackAddMore = async () => {
        if (!pendingFeedbackPayload) return;
        const session = await startSessionFromChat(pendingFeedbackPayload);
        setFeedbackSessionId(session.id);
        setPendingFeedbackPayload(null);
        setShowFeedbackConfirm(false);
    };

    // "Afslut og vis feedback" — create + immediately complete, then navigate
    const closeFeedbackAndNavigate = async () => {
        let sessionId = feedbackSessionId;
        if (pendingFeedbackPayload) {
            const session = await startSessionFromChat(pendingFeedbackPayload);
            sessionId = session.id;
            setPendingFeedbackPayload(null);
        }
        await completeSession();
        setShowFeedbackConfirm(false);
        if (sessionId) {
            navigate(`/feedback/${sessionId}`);
        } else {
            navigate('/feedback');
        }
    };

    // ─── Render ────────────────────────────────────────────────

    const renderConversation = (conv: Conversation) => (
        <div
            key={conv.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${activeConversationId === conv.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted/50 text-muted-foreground'
                }`}
            onClick={() => loadConversation(conv.id)}
        >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <span className="truncate block">
                    {conv.title ?? t('chat.untitled')}
                </span>
                {conv.updatedAt && (
                    <span className="text-[10px] text-muted-foreground/50 block">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                )}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    openEdit(conv);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity mr-1"
                title={t('chat.edit')}
            >
                <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    confirmDelete(conv);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                title={t('chat.delete')}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );

    return (
        <>
            <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('chat.editTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('chat.chatName')}</label>
                            <input 
                                className="w-full text-sm bg-muted/30 border border-border/30 rounded-lg px-3 py-2 outline-none focus:border-primary/50 transition-colors" 
                                value={editTitle} 
                                onChange={e => setEditTitle(e.target.value)} 
                                placeholder={t('chat.untitled')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('chat.folderName')}</label>
                            <input 
                                className="w-full text-sm bg-muted/30 border border-border/30 rounded-lg px-3 py-2 outline-none focus:border-primary/50 transition-colors" 
                                value={editFolder} 
                                onChange={e => setEditFolder(e.target.value)} 
                                placeholder={t('chat.noFolder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={saveEdit}>
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('chat.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('chat.deleteDescription', { title: deleteTarget?.title ?? t('chat.untitled') })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteConversation(deleteTarget.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {headerAddons}

            <div className={cn("flex gap-0 animate-fade-in overflow-hidden relative", isExtensionMode ? "flex-1" : "h-[calc(100%+3rem)] -m-6")}>
                {/* Mobile sidebar overlay */}
                {showSidebarMobile && (
                    <div 
                        className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                        onClick={() => setShowSidebarMobile(false)}
                    />
                )}
                
                {/* Sidebar — Conversation history */}
                <div className={cn(
                    "w-72 flex flex-col gap-2 p-4 border-r border-border/50 shrink-0 bg-background",
                    "absolute md:relative z-50 h-full transition-transform duration-300 right-auto top-0 bottom-0 left-0",
                    showSidebarMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
                    !showSidebarDesktop && "md:hidden"
                )}>
                    <Button
                        onClick={startNewChat}
                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    >
                        <Plus className="h-4 w-4" />
                        {t('chat.newChat')}
                    </Button>

                    {/* Stats bar */}
                    <div className="flex gap-2 px-1">
                        <Badge variant="secondary" className="gap-1 text-xs">
                            <Hash className="h-3 w-3" />
                            {t('chat.requests', { count: String(totalRequests) })}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Sidebar search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={sidebarSearch}
                            onChange={(e) => setSidebarSearch(e.target.value)}
                            placeholder={t('chat.searchConversations')}
                            className="w-full text-xs bg-muted/30 border border-border/30 rounded-lg pl-8 pr-7 py-1.5 outline-none focus:border-primary/50 focus:bg-muted/50 transition-colors placeholder:text-muted-foreground/40"
                        />
                        {sidebarSearch && (
                            <button
                                onClick={() => setSidebarSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Conversation count */}
                    {conversations.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/50 px-1">
                            {sidebarSearch
                                ? t('chat.conversationCountFiltered', { filtered: String(filteredConversations.length), total: String(conversations.length) })
                                : (conversations.length !== 1
                                    ? t('chat.conversationCountPlural', { count: String(conversations.length) })
                                    : t('chat.conversationCount', { count: String(conversations.length) })
                                )
                            }
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-1">
                        {conversations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                {t('chat.noConversations')}
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                                <Search className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                {t('chat.noMatches')}
                            </div>
                        ) : (
                            (Object.entries(groupedConversations) as [string, Conversation[]][]).map(([folder, convs]) => {
                                if (convs.length === 0) return null;
                                if (!folder) {
                                    return <div key="unfolder" className="space-y-1 mb-2">{convs.map(renderConversation)}</div>;
                                }
                                const isOpen = openFolders[folder] ?? true;
                                return (
                                    <div key={folder} className="mb-2">
                                        <button 
                                            className="flex items-center gap-1 w-full text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group rounded-md hover:bg-muted/30"
                                            onClick={() => setOpenFolders(prev => ({ ...prev, [folder]: !isOpen }))}
                                        >
                                            {isOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                                            <Folder className="h-3.5 w-3.5 text-blue-500/70" />
                                            <span className="flex-1 truncate uppercase tracking-wider text-[10px] ml-1">{folder}</span>
                                            <span className="text-[9px] opacity-70 bg-muted px-1.5 py-0.5 rounded-sm">{convs.length}</span>
                                        </button>
                                        {isOpen && (
                                            <div className="mt-1 space-y-1 pl-1 ml-[7px] border-l-2 border-border/30">
                                                {convs.map(renderConversation)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main chat area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    {/* Conversation header */}
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-8 w-8 shrink-0 -ml-3 text-muted-foreground hover:bg-muted"
                            onClick={() => setShowSidebarMobile(prev => !prev)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden md:flex h-8 w-8 shrink-0 -ml-3 text-muted-foreground hover:bg-muted"
                            onClick={() => setShowSidebarDesktop(prev => !prev)}
                        >
                            {showSidebarDesktop ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-5 w-5" />}
                        </Button>
                        {activeConversationId ? (
                            <>
                                <MessageSquare className="h-4 w-4 text-muted-foreground hidden md:block" />
                                <span className="text-sm font-medium truncate">
                                    {conversations.find(c => c.id === activeConversationId)?.title ?? t('chat.untitled')}
                                </span>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {messages.length !== 1
                                        ? t('chat.messagesPlural', { count: String(messages.length) })
                                        : t('chat.messages', { count: String(messages.length) })
                                    }
                                </span>
                                <div className="flex-1" />
                                <button
                                    onClick={copyShareLink}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('chat.share')}
                                >
                                    {linkCopied ? (
                                        <><Check className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline">{t('chat.copied')}</span></>
                                    ) : (
                                        <><Link2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('chat.share')}</span></>
                                    )}
                                </button>
                                <button
                                    onClick={loadDebugInfo}
                                    className="flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                                    title="Debug Info"
                                >
                                    <Info className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={startFeedbackFromChat}
                                    className={cn(
                                        'flex items-center gap-1.5 text-xs transition-colors hidden sm:flex',
                                        'text-muted-foreground hover:text-amber-600',
                                    )}
                                    title={activeSession ? 'Afslut feedbacksession' : 'Send feedback fra denne chat'}
                                >
                                    <MessageSquareMore className="h-3.5 w-3.5" />
                                    Feedback
                                </button>
                            </>
                        ) : (
                            <span className="text-sm font-medium truncate text-muted-foreground">
                                {t('chat.newChat')}
                            </span>
                        )}
                    </div>

                    {/* Feedback confirmation dialog */}
                    <Dialog open={showFeedbackConfirm} onOpenChange={setShowFeedbackConfirm}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Feedbacksession startet</DialogTitle>
                                <DialogDescription>
                                    Chatten er vedhæftet som dokument. Vil du tilføje mere (skærmbilleder, optagelser) eller afslutte sessionen?
                                </DialogDescription>
                            </DialogHeader>
                            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="font-medium">{messages.length} beskeder vedhæftet</span>
                                </div>
                                <p className="text-muted-foreground">
                                    Du kan nu tage skærmbilleder, lydoptagelser eller videooptagelser via feedback-værktøjslinjen i headeren.
                                </p>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={confirmFeedbackAddMore}>
                                    Tilføj mere
                                </Button>
                                <Button onClick={closeFeedbackAndNavigate}>
                                    Afslut og vis feedback
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Debug panel */}
                    {showDebugPanel && debugInfo && (
                        <div className="border-b border-border/30 bg-muted/20 animate-slide-up overflow-auto" style={{ maxHeight: '50vh' }}>
                            <div className="px-6 py-4 space-y-3 text-xs font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Debug Panel</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={copyFullChat}
                                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${debugCopied
                                                ? 'bg-emerald-500/10 text-emerald-500'
                                                : 'bg-muted hover:bg-primary/10 hover:text-primary'
                                                }`}
                                        >
                                            {debugCopied ? <Check className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                                            {debugCopied ? 'Copied!' : 'Copy Full Chat'}
                                        </button>
                                        <button onClick={() => setShowDebugPanel(false)} className="text-muted-foreground/40 hover:text-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-[10px]">
                                    <div className="bg-muted/50 rounded px-2 py-1">
                                        <span className="text-muted-foreground/50">Version</span>
                                        <div className="font-semibold">{debugInfo.version}</div>
                                    </div>
                                    <div className="bg-muted/50 rounded px-2 py-1">
                                        <span className="text-muted-foreground/50">Provider</span>
                                        <div className="font-semibold">{debugInfo.model}</div>
                                    </div>
                                    <div className="bg-muted/50 rounded px-2 py-1">
                                        <span className="text-muted-foreground/50">Tier</span>
                                        <div className="font-semibold">{selectedModel}</div>
                                    </div>
                                    <div className="bg-muted/50 rounded px-2 py-1">
                                        <span className="text-muted-foreground/50">Conv ID</span>
                                        <div className="font-semibold truncate">{activeConversationId?.slice(0, 8)}...</div>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">System Prompt</span>
                                    <pre className="mt-1 p-2 bg-muted/50 rounded text-[10px] whitespace-pre-wrap leading-relaxed max-h-32 overflow-auto">{debugInfo.systemPrompt}</pre>
                                </div>

                                <div>
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Tools ({debugInfo.tools.length})</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {debugInfo.tools.map(tool => (
                                            <span key={tool.id} className={`px-2 py-0.5 rounded text-[10px] ${enabledTools.has(tool.id)
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-muted/50 text-muted-foreground/40 line-through'
                                                }`}>
                                                {tool.id}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-4" />
                                <p className="text-muted-foreground text-sm">{t('chat.loading')}</p>
                            </div>
                        ) : messages.length === 0 && !isStreaming ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-8 mb-6">
                                    <Sparkles className="h-12 w-12 text-violet-500" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">{t('chat.aiGreeting')}</h2>
                                <p className="text-muted-foreground max-w-md">
                                    {t('chat.aiIntro')}
                                </p>
                                {emptyStateContextTools}
                                <div className={cn("grid gap-3 mt-8 max-w-lg", isExtensionMode ? "grid-cols-1 hidden sm:grid sm:grid-cols-2" : "grid-cols-2")}>
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => {
                                                setInput(suggestion);
                                                inputRef.current?.focus();
                                            }}
                                            className="text-left text-sm p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => (
                                    <MessageBubble 
                                        key={msg.id} 
                                        message={msg} 
                                        t={t} 
                                        docRefs={docRefs} 
                                        onDocClick={openDocPreview}
                                        onProposalClick={(text) => {
                                            setInput(text);
                                            inputRef.current?.focus();
                                        }}
                                    />
                                ))}

                                {/* Live reasoning steps during streaming */}
                                {isStreaming && reasoningSteps.length > 0 && (
                                    <ReasoningStepsUI steps={reasoningSteps} />
                                )}

                                {/* Streaming indicator */}
                                {isStreaming && streamingText && (
                                    <MessageBubble
                                        message={{
                                            id: 'streaming',
                                            role: 'assistant',
                                            content: streamingText,
                                        }}
                                        isStreaming
                                        t={t}
                                        docRefs={docRefs}
                                        onDocClick={openDocPreview}
                                        onProposalClick={(text) => {
                                            setInput(text);
                                            inputRef.current?.focus();
                                        }}
                                    />
                                )}

                                {isStreaming && !streamingText && (
                                    <div className="flex items-center gap-3 text-muted-foreground text-sm">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-violet-500/10">
                                            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                                        </div>
                                        {reasoningSteps.length > 0
                                            ? reasoningSteps[reasoningSteps.length - 1].summary ?? t('chat.thinking')
                                            : t('chat.thinking')
                                        }
                                    </div>
                                )}
                            </>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-50 rounded-xl bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 flex flex-col items-center justify-center animate-in fade-in">
                            <Plus className="h-12 w-12 text-primary/50 mb-2" />
                            <p className="text-lg font-medium text-foreground">Drop files to attach</p>
                        </div>
                    )}

                    {/* Error banner */}
                    {error && (
                        <div className="mx-4 mb-2 px-4 py-2 bg-destructive/10 text-destructive text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Input area */}
                    <Card
                        className={cn("mx-4 mb-4 p-3 shadow-lg border-border/50 relative transition-all", isDragging && "border-primary/50 ring-1 ring-primary/20")}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="flex gap-3 items-end">
                            {/* Model selector */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs text-muted-foreground h-[40px]">
                                        {TIER_LABELS[selectedModel] ?? selectedModel}
                                        <ChevronDown className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-52">
                                    <DropdownMenuLabel>{t('chat.model')}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                                        {availableModels.length > 0 ? (
                                            availableModels.map((m) => (
                                                <DropdownMenuRadioItem key={m.tier} value={m.tier}>
                                                    <div>
                                                        <div className="font-medium">{TIER_LABELS[m.tier] ?? m.tier}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {m.id} · {TIER_DESCRIPTIONS[m.tier]}
                                                        </div>
                                                    </div>
                                                </DropdownMenuRadioItem>
                                            ))
                                        ) : (
                                            ['low', 'medium', 'high', 'reasoning'].map((tier) => (
                                                <DropdownMenuRadioItem key={tier} value={tier}>
                                                    <div>
                                                        <div className="font-medium">{TIER_LABELS[tier]}</div>
                                                        <div className="text-xs text-muted-foreground">{TIER_DESCRIPTIONS[tier]}</div>
                                                    </div>
                                                </DropdownMenuRadioItem>
                                            ))
                                        )}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Tool toggle */}
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`shrink-0 gap-1 text-xs h-[40px] ${enabledTools.size < MCP_TOOLS.length
                                        ? 'text-amber-500'
                                        : 'text-muted-foreground'
                                        }`}
                                    onClick={() => setShowToolPanel(!showToolPanel)}
                                    title="MCP Tools"
                                >
                                    <Wrench className="h-3.5 w-3.5" />
                                    {enabledTools.size}/{MCP_TOOLS.length}
                                </Button>
                                {showToolPanel && (
                                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border/50 rounded-xl shadow-xl p-3 z-50 animate-scale-in">
                                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                                            <span>MCP Tools</span>
                                            <button
                                                onClick={() => {
                                                    if (enabledTools.size === MCP_TOOLS.length) {
                                                        setEnabledTools(new Set());
                                                    } else {
                                                        setEnabledTools(new Set(MCP_TOOLS.map(t => t.id)));
                                                    }
                                                }}
                                                className="text-[10px] hover:text-foreground transition-colors"
                                            >
                                                {enabledTools.size === MCP_TOOLS.length ? 'Deaktivér alle' : 'Aktivér alle'}
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {MCP_TOOLS.map(tool => (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => toggleTool(tool.id)}
                                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${enabledTools.has(tool.id)
                                                        ? 'bg-primary/10 text-primary border border-primary/20'
                                                        : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
                                                        }`}
                                                >
                                                    <span>{tool.icon}</span>
                                                    <div className="flex-1 text-left">
                                                        <div className="font-medium">{tool.label}</div>
                                                        <div className="text-[10px] opacity-60">{tool.description}</div>
                                                    </div>
                                                    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${enabledTools.has(tool.id)
                                                        ? 'bg-primary border-primary'
                                                        : 'border-muted-foreground/30'
                                                        }`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="h-6 w-px bg-border/30" />

                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 gap-1 text-xs h-[40px] text-muted-foreground hover:text-foreground"
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach Files"
                                disabled={isStreaming}
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>

                            {/* Slash Command Popover */}
                            {showSlashMenu && (
                                <div className="absolute bottom-[calc(100%+8px)] left-0 w-80 max-h-64 overflow-y-auto bg-background/95 backdrop-blur-md border border-border/50 rounded-xl shadow-xl flex flex-col p-1 z-50">
                                    {filteredUseCases.length === 0 ? (
                                        <div className="text-xs text-muted-foreground p-3 text-center">
                                            Ingen matchende skabeloner.
                                        </div>
                                    ) : (
                                        filteredUseCases.map((uc, i) => (
                                            <button
                                                key={uc.id}
                                                onClick={() => applySlashCommand(uc)}
                                                className={`flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${i === slashIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-foreground'}`}
                                            >
                                                <div className="mt-0.5 shrink-0 opacity-80">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="text-xs font-semibold truncate leading-tight">
                                                        /{uc.slug}
                                                    </div>
                                                    <div className={`text-[10px] truncate leading-tight mt-0.5 ${i === slashIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                        {uc.label}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                                <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder={t('chat.placeholder')}
                                rows={1}
                                className="flex-1 resize-none bg-transparent outline-none text-sm min-h-[40px] max-h-[120px] py-2 placeholder:text-muted-foreground/50"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
                                disabled={isStreaming}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!input.trim() || isStreaming || hasFilesProcessing}
                                size="sm"
                                className="shrink-0 gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                            >
                                {isStreaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                {t('chat.send')}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Right Attachment Panel */}
                <AttachmentPanel
                    files={attachedFiles}
                    onCloseFile={removeFile}
                    onReorder={onReorderFiles}
                    activeTabId={activeTabId}
                    setActiveTabId={setActiveTabId}
                    width={leftPanelWidth}
                    onResizeStart={onLeftPanelResizeStart}
                    side="right"
                />
            </div>
        </>
    );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr?: string, t?: (key: string, params?: Record<string, string>) => string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t?.('time.justNow') ?? 'just now';
    if (mins < 60) return t?.('time.minutesAgo', { count: String(mins) }) ?? `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t?.('time.hoursAgo', { count: String(hrs) }) ?? `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return t?.('time.daysAgo', { count: String(days) }) ?? `${days}d ago`;
}

// ─── Reasoning Steps UI ────────────────────────────────────────

function getToolIcon(toolName?: string, type?: string) {
    if (type === 'status') return <Loader2 className="h-3.5 w-3.5" />;
    switch (toolName) {
        case 'search_web': return <Globe className="h-3.5 w-3.5" />;
        case 'rag_search': return <BookOpen className="h-3.5 w-3.5" />;
        case 'search_properties': return <Database className="h-3.5 w-3.5" />;
        default: return <Wrench className="h-3.5 w-3.5" />;
    }
}

function getToolLabel(step: ReasoningStep): string {
    if (step.type === 'status') return step.message ?? 'Processing...';
    if (step.type === 'tool_result' && step.summary) return step.summary;
    switch (step.toolName) {
        case 'search_web':
            return step.type === 'tool_call'
                ? `Searching the web for "${step.args?.query ?? ''}"`
                : 'Web search complete';
        case 'rag_search':
            return step.type === 'tool_call'
                ? `Searching documents for "${step.args?.query ?? ''}"`
                : 'Document search complete';
        case 'search_properties':
            return step.type === 'tool_call'
                ? 'Searching properties...'
                : 'Property search complete';
        case 'get_property':
            return step.type === 'tool_call'
                ? 'Fetching property details...'
                : 'Property details loaded';
        case 'compute_yield':
            return step.type === 'tool_call'
                ? 'Computing yield...'
                : 'Yield calculated';
        case 'list_documents':
            return step.type === 'tool_call'
                ? 'Loading document list...'
                : 'Documents loaded';
        default:
            return step.type === 'tool_call'
                ? `Running ${step.toolName}...`
                : `${step.toolName} complete`;
    }
}

function ReasoningStepsUI({ steps }: { steps: ReasoningStep[] }) {
    return (
        <div className="ml-11 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
            {steps.map((step) => (
                <div
                    key={step.id}
                    className={cn(
                        'flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg transition-all max-w-lg',
                        step.type === 'tool_call'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                    )}
                >
                    {step.type === 'tool_call' ? (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    ) : (
                        <Check className="h-3 w-3 shrink-0" />
                    )}
                    {getToolIcon(step.toolName, step.type)}
                    <span className="truncate">{getToolLabel(step)}</span>
                </div>
            ))}
        </div>
    );
}

// ─── MessageBubble ─────────────────────────────────────────────

function MessageBubble({ message, isStreaming, t, docRefs, onDocClick, onProposalClick }: {
    message: Message;
    isStreaming?: boolean;
    t: (key: string, params?: Record<string, string>) => string;
    docRefs?: Record<string, string>;
    onDocClick?: (filename: string) => void;
    onProposalClick?: (text: string) => void;
}) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    // Custom markdown components to make document references clickable
    const markdownComponents = {
        // Intercept anchor links — AI often generates [filename.pdf](#) style links
        a: ({ children, href, ...props }: any) => {
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
            const isSource = href === '#source' || href?.startsWith('#source-') || text.match(/\.(pdf|docx|xlsx|csv|pptx)$/i) || text.match(/^\[?\d+\]?$/);
            
            // Explicit download links generated by the AI (match with or without leading slash)
            const blobMatch = href?.match(/\/?api\/blobs\/([a-f0-9-]+)/i);
            if (blobMatch) {
                const blobId = blobMatch[1];
                const downloadUrl = `/api/blobs/${blobId}`;
                const handleDownload = async (e: React.MouseEvent) => {
                    e.preventDefault();
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.classList.add('opacity-50');
                    btn.textContent = 'Downloading...';
                    try {
                        const res = await fetch(downloadUrl);
                        if (!res.ok) throw new Error('Download failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // Extract filename from link text (e.g. "Download Hello World.docx" -> "Hello World.docx")
                        const linkText = text.replace(/^download\s+/i, '').trim();
                        a.download = linkText || 'document';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    } catch (err) {
                        console.error('Download failed:', err);
                        window.open(downloadUrl, '_blank');
                    } finally {
                        btn.classList.remove('opacity-50');
                    }
                };
                return (
                    <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm border border-primary/20 no-underline shadow-sm cursor-pointer"
                        title={`Download: ${text}`}
                    >
                        <FileText className="h-4 w-4 shrink-0" />
                        {children}
                    </button>
                );
            }

            if (isSource && onDocClick) {
                return (
                    <button
                        onClick={(e) => { e.preventDefault(); onDocClick(text); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer text-xs font-mono border border-primary/20"
                        title={`View source: ${text}`}
                    >
                        <FileText className="h-3 w-3 inline shrink-0" />
                        {children}
                    </button>
                );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4" {...props}>{children}</a>;
        },
        code: ({ children, ...props }: any) => {
            const text = String(children).trim();
            if (text.match(/\.(pdf|docx|xlsx|csv)$/i) && onDocClick) {
                return (
                    <button
                        onClick={() => onDocClick(text)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer font-mono text-xs border border-primary/20"
                        title={`Open ${text}`}
                    >
                        <FileText className="h-3 w-3" />
                        {text}
                    </button>
                );
            }
            
            // Suggested action interceptor for inline code containing emojis like 📄, ✅, ✨
            if ((/^[\u{1F4C4}\u{2705}\u{2728}\u{1F4A1}]/u).test(text) && onProposalClick) {
                return (
                    <button
                        onClick={(e) => { e.preventDefault(); onProposalClick(text.replace(/^[\u{1F4C4}\u{2705}\u{2728}\u{1F4A1}\s]+/u, '').trim()); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer text-sm font-medium border border-blue-500/20 text-left w-auto max-w-full shadow-sm"
                        title="Click to use this suggestion"
                    >
                        {text}
                    </button>
                );
            }
            
            return <code {...props}>{children}</code>;
        },
        // Intercept paragraph text to find filename patterns
        p: ({ children, ...props }: any) => {
            if (onDocClick && typeof children === 'string') {
                const text = String(children);
                // Match filenames like ID18195.pdf or [something.pdf]
                const parts = text.split(/(\b\w+\.pdf\b|\[\w+\.pdf\])/gi);
                if (parts.length > 1) {
                    return (
                        <p {...props}>
                            {parts.map((part, i) => {
                                const clean = part.replace(/^\[|\]$/g, '');
                                if (clean.match(/\.pdf$/i)) {
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => onDocClick(clean)}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer text-xs border border-primary/20 mx-0.5"
                                            title={`Open ${clean}`}
                                        >
                                            <FileText className="h-3 w-3" />
                                            {clean}
                                        </button>
                                    );
                                }
                                return <span key={i}>{part}</span>;
                            })}
                        </p>
                    );
                }
            }
            return <p {...props}>{children}</p>;
        },
        // Make list items with filenames clickable too
        li: ({ children, ...props }: any) => {
            if (!onDocClick) return <li {...props}>{children}</li>;
            // Process children recursively
            const processNode = (node: any): any => {
                if (typeof node === 'string') {
                    const parts = node.split(/(\b\w+\.pdf\b)/gi);
                    if (parts.length > 1) {
                        return parts.map((part: string, i: number) => {
                            if (part.match(/\.pdf$/i)) {
                                return (
                                    <button
                                        key={i}
                                        onClick={() => onDocClick(part)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer text-xs border border-primary/20 mx-0.5"
                                        title={`Open ${part}`}
                                    >
                                        <FileText className="h-3 w-3" />
                                        {part}
                                    </button>
                                );
                            }
                            return part;
                        });
                    }
                }
                return node;
            };
            const processed = Array.isArray(children)
                ? children.map(processNode)
                : processNode(children);
            return <li {...props}>{processed}</li>;
        },
    };

    return (
        <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div
                className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                    }`}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="flex flex-col gap-1 max-w-[75%]">
                {/* Collapsed reasoning steps for completed messages */}
                {!isUser && message.reasoningSteps && message.reasoningSteps.length > 0 && (
                    <details className="text-xs mb-1">
                        <summary className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1 select-none">
                            <Wrench className="h-3 w-3" />
                            {message.reasoningSteps.length} tool{message.reasoningSteps.length !== 1 ? 's' : ''} used
                        </summary>
                        <div className="mt-1 space-y-1">
                            {message.reasoningSteps.map(step => (
                                <div key={step.id} className={cn(
                                    'flex items-center gap-1.5 py-1 px-2 rounded text-[10px]',
                                    step.type === 'tool_result'
                                        ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                        : 'text-muted-foreground/60',
                                )}>
                                    {getToolIcon(step.toolName, step.type)}
                                    <span>{getToolLabel(step)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
                <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted/50 border border-border/50 rounded-bl-md'
                        } ${isStreaming ? 'animate-pulse-subtle' : ''}`}
                >
                    {isUser ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                        <div className="chat-markdown">
                            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>{enhanceMarkdown(message.content)}</Markdown>
                        </div>
                    )}
                </div>
                {/* Meta row — timestamp + copy */}
                <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {message.createdAt && (
                        <span className="text-[10px] text-muted-foreground/60">
                            {relativeTime(message.createdAt, t)}
                        </span>
                    )}
                    {!isUser && !isStreaming && (
                        <button
                            onClick={copyToClipboard}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            title={t('chat.copyMessage')}
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
