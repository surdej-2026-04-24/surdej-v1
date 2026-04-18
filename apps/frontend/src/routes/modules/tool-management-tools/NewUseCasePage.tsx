import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Bot, User, Loader2, Send, Wand2, FlaskConical, CircleDot, Bug, Play, RotateCcw, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createUseCase, createVersion, createTask, fetchUseCase, updateUseCase, deleteTask, fetchTasks } from './use-case-api';
import { WizardQuestionsForm, parseWizardQuestions, type WizardQuestions } from './WizardQuestionsForm';
import { WorkflowSimulator, type SimulationData } from './WorkflowSimulator';
import { useNosqlApi } from '@surdej/module-member-nosql-ui';
import Markdown from 'react-markdown';
import { BASE_URL } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

const WIZARD_DEBUG_CHANNEL = 'wizard-debug';
const SESSION_KEY = 'wizard-state';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

type InteractionEntry = {
    type: 'user-message' | 'form-submit';
    content: string;
    timestamp: number;
};

type WizardProposal = {
    slug: string;
    label: string;
    description: string;
    icon: string;
    workflowMode: boolean;
    promptTemplate?: string;
    tools?: string[];
    modelTier?: string;
    tasks?: Array<{
        title: string;
        systemPrompt: string;
        allowedTools: string[];
        dataSchema: any;
        seedData?: Record<string, unknown>;
        userHint?: string;
    }>;
};

function loadSessionState(): { messages: Message[]; proposal: WizardProposal | null; systemPrompt: string | null } | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export function NewUseCasePage() {
    const navigate = useNavigate();
    const { useCaseId } = useParams<{ useCaseId?: string }>();
    const isEditMode = !!useCaseId;
    const { t, locale } = useTranslation();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingUseCase, setLoadingUseCase] = useState(isEditMode);

    const saved = useRef(loadSessionState());

    const [messages, setMessages] = useState<Message[]>(
        saved.current?.messages ?? [{ role: 'assistant', content: '' }]
    );
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [proposal, setProposal] = useState<WizardProposal | null>(saved.current?.proposal ?? null);
    const [systemPrompt, setSystemPrompt] = useState<string | null>(saved.current?.systemPrompt ?? null);

    const [interactions, setInteractions] = useState<InteractionEntry[]>([]);
    const [showSimulator, setShowSimulator] = useState(false);
    const [simulationData, setSimulationData] = useState<SimulationData>({});
    const [sessionDocId, setSessionDocId] = useState<string | null>(null);
    const [hasExtension, setHasExtension] = useState(false);

    useEffect(() => {
        setHasExtension(document.documentElement.hasAttribute('data-surdej-extension'));
    }, []);

    // Load existing use case in edit mode
    useEffect(() => {
        if (!useCaseId) return;
        let active = true;
        (async () => {
            try {
                const uc = await fetchUseCase(useCaseId);
                const latestVersion = uc.versions.sort((a, b) => b.version - a.version)[0];
                const tasksRes = uc.tasks && uc.tasks.length > 0
                    ? uc.tasks
                    : (await fetchTasks(useCaseId)).items;

                const editProposal: WizardProposal = {
                    slug: uc.slug,
                    label: uc.label,
                    description: uc.description || '',
                    icon: uc.icon || 'FlaskConical',
                    workflowMode: uc.workflowMode ?? false,
                    promptTemplate: latestVersion?.promptTemplate,
                    tools: latestVersion?.tools,
                    modelTier: latestVersion?.modelTier,
                    tasks: tasksRes?.map((task: any) => ({
                        title: task.title,
                        systemPrompt: task.systemPrompt,
                        allowedTools: task.allowedTools || [],
                        dataSchema: task.dataSchema || { type: 'object', properties: {} },
                        seedData: task.seedData || undefined,
                        userHint: task.userHint || undefined,
                    })),
                };

                if (active) {
                    setProposal(editProposal);
                    setMessages([{
                        role: 'assistant',
                        content: `Loaded existing workflow **${uc.label}** for editing. You can continue the conversation to modify it, or save directly.`,
                    }]);
                    setLoadingUseCase(false);
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Failed to load use case');
                    setLoadingUseCase(false);
                }
            }
        })();
        return () => { active = false; };
    }, [useCaseId]);

    const nosql = useNosqlApi();

    // Derive pending questions from the last assistant message (more reliable than state)
    const pendingQuestions = useMemo(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role !== 'assistant' || !lastMsg.content) return null;
        const { questions } = parseWizardQuestions(lastMsg.content);
        return questions;
    }, [messages]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debugChannelRef = useRef<BroadcastChannel | null>(null);

    // ─── Debug channel: broadcast state to debug window ───
    useEffect(() => {
        const channel = new BroadcastChannel(WIZARD_DEBUG_CHANNEL);
        debugChannelRef.current = channel;

        // Listen for state requests from debug window
        channel.onmessage = () => {
            channel.postMessage({ messages, proposal, streaming: loading, streamingText, systemPrompt, locale, interactions, simulationData, sessionDocId, timestamp: Date.now() });
        };

        return () => { channel.close(); debugChannelRef.current = null; };
    }, []);

    // Broadcast state changes to debug window
    useEffect(() => {
        debugChannelRef.current?.postMessage({
            messages, proposal, streaming: loading, streamingText, systemPrompt, locale, interactions, simulationData, sessionDocId, timestamp: Date.now(),
        });
    }, [messages, proposal, loading, streamingText, systemPrompt, locale, interactions, simulationData, sessionDocId]);

    // Persist simulation data to NoSQL
    const NOSQL_COLLECTION_SLUG = 'workflow-wizard-sessions';
    const persistToNosql = useCallback(async (data: SimulationData) => {
        try {
            const docData = {
                proposal: proposal ? { slug: proposal.slug, label: proposal.label, description: proposal.description } : null,
                simulationData: data,
                locale,
                updatedAt: new Date().toISOString(),
            };

            if (sessionDocId) {
                await nosql.updateDocument(sessionDocId, { data: docData });
            } else {
                // Find or create the collection
                const { items } = await nosql.listCollections();
                let col = items.find((c) => c.slug === NOSQL_COLLECTION_SLUG);
                if (!col) {
                    col = await nosql.createCollection({ name: 'Workflow Wizard Sessions', slug: NOSQL_COLLECTION_SLUG });
                }
                const doc = await nosql.createDocument(col.id, { data: docData });
                setSessionDocId(doc.id);
            }
        } catch (e) {
            console.warn('Failed to persist wizard session to NoSQL:', e);
        }
    }, [sessionDocId, proposal, locale, nosql]);

    // Persist interim state to sessionStorage
    useEffect(() => {
        if (loading) return; // don't save mid-stream
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, proposal, systemPrompt }));
        } catch { /* quota exceeded — ignore */ }
    }, [messages, proposal, systemPrompt, loading, interactions]);

    const openDebugWindow = useCallback(() => {
        window.open(
            `${window.location.origin}/modules/workflow/wizard-debug`,
            '_blank',
            'noopener',
        );
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText, loading]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        if (!text || loading) return;

        setInteractions((prev) => [...prev, { type: 'user-message', content: text, timestamp: Date.now() }]);
        const userMessage: Message = { role: 'user', content: text };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setLoading(true);
        setStreamingText('');

        try {
            const res = await fetch(
                `${BASE_URL}/module/tool-management-tools/use-cases/wizard/chat`,
                {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ messages: newMessages, locale }),
                },
            );

            if (!res.ok) throw new Error('Chat failed');

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            let currentProposal: WizardProposal | null = proposal;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    if (line === 'data: [DONE]') continue;
                    
                    const jsonStr = line.slice(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        if (event.type === 'system_prompt') {
                            setSystemPrompt(event.content);
                        } else if (event.type === 'text') {
                            accumulatedText += event.content;
                            setStreamingText(accumulatedText);
                            
                            // Check for _wizardProposal live
                            const match = accumulatedText.match(/```json\n\{\s*"_wizardProposal"[\s\S]*?\n```/);
                            if (match) {
                                try {
                                    const jsonStr = match[0].replace(/```json\n|\n```/g, '');
                                    const parsed = JSON.parse(jsonStr);
                                    if (parsed._wizardProposal) {
                                        currentProposal = parsed._wizardProposal;
                                        setProposal(currentProposal);
                                    }
                                } catch {
                                    // ignore incomplete json
                                }
                            }
                        } else if (event.type === 'error') {
                            accumulatedText += `\n\n⚠️ *${event.error || 'An error occurred'}*`;
                            setStreamingText(accumulatedText);
                        }
                    } catch {
                        // ignore empty lines
                    }
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: accumulatedText },
            ]);
            setStreamingText('');
        } catch (e) {
            console.error('Chat error', e);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: t('workflow.wizardError') },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [loading, messages, proposal]);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (text) sendMessage(text);
    }, [input, sendMessage]);

    const handleFormSubmit = useCallback((formattedAnswers: string) => {
        setInteractions((prev) => [...prev, { type: 'form-submit', content: formattedAnswers, timestamp: Date.now() }]);
        sendMessage(formattedAnswers);
    }, [sendMessage]);


    const handleResetWizard = useCallback(() => {
        setMessages([{ role: 'assistant', content: '' }]);
        setProposal(null);
        setSystemPrompt(null);
        setStreamingText('');
        setError(null);
        setInteractions([]);
        setSimulationData({});
        setSessionDocId(null);
        sessionStorage.removeItem(SESSION_KEY);
    }, []);

    const handleSave = async (openInExtension = false) => {
        if (!proposal) return;
        setSaving(true);
        setError(null);
        try {
            let targetId: string;

            if (isEditMode && useCaseId) {
                // ─── Update existing use case ───
                targetId = useCaseId;
                await updateUseCase(useCaseId, {
                    label: proposal.label,
                    description: proposal.description || undefined,
                    icon: proposal.icon || undefined,
                    workflowMode: proposal.workflowMode,
                });

                await createVersion(useCaseId, {
                    promptTemplate: proposal.promptTemplate || proposal.description || proposal.slug,
                    tools: proposal.tools || [],
                    modelTier: (proposal.modelTier as any) || 'medium',
                    changelog: 'Updated via AI Wizard',
                });

                if (proposal.workflowMode && proposal.tasks && proposal.tasks.length > 0) {
                    // Delete existing tasks and recreate
                    const existing = await fetchTasks(useCaseId);
                    for (const task of existing.items) {
                        await deleteTask(useCaseId, task.id);
                    }
                    for (let i = 0; i < proposal.tasks.length; i++) {
                        const task = proposal.tasks[i];
                        await createTask(useCaseId, {
                            taskId: `step-${i + 1}`,
                            title: task.title,
                            sortOrder: i,
                            systemPrompt: task.systemPrompt,
                            allowedTools: task.allowedTools || [],
                            dataSchema: task.dataSchema || { type: 'object', properties: {} },
                            seedData: task.seedData,
                            userHint: task.userHint,
                        });
                    }
                }
            } else {
                // ─── Create new use case ───
                const slug = `${proposal.slug}-${Date.now().toString(36).slice(-4)}`;
                const uc = await createUseCase({
                    slug,
                    label: proposal.label,
                    description: proposal.description || undefined,
                    icon: proposal.icon || undefined,
                    workflowMode: proposal.workflowMode,
                });
                targetId = uc.id;

                await createVersion(uc.id, {
                    promptTemplate: proposal.promptTemplate || proposal.description || slug,
                    tools: proposal.tools || [],
                    modelTier: (proposal.modelTier as any) || 'medium',
                    changelog: 'Created via AI Wizard',
                });

                if (proposal.workflowMode && proposal.tasks && proposal.tasks.length > 0) {
                    for (let i = 0; i < proposal.tasks.length; i++) {
                        const task = proposal.tasks[i];
                        await createTask(uc.id, {
                            taskId: `step-${i + 1}`,
                            title: task.title,
                            sortOrder: i,
                            systemPrompt: task.systemPrompt,
                            allowedTools: task.allowedTools || [],
                            dataSchema: task.dataSchema || { type: 'object', properties: {} },
                            seedData: task.seedData,
                            userHint: task.userHint,
                        });
                    }
                }
            }

            if (openInExtension) {
                window.postMessage({ type: 'SURDEJ_OPEN_SIDEBAR', useCase: targetId }, '*');
            }

            navigate(`/modules/workflow/${targetId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workflow.createFailed'));
        } finally {
            setSaving(false);
        }
    };

    const cleanContent = (content: string) =>
        content
            .replace(/```json\n\{\s*"_wizardProposal"[\s\S]*?\n```/g, '')
            .replace(/```json\n\{\s*"_wizardQuestions"[\s\S]*?\n```/g, '')
            .trim();

    if (loadingUseCase) {
        return (
            <div className="flex flex-col h-full bg-background items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading workflow…</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div className="flex flex-row items-center gap-3">
                    <button
                        onClick={() => navigate(isEditMode ? `/modules/workflow/${useCaseId}` : '/modules/workflow')}
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-primary" />
                        <h1 className="text-lg font-semibold">
                            {isEditMode ? t('workflow.editWizardTitle') : t('workflow.wizardTitle')}
                        </h1>
                        {isEditMode && proposal && (
                            <span className="text-xs text-muted-foreground">— {proposal.label}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {proposal?.workflowMode && proposal.tasks && proposal.tasks.length > 0 && (
                        <button
                            onClick={() => setShowSimulator((v) => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md hover:bg-muted/50 transition-colors ${
                                showSimulator ? 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Toggle workflow simulator"
                        >
                            <Play className="h-3.5 w-3.5" />
                            Simulator
                        </button>
                    )}
                    {hasExtension && proposal && (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50"
                            title="Save and open in browser extension side panel"
                        >
                            <Puzzle className="h-3.5 w-3.5" />
                            Run in Extension
                        </button>
                    )}
                    <button
                        onClick={handleResetWizard}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-muted/50 transition-colors"
                        title="Reset wizard"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={openDebugWindow}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-muted/50 transition-colors"
                        title="Open debug window"
                    >
                        <Bug className="h-3.5 w-3.5" />
                        Debug
                    </button>
                
                    {proposal && (
                        <Button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving
                                ? (isEditMode ? t('workflow.updating') : t('workflow.creating'))
                                : (isEditMode ? t('workflow.updateWorkflow') : t('workflow.saveWorkflow'))}
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm border-b">
                    {error}
                </div>
            )}

            <div className="flex flex-1 min-h-0">
                {/* Left Panel: Chat */}
                <div className="w-1/2 flex flex-col border-r relative">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((m, i) => {
                            const isUser = m.role === 'user';
                            const cleaned = cleanContent(m.content);
                            if (!cleaned && !isUser) return null;

                            return (
                                <div key={i} className={`flex gap-3 text-sm ${isUser ? 'flex-row-reverse' : ''}`}>
                                    <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${isUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                    </div>
                                    <div className={`py-2 px-3 rounded-2xl max-w-[85%] ${isUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                                        <div className="prose prose-sm dark:prose-invert break-words">
                                            <Markdown>{cleaned}</Markdown>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {pendingQuestions && !loading && (
                            <div className="flex gap-3 text-sm">
                                <div className="w-8 shrink-0" />
                                <div className="py-3 px-4 rounded-2xl bg-muted/50 border rounded-tl-none max-w-[90%]">
                                    <WizardQuestionsForm
                                        questions={pendingQuestions}
                                        onSubmit={handleFormSubmit}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        )}

                        {loading && streamingText && (
                            <div className="flex gap-3 text-sm">
                                <div className="p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                                    <Bot className="h-4 w-4" />
                                </div>
                                <div className="py-2 px-3 rounded-2xl bg-muted rounded-tl-none max-w-[85%]">
                                    <div className="prose prose-sm dark:prose-invert break-words">
                                        <Markdown>{cleanContent(streamingText)}</Markdown>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loading && !streamingText && (
                            <div className="flex items-center gap-2 p-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground animate-pulse">{t('workflow.wizardTyping')}</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-background border-t">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                disabled={loading}
                                placeholder={t('workflow.wizardPlaceholder')}
                                className="w-full pl-4 pr-12 py-3 rounded-full border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="absolute right-1 top-1 bottom-1 h-auto rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Live Preview or Simulator */}
                <div className="w-1/2 bg-muted/10 overflow-y-auto p-6">
                    {showSimulator && proposal?.workflowMode && proposal.tasks && proposal.tasks.length > 0 ? (
                        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Play className="h-5 w-5 text-amber-500" />
                                <h2 className="text-lg font-semibold">Workflow Simulator</h2>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {proposal.label}
                                </span>
                            </div>
                            <WorkflowSimulator
                                tasks={proposal.tasks}
                                onDataChange={(data) => {
                                    setSimulationData(data);
                                    persistToNosql(data);
                                }}
                            />
                        </div>
                    ) : !proposal ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-50">
                            <FlaskConical className="h-16 w-16" />
                            <p className="text-lg">{t('workflow.previewEmpty')}</p>
                        </div>
                    ) : (
                        <div className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-card p-6 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <FlaskConical className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{proposal.label}</h2>
                                        <p className="text-sm text-muted-foreground">{proposal.slug}</p>
                                    </div>
                                </div>
                                <p className="text-sm">{proposal.description}</p>
                                
                                <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 bg-muted rounded-md font-medium">{t('workflow.model').replace('{tier}', proposal.modelTier || '')}</span>
                                    {proposal.workflowMode && (
                                        <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-md font-medium">{t('workflow.workflowMode')}</span>
                                    )}
                                </div>
                            </div>

                            {!proposal.workflowMode ? (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-sm">{t('workflow.systemPrompt')}</h3>
                                    <div className="p-4 bg-muted/30 rounded-lg border text-sm font-mono whitespace-pre-wrap">
                                        {proposal.promptTemplate}
                                    </div>
                                    {proposal.tools && proposal.tools.length > 0 && (
                                        <div className="mt-4">
                                            <h3 className="font-semibold text-sm mb-2">{t('workflow.enabledTools')}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {proposal.tools.map(t => (
                                                    <span key={t} className="px-2 py-1 rounded text-xs border bg-background">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <CircleDot className="h-4 w-4" />
                                        {t('workflow.workflowSteps')}
                                    </h3>
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                                        {proposal.tasks?.map((task, i) => (
                                            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                    <span className="text-xs font-bold">{i + 1}</span>
                                                </div>
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border shadow-sm">
                                                    <h4 className="font-bold text-sm mb-1">{task.title}</h4>
                                                    <div className="text-xs text-muted-foreground mb-3 line-clamp-2" title={task.systemPrompt}>
                                                        {task.systemPrompt}
                                                    </div>
                                                    
                                                    {task.dataSchema?.properties && (
                                                        <div className="mt-2 space-y-1">
                                                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">{t('workflow.extracts')}</div>
                                                            {Object.entries(task.dataSchema.properties).map(([key, prop]: [string, any]) => (
                                                                <div key={key} className="flex items-center gap-2 text-xs">
                                                                    <span className="font-mono bg-muted px-1 rounded">{key}</span>
                                                                    <span className="text-muted-foreground">{prop.type}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {task.allowedTools && task.allowedTools.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-1">
                                                            {task.allowedTools.map(t => (
                                                                <span key={t} className="px-1.5 py-0.5 rounded text-[10px] border bg-background font-mono">{t}</span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {task.userHint && (
                                                        <div className="mt-3 flex items-start gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-1.5 rounded-md">
                                                            <span className="shrink-0">💡</span>
                                                            <span>{task.userHint}</span>
                                                        </div>
                                                    )}

                                                    {task.seedData && Object.keys(task.seedData).length > 0 && (
                                                        <div className="mt-2">
                                                            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Seed Data</div>
                                                            {Object.entries(task.seedData).map(([key, val]) => (
                                                                <div key={key} className="flex items-center gap-2 text-[11px]">
                                                                    <span className="font-mono text-muted-foreground">{key}:</span>
                                                                    <span className="text-foreground truncate">{String(val)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
