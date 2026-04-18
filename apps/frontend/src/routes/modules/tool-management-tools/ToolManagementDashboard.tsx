/**
 * Tool Management — MCP Server Registry Dashboard
 *
 * Lists all registered MCP servers and their tools with enable/disable toggles.
 * Accessible at /modules/tool-management-tools
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
    Server,
    Plus,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    ChevronDown,
    ChevronRight,
    Circle,
    ExternalLink,
    Cpu,
    Activity,
    Wrench,
    AppWindow,
} from 'lucide-react';
import type {
    McpServerWithTools,
    McpServerListResponse,
    McpTool,
} from '@surdej/module-tool-management-tools-shared';
import {
    MCP_SERVER_TYPES,
    TOOL_CATEGORIES,
} from '@surdej/module-tool-management-tools-shared';

const MODULE_API_BASE = '/api/module/tool-management-tools';

async function fetchServers(params?: { type?: string }): Promise<McpServerListResponse> {
    const qs = params?.type ? `?type=${params.type}` : '';
    const res = await fetch(`${MODULE_API_BASE}/mcp-servers${qs}`);
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.hint ?? body?.error ?? '';
        throw new Error(
            res.status === 404
                ? `Module worker not reachable (404). ${detail || 'Ensure the module worker is running.'}`
                : `Failed to fetch MCP servers: ${res.status}${detail ? ` — ${detail}` : ''}`,
        );
    }
    return res.json();
}

async function toggleServer(id: string): Promise<McpServerWithTools> {
    const res = await fetch(`${MODULE_API_BASE}/mcp-servers/${id}/toggle`, { method: 'PATCH' });
    if (!res.ok) throw new Error(`Failed to toggle server: ${res.status}`);
    return res.json();
}

async function toggleTool(serverId: string, toolId: string): Promise<McpTool> {
    const res = await fetch(`${MODULE_API_BASE}/mcp-servers/${serverId}/tools/${toolId}/toggle`, {
        method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Failed to toggle tool: ${res.status}`);
    return res.json();
}

async function healthCheck(id: string): Promise<McpServerWithTools> {
    const res = await fetch(`${MODULE_API_BASE}/mcp-servers/${id}/health-check`, { method: 'POST' });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
}

const STATUS_COLORS: Record<string, string> = {
    online: 'text-emerald-500',
    offline: 'text-muted-foreground',
    error: 'text-destructive',
    unknown: 'text-amber-500',
};

const STATUS_LABELS: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    error: 'Error',
    unknown: 'Unknown',
};

const TYPE_BADGES: Record<string, { class: string; label: string }> = {
    internal: { class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'Internal' },
    external: { class: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'External' },
};

const CATEGORY_COLORS: Record<string, string> = {
    search: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    analysis: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    generation: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    context: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    integration: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    general: 'bg-muted text-muted-foreground',
};

export function ToolManagementDashboard() {
    const navigate = useNavigate();
    const [servers, setServers] = useState<McpServerWithTools[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string>('all');
    const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
    const [toggling, setToggling] = useState<string | null>(null);
    const [checking, setChecking] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchServers(
                activeType !== 'all' ? { type: activeType } : undefined,
            );
            setServers(res.items);
            // Auto-expand servers with tools
            const expanded = new Set<string>();
            res.items.forEach((s) => {
                if (s.tools.length > 0) expanded.add(s.id);
            });
            setExpandedServers(expanded);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [activeType]);

    const handleToggleServer = async (id: string) => {
        setToggling(id);
        try {
            const updated = await toggleServer(id);
            setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle server');
        } finally {
            setToggling(null);
        }
    };

    const handleToggleTool = async (serverId: string, toolId: string) => {
        setToggling(toolId);
        try {
            const updated = await toggleTool(serverId, toolId);
            setServers((prev) =>
                prev.map((s) =>
                    s.id === serverId
                        ? { ...s, tools: s.tools.map((t) => (t.id === toolId ? { ...updated, serverId: s.id } : t)) }
                        : s,
                ),
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle tool');
        } finally {
            setToggling(null);
        }
    };

    const handleHealthCheck = async (id: string) => {
        setChecking(id);
        try {
            const updated = await healthCheck(id);
            setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Health check failed');
        } finally {
            setChecking(null);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedServers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const totalTools = servers.reduce((acc, s) => acc + s.tools.length, 0);
    const enabledServers = servers.filter((s) => s.isEnabled).length;
    const onlineServers = servers.filter((s) => s.status === 'online').length;

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div>
                    <h1 className="text-lg font-semibold">MCP Tool Registry</h1>
                    <p className="text-sm text-muted-foreground">
                        {servers.length} servers — {totalTools} tools — {onlineServers} online
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                    <button
                        onClick={() => navigate('iframe-tools')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <AppWindow className="h-3.5 w-3.5" />
                        Iframe Tools
                    </button>
                    <button
                        onClick={() => navigate('mcp-servers/new')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add MCP Server
                    </button>
                </div>
            </div>

            {/* Type filters */}
            <div className="flex items-center gap-2 px-6 py-3 border-b overflow-x-auto shrink-0">
                {['all', ...MCP_SERVER_TYPES].map((t) => (
                    <button
                        key={t}
                        onClick={() => setActiveType(t)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
                            activeType === t
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:bg-muted/50'
                        }`}
                    >
                        {t === 'all' ? 'All' : t === 'internal' ? 'Internal' : 'External'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {error && (
                    <div className="m-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Loading MCP servers...
                    </div>
                ) : servers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <Server className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No MCP servers registered</p>
                        <button
                            onClick={() => navigate('mcp-servers/new')}
                            className="text-xs text-primary hover:underline"
                        >
                            Add your first MCP server
                        </button>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {servers.map((server) => (
                            <div key={server.id} className="border rounded-lg overflow-hidden">
                                {/* Server Header */}
                                <div className="flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors">
                                    <button
                                        onClick={() => toggleExpand(server.id)}
                                        className="shrink-0 text-muted-foreground hover:text-foreground"
                                    >
                                        {expandedServers.has(server.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {server.type === 'internal' ? (
                                                <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                                            ) : (
                                                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                            <span className="font-medium text-sm">{server.label}</span>
                                            <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
                                                {server.name}
                                            </code>
                                            <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                    TYPE_BADGES[server.type]?.class ?? TYPE_BADGES.internal.class
                                                }`}
                                            >
                                                {TYPE_BADGES[server.type]?.label ?? server.type}
                                            </span>
                                            <span className={`flex items-center gap-1 text-[10px] ${STATUS_COLORS[server.status] ?? STATUS_COLORS.unknown}`}>
                                                <Circle className="h-2 w-2 fill-current" />
                                                {STATUS_LABELS[server.status] ?? server.status}
                                            </span>
                                            {server.isBuiltIn && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded font-medium">
                                                    built-in
                                                </span>
                                            )}
                                        </div>
                                        {server.description && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {server.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                            <span>Transport: {server.transportType}</span>
                                            {server.endpoint && (
                                                <span className="truncate max-w-[200px]">{server.endpoint}</span>
                                            )}
                                            <span>{server.tools.length} tools</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleHealthCheck(server.id)}
                                            disabled={checking === server.id}
                                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                            title="Health check"
                                        >
                                            <Activity className={`h-4 w-4 ${checking === server.id ? 'animate-pulse' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleServer(server.id)}
                                            disabled={toggling === server.id}
                                            className={`transition-colors ${
                                                server.isEnabled ? 'text-primary' : 'text-muted-foreground'
                                            } hover:opacity-80 disabled:opacity-50`}
                                            title={server.isEnabled ? 'Disable server' : 'Enable server'}
                                        >
                                            {server.isEnabled ? (
                                                <ToggleRight className="h-6 w-6" />
                                            ) : (
                                                <ToggleLeft className="h-6 w-6" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Tools (expanded) */}
                                {expandedServers.has(server.id) && server.tools.length > 0 && (
                                    <div className="border-t bg-muted/5">
                                        {server.tools.map((tool) => (
                                            <div
                                                key={tool.id}
                                                className="flex items-center gap-3 px-4 py-2.5 pl-12 border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                                            >
                                                <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm">{tool.label}</span>
                                                        <code className="text-[10px] px-1 py-0.5 bg-muted rounded font-mono">
                                                            {tool.name}
                                                        </code>
                                                        <span
                                                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                                CATEGORY_COLORS[tool.category] ?? CATEGORY_COLORS.general
                                                            }`}
                                                        >
                                                            {tool.category}
                                                        </span>
                                                    </div>
                                                    {tool.description && (
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                            {tool.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleToggleTool(server.id, tool.id)}
                                                    disabled={toggling === tool.id}
                                                    className={`shrink-0 transition-colors ${
                                                        tool.isEnabled ? 'text-primary' : 'text-muted-foreground'
                                                    } hover:opacity-80 disabled:opacity-50`}
                                                    title={tool.isEnabled ? 'Disable tool' : 'Enable tool'}
                                                >
                                                    {tool.isEnabled ? (
                                                        <ToggleRight className="h-5 w-5" />
                                                    ) : (
                                                        <ToggleLeft className="h-5 w-5" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* No tools message */}
                                {expandedServers.has(server.id) && server.tools.length === 0 && (
                                    <div className="border-t px-4 py-3 pl-12 text-xs text-muted-foreground">
                                        No tools registered. Use "Discover" or add tools manually.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
