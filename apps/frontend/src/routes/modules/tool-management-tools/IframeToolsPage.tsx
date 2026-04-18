/**
 * Iframe Tools Management Page
 *
 * CRUD UI for registering, editing, toggling and deleting iframe tools.
 * Accessible at /modules/tool-management-tools/iframe-tools
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
    AppWindow,
    Plus,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    Trash2,
    Pencil,
    X,
    Check,
    ExternalLink,
    ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

interface IframeTool {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    url: string;
    icon: string;
    permissions: string[];
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

const ALL_PERMISSIONS = [
    { value: 'bridge:read', label: 'Bridge Read', desc: 'Page info, text, snapshot, DOM queries' },
    { value: 'bridge:readwrite', label: 'Bridge Read/Write', desc: 'Above + click, fill, fetch' },
    { value: 'nosql:read', label: 'NoSQL Read', desc: 'Collections & documents read' },
    { value: 'nosql:readwrite', label: 'NoSQL Read/Write', desc: 'Above + create/update/delete' },
    { value: 'kv:read', label: 'KV Read', desc: 'Per-user mixin KV store read' },
    { value: 'kv:readwrite', label: 'KV Read/Write', desc: 'Above + set/delete keys' },
] as const;

const PERMISSION_COLORS: Record<string, string> = {
    'bridge:read': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'bridge:readwrite': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    'nosql:read': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'nosql:readwrite': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    'kv:read': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    'kv:readwrite': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

// ─── Form State ─────────────────────────────────────────────────

interface FormState {
    slug: string;
    name: string;
    description: string;
    url: string;
    icon: string;
    permissions: string[];
}

const emptyForm: FormState = {
    slug: '',
    name: '',
    description: '',
    url: '',
    icon: 'AppWindow',
    permissions: [],
};

// ─── Component ──────────────────────────────────────────────────

export function IframeToolsPage() {
    const navigate = useNavigate();
    const [tools, setTools] = useState<IframeTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Form
    const [formOpen, setFormOpen] = useState(false);
    const [editingSlug, setEditingSlug] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get<IframeTool[]>('/iframe-tools');
            setTools(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load iframe tools');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (slug: string) => {
        setToggling(slug);
        try {
            const toggled = await api.patch<IframeTool>(`/iframe-tools/${slug}/toggle`);
            setTools((prev) => prev.map((t) => (t.slug === slug ? toggled : t)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle');
        } finally {
            setToggling(null);
        }
    };

    const handleDelete = async (slug: string) => {
        if (!confirm(`Delete iframe tool "${slug}"? This cannot be undone.`)) return;
        setDeleting(slug);
        try {
            await api.del(`/iframe-tools/${slug}`);
            setTools((prev) => prev.filter((t) => t.slug !== slug));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setDeleting(null);
        }
    };

    const openCreateForm = () => {
        setForm(emptyForm);
        setEditingSlug(null);
        setFormError(null);
        setFormOpen(true);
    };

    const openEditForm = (tool: IframeTool) => {
        setForm({
            slug: tool.slug,
            name: tool.name,
            description: tool.description ?? '',
            url: tool.url,
            icon: tool.icon,
            permissions: [...tool.permissions],
        });
        setEditingSlug(tool.slug);
        setFormError(null);
        setFormOpen(true);
    };

    const handleSave = async () => {
        setFormError(null);
        setSaving(true);
        try {
            if (editingSlug) {
                const { slug: _, ...body } = form;
                const updated = await api.put<IframeTool>(`/iframe-tools/${editingSlug}`, body);
                setTools((prev) => prev.map((t) => (t.slug === editingSlug ? updated : t)));
            } else {
                const created = await api.post<IframeTool>('/iframe-tools', form);
                setTools((prev) => [...prev, created]);
            }
            setFormOpen(false);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const togglePermission = (perm: string) => {
        setForm((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter((p) => p !== perm)
                : [...prev.permissions, perm],
        }));
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/modules/tool-management-tools')}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            MCP Tool Registry
                        </button>
                        <span className="text-muted-foreground">/</span>
                        <h1 className="text-lg font-semibold">Iframe Tools</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {tools.length} registered — {tools.filter((t) => t.enabled).length} enabled
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Register Iframe Tool
                    </button>
                </div>
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
                        Loading iframe tools...
                    </div>
                ) : tools.length === 0 && !formOpen ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <AppWindow className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No iframe tools registered</p>
                        <button onClick={openCreateForm} className="text-xs text-primary hover:underline">
                            Register your first iframe tool
                        </button>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {/* Tool list */}
                        {tools.map((tool) => (
                            <div key={tool.id} className="border rounded-lg p-4 hover:bg-muted/10 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                        <AppWindow className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{tool.name}</span>
                                            <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
                                                {tool.slug}
                                            </code>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                tool.enabled
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {tool.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        {tool.description && (
                                            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                            <a
                                                href={tool.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                {tool.url}
                                                <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                        </div>
                                        {tool.permissions.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {tool.permissions.map((p) => (
                                                    <span
                                                        key={p}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                            PERMISSION_COLORS[p] ?? 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => openEditForm(tool)}
                                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleToggle(tool.slug)}
                                            disabled={toggling === tool.slug}
                                            className={`transition-colors ${
                                                tool.enabled ? 'text-primary' : 'text-muted-foreground'
                                            } hover:opacity-80 disabled:opacity-50`}
                                            title={tool.enabled ? 'Disable' : 'Enable'}
                                        >
                                            {tool.enabled ? (
                                                <ToggleRight className="h-6 w-6" />
                                            ) : (
                                                <ToggleLeft className="h-6 w-6" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tool.slug)}
                                            disabled={deleting === tool.slug}
                                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Slide-over */}
            {formOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setFormOpen(false)} />
                    <div className="relative w-full max-w-md bg-background border-l shadow-xl flex flex-col">
                        {/* Form header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                            <h2 className="text-sm font-semibold">
                                {editingSlug ? 'Edit Iframe Tool' : 'Register Iframe Tool'}
                            </h2>
                            <button onClick={() => setFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Form body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {formError && (
                                <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded-md">
                                    {formError}
                                </div>
                            )}

                            {/* Slug */}
                            <div>
                                <label className="text-xs font-medium block mb-1">Slug</label>
                                <input
                                    type="text"
                                    value={form.slug}
                                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                                    disabled={!!editingSlug}
                                    placeholder="my-tool"
                                    className="w-full h-8 px-3 text-sm border rounded-md disabled:opacity-50 disabled:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Lowercase letters, numbers, hyphens only. Cannot be changed after creation.
                                </p>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-xs font-medium block mb-1">Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="SharePoint Explorer"
                                    className="w-full h-8 px-3 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-medium block mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Browse SharePoint sites and documents"
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {/* URL */}
                            <div>
                                <label className="text-xs font-medium block mb-1">URL</label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                    placeholder="https://my-tool.example.com"
                                    className="w-full h-8 px-3 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    The tool will be loaded in an iframe. Must use the @surdej/mixin-sdk.
                                </p>
                            </div>

                            {/* Icon */}
                            <div>
                                <label className="text-xs font-medium block mb-1">Icon</label>
                                <input
                                    type="text"
                                    value={form.icon}
                                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                                    placeholder="AppWindow"
                                    className="w-full h-8 px-3 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Lucide icon name (e.g. AppWindow, Database, Globe)
                                </p>
                            </div>

                            {/* Permissions */}
                            <div>
                                <label className="text-xs font-medium block mb-1.5">
                                    <ShieldCheck className="h-3 w-3 inline mr-1" />
                                    Permissions
                                </label>
                                <div className="space-y-1.5">
                                    {ALL_PERMISSIONS.map((perm) => {
                                        const active = form.permissions.includes(perm.value);
                                        return (
                                            <button
                                                key={perm.value}
                                                type="button"
                                                onClick={() => togglePermission(perm.value)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-colors ${
                                                    active
                                                        ? 'border-primary/30 bg-primary/5'
                                                        : 'border-border hover:bg-muted/50'
                                                }`}
                                            >
                                                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                                    active ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                                                }`}>
                                                    {active && <Check className="h-3 w-3 text-primary-foreground" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium">{perm.label}</div>
                                                    <div className="text-[10px] text-muted-foreground">{perm.desc}</div>
                                                </div>
                                                <code className="text-[9px] px-1 py-0.5 bg-muted rounded font-mono shrink-0">
                                                    {perm.value}
                                                </code>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Form footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0">
                            <button
                                onClick={() => setFormOpen(false)}
                                className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.slug || !form.name || !form.url}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Check className="h-3.5 w-3.5" />
                                )}
                                {editingSlug ? 'Save Changes' : 'Register'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
