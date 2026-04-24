import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router';
import {
    Workflow, Activity, BarChart3, ChevronRight, User as UserIcon, ArrowLeft, ExternalLink, Shield
} from 'lucide-react';

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

export function AdminWorkflowInspectionPage() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<WorkflowSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<{ items: WorkflowSession[] }>('/module/tool-management-tools/admin/sessions')
            .then((res) => {
                setSessions(res.items);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const activeCount = sessions.filter(s => s.status === 'active').length;
    const completedCount = sessions.filter(s => s.status === 'completed').length;

    return (
        <div className="flex flex-col h-full -m-6 animate-fade-in">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Admin
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Tilbage til Admin</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold">Workflow Inspektion</span>
                </div>

                <div className="flex items-center gap-1.5 ml-1">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {sessions.length} total
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 text-emerald-600">
                        {activeCount} aktive
                    </Badge>
                </div>
            </div>

            {/* Main area */}
            <div className="flex flex-1 min-h-0 overflow-hidden bg-muted/10">
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse text-sm">
                            Indlæser workflows...
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            Ingen workflows fundet.
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto grid gap-3">
                            {sessions.map((session) => (
                                <Card 
                                    key={session.id} 
                                    className="hover:shadow-md transition-all cursor-pointer group"
                                    onClick={() => navigate(`/modules/workflow/inspector/${session.id}`)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                                <Activity className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-sm truncate">{session.useCase?.label || session.useCaseId}</span>
                                                    <Badge variant={session.status === 'active' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                        {session.status}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono text-muted-foreground bg-muted/30">
                                                        {session.id.slice(0, 8)}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span className="flex items-center gap-1.5 bg-muted/50 px-1.5 py-0.5 rounded">
                                                        <UserIcon className="h-3 w-3" />
                                                        <span className="truncate max-w-[120px]">{session.userId}</span>
                                                    </span>
                                                    <span>• Trin {session.currentStepIdx + 1}</span>
                                                    <span>• Sidst opdateret: {new Date(session.updatedAt).toLocaleString('da-DK')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs font-medium">Åbn Inspector</span>
                                            <ExternalLink className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
