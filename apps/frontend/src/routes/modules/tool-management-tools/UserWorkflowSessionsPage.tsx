import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router';
import { Workflow, Activity, ArrowRight, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/core/i18n';
import { listAllSessions } from './use-case-api';

interface WorkflowSession {
    id: string;
    useCaseId: string;
    userId: string;
    status: string;
    currentStepIdx: number;
    updatedAt: string;
    useCase: {
        label: string;
        icon: string;
    };
}

export function UserWorkflowSessionsPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<WorkflowSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listAllSessions()
            .then((res) => {
                setSessions(res.items);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">{t('workflow.loadingSessions')}</div>;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 rounded-xl bg-primary/10">
                    <Workflow className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('workflow.mySessions')}</h1>
                    <p className="text-sm text-muted-foreground">{t('workflow.mySessionsDesc')}</p>
                </div>
            </div>

            {sessions.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-12 text-center text-muted-foreground">
                        {t('workflow.noSessions')}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {sessions.map((session) => (
                        <Card 
                            key={session.id} 
                            className="hover:shadow-sm transition-all cursor-pointer group"
                            onClick={() => navigate(`/modules/workflow/inspector/${session.id}`)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Activity className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-sm">{session.useCase?.label || session.useCaseId}</span>
                                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                {session.status}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('workflow.stepOf').replace('{current}', String(session.currentStepIdx + 1))} • {t('workflow.updated').replace('{date}', new Date(session.updatedAt).toLocaleString('da-DK'))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs mr-2">{t('workflow.openInspector')}</span>
                                    <ExternalLink className="h-4 w-4" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
