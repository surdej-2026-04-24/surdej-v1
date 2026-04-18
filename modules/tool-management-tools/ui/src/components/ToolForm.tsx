import { useState } from 'react';
import { CreateToolSchema, TOOL_CATEGORIES } from '@surdej/module-tool-management-tools-shared';
import { useModuleApi } from '../hooks/useModuleApi.js';

interface Props {
    onCreated?: () => void;
}

export function ToolForm({ onCreated }: Props) {
    const api = useModuleApi();
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<string>('general');
    const [icon, setIcon] = useState('');
    const [useCases, setUseCases] = useState('');
    const [promptTemplate, setPromptTemplate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const parsed = useCases
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        const payload = {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            label,
            description: description || undefined,
            category: category as typeof TOOL_CATEGORIES[number],
            icon: icon || undefined,
            isEnabled: true,
            isBuiltIn: false,
            useCases: parsed,
            promptTemplate: promptTemplate || undefined,
        };

        const result = CreateToolSchema.safeParse(payload);
        if (!result.success) {
            setError(result.error.issues.map((i) => i.message).join(', '));
            return;
        }

        setSaving(true);
        try {
            await api.create(result.data);
            setName('');
            setLabel('');
            setDescription('');
            setCategory('general');
            setIcon('');
            setUseCases('');
            setPromptTemplate('');
            onCreated?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tool');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 max-w-lg">
            {error && <div className="text-destructive text-sm p-2 bg-destructive/10 rounded">{error}</div>}

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Tool Name (slug) *
                </label>
                <input
                    type="text"
                    placeholder="e.g. my_tool"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                />
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Display Label *
                </label>
                <input
                    type="text"
                    placeholder="e.g. My Tool"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                />
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Description
                </label>
                <textarea
                    placeholder="What does this tool do?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={2}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Category
                    </label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {TOOL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Icon (Lucide name)
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Globe"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Use Cases (comma-separated IDs)
                </label>
                <input
                    type="text"
                    placeholder="e.g. improve-text, quick-research"
                    value={useCases}
                    onChange={(e) => setUseCases(e.target.value)}
                    className="w-full p-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Prompt Template
                </label>
                <textarea
                    placeholder="Optional session prompt prefix..."
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    className="w-full p-2 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={3}
                />
            </div>

            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
                {saving ? 'Creating...' : 'Create Tool'}
            </button>
        </form>
    );
}
