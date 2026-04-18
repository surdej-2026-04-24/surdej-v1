/**
 * Tool Management — New Tool page (LEGACY / ORPHANED)
 *
 * Phase 1 scaffolding for the legacy in-memory tool store (POST /).
 * This page is NO LONGER routed — the activity bar "Ny MCP Server" item
 * now points to /mcp-servers/new (NewMcpServerPage) instead.
 *
 * TODO(cleanup): Either repurpose for Phase 2 Prisma-backed tool creation
 * (see plans/tool-management-tools-plan.md) or delete once Phase 2 is done.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { TOOL_CATEGORIES, CreateToolSchema } from '@surdej/module-tool-management-tools-shared';

const MODULE_API_BASE = '/api/module/tool-management-tools';

export function NewToolPage() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<string>('general');
    const [icon, setIcon] = useState('');
    const [useCasesRaw, setUseCasesRaw] = useState('');
    const [promptTemplate, setPromptTemplate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const useCases = useCasesRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        const payload = {
            name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label,
            description: description || undefined,
            category: category as typeof TOOL_CATEGORIES[number],
            icon: icon || undefined,
            isEnabled: true,
            isBuiltIn: false,
            useCases,
            promptTemplate: promptTemplate || undefined,
        };

        const result = CreateToolSchema.safeParse(payload);
        if (!result.success) {
            setError(result.error.issues.map((i) => i.message).join(', '));
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(MODULE_API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.data),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error ?? `HTTP ${res.status}`);
            }

            navigate('..', { relative: 'path' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tool');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
                <button
                    onClick={() => navigate('..', { relative: 'path' })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <h1 className="text-lg font-semibold">New Tool</h1>
                    <p className="text-sm text-muted-foreground">Register a tool for portal and extension use cases</p>
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

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Tool Name (slug) *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. my_tool"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Used as the tool identifier in API calls (lowercase, underscores)
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Display Label *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. My Tool"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Description</label>
                        <textarea
                            placeholder="What does this tool do?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {TOOL_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                Icon (Lucide name)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Globe"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Use Cases (comma-separated IDs)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. improve-text, quick-research"
                            value={useCasesRaw}
                            onChange={(e) => setUseCasesRaw(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Associates this tool with one or more extension use cases
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">
                            Prompt Template
                        </label>
                        <textarea
                            placeholder="Optional session prompt prefix that gets prepended when this tool's use case is selected..."
                            value={promptTemplate}
                            onChange={(e) => setPromptTemplate(e.target.value)}
                            className="w-full p-2.5 text-sm border rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            rows={4}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {saving ? 'Creating...' : 'Create Tool'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('..', { relative: 'path' })}
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
