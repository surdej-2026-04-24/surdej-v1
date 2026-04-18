/**
 * Admin — Workflow Tags management page
 *
 * CRUD for workflow classification tags. Accessible at /admin/workflows/tags
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
    Tags, Plus, Pencil, Trash2, ArrowLeft, Save, X, GripVertical,
} from 'lucide-react';
import {
    fetchWorkflowTags, createWorkflowTag, updateWorkflowTag, deleteWorkflowTag,
    type WorkflowTagItem,
} from '@/routes/modules/tool-management-tools/use-case-api';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280',
];

interface TagForm {
    name: string;
    label: string;
    color: string;
    description: string;
}

const EMPTY_FORM: TagForm = { name: '', label: '', color: '#3b82f6', description: '' };

export function AdminWorkflowTagsPage() {
    const navigate = useNavigate();
    const [tags, setTags] = useState<WorkflowTagItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<TagForm>(EMPTY_FORM);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchWorkflowTags();
            setTags(res.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tags');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const handleLabelChange = (val: string) => {
        setForm((f) => ({
            ...f,
            label: val,
            // Auto-generate name from label only when creating
            ...(editingId === null ? { name: slugify(val) } : {}),
        }));
    };

    const handleCreate = async () => {
        if (!form.name || !form.label) return;
        setSaving(true);
        try {
            await createWorkflowTag({
                name: form.name,
                label: form.label,
                color: form.color,
                description: form.description || undefined,
            });
            setShowCreate(false);
            setForm(EMPTY_FORM);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId || !form.label) return;
        setSaving(true);
        try {
            await updateWorkflowTag(editingId, {
                label: form.label,
                color: form.color,
                description: form.description || undefined,
            });
            setEditingId(null);
            setForm(EMPTY_FORM);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this tag? It will be removed from all workflows.')) return;
        try {
            await deleteWorkflowTag(id);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const startEdit = (tag: WorkflowTagItem) => {
        setEditingId(tag.id);
        setShowCreate(false);
        setForm({ name: tag.name, label: tag.label, color: tag.color, description: tag.description ?? '' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setShowCreate(false);
        setForm(EMPTY_FORM);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Admin
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Tags className="h-5 w-5" />
                            Workflow Tags
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {tags.length} tags defined
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowCreate(true); setEditingId(null); setForm(EMPTY_FORM); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-3.5 w-3.5" />
                    New Tag
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm border-b">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
                </div>
            )}

            <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
                {/* Create form */}
                {showCreate && (
                    <div className="mb-6 border rounded-lg p-4 bg-muted/20">
                        <h3 className="font-medium text-sm mb-3">Create New Tag</h3>
                        <TagFormFields
                            form={form}
                            onLabelChange={handleLabelChange}
                            onChange={setForm}
                            showName
                        />
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={handleCreate}
                                disabled={saving || !form.name || !form.label}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {saving ? 'Creating…' : 'Create'}
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Tag list */}
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        Loading tags…
                    </div>
                ) : tags.length === 0 && !showCreate ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <Tags className="h-10 w-10 mb-3 opacity-40" />
                        <p className="text-sm">No workflow tags defined yet.</p>
                        <button
                            onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); }}
                            className="mt-2 text-sm text-primary hover:underline"
                        >
                            Create your first tag
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tags.map((tag) => (
                            <div key={tag.id}>
                                {editingId === tag.id ? (
                                    <div className="border rounded-lg p-4 bg-muted/20">
                                        <h3 className="font-medium text-sm mb-3">Edit Tag</h3>
                                        <TagFormFields
                                            form={form}
                                            onLabelChange={(v) => setForm((f) => ({ ...f, label: v }))}
                                            onChange={setForm}
                                            showName={false}
                                        />
                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                onClick={handleUpdate}
                                                disabled={saving || !form.label}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                                            >
                                                <Save className="h-3.5 w-3.5" />
                                                {saving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors group">
                                        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                        <div
                                            className="h-4 w-4 rounded-full shrink-0 border"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{tag.label}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                    {tag.name}
                                                </span>
                                            </div>
                                            {tag.description && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {tag.description}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {tag.useCaseCount ?? 0} workflow{(tag.useCaseCount ?? 0) !== 1 ? 's' : ''}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEdit(tag)}
                                                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tag.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
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

function TagFormFields({
    form,
    onLabelChange,
    onChange,
    showName,
}: {
    form: TagForm;
    onLabelChange: (val: string) => void;
    onChange: (fn: (f: TagForm) => TagForm) => void;
    showName: boolean;
}) {
    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Label</label>
                <input
                    type="text"
                    value={form.label}
                    onChange={(e) => onLabelChange(e.target.value)}
                    placeholder="e.g. Research"
                    className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>
            {showName && (
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Name (slug)</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. research"
                        className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                </div>
            )}
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
                <input
                    type="text"
                    value={form.description}
                    onChange={(e) => onChange((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short description…"
                    className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => onChange((f) => ({ ...f, color: c }))}
                            className={`h-6 w-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
