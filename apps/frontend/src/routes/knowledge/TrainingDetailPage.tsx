import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, GraduationCap, Loader2, RefreshCw,
    Clock, Users, Play, CheckCircle2, Circle,
    BookOpen, BarChart3, UserPlus, ChevronDown,
    ChevronRight, Trash2, Edit3, Save,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────

interface TrainingLesson {
    title: string;
    type: string;
    durationMinutes: number;
    content: string;
}

interface LearnerProgress {
    id: string;
    userId: string;
    completedItems: string[];
    completionPct: number;
    startedAt: string;
    completedAt: string | null;
    updatedAt: string;
    user: { id: string; displayName: string | null; email: string };
}

interface TrainingModule {
    id: string;
    title: string;
    description: string | null;
    modules: TrainingLesson[];
    difficulty: string;
    durationMinutes: number;
    isPublished: boolean;
    articleId: string | null;
    createdAt: string;
    updatedAt: string;
    progress: LearnerProgress[];
}

// ─── Constants ─────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
    beginner: { label: 'Beginner', color: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-500' },
    intermediate: { label: 'Intermediate', color: 'text-amber-600', gradient: 'from-amber-500 to-orange-500' },
    advanced: { label: 'Advanced', color: 'text-red-600', gradient: 'from-red-500 to-rose-500' },
};

const LESSON_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
    lesson: { icon: BookOpen, color: 'text-emerald-500 bg-emerald-500/10' },
    quiz: { icon: BarChart3, color: 'text-amber-500 bg-amber-500/10' },
    exercise: { icon: Play, color: 'text-blue-500 bg-blue-500/10' },
    assessment: { icon: CheckCircle2, color: 'text-red-500 bg-red-500/10' },
};

// ─── Component ─────────────────────────────────────────────────

export function TrainingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [module, setModule] = useState<TrainingModule | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
    const [showProgress, setShowProgress] = useState(true);

    const fetchModule = useCallback(async (isRefresh = false) => {
        if (!id) return;
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.get<TrainingModule>(`/knowledge/training/${id}`);
            setModule(data);
        } catch (err) {
            console.error('Failed to fetch training module:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchModule(); }, [fetchModule]);

    const handleEnroll = async () => {
        if (!id) return;
        setEnrolling(true);
        try {
            await api.post(`/knowledge/training/${id}/enroll`, {});
            await fetchModule(true);
        } catch (err) {
            console.error('Failed to enroll:', err);
        } finally {
            setEnrolling(false);
        }
    };

    const handleTogglePublish = async () => {
        if (!id || !module) return;
        try {
            await api.put(`/knowledge/training/${id}`, {
                isPublished: !module.isPublished,
            });
            await fetchModule(true);
        } catch (err) {
            console.error('Failed to toggle publish:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!module) {
        return (
            <div className="max-w-4xl mx-auto text-center py-20">
                <h2 className="text-lg font-semibold">Module not found</h2>
                <Button variant="ghost" onClick={() => navigate('/knowledge/training')} className="mt-4">
                    ← Back to Training
                </Button>
            </div>
        );
    }

    const lessons = (module.modules ?? []) as TrainingLesson[];
    const diffConf = DIFFICULTY_CONFIG[module.difficulty] ?? DIFFICULTY_CONFIG['beginner']!;
    const avgCompletion = module.progress.length > 0
        ? Math.round(module.progress.reduce((sum, p) => sum + p.completionPct, 0) / module.progress.length)
        : 0;
    const completedLearners = module.progress.filter(p => p.completedAt).length;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge/training')} className="gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Training
                </Button>
                <div className="flex-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchModule(true)}
                    disabled={refreshing}
                    className="text-muted-foreground"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                    variant={module.isPublished ? 'secondary' : 'default'}
                    size="sm"
                    onClick={handleTogglePublish}
                    className="gap-1.5"
                >
                    {module.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
            </div>

            {/* Title Section */}
            <div className="flex items-start gap-4 mb-8">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${diffConf.gradient} flex items-center justify-center shrink-0`}>
                    <GraduationCap className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight mb-1">{module.title}</h1>
                    {module.description && (
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className={`text-xs ${diffConf.color}`}>
                            {diffConf.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {module.durationMinutes} min
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {module.progress.length} enrolled
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <StatCard
                    label="Lessons"
                    value={lessons.length}
                    icon={BookOpen}
                    color="from-blue-500/10 to-indigo-500/10"
                />
                <StatCard
                    label="Duration"
                    value={`${module.durationMinutes}m`}
                    icon={Clock}
                    color="from-violet-500/10 to-purple-500/10"
                />
                <StatCard
                    label="Enrolled"
                    value={module.progress.length}
                    icon={Users}
                    color="from-emerald-500/10 to-teal-500/10"
                />
                <StatCard
                    label="Avg. Completion"
                    value={`${avgCompletion}%`}
                    icon={BarChart3}
                    color="from-amber-500/10 to-orange-500/10"
                />
            </div>

            {/* Lessons */}
            <div className="mb-8">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Play className="h-3.5 w-3.5 text-primary" />
                    Lessons
                </h2>
                <div className="space-y-2 stagger-children">
                    {lessons.map((lesson, index) => {
                        const lessonConf = LESSON_ICONS[lesson.type] ?? LESSON_ICONS['lesson']!;
                        const LessonIcon = lessonConf.icon;
                        const isExpanded = expandedLesson === index;

                        return (
                            <Card
                                key={index}
                                className={`transition-all duration-200 hover:shadow-md ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}
                            >
                                <CardContent className="p-0">
                                    <div
                                        className="flex items-center gap-3 p-4 cursor-pointer"
                                        onClick={() => setExpandedLesson(isExpanded ? null : index)}
                                    >
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/5 text-xs font-bold text-primary shrink-0">
                                            {index + 1}
                                        </div>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${lessonConf.color}`}>
                                            <LessonIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{lesson.title || 'Untitled'}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                                                <span className="capitalize">{lesson.type}</span>
                                                <span>·</span>
                                                <span>{lesson.durationMinutes} min</span>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                    </div>

                                    {isExpanded && lesson.content && (
                                        <div className="px-4 pb-4 pt-0">
                                            <Separator className="mb-3" />
                                            <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3 text-xs">
                                                {lesson.content}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <Separator className="my-8" />

            {/* Learner Progress */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2
                        className="text-sm font-semibold flex items-center gap-2 cursor-pointer"
                        onClick={() => setShowProgress(!showProgress)}
                    >
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Learner Progress ({module.progress.length})
                        {showProgress ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="gap-1.5 text-xs"
                    >
                        {enrolling ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                        Enroll
                    </Button>
                </div>

                {showProgress && (
                    module.progress.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>No learners enrolled yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 stagger-children">
                            {module.progress.map((prog) => (
                                <Card key={prog.id} className="transition-all duration-200">
                                    <CardContent className="flex items-center gap-4 p-4">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center text-xs font-bold text-blue-600">
                                            {(prog.user.displayName ?? prog.user.email)?.[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">
                                                {prog.user.displayName ?? prog.user.email}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Started {new Date(prog.startedAt).toLocaleDateString()}
                                                {prog.completedAt && ` · Completed ${new Date(prog.completedAt).toLocaleDateString()}`}
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-32 flex items-center gap-2 shrink-0">
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${prog.completionPct >= 100 ? 'bg-emerald-500' :
                                                            prog.completionPct >= 50 ? 'bg-blue-500' :
                                                                'bg-amber-500'
                                                        }`}
                                                    style={{ width: `${Math.min(prog.completionPct, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono w-10 text-right">
                                                {Math.round(prog.completionPct)}%
                                            </span>
                                        </div>
                                        {prog.completedAt && (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Meta */}
            <div className="text-xs text-muted-foreground flex gap-4 mt-8">
                <span>Created: {new Date(module.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(module.updatedAt).toLocaleDateString()}</span>
                <span>ID: <code className="font-mono">{module.id.slice(0, 8)}</code></span>
            </div>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function StatCard({
    label, value, icon: Icon, color,
}: {
    label: string; value: string | number; icon: React.ElementType; color: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2`}>
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-lg font-bold">{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
            </CardContent>
        </Card>
    );
}
