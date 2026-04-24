import { useState, useRef, useEffect } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatForm() {
    const api = useModuleApi();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [model, setModel] = useState<'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini'>('gpt-4o');
    const [loading, setLoading] = useState(false);
    const [streamContent, setStreamContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamContent]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);
        setStreamContent('');

        try {
            let accumulated = '';
            await api.chatStream(
                {
                    messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                    model,
                },
                (chunk) => {
                    accumulated += chunk;
                    setStreamContent(accumulated);
                },
                () => {
                    setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
                    setStreamContent('');
                    setLoading(false);
                },
            );
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
            }]);
            setLoading(false);
        }
    };

    return (
        <div className="p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">AI Chat</h2>
                <select value={model} onChange={e => setModel(e.target.value as typeof model)} className="p-2 border rounded text-sm">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px] max-h-[500px]">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                            msg.role === 'user'
                                ? 'bg-primary/10 ml-8'
                                : 'bg-muted mr-8'
                        }`}
                    >
                        <p className="text-xs font-medium text-muted-foreground mb-1 capitalize">{msg.role}</p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                ))}
                {streamContent && (
                    <div className="p-3 rounded-lg bg-muted mr-8">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Assistant</p>
                        <p className="text-sm whitespace-pre-wrap">{streamContent}</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="flex-1 p-2 border rounded"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? '...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
