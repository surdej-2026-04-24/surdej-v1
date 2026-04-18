import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    BookOpen, Plus, Search, FileText, Clock, Filter, RefreshCw,
    ChevronRight, Loader2, ArrowRight, Tag, Layers, GraduationCap,
    FolderOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

// ─── Types ─────────────────────────────────────────────────────

interface ArticleSummary {
    id: string;
    title: string;
    slug: string;
    status: string;
    tags: string[];
    authorId: string;
    templateId: string | null;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    author: { id: string; displayName: string | null; email: string };
}

interface ArticlesResponse {
    articles: ArticleSummary[];
    total: number;
    limit: number;
    offset: number;
}

interface TemplateSummary {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    _count: { articles: number };
}

interface TrainingSummary {
    id: string;
    title: string;
    difficulty: string;
    durationMinutes: number;
    isPublished: boolean;
    _count: { progress: number };
}

// ─── Constants ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-600 border-slate-300',
    review: 'bg-amber-500/10 text-amber-600 border-amber-300',
    approved: 'bg-blue-500/10 text-blue-600 border-blue-300',
    published: 'bg-emerald-500/10 text-emerald-600 border-emerald-300',
    archived: 'bg-gray-500/10 text-gray-500 border-gray-300',
};

const STATUSES = ['all', 'draft', 'review', 'approved', 'published', 'archived'] as const;

// ─── Knowledge Hub ─────────────────────────────────────────────

export function KnowledgePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [articles, setArticles] = useState<ArticleSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);
    const [training, setTraining] = useState<TrainingSummary[]>([]);
    const [documentCount, setDocumentCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Status label lookup — uses translated keys
    const statusLabel = (key: string): string => {
        const map: Record<string, string> = {
            all: t('knowledge.status.all'),
            draft: t('knowledge.status.draft'),
            review: t('knowledge.status.review'),
            approved: t('knowledge.status.approved'),
            published: t('knowledge.status.published'),
            archived: t('knowledge.status.archived'),
        };
        return map[key] ?? key;
    };

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            if (statusFilter !== 'all') params.set('status', statusFilter);
            params.set('limit', '20');

            const [articlesRes, templatesRes, trainingRes, documentsRes] = await Promise.allSettled([
                api.get<ArticlesResponse>(`/knowledge/articles?${params}`),
                api.get<TemplateSummary[]>('/knowledge/templates'),
                api.get<TrainingSummary[]>('/knowledge/training'),
                api.get<unknown[]>('/knowledge/documents'),
            ]);

            if (articlesRes.status === 'fulfilled') {
                setArticles(articlesRes.value.articles);
                setTotal(articlesRes.value.total);
            }
            if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value);
            if (trainingRes.status === 'fulfilled') setTraining(trainingRes.value);
            if (documentsRes.status === 'fulfilled') setDocumentCount(documentsRes.value.length);
        } catch {
            // Errors handled by individual allSettled
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateArticle = async () => {
        try {
            // Get current user id from the auth token
            const me = await api.get<{ id: string }>('/auth/me');
            const article = await api.post<ArticleSummary>('/knowledge/articles', {
                title: t('knowledge.untitledArticle'),
                content: t('knowledge.newArticleContent'),
                authorId: me.id,
            });
            navigate(`/knowledge/articles/${article.id}`);
        } catch (err) {
            console.error('Failed to create article:', err);
        }
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <BookOpen className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('knowledge.title')}</h1>
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="text-muted-foreground gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? t('common.refreshing') : t('common.refresh')}
                    </Button>
                    <Button onClick={handleCreateArticle} size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        {t('knowledge.newArticle')}
                    </Button>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('knowledge.subtitle')}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 stagger-children">
                <StatCard
                    icon={FileText}
                    label={t('knowledge.articles')}
                    value={loading ? '…' : String(total)}
                    color="text-blue-500"
                    onClick={() => { }}
                />
                <StatCard
                    icon={Layers}
                    label={t('knowledge.templates')}
                    value={loading ? '…' : String(templates.length)}
                    color="text-violet-500"
                    onClick={() => navigate('/knowledge/templates')}
                />
                <StatCard
                    icon={GraduationCap}
                    label={t('knowledge.training')}
                    value={loading ? '…' : String(training.length)}
                    color="text-emerald-500"
                    onClick={() => navigate('/knowledge/training')}
                />
                <StatCard
                    icon={FolderOpen}
                    label={t('knowledge.documents')}
                    value={loading ? '…' : String(documentCount)}
                    color="text-amber-500"
                    onClick={() => navigate('/knowledge/documents')}
                />
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('knowledge.searchArticles')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    {STATUSES.map((s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(s)}
                            className="text-xs"
                        >
                            {statusLabel(s)}
                        </Button>
                    ))}
                </div>
            </div>

            <Separator className="mb-6" />

            {/* Article List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                        <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-1">{t('knowledge.noArticles')}</h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        {t('knowledge.noArticlesDesc')}
                    </p>
                    <Button onClick={handleCreateArticle} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        {t('knowledge.createArticle')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2 stagger-children">
                    {articles.map((article) => (
                        <ArticleRow
                            key={article.id}
                            article={article}
                            statusLabel={statusLabel}
                            onClick={() => navigate(`/knowledge/articles/${article.id}`)}
                        />
                    ))}

                    {total > articles.length && (
                        <p className="text-xs text-center text-muted-foreground pt-4">
                            {t('knowledge.showingCount', { shown: articles.length, total })}
                        </p>
                    )}
                </div>
            )}

            {/* Quick Links */}
            {(templates.length > 0 || training.length > 0) && (
                <>
                    <Separator className="my-8" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Templates */}
                        {templates.length > 0 && (
                            <TemplatesSection templates={templates} navigate={navigate} />
                        )}

                        {/* Training */}
                        {training.length > 0 && (
                            <TrainingSection training={training} navigate={navigate} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function TemplatesSection({ templates, navigate }: { templates: TemplateSummary[]; navigate: ReturnType<typeof useNavigate> }) {
    const { t } = useTranslation();
    return (
        <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
                {t('knowledge.templates')}
            </h2>
            <div className="space-y-2">
                {templates.slice(0, 5).map((tmpl) => (
                    <Card
                        key={tmpl.id}
                        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                        onClick={() => navigate(`/knowledge/templates/${tmpl.id}`)}
                    >
                        <CardContent className="flex items-center gap-3 p-3">
                            <Layers className="h-4 w-4 text-violet-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{tmpl.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {tmpl._count.articles !== 1
                                        ? t('knowledge.articleCountPlural', { count: tmpl._count.articles })
                                        : t('knowledge.articleCount', { count: tmpl._count.articles })}
                                </div>
                            </div>
                            {tmpl.isDefault && <Badge variant="outline" className="text-[10px]">{t('common.default')}</Badge>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function TrainingSection({ training, navigate }: { training: TrainingSummary[]; navigate: ReturnType<typeof useNavigate> }) {
    const { t } = useTranslation();
    return (
        <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
                {t('knowledge.trainingModules')}
            </h2>
            <div className="space-y-2">
                {training.slice(0, 5).map((tr) => (
                    <Card
                        key={tr.id}
                        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                        onClick={() => navigate(`/knowledge/training/${tr.id}`)}
                    >
                        <CardContent className="flex items-center gap-3 p-3">
                            <GraduationCap className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{tr.title}</div>
                                <div className="text-xs text-muted-foreground">
                                    {tr.durationMinutes}min · {tr.difficulty} · {tr._count.progress !== 1
                                        ? t('knowledge.learnerCountPlural', { count: tr._count.progress })
                                        : t('knowledge.learnerCount', { count: tr._count.progress })}
                                </div>
                            </div>
                            {tr.isPublished && <Badge variant="default" className="text-[10px]">{t('knowledge.published')}</Badge>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color, onClick }: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
    onClick: () => void;
}) {
    return (
        <Card
            className="group cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            onClick={onClick}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className={`h-[18px] w-[18px] ${color}`} />
                    </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
                <div className="text-xl font-bold tracking-tight">{value}</div>
            </CardContent>
        </Card>
    );
}

function ArticleRow({ article, statusLabel, onClick }: { article: ArticleSummary; statusLabel: (key: string) => string; onClick: () => void }) {
    const { t } = useTranslation();
    const color = STATUS_COLORS[article.status] ?? STATUS_COLORS['draft']!;

    return (
        <Card
            className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
            onClick={onClick}
        >
            <CardContent className="flex items-center gap-4 p-4">
                <div
                    className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center shrink-0"
                >
                    <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{article.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{article.author.displayName ?? article.author.email}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(article.updatedAt, t)}
                        </span>
                    </div>
                </div>
                {article.tags.length > 0 && (
                    <div className="hidden md:flex items-center gap-1 shrink-0">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {article.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                        ))}
                    </div>
                )}
                <Badge variant="outline" className={`text-[10px] shrink-0 ${color}`}>
                    {statusLabel(article.status)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </CardContent>
        </Card>
    );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr: string | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('time.justNow');
    if (mins < 60) return t('time.minutesAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('time.hoursAgo', { count: hrs });
    const days = Math.floor(hrs / 24);
    return t('time.daysAgo', { count: days });
}
