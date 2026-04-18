import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft, Layers, Plus, Loader2, RefreshCw, Trash2,
    ChevronRight, FileText, CheckCircle2, Type, Image,
    Table, ListChecks, Save, X,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────

interface TemplateSection {
    title: string;
    contentType: string;
    required: boolean;
    description?: string;
}

interface Template {
    id: string;
    name: string;
    description: string | null;
    sections: TemplateSection[];
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    _count: { articles: number };
}

// ─── Constants ─────────────────────────────────────────────────

const CONTENT_TYPES: { value: string; label: string; icon: React.ElementType }[] = [
    { value: 'text', label: 'Text', icon: Type },
    { value: 'rich-text', label: 'Rich Text', icon: FileText },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'table', label: 'Table', icon: Table },
    { value: 'checklist', label: 'Checklist', icon: ListChecks },
];

// ─── Component ─────────────────────────────────────────────────

export function TemplatesPage() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Create form state
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newSections, setNewSections] = useState<TemplateSection[]>([
        { title: 'Introduction', contentType: 'text', required: true },
    ]);
    const [saving, setSaving] = useState(false);

    const fetchTemplates = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.get<Template[]>('/knowledge/templates');
            setTemplates(data);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            await api.post('/knowledge/templates', {
                name: newName.trim(),
                description: newDescription.trim() || null,
                sections: newSections,
            });
            setNewName('');
            setNewDescription('');
            setNewSections([{ title: 'Introduction', contentType: 'text', required: true }]);
            setShowCreate(false);
            await fetchTemplates(true);
        } catch (err) {
            console.error('Failed to create template:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
            await api.del(`/knowledge/templates/${id}`);
            await fetchTemplates(true);
        } catch (err) {
            console.error('Failed to delete template:', err);
        }
    };

    const addSection = () => {
        setNewSections([...newSections, {
            title: '',
            contentType: 'text',
            required: false,
        }]);
    };

    const updateSection = (index: number, updates: Partial<TemplateSection>) => {
        setNewSections(sections =>
            sections.map((s, i) => i === index ? { ...s, ...updates } : s),
        );
    };

    const removeSection = (index: number) => {
        setNewSections(sections => sections.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')} className="gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Knowledge
                </Button>
                <div className="flex-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchTemplates(true)}
                    disabled={refreshing}
                    className="text-muted-foreground"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    New Template
                </Button>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-violet-500/10 p-2.5">
                    <Layers className="h-[22px] w-[22px] text-violet-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
                    <p className="text-sm text-muted-foreground">
                        Define article structures with required sections.
                    </p>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <Card className="mb-6 animate-slide-up">
                    <CardContent className="p-5 space-y-4">
                        <h3 className="font-semibold text-sm">New Template</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                                placeholder="Template name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                            />
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sections</h4>
                                <Button variant="ghost" size="sm" onClick={addSection} className="gap-1 text-xs">
                                    <Plus className="h-3 w-3" />
                                    Add Section
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {newSections.map((section, index) => (
                                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                        <span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
                                            {index + 1}
                                        </span>
                                        <Input
                                            placeholder="Section title"
                                            value={section.title}
                                            onChange={(e) => updateSection(index, { title: e.target.value })}
                                            className="flex-1 h-8 text-sm"
                                        />
                                        <select
                                            value={section.contentType}
                                            onChange={(e) => updateSection(index, { contentType: e.target.value })}
                                            className="h-8 px-2 border rounded-md text-xs bg-background"
                                        >
                                            {CONTENT_TYPES.map((ct) => (
                                                <option key={ct.value} value={ct.value}>{ct.label}</option>
                                            ))}
                                        </select>
                                        <Button
                                            variant={section.required ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => updateSection(index, { required: !section.required })}
                                            className="text-[10px] h-8 px-2"
                                        >
                                            {section.required ? 'Required' : 'Optional'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                            onClick={() => removeSection(index)}
                                            disabled={newSections.length <= 1}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()} className="gap-1.5">
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                {saving ? 'Creating…' : 'Create Template'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Template List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : templates.length === 0 && !showCreate ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                        <Layers className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-1">No templates</h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Templates define the structure of articles with required sections and content types.
                    </p>
                    <Button onClick={() => setShowCreate(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Create Template
                    </Button>
                </div>
            ) : (
                <div className="space-y-2 stagger-children">
                    {templates.map((template) => (
                        <Card
                            key={template.id}
                            className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                        >
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center shrink-0">
                                    <Layers className="h-4 w-4 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{template.name}</div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                        {template.description && (
                                            <span className="truncate max-w-[250px]">{template.description}</span>
                                        )}
                                        <span>·</span>
                                        <span>{(template.sections as TemplateSection[]).length} sections</span>
                                        <span>·</span>
                                        <span>{template._count.articles} article{template._count.articles !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center gap-1 shrink-0">
                                    {(template.sections as TemplateSection[]).slice(0, 3).map((s, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                            {s.required && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                                            {s.title || 'Untitled'}
                                        </Badge>
                                    ))}
                                    {(template.sections as TemplateSection[]).length > 3 && (
                                        <Badge variant="outline" className="text-[10px]">
                                            +{(template.sections as TemplateSection[]).length - 3}
                                        </Badge>
                                    )}
                                </div>
                                {template.isDefault && (
                                    <Badge variant="default" className="text-[10px]">Default</Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(template.id, template.name); }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
