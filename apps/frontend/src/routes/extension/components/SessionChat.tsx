/**
 * SessionChat — Step-scoped chat for workflow sessions.
 *
 * Sends messages to the workflow session chat endpoint (not /ai/chat).
 * Parses SSE stream. Detects `_formUpdate` blocks and triggers a session
 * refresh so the DynamicForm picks up AI-extracted data.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enhanceMarkdown } from '@/lib/utils';
import { BASE_URL } from '@/lib/api';
import { useExtensionDebug } from '@/core/extension/ExtensionDebugContext';

type Message = { id?: string; role: 'user' | 'assistant' | 'system'; content: string };

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export function SessionChat({
    sessionId,
    stepIndex,
    currentTaskTitle,
    initialMessages,
    onDataUpdated,
    pageContext,
}: {
    sessionId: string;
    stepIndex: number;
    currentTaskTitle?: string;
    initialMessages: Message[];
    onDataUpdated: () => void;
    pageContext?: { url?: string; title?: string; textContent?: string; selectedText?: string } | null;
}) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { enabled: debugEnabled } = useExtensionDebug();

    // Reset messages when step changes (new step = fresh chat within that step)
    useEffect(() => {
        setMessages(initialMessages);
        setStreamingText('');
    }, [stepIndex, sessionId]);

    // Re-sync if initialMessages change (e.g. after session refetch)
    useEffect(() => {
        if (!loading) {
            setMessages(initialMessages);
        }
    }, [initialMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText, loading]);

    // Focus input on mount and step change
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [stepIndex]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMessage: Message = { role: 'user', content: text };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setStreamingText('');

        try {
            const res = await fetch(
                `${BASE_URL}/module/tool-management-tools/sessions/${sessionId}/chat`,
                {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        messages: [userMessage],
                        ...(pageContext ? { pageContext } : {}),
                    }),
                },
            );

            if (!res.ok) throw new Error('Chat failed');

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    if (line === 'data: [DONE]') {
                        // Stream complete — trigger session refresh for _formUpdate
                        onDataUpdated();
                        continue;
                    }
                    const jsonStr = line.slice(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        if (event.type === 'text') {
                            accumulatedText += event.content;
                            setStreamingText(accumulatedText);
                            setActiveToolCall(null);
                        } else if (event.type === 'tool_call') {
                            setActiveToolCall(`🔧 ${event.toolName}…`);
                        } else if (event.type === 'tool_result') {
                            setActiveToolCall(null);
                        } else if (event.type === 'error') {
                            accumulatedText += `\n\n⚠️ *${event.error || 'An error occurred'}*`;
                            setStreamingText(accumulatedText);
                        }
                    } catch {
                        // skip parse errors
                    }
                }
            }

            // Commit the streamed message
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: accumulatedText },
            ]);
            setStreamingText('');
        } catch (e) {
            console.error('Chat error', e);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'An error occurred. Please try again.' },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [input, loading, sessionId, onDataUpdated]);

    // Clean _formUpdate JSON blocks from display (keep in debug mode)
    const cleanContent = (content: string) => {
        if (debugEnabled) {
            return content.replace(
                /```json\n(\{\s*"_formUpdate"[\s\S]*?\})\s*\n```/g,
                '> 🔄 **Form Update:**\n> ```json\n> $1\n> ```',
            ).trim();
        }
        return content.replace(/```json\n\{\s*"_formUpdate"[\s\S]*?\n```/g, '').trim();
    };

    const isEmpty = messages.length === 0 && !loading;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {isEmpty && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{currentTaskTitle || 'Current Step'}</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                                Chat with the AI to gather the required information for this step.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const cleaned = cleanContent(m.content);
                    if (!cleaned) return null;

                    return (
                        <div key={i} className={`flex gap-2 text-sm ${isUser ? 'flex-row-reverse' : ''}`}>
                            <div
                                className={`p-1 rounded-md self-end shrink-0 ${
                                    isUser
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                            </div>
                            <div
                                className={`py-2 px-3 rounded-2xl max-w-[85%] ${
                                    isUser
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted rounded-bl-sm'
                                }`}
                            >
                                <div className="prose prose-sm dark:prose-invert break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {enhanceMarkdown(cleaned)}
                                    </Markdown>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Streaming indicator */}
                {loading && streamingText && (
                    <div className="flex gap-2 text-sm">
                        <div className="p-1 rounded-md self-end shrink-0 bg-muted text-muted-foreground">
                            <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="py-2 px-3 rounded-2xl rounded-bl-sm bg-muted max-w-[85%]">
                            <div className="prose prose-sm dark:prose-invert break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                    {enhanceMarkdown(cleanContent(streamingText))}
                                </Markdown>
                            </div>
                        </div>
                    </div>
                )}

                {loading && !streamingText && (
                    <div className="flex items-center gap-2 px-2 py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground animate-pulse">Thinking...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="relative">
                    <input
                        ref={inputRef}
                        className="w-full pl-3 pr-9 py-2 text-sm rounded-full bg-zinc-100 dark:bg-zinc-900 border-none focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Discuss this step..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={loading}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-0.5 top-0.5 h-7 w-7 rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                    >
                        <Send className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
