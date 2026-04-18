import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    FolderKanban, Plus, Clock, CheckCircle2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/core/i18n';

// Simulated projects for the initial UI
const SAMPLE_PROJECTS = [
    { id: '1', name: 'SharePoint Document Migration', status: 'active', members: 3, tasks: 12, completed: 8, updated: '2h ago' },
    { id: '2', name: 'Knowledge Base v2', status: 'active', members: 2, tasks: 24, completed: 18, updated: '30 min ago' },
    { id: '3', name: 'Document Processing Pipeline', status: 'planning', members: 4, tasks: 8, completed: 0, updated: '1 day ago' },
    { id: '4', name: 'PDF Refinery Optimization', status: 'completed', members: 2, tasks: 15, completed: 15, updated: '3 days ago' },
];

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-500/10 text-green-700 border-green-500/30',
    planning: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    completed: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    archived: 'bg-muted text-muted-foreground',
};

const STATUS_KEYS: Record<string, string> = {
    active: 'projects.statusActive',
    planning: 'projects.statusPlanning',
    completed: 'projects.statusCompleted',
    archived: 'projects.statusArchived',
};

export function ProjectsPage() {
    const { t } = useTranslation();

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <FolderKanban className="h-[22px] w-[22px] text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t('projects.title')}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t('projects.subtitle')}
                            </p>
                        </div>
                    </div>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        {t('projects.newProject')}
                    </Button>
                </div>
            </div>

            <Separator className="mb-8" />

            {/* Project grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_PROJECTS.map((project) => {
                    const progress = project.tasks > 0 ? Math.round((project.completed / project.tasks) * 100) : 0;

                    return (
                        <Card key={project.id} className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-semibold text-sm">{project.name}</h3>
                                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[project.status] ?? ''}`}>
                                        {t(STATUS_KEYS[project.status] ?? 'projects.statusActive')}
                                    </Badge>
                                </div>

                                {/* Progress */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                        <span>{t('projects.tasks', { completed: project.completed, total: project.tasks })}</span>
                                        <span className="tabular-nums">{progress}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {t('projects.members', { count: project.members })}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {project.status === 'completed'
                                            ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            : <Clock className="h-3 w-3" />
                                        }
                                        {project.updated}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
