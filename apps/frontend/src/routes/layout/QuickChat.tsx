/**
 * Quick Chat Flyover (Phase 5.7)
 *
 * A lightweight chat widget that opens as a 420px panel anchored to the toolbar.
 * Messages stream from the backend and the conversation is tracked server-side.
 * Clicking "Save" opens the conversation in /chat/:id and clears Quick Chat.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
    MessageSquare, Send, X, Loader2, Bot, User, Sparkles, Save, Lightbulb,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { BASE_URL, api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

const API_BASE = BASE_URL;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = api.getTenantId();
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    return headers;
}

interface QuickMessage {
    role: 'user' | 'assistant';
    content: string;
}

export function QuickChat() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<QuickMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input when opening
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    const handleClose = useCallback(() => {
        setOpen(false);
        // Don't clear messages so the user can reopen and see context
    }, []);

    const handleClear = useCallback(() => {
        setMessages([]);
        setConversationId(null);
    }, []);

    const handleSave = useCallback(() => {
        if (!conversationId) return;
        const savedId = conversationId;
        // Clear quick chat immediately so it's fresh for next use
        setMessages([]);
        setConversationId(null);
        setOpen(false);
        // Navigate to the saved conversation in full chat
        navigate(`/chat/${savedId}`);
    }, [conversationId, navigate]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || streaming) return;

        const userMessage: QuickMessage = { role: 'user', content: text };
        const assistantMessage: QuickMessage = { role: 'assistant', content: '' };

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInput('');
        setStreaming(true);

        try {
            // Use same contract as /chat — { message, conversationId, model }
            const response = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message: text,
                    conversationId: conversationId,
                    model: 'medium',
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Chat request failed: ${response.status}`);
            }

            // Parse Surdej SSE events: { type: "meta"|"text"|"done"|"error", ... }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep the last potentially incomplete line in the buffer
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);

                    try {
                        const event = JSON.parse(jsonStr);

                        if (event.type === 'meta' && event.conversationId) {
                            // Persist the conversation ID so we can deep-link later
                            setConversationId(event.conversationId);
                        } else if (event.type === 'text') {
                            accumulated += event.content;
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: 'assistant',
                                    content: accumulated,
                                };
                                return updated;
                            });
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        }
                        // 'done' with usage is silently accepted for quick chat
                    } catch (e) {
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }
        } catch (err) {
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: `⚠️ ${err instanceof Error ? err.message : 'Connection error'}`,
                };
                return updated;
            });
        } finally {
            setStreaming(false);
        }
    }, [input, streaming, conversationId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasConversation = messages.length > 0;

    return (
        <div className="relative">
            {/* Trigger Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(!open)}
                className={`h-8 w-8 transition-colors ${open ? 'text-primary' : ''}`}
                aria-label={t('quickChat.title')}
            >
                <MessageSquare className="h-4 w-4" />
                {/* Dot indicator when there's an active conversation */}
                {conversationId && !open && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
            </Button>

            {/* Flyover Panel */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={handleClose} />

                    {/* Panel */}
                    <div
                        className="absolute right-0 top-10 z-50 w-[420px] bg-background border rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-top-2 fade-in duration-200"
                        style={{ maxHeight: 'calc(100vh - 120px)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm">{t('quickChat.title')}</span>
                                {hasConversation && (
                                    <span className="text-[10px] text-muted-foreground/60">
                                        {t('quickChat.messages', { count: messages.filter(m => m.role === 'user').length })}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {conversationId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/30"
                                        onClick={handleSave}
                                        title={t('quickChat.saveTitle')}
                                    >
                                        <Save className="h-3 w-3" />
                                        {t('quickChat.save')}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                                    onClick={() => { handleClose(); navigate('/feedback'); }}
                                    title={t('quickChat.sendFeedback')}
                                >
                                    <Lightbulb className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[400px]">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Bot className="h-8 w-8 text-muted-foreground/20 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        {t('quickChat.emptyState')}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                                        {t('quickChat.emptyHint')}
                                    </p>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="shrink-0 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center mt-0.5">
                                            <Bot className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                            }`}
                                    >
                                        {msg.role === 'assistant' && !msg.content && streaming && i === messages.length - 1 ? (
                                            <div className="flex items-center gap-1.5">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span className="text-xs text-muted-foreground">{t('quickChat.thinking')}</span>
                                            </div>
                                        ) : msg.role === 'assistant' ? (
                                            <div className="chat-markdown text-sm">
                                                <Markdown>{msg.content}</Markdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="shrink-0 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center mt-0.5">
                                            <User className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="border-t px-3 py-2.5">
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t('quickChat.placeholder')}
                                    rows={1}
                                    className="flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary max-h-[100px]"
                                    style={{ minHeight: '36px' }}
                                />
                                <Button
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={handleSend}
                                    disabled={!input.trim() || streaming}
                                >
                                    {streaming ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5 px-1">
                                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                    {t('quickChat.balanced')}
                                    {conversationId && (
                                        <>
                                            <span className="mx-0.5">·</span>
                                            <span className="text-emerald-500/70">● {t('common.saved')}</span>
                                        </>
                                    )}
                                </span>
                                {hasConversation && (
                                    <button
                                        onClick={handleClear}
                                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                    >
                                        {t('common.newChat')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
