import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft, GraduationCap, Plus, Loader2, RefreshCw,
    Clock, Users, BarChart3, BookOpen, Save, ChevronRight,
    Play, CheckCircle2, CircleDot, Trophy,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────

interface TrainingLesson {
    title: string;
    type: string;
    durationMinutes: number;
    content: string;
}

interface TrainingModule {
    id: string;
    title: string;
    description: string | null;
    modules: TrainingLesson[];  // Prisma JSON field name is `modules`
    difficulty: string;
    durationMinutes: number;
    isPublished: boolean;
    articleId: string | null;
    createdAt: string;
    updatedAt: string;
    article?: { id: string; title: string } | null;
    _count: { progress: number };
    progress?: LearnerProgress[];
}

interface LearnerProgress {
    id: string;
    userId: string;
    completedLessons: number[];
    totalLessons: number;
    startedAt: string;
    completedAt: string | null;
    user: { id: string; displayName: string | null; email: string };
}

// ─── Constants ─────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
    beginner: { label: 'Beginner', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-300' },
    intermediate: { label: 'Intermediate', color: 'bg-amber-500/10 text-amber-600 border-amber-300' },
    advanced: { label: 'Advanced', color: 'bg-red-500/10 text-red-600 border-red-300' },
};

const LESSON_TYPES = [
    { value: 'lesson', label: 'Lesson' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'exercise', label: 'Exercise' },
    { value: 'assessment', label: 'Assessment' },
];

// ─── Component ─────────────────────────────────────────────────

export function TrainingPage() {
    const navigate = useNavigate();
    const [modules, setModules] = useState<TrainingModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newDifficulty, setNewDifficulty] = useState('beginner');
    const [newLessons, setNewLessons] = useState<TrainingLesson[]>([
        { title: 'Introduction', type: 'lesson', durationMinutes: 15, content: '' },
    ]);
    const [saving, setSaving] = useState(false);

    const fetchModules = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.get<TrainingModule[]>('/knowledge/training');
            setModules(data);
        } catch (err) {
            console.error('Failed to fetch training:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchModules(); }, [fetchModules]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        setSaving(true);
        try {
            const totalDuration = newLessons.reduce((sum, l) => sum + l.durationMinutes, 0);
            await api.post('/knowledge/training', {
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                modules: newLessons,  // API schema uses `modules` for the lessons JSON field
                difficulty: newDifficulty,
                durationMinutes: totalDuration,
            });
            setNewTitle('');
            setNewDescription('');
            setNewLessons([{ title: 'Introduction', type: 'lesson', durationMinutes: 15, content: '' }]);
            setNewDifficulty('beginner');
            setShowCreate(false);
            await fetchModules(true);
        } catch (err) {
            console.error('Failed to create training:', err);
        } finally {
            setSaving(false);
        }
    };

    const addLesson = () => {
        setNewLessons([...newLessons, { title: '', type: 'lesson', durationMinutes: 10, content: '' }]);
    };

    const updateLesson = (index: number, updates: Partial<TrainingLesson>) => {
        setNewLessons(lessons =>
            lessons.map((l, i) => i === index ? { ...l, ...updates } : l),
        );
    };

    const removeLesson = (index: number) => {
        setNewLessons(lessons => lessons.filter((_, i) => i !== index));
    };

    const totalDuration = newLessons.reduce((sum, l) => sum + l.durationMinutes, 0);

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
                    onClick={() => fetchModules(true)}
                    disabled={refreshing}
                    className="text-muted-foreground"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    New Module
                </Button>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-emerald-500/10 p-2.5">
                    <GraduationCap className="h-[22px] w-[22px] text-emerald-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Training</h1>
                    <p className="text-sm text-muted-foreground">
                        Create learning modules with lessons, quizzes, and exercises.
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            {modules.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <MiniStat icon={BookOpen} label="Modules" value={modules.length} />
                    <MiniStat
                        icon={Clock}
                        label="Total Duration"
                        value={`${modules.reduce((sum, m) => sum + m.durationMinutes, 0)}m`}
                    />
                    <MiniStat
                        icon={Users}
                        label="Learners"
                        value={modules.reduce((sum, m) => sum + m._count.progress, 0)}
                    />
                    <MiniStat
                        icon={CheckCircle2}
                        label="Published"
                        value={modules.filter(m => m.isPublished).length}
                    />
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <Card className="mb-6 animate-slide-up">
                    <CardContent className="p-5 space-y-4">
                        <h3 className="font-semibold text-sm">New Training Module</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                                placeholder="Module title"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Difficulty:</span>
                            {Object.entries(DIFFICULTY_CONFIG).map(([key, conf]) => (
                                <Button
                                    key={key}
                                    variant={newDifficulty === key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setNewDifficulty(key)}
                                    className="text-xs"
                                >
                                    {conf.label}
                                </Button>
                            ))}
                            <div className="flex-1" />
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {totalDuration} min total
                            </span>
                        </div>

                        <Separator />

                        {/* Lessons Builder */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lessons</h4>
                                <Button variant="ghost" size="sm" onClick={addLesson} className="gap-1 text-xs">
                                    <Plus className="h-3 w-3" />
                                    Add Lesson
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {newLessons.map((lesson, index) => (
                                    <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0 mt-0.5">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Lesson title"
                                                    value={lesson.title}
                                                    onChange={(e) => updateLesson(index, { title: e.target.value })}
                                                    className="flex-1 h-8 text-sm"
                                                />
                                                <select
                                                    value={lesson.type}
                                                    onChange={(e) => updateLesson(index, { type: e.target.value })}
                                                    className="h-8 px-2 border rounded-md text-xs bg-background"
                                                >
                                                    {LESSON_TYPES.map((lt) => (
                                                        <option key={lt.value} value={lt.value}>{lt.label}</option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        value={lesson.durationMinutes}
                                                        onChange={(e) => updateLesson(index, { durationMinutes: parseInt(e.target.value) || 0 })}
                                                        className="w-16 h-8 text-xs text-center"
                                                        min={1}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground">min</span>
                                                </div>
                                            </div>
                                            <textarea
                                                placeholder="Lesson content (Markdown)…"
                                                value={lesson.content}
                                                onChange={(e) => updateLesson(index, { content: e.target.value })}
                                                className="w-full border rounded-md p-2 text-xs font-mono resize-y min-h-[60px] bg-background"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                            onClick={() => removeLesson(index)}
                                            disabled={newLessons.length <= 1}
                                        >
                                            ✕
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleCreate} disabled={saving || !newTitle.trim()} className="gap-1.5">
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                {saving ? 'Creating…' : 'Create Module'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Separator className="mb-6" />

            {/* Module List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : modules.length === 0 && !showCreate ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                        <GraduationCap className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-1">No training modules</h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Create training modules with lessons, quizzes, and exercises for your team.
                    </p>
                    <Button onClick={() => setShowCreate(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Create Module
                    </Button>
                </div>
            ) : (
                <div className="space-y-3 stagger-children">
                    {modules.map((mod) => {
                        const diffConf = DIFFICULTY_CONFIG[mod.difficulty] ?? DIFFICULTY_CONFIG['beginner']!;
                        const lessonCount = (mod.modules as TrainingLesson[]).length;

                        return (
                            <Card
                                key={mod.id}
                                className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                                onClick={() => navigate(`/knowledge/training/${mod.id}`)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center shrink-0">
                                            <GraduationCap className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm">{mod.title}</div>
                                            {mod.description && (
                                                <div className="text-xs text-muted-foreground truncate">{mod.description}</div>
                                            )}
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] ${diffConf.color}`}>
                                            {diffConf.label}
                                        </Badge>
                                        {mod.isPublished && (
                                            <Badge variant="default" className="text-[10px]">Published</Badge>
                                        )}
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </div>

                                    {/* Lesson Preview Bar */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Play className="h-3 w-3" />
                                            {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {mod.durationMinutes} min
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {mod._count.progress} learner{mod._count.progress !== 1 ? 's' : ''}
                                        </span>
                                        {mod.article && (
                                            <span className="flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" />
                                                {mod.article.title}
                                            </span>
                                        )}
                                    </div>

                                    {/* Lesson Progress Dots */}
                                    {lessonCount > 0 && (
                                        <div className="flex items-center gap-1 mt-2">
                                            {(mod.modules as TrainingLesson[]).map((lesson, i) => (
                                                <div
                                                    key={i}
                                                    className="group/dot relative"
                                                    title={`${lesson.title} (${lesson.type}, ${lesson.durationMinutes}m)`}
                                                >
                                                    <div className={`w-4 h-1.5 rounded-full transition-colors ${lesson.type === 'quiz' ? 'bg-amber-400/60' :
                                                        lesson.type === 'exercise' ? 'bg-blue-400/60' :
                                                            lesson.type === 'assessment' ? 'bg-red-400/60' :
                                                                'bg-emerald-400/60'
                                                        }`} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-lg font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}
