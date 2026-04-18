/**
 * Tool Management — Add MCP Server page
 *
 * Form for registering a new MCP server (internal or external).
 * Accessible at /modules/tool-management-tools/mcp-servers/new
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
    CreateMcpServerSchema,
    MCP_SERVER_TYPES,
    MCP_TRANSPORT_TYPES,
    MCP_AUTH_TYPES,
} from '@surdej/module-tool-management-tools-shared';

const MODULE_API_BASE = '/api/module/tool-management-tools';

export function NewMcpServerPage() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<string>('external');
    const [transportType, setTransportType] = useState<string>('sse');
    const [endpoint, setEndpoint] = useState('');
    const [command, setCommand] = useState('');
    const [argsRaw, setArgsRaw] = useState('');
    const [authType, setAuthType] = useState<string>('none');
    const [apiKey, setApiKey] = useState('');
    const [bearerToken, setBearerToken] = useState('');
    const [icon, setIcon] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const args = argsRaw
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

        let authConfig: Record<string, unknown> | undefined;
        if (authType === 'api-key' && apiKey) {
            authConfig = { apiKey };
        } else if (authType === 'bearer' && bearerToken) {
            authConfig = { token: bearerToken };
        }

        const payload = {
            name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            label,
            description: description || undefined,
            type: type as typeof MCP_SERVER_TYPES[number],
            transportType: transportType as typeof MCP_TRANSPORT_TYPES[number],
            endpoint: endpoint || undefined,
            command: command || undefined,
            args: args.length > 0 ? args : undefined,
            authType: authType as typeof MCP_AUTH_TYPES[number],
            authConfig,
            icon: icon || undefined,
            isEnabled: true,
            isBuiltIn: false,
        };

        const result = CreateMcpServerSchema.safeParse(payload);
        if (!result.success) {
            setError(result.error.issues.map((i) => i.message).join(', '));
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${MODULE_API_BASE}/mcp-servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.data),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error ?? `HTTP ${res.status}`);
            }

            navigate('/modules/tool-management-tools');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create MCP server');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
                <button
                    onClick={() => navigate('/modules/tool-management-tools')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <h1 className="text-lg font-semibold">Add MCP Server</h1>
                    <p className="text-sm text-muted-foreground">
                        Register an internal or external MCP server
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-w-xl">
                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {MCP_SERVER_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t === 'internal' ? 'Internal (platform)' : 'External (third-party)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Transport</label>
                            <select
                                value={transportType}
                                onChange={(e) => setTransportType(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {MCP_TRANSPORT_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Server Name (slug) *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. github-mcp"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Lowercase with hyphens. Used as the unique identifier.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Display Label *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. GitHub MCP Server"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Description</label>
                        <textarea
                            placeholder="What tools does this server provide?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Connection: SSE/HTTP */}
                    {(transportType === 'sse' || transportType === 'streamable-http') && (
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                Endpoint URL {type === 'external' && '*'}
                            </label>
                            <input
                                type="url"
                                placeholder="e.g. https://mcp.example.com/sse"
                                value={endpoint}
                                onChange={(e) => setEndpoint(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required={type === 'external'}
                            />
                        </div>
                    )}

                    {/* Connection: stdio */}
                    {transportType === 'stdio' && (
                        <>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                    Command *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. npx -y @modelcontextprotocol/server-github"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    className="w-full p-2.5 text-sm border rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                    Arguments (one per line)
                                </label>
                                <textarea
                                    placeholder="--flag&#10;value"
                                    value={argsRaw}
                                    onChange={(e) => setArgsRaw(e.target.value)}
                                    className="w-full p-2.5 text-sm border rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {/* Auth */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Authentication</label>
                        <select
                            value={authType}
                            onChange={(e) => setAuthType(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {MCP_AUTH_TYPES.map((a) => (
                                <option key={a} value={a}>
                                    {a === 'none' ? 'None' : a === 'api-key' ? 'API Key' : a === 'bearer' ? 'Bearer Token' : 'OAuth'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {authType === 'api-key' && (
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">API Key</label>
                            <input
                                type="password"
                                placeholder="Enter API key"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    )}

                    {authType === 'bearer' && (
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Bearer Token</label>
                            <input
                                type="password"
                                placeholder="Enter bearer token"
                                value={bearerToken}
                                onChange={(e) => setBearerToken(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Icon (Lucide name)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Github"
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {saving ? 'Adding...' : 'Add MCP Server'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/modules/tool-management-tools')}
                            className="px-5 py-2.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
