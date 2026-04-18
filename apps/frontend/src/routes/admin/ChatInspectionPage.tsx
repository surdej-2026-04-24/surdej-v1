/**
 * Admin — Chat Inspection Module
 *
 * VS Code–style layout with activity bar:
 *   - Dashboard view with statistics
 *   - Explorer view: user list → conversation list → chat viewer
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router';
import {
    MessageSquare, Users, BarChart3, DollarSign, Zap, Clock,
    ChevronRight, Cpu, User as UserIcon, ArrowLeft,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────

interface ChatStats {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalCostUsd: number;
    totalRequests: number;
    activeUserCount: number;
    recentConversations: RecentConversation[];
    messagesPerDay: { day: string; count: number }[];
    modelBreakdown: { model: string; requests: number; totalTokens: number; costUsd: number }[];
}

interface RecentConversation {
    id: string;
    title: string | null;
    userId: string;
    model: string;
    messageCount: number;
    lastMessage: string | null;
    updatedAt: string;
}

interface ChatUser {
    userId: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    conversationCount: number;
    lastActive: string | null;
}

interface ChatConversation {
    id: string;
    title: string | null;
    model: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
}

interface ChatMessage {
    id: string;
    role: string;
    content: string;
    model: string | null;
    tokenCount: number | null;
    createdAt: string;
}

type View = 'dashboard' | 'explorer';

// ─── Activity Bar items ────────────────────────────────────────

const ACTIVITY_ITEMS: { id: View; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'explorer', label: 'Explorer', icon: Users },
];

// ─── Component ─────────────────────────────────────────────────

export function ChatInspectionPage() {
    const navigate = useNavigate();
    const [view, setView] = useState<View>('dashboard');
    const [stats, setStats] = useState<ChatStats | null>(null);
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
    const [loading, setLoading] = useState(false);

    // Load stats
    useEffect(() => {
        api.get<ChatStats>('/ai/admin/stats')
            .then(setStats)
            .catch(console.error);
    }, []);

    // Load users when explorer view is opened
    useEffect(() => {
        if (view !== 'explorer') return;
        setLoading(true);
        api.get<ChatUser[]>('/ai/admin/users')
            .then(data => { setUsers(data); setLoading(false); })
            .catch(err => { console.error(err); setLoading(false); });
    }, [view]);

    // Load conversations when user is selected
    const selectUser = async (user: ChatUser) => {
        setSelectedUser(user);
        setSelectedConv(null);
        setLoading(true);
        try {
            const data = await api.get<ChatConversation[]>(`/ai/admin/users/${user.userId}/conversations`);
            setConversations(data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('da-DK', {
        day: 'numeric', month: 'short', year: 'numeric',
    });

    const formatTime = (d: string) => new Date(d).toLocaleTimeString('da-DK', {
        hour: '2-digit', minute: '2-digit',
    });

    const formatTokens = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
        return String(n);
    };

    // ─── Dashboard View ────────────────────────────────────────────

    const renderDashboard = () => {
        if (!stats) return <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Indlæser statistik…</div>;

        return (
            <div className="space-y-6 p-6 overflow-auto animate-fade-in">
                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Samtaler', value: stats.totalConversations, icon: MessageSquare, color: 'from-blue-500 to-indigo-500' },
                        { label: 'Beskeder', value: stats.totalMessages, icon: Zap, color: 'from-amber-500 to-orange-500' },
                        { label: 'Brugere', value: stats.activeUserCount, icon: Users, color: 'from-emerald-500 to-teal-500' },
                        { label: 'Tokens', value: formatTokens(stats.totalTokens), icon: Cpu, color: 'from-violet-500 to-purple-500' },
                        { label: 'Kost (USD)', value: `$${stats.totalCostUsd.toFixed(2)}`, icon: DollarSign, color: 'from-pink-500 to-rose-500' },
                        { label: 'API Kald', value: stats.totalRequests, icon: BarChart3, color: 'from-cyan-500 to-blue-500' },
                    ].map(s => (
                        <Card key={s.label} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                                        <s.icon className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</span>
                                </div>
                                <div className="text-xl font-bold">{s.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Model breakdown + Activity chart */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardContent className="p-5">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-muted-foreground" />
                                Model-fordeling
                            </h3>
                            <div className="space-y-3">
                                {stats.modelBreakdown.map(m => {
                                    const maxReqs = Math.max(...stats.modelBreakdown.map(x => x.requests));
                                    const pct = maxReqs > 0 ? (m.requests / maxReqs) * 100 : 0;
                                    return (
                                        <div key={m.model}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-mono font-medium">{m.model}</span>
                                                <span className="text-muted-foreground">
                                                    {m.requests} kald · {formatTokens(m.totalTokens)} tokens · ${m.costUsd.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-5">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                Beskeder pr. dag (14 dage)
                            </h3>
                            <div className="flex items-end gap-1 h-32">
                                {stats.messagesPerDay.slice().reverse().map((d, i) => {
                                    const max = Math.max(...stats.messagesPerDay.map(x => x.count), 1);
                                    const h = (d.count / max) * 100;
                                    return (
                                        <div
                                            key={i}
                                            className="flex-1 group relative"
                                            title={`${d.day}: ${d.count} beskeder`}
                                        >
                                            <div
                                                className="w-full bg-gradient-to-t from-primary to-primary/40 rounded-t-sm transition-all group-hover:opacity-80"
                                                style={{ height: `${Math.max(h, 2)}%` }}
                                            />
                                            <div className="text-[8px] text-center text-muted-foreground mt-1 truncate">
                                                {new Date(d.day).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent conversations */}
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Seneste samtaler
                        </h3>
                        <div className="space-y-1">
                            {stats.recentConversations.map(c => (
                                <div
                                    key={c.id}
                                    className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer text-xs"
                                    onClick={() => {
                                        setView('explorer');
                                        api.get<ChatUser[]>('/ai/admin/users')
                                            .then((us) => {
                                                setUsers(us);
                                                const u = us.find(x => x.userId === c.userId);
                                                if (u) selectUser(u);
                                            });
                                    }}
                                >
                                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{c.title || 'Untitled'}</span>
                                            <Badge variant="outline" className="text-[9px] px-1">{c.model}</Badge>
                                        </div>
                                        {c.lastMessage && (
                                            <p className="text-muted-foreground truncate text-[10px] mt-0.5">{c.lastMessage}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                                        <span>{c.messageCount} msgs</span>
                                        <span>{formatDate(c.updatedAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    // ─── Explorer View ─────────────────────────────────────────────

    const renderExplorer = () => (
        <div className="flex flex-1 min-h-0 overflow-hidden animate-fade-in">
            {/* Panel 1: User list */}
            <div className={cn(
                "flex flex-col bg-muted/30 transition-all border-r",
                selectedUser ? 'w-56' : 'w-72',
            )}>
                <div className="p-3 border-b bg-background/50">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Users className="h-4 w-4" />
                        Brugere ({users.length})
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading && !users.length && (
                        <div className="p-4 text-xs text-muted-foreground animate-pulse">Indlæser…</div>
                    )}
                    {users.map(user => (
                        <div
                            key={user.userId}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors text-xs",
                                selectedUser?.userId === user.userId
                                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                                    : 'hover:bg-muted/50',
                            )}
                            onClick={() => selectUser(user)}
                        >
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} className="h-6 w-6 rounded-full object-cover" alt="" />
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                    <UserIcon className="h-3 w-3 text-primary" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{user.name}</div>
                                <div className="text-muted-foreground text-[10px]">
                                    {user.conversationCount} samtaler
                                    {user.lastActive && ` · ${formatDate(user.lastActive)}`}
                                </div>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Panel 2: Conversation list */}
            {selectedUser && (
                <div className={cn(
                    "flex flex-col border-r transition-all",
                    selectedConv ? 'w-64' : 'w-80',
                )}>
                    <div className="p-3 border-b bg-background/50">
                        <div className="text-sm font-semibold truncate">{selectedUser.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                            {conversations.length} samtaler
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading && (
                            <div className="p-4 text-xs text-muted-foreground animate-pulse">Indlæser samtaler…</div>
                        )}
                        {conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={cn(
                                    "px-3 py-2.5 cursor-pointer transition-colors border-b border-border/30",
                                    selectedConv?.id === conv.id
                                        ? 'bg-primary/10 border-l-2 border-l-primary'
                                        : 'hover:bg-muted/30',
                                )}
                                onClick={() => setSelectedConv(conv)}
                            >
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-medium truncate flex-1">{conv.title || 'Untitled'}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground ml-5">
                                    <Badge variant="outline" className="text-[8px] px-1 py-0">{conv.model}</Badge>
                                    <span>{conv.messageCount} msgs</span>
                                    <span>{formatDate(conv.updatedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Panel 3: Chat viewer */}
            {selectedConv ? (
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-3 border-b bg-background/50 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{selectedConv.title || 'Untitled'}</div>
                            <div className="text-[10px] text-muted-foreground">
                                {selectedConv.messageCount} beskeder · {selectedConv.model} ·
                                {formatDate(selectedConv.createdAt)} {formatTime(selectedConv.createdAt)}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedConv.messages.map(msg => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex gap-3",
                                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                                )}
                            >
                                <div className={cn(
                                    "max-w-[80%] rounded-lg px-4 py-2.5 text-xs leading-relaxed",
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : msg.role === 'system'
                                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-bl-none'
                                            : 'bg-muted rounded-bl-none',
                                )}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "text-[9px] uppercase tracking-wider font-bold",
                                            msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                                        )}>
                                            {msg.role}
                                        </span>
                                        <span className={cn(
                                            "text-[9px]",
                                            msg.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/50',
                                        )}>
                                            {formatTime(msg.createdAt)}
                                        </span>
                                        {msg.tokenCount && (
                                            <span className={cn(
                                                "text-[9px]",
                                                msg.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/50',
                                            )}>
                                                {msg.tokenCount} tokens
                                            </span>
                                        )}
                                    </div>
                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    {selectedUser
                        ? '← Vælg en samtale for at se chat-historikken'
                        : '← Vælg en bruger for at se deres samtaler'
                    }
                </div>
            )}
        </div>
    );

    // ─── Layout (VS Code–style) ────────────────────────────────────

    const activeLabel = ACTIVITY_ITEMS.find(i => i.id === view)?.label ?? 'Dashboard';

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* ── Top bar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Admin
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Tilbage til Admin</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-semibold">Chat Inspektion</span>
                </div>

                {stats && (
                    <div className="flex items-center gap-1.5 ml-1">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {stats.totalConversations} samtaler
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {stats.activeUserCount} brugere
                        </Badge>
                    </div>
                )}

                <div className="flex-1" />

                <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">
                    {activeLabel}
                </Badge>
            </div>

            {/* ── Main area: activity bar + content ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Activity bar */}
                <div className="w-12 border-r bg-muted/20 flex flex-col items-center py-2 gap-1 shrink-0">
                    {ACTIVITY_ITEMS.map((item) => {
                        const isItemActive = view === item.id;
                        const Icon = item.icon;

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            setView(item.id);
                                            if (item.id === 'dashboard') {
                                                setSelectedUser(null);
                                                setSelectedConv(null);
                                            }
                                        }}
                                        className={cn(
                                            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150',
                                            isItemActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                                        )}
                                    >
                                        {/* Active indicator bar */}
                                        {isItemActive && (
                                            <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                                        )}
                                        <Icon className="h-5 w-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right">{item.label}</TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>

                {/* Content area */}
                {view === 'dashboard' ? (
                    <div className="flex-1 overflow-auto">
                        {renderDashboard()}
                    </div>
                ) : (
                    renderExplorer()
                )}
            </div>

            {/* ── Status bar ── */}
            <div className="flex items-center justify-between px-4 py-1 border-t text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Chat Inspektion
                    </span>
                    {selectedUser && (
                        <span className="font-medium text-foreground">{selectedUser.name}</span>
                    )}
                    {selectedConv && (
                        <span className="font-mono">{selectedConv.title || selectedConv.id.slice(0, 8)}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {stats && (
                        <>
                            <span>{stats.totalConversations} samtaler</span>
                            <span>{stats.totalMessages} beskeder</span>
                            <span>{formatTokens(stats.totalTokens)} tokens</span>
                            <span>${stats.totalCostUsd.toFixed(2)}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
