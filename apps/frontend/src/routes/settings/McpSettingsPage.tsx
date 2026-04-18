import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft, Server, Plus, Trash2, Loader2, RefreshCw,
    TestTube, Globe, Terminal, Radio, ChevronRight,
    Wrench, Zap, ExternalLink, AlertTriangle, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

// ─── Types ─────────────────────────────────────────────────────

interface McpServer {
    id: string;
    name: string;
    transport: string;
    endpoint: string | null;
    config: unknown;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    _count: { invocations: number };
}

interface McpTool {
    name: string;
    description: string;
    inputSchema: unknown;
}

interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

interface McpServerInfo {
    name: string;
    version: string;
    protocolVersion: string;
    capabilities: Record<string, unknown>;
}

// ─── Constants ─────────────────────────────────────────────────

const TRANSPORT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    stdio: { label: 'stdio', icon: Terminal, color: 'text-emerald-500' },
    sse: { label: 'SSE', icon: Radio, color: 'text-blue-500' },
    http: { label: 'HTTP', icon: Globe, color: 'text-violet-500' },
};

// ─── Component ─────────────────────────────────────────────────

export function McpSettingsPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [serverInfo, setServerInfo] = useState<McpServerInfo | null>(null);
    const [tools, setTools] = useState<McpTool[]>([]);
    const [resources, setResources] = useState<McpResource[]>([]);
    const [externalServers, setExternalServers] = useState<McpServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Add server form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTransport, setNewTransport] = useState<'stdio' | 'sse' | 'http'>('http');
    const [newEndpoint, setNewEndpoint] = useState('');
    const [adding, setAdding] = useState(false);

    // Test result
    const [testResult, setTestResult] = useState<{ name: string; status: 'success' | 'error'; message: string } | null>(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [info, toolsRes, resourcesRes, serversRes] = await Promise.allSettled([
                api.get<McpServerInfo>('/mcp'),
                api.get<{ tools: McpTool[] }>('/mcp/tools'),
                api.get<{ resources: McpResource[] }>('/mcp/resources'),
                api.get<McpServer[]>('/mcp/servers'),
            ]);

            if (info.status === 'fulfilled') setServerInfo(info.value);
            if (toolsRes.status === 'fulfilled') setTools(toolsRes.value.tools);
            if (resourcesRes.status === 'fulfilled') setResources(resourcesRes.value.resources);
            if (serversRes.status === 'fulfilled') setExternalServers(serversRes.value);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAddServer = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        try {
            await api.post('/mcp/servers', {
                name: newName.trim(),
                transport: newTransport,
                endpoint: newEndpoint.trim() || null,
            });
            setNewName('');
            setNewEndpoint('');
            setShowAddForm(false);
            await fetchData(true);
        } catch (err) {
            console.error('Failed to add server:', err);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteServer = async (id: string, name: string) => {
        if (!confirm(`Remove MCP server "${name}"?`)) return;
        try {
            await api.del(`/mcp/servers/${id}`);
            await fetchData(true);
        } catch (err) {
            console.error('Failed to delete server:', err);
        }
    };

    const handleTestTool = async (toolName: string) => {
        setTestResult(null);
        try {
            const result = await api.post<{ content: Array<{ text: string }>; isError?: boolean }>('/mcp/tools/call', {
                name: toolName,
                arguments: toolName === 'surdej.search' ? { query: 'test' } : {},
            });
            setTestResult({
                name: toolName,
                status: result.isError ? 'error' : 'success',
                message: result.content[0]?.text ?? 'No output',
            });
        } catch (err) {
            setTestResult({ name: toolName, status: 'error', message: String(err) });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-1.5">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {t('mcp.backToSettings')}
                    </Button>
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="text-muted-foreground gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Server className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('mcp.title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('mcp.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Server Info Card */}
            {serverInfo && (
                <Card className="mb-6">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-sm">{t('mcp.builtInServer')}</div>
                                <div className="text-xs text-muted-foreground">{serverInfo.name} v{serverInfo.version}</div>
                            </div>
                            <Badge variant="default" className="text-[10px]">{t('developer.active')}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                            <div>
                                <div className="font-medium text-foreground">{tools.length}</div>
                                <div>{t('mcp.tools')}</div>
                            </div>
                            <div>
                                <div className="font-medium text-foreground">{resources.length}</div>
                                <div>{t('mcp.resources')}</div>
                            </div>
                            <div>
                                <div className="font-medium text-foreground">{serverInfo.protocolVersion}</div>
                                <div>{t('mcp.protocol')}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Built-in Tools */}
            <div className="mb-8">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-primary" />
                    {t('mcp.availableTools')}
                </h2>
                <div className="space-y-2 stagger-children">
                    {tools.map((tool) => (
                        <Card key={tool.name} className="group transition-all duration-200 hover:shadow-md">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center shrink-0">
                                    <Wrench className="h-3.5 w-3.5 text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm font-mono">{tool.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{tool.description}</div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTestTool(tool.name)}
                                    className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <TestTube className="h-3 w-3" />
                                    {t('mcp.test')}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Test Result */}
                {testResult && (
                    <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.status === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                        <div className="flex items-center gap-2 mb-1 font-semibold">
                            {testResult.status === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {testResult.name} — {testResult.status}
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] max-h-32 overflow-auto">
                            {testResult.message}
                        </pre>
                    </div>
                )}
            </div>

            {/* Built-in Resources */}
            <div className="mb-8">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    {t('mcp.resourcesSection')}
                </h2>
                <div className="space-y-2 stagger-children">
                    {resources.map((res) => (
                        <Card key={res.uri} className="transition-all duration-200 hover:shadow-md">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center shrink-0">
                                    <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{res.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{res.description}</div>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-mono shrink-0">{res.uri}</Badge>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Separator className="my-8" />

            {/* External MCP Servers */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-primary" />
                        {t('mcp.externalServers')}
                    </h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="gap-1.5 text-xs"
                    >
                        <Plus className="h-3 w-3" />
                        {t('mcp.addServer')}
                    </Button>
                </div>

                {/* Add Server Form */}
                {showAddForm && (
                    <Card className="mb-4 animate-slide-up">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex gap-3">
                                <Input
                                    placeholder={t('mcp.serverName')}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="flex-1"
                                />
                                <div className="flex gap-1">
                                    {(['stdio', 'sse', 'http'] as const).map((t) => {
                                        const conf = TRANSPORT_CONFIG[t]!;
                                        const TIcon = conf.icon;
                                        return (
                                            <Button
                                                key={t}
                                                variant={newTransport === t ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setNewTransport(t)}
                                                className="gap-1 text-xs"
                                            >
                                                <TIcon className="h-3 w-3" />
                                                {conf.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                            <Input
                                placeholder={newTransport === 'stdio' ? t('mcp.stdioPh') : t('mcp.httpPh')}
                                value={newEndpoint}
                                onChange={(e) => setNewEndpoint(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>{t('common.cancel')}</Button>
                                <Button size="sm" onClick={handleAddServer} disabled={adding || !newName.trim()} className="gap-1.5">
                                    {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    {adding ? t('mcp.adding') : t('mcp.add')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Server List */}
                {externalServers.length === 0 && !showAddForm ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>{t('mcp.noServers')}</p>
                        <p className="text-xs mt-1">{t('mcp.noServersHint')}</p>
                    </div>
                ) : (
                    <div className="space-y-2 stagger-children">
                        {externalServers.map((server) => {
                            const transport = TRANSPORT_CONFIG[server.transport] ?? TRANSPORT_CONFIG['http']!;
                            const TransportIcon = transport.icon;
                            return (
                                <Card key={server.id} className="group transition-all duration-200 hover:shadow-md">
                                    <CardContent className="flex items-center gap-4 p-4">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-500/10 to-gray-500/10 flex items-center justify-center shrink-0">
                                            <TransportIcon className={`h-4 w-4 ${transport.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{server.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span className="font-mono">{transport.label}</span>
                                                {server.endpoint && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="truncate max-w-[200px] font-mono">{server.endpoint}</span>
                                                    </>
                                                )}
                                                <span>·</span>
                                                <span>{server._count.invocations} call{server._count.invocations !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={server.isEnabled ? 'default' : 'secondary'}
                                            className="text-[10px] shrink-0"
                                        >
                                            {server.isEnabled ? t('mcp.enabled') : t('mcp.disabled')}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
                                            onClick={() => handleDeleteServer(server.id, server.name)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
