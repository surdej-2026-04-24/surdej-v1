import { useNavigate } from 'react-router';
import { useJobs } from './JobContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function JobIndicator() {
    const { activeJobs, completedJobs, dismissJob } = useJobs();
    const navigate = useNavigate();

    const totalActive = activeJobs.length;
    const hasActive = totalActive > 0;

    if (!hasActive && completedJobs.length === 0) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={cn("h-8 gap-2 relative", hasActive ? "text-primary" : "text-muted-foreground")}>
                    {hasActive ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs font-medium">{totalActive} Job{totalActive > 1 ? 's' : ''} running</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">Jobs</span>
                        </>
                    )}
                    {/* Badge for unread completions could go here */}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Background Jobs</h4>
                    <Button variant="ghost" size="xs" className="h-6 text-[10px]" onClick={() => navigate('/jobs')}>
                        View all
                    </Button>
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-1">
                        {activeJobs.length === 0 && completedJobs.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No recent jobs.
                            </div>
                        )}

                        {/* Active Jobs */}
                        {activeJobs.map(job => (
                            <div key={job.id} className="flex items-start gap-3 p-2 rounded-md bg-primary/5 border border-primary/10">
                                <Loader2 className="h-4 w-4 mt-0.5 text-primary animate-spin" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{formatJobType(job.type)}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 flex-1 bg-primary/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${job.progress}%` }} />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{job.progress}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Completed Jobs (Last 5) */}
                        {completedJobs.slice(0, 5).map(job => (
                            <div key={job.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group relative">
                                {job.status === 'completed' ? (
                                    <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{formatJobType(job.type)}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {job.status === 'completed' ? 'Completed' : 'Failed'} • {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                                    </p>
                                    {job.error && (
                                        <p className="text-[10px] text-destructive mt-1 line-clamp-2 bg-destructive/5 p-1 rounded">
                                            {job.error}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissJob(job.id);
                                    }}
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <div className="text-[10px]">×</div>
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

function formatJobType(type: string) {
    switch (type) {
        case 'export_tenant': return 'Export Tenant Data';
        case 'import_tenant': return 'Import Tenant Data';
        case 'copy_tenant': return 'Copy Tenant';
        default: return type.replace(/_/g, ' ');
    }
}
