import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft, Save, Clock, FileText, Tag, Loader2,
    ChevronRight, History, CheckCircle2, Eye, Send,
    Archive, RotateCcw, Trash2, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────

interface Article {
    id: string;
    title: string;
    slug: string;
    content: string;
    contentHash: string | null;
    status: string;
    authorId: string;
    templateId: string | null;
    tags: string[];
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    author: { id: string; displayName: string | null; email: string };
    template: { id: string; name: string } | null;
    versions: VersionSummary[];
}

interface VersionSummary {
    id: string;
    version: number;
    changeSummary: string | null;
    authorId: string;
    createdAt: string;
}

// ─── Constants ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    draft: { label: 'Draft', icon: FileText, color: 'bg-slate-500/10 text-slate-600' },
    review: { label: 'In Review', icon: Eye, color: 'bg-amber-500/10 text-amber-600' },
    approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-blue-500/10 text-blue-600' },
    published: { label: 'Published', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600' },
    archived: { label: 'Archived', icon: Archive, color: 'bg-gray-500/10 text-gray-500' },
};

const STATUS_ACTIONS: Record<string, Array<{ targetStatus: string; label: string; icon: React.ElementType; variant: 'default' | 'outline' | 'secondary' | 'destructive' }>> = {
    draft: [
        { targetStatus: 'review', label: 'Submit for Review', icon: Send, variant: 'default' },
        { targetStatus: 'archived', label: 'Archive', icon: Archive, variant: 'outline' },
    ],
    review: [
        { targetStatus: 'approved', label: 'Approve', icon: CheckCircle2, variant: 'default' },
        { targetStatus: 'draft', label: 'Return to Draft', icon: RotateCcw, variant: 'outline' },
    ],
    approved: [
        { targetStatus: 'published', label: 'Publish', icon: CheckCircle2, variant: 'default' },
        { targetStatus: 'draft', label: 'Return to Draft', icon: RotateCcw, variant: 'outline' },
    ],
    published: [
        { targetStatus: 'archived', label: 'Archive', icon: Archive, variant: 'outline' },
    ],
    archived: [
        { targetStatus: 'draft', label: 'Restore to Draft', icon: RotateCcw, variant: 'default' },
    ],
};

// ─── Component ─────────────────────────────────────────────────

export function ArticleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable fields
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [dirty, setDirty] = useState(false);

    const fetchArticle = useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.get<Article>(`/knowledge/articles/${id}`);
            setArticle(data);
            setTitle(data.title);
            setContent(data.content);
            setTagsInput(data.tags.join(', '));
            setDirty(false);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchArticle(); }, [fetchArticle]);

    const handleSave = async () => {
        if (!article || !dirty) return;
        setSaving(true);
        try {
            const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
            const updated = await api.put<Article>(`/knowledge/articles/${article.id}`, {
                title: title.trim(),
                content,
                tags,
                authorId: article.authorId,
                changeSummary: 'Manual save',
            });
            setArticle(updated);
            setDirty(false);
        } catch (err) {
            setError(String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (targetStatus: string) => {
        if (!article) return;
        try {
            const updated = await api.post<Article>(`/knowledge/articles/${article.id}/status`, {
                status: targetStatus,
            });
            setArticle((prev) => prev ? { ...prev, ...updated } : prev);
        } catch (err) {
            setError(String(err));
        }
    };

    const handleDelete = async () => {
        if (!article) return;
        if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
        try {
            await api.del(`/knowledge/articles/${article.id}`);
            navigate('/knowledge');
        } catch (err) {
            setError(String(err));
        }
    };

    // ─── Keyboard shortcut ─────────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!article) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-2">Article not found</h2>
                <Button variant="outline" onClick={() => navigate('/knowledge')}>
                    Back to Knowledge
                </Button>
            </div>
        );
    }

    const statusConf = STATUS_CONFIG[article.status] ?? STATUS_CONFIG['draft']!;
    const StatusIcon = statusConf.icon;
    const actions = STATUS_ACTIONS[article.status] ?? [];
    const isEditable = article.status !== 'published';

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Top Bar */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')} className="gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                </Button>
                <div className="flex-1" />
                <Badge variant="outline" className={`${statusConf.color} gap-1`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConf.label}
                </Badge>
                {dirty && (
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1.5"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                )}
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2 mb-4">
                    {error}
                    <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>Dismiss</Button>
                </div>
            )}

            {/* Title */}
            {isEditable ? (
                <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                    className="text-2xl font-bold border-0 bg-transparent px-0 mb-2 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Article title…"
                />
            ) : (
                <h1 className="text-2xl font-bold mb-2">{title}</h1>
            )}

            {/* Meta Line */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6">
                <span>{article.author.displayName ?? article.author.email}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {relativeTime(article.updatedAt)}
                </span>
                {article.template && (
                    <>
                        <span>·</span>
                        <span>📋 {article.template.name}</span>
                    </>
                )}
                <span>·</span>
                <span>{article.slug}</span>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 mb-6">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                {isEditable ? (
                    <Input
                        value={tagsInput}
                        onChange={(e) => { setTagsInput(e.target.value); setDirty(true); }}
                        placeholder="Add tags (comma-separated)…"
                        className="text-sm h-8"
                    />
                ) : (
                    <div className="flex items-center gap-1">
                        {article.tags.map(t => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                        {article.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
                    </div>
                )}
            </div>

            <Separator className="mb-6" />

            {/* Content Editor */}
            <div className="mb-8">
                {isEditable ? (
                    <textarea
                        value={content}
                        onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                        className="w-full min-h-[400px] bg-transparent border rounded-lg p-4 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Write your article content in Markdown…"
                    />
                ) : (
                    <Card>
                        <CardContent className="p-6 prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                            {content}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Status Actions */}
            {actions.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-primary" />
                        Actions
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {actions.map(({ targetStatus, label, icon: ActionIcon, variant }) => (
                            <Button
                                key={targetStatus}
                                variant={variant}
                                size="sm"
                                onClick={() => handleStatusChange(targetStatus)}
                                className="gap-1.5"
                            >
                                <ActionIcon className="h-3.5 w-3.5" />
                                {label}
                            </Button>
                        ))}
                        {article.status !== 'published' && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                                className="gap-1.5 ml-auto"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Version History */}
            {article.versions.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-primary" />
                        Version History
                    </h3>
                    <div className="space-y-1.5">
                        {article.versions.map((v) => (
                            <div key={v.id} className="flex items-center gap-3 text-xs text-muted-foreground py-1.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
                                <Badge variant="outline" className="text-[10px] font-mono">v{v.version}</Badge>
                                <span className="flex-1">{v.changeSummary ?? 'No summary'}</span>
                                <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {relativeTime(v.createdAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="text-center text-xs text-muted-foreground/50 pb-8">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘S</kbd> to save
            </div>
        </div>
    );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
