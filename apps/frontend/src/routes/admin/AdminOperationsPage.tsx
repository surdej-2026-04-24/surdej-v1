import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Shield, Play, RefreshCw, CheckCircle, AlertCircle, XCircle,
    FileStack, Loader2, ArrowLeft, FileText, Clock, Zap,
    BarChart3, CircleDot, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTenant } from '@/core/tenants/TenantContext';
import { api } from '@/lib/api';

interface RescanResult {
    message: string;
    total: number;
    queued: number;
    errors: number;
    operation: string;
}

interface Stats {
    total: number;
    processing: number;
    completed: number;
    failed: number;
    avgQuality: number;
}

interface DocumentItem {
    id: string;
    filename: string;
    status: string;
    quality: number | null;
    pageCount: number | null;
    createdAt: string;
    sizeBytes: number;
    metadata: {
        status?: string;
        quality?: number;
        pageCount?: number;
        extractedAt?: string;
        extractedChars?: number;
        extractionEngine?: string;
        extractionDurationMs?: number;
        analyzedAt?: string;
        analysisModel?: string;
        analysisDurationMs?: number;
        hasRentalData?: boolean;
        domain?: string;
    } | null;
    analysis: Record<string, unknown> | null;
}

type Operation = 'both' | 'extract' | 'analyze';
type DocFilter = 'all' | 'completed' | 'processing' | 'failed' | 'analyzed' | 'not-analyzed';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | undefined | null): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

function StatusIcon({ status, hasAnalysis }: { status: string; hasAnalysis: boolean }) {
    if (status === 'completed' && hasAnalysis) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (status === 'completed') {
        return <CircleDot className="h-4 w-4 text-amber-500" />;
    }
    if (status === 'failed') {
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (status === 'processing' || status === 'queued') {
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function QualityBar({ quality }: { quality: number | null }) {
    if (quality == null) return <span className="text-[10px] text-muted-foreground">—</span>;
    const color = quality >= 80 ? 'bg-green-500' : quality >= 60 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${quality}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{quality}</span>
        </div>
    );
}

export function AdminOperationsPage() {
    const navigate = useNavigate();
    const { activeTenant } = useTenant();

    const [stats, setStats] = useState<Stats | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [result, setResult] = useState<RescanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [operation, setOperation] = useState<Operation>('both');
    const [isPolling, setIsPolling] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const [docFilter, setDocFilter] = useState<DocFilter>('all');
    const [prevDocMap, setPrevDocMap] = useState<Map<string, string>>(new Map());
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

    const fetchAll = useCallback(async () => {
        try {
            const [statsData, docsData] = await Promise.all([
                api.get<Stats>('/pdf/stats'),
                api.get<{ documents: DocumentItem[] }>('/pdf/documents?limit=500'),
            ]);
            setStats(statsData);
            setLastRefreshed(new Date());

            // Track which documents changed since last poll
            setDocuments(prev => {
                const oldMap = new Map(prev.map(d => [d.id, d.metadata?.status ?? '']));
                const newChanged = new Set<string>();
                for (const doc of docsData.documents) {
                    const oldStatus = oldMap.get(doc.id);
                    if (oldStatus !== undefined && oldStatus !== (doc.metadata?.status ?? '')) {
                        newChanged.add(doc.id);
                    }
                }
                if (newChanged.size > 0) {
                    setChangedIds(newChanged);
                    setTimeout(() => setChangedIds(new Set()), 2000);
                }
                return docsData.documents;
            });

            return statsData;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll, activeTenant]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const startPolling = useCallback(() => {
        setIsPolling(true);
        setPollCount(0);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            setPollCount(c => c + 1);
            const current = await fetchAll();
            if (current && current.processing === 0) {
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = null;
                setIsPolling(false);
            }
        }, 3000);
    }, [fetchAll]);

    // Auto-start polling if there are documents processing
    useEffect(() => {
        if (stats && stats.processing > 0 && !isPolling) {
            startPolling();
        }
    }, [stats?.processing]);

    const handleTriggerRescan = async () => {
        setIsTriggering(true);
        setError(null);
        setResult(null);
        try {
            const data = await api.post<RescanResult>('/pdf/documents/rescan', {
                documentIds: 'all',
                operation,
            });
            setResult(data);
            await fetchAll();
            startPolling();
        } catch (err: any) {
            setError(err.message || 'Failed to trigger rescan');
        } finally {
            setIsTriggering(false);
        }
    };

    const progressPercent = stats && stats.total > 0
        ? Math.round(((stats.completed + stats.failed) / stats.total) * 100)
        : 0;

    const filteredDocs = useMemo(() => {
        let filtered = documents;
        switch (docFilter) {
            case 'completed': filtered = documents.filter(d => d.metadata?.status === 'completed'); break;
            case 'processing': filtered = documents.filter(d => d.metadata?.status === 'processing' || d.metadata?.status === 'queued'); break;
            case 'failed': filtered = documents.filter(d => d.metadata?.status === 'failed'); break;
            case 'analyzed': filtered = documents.filter(d => d.analysis != null); break;
            case 'not-analyzed': filtered = documents.filter(d => d.analysis == null); break;
        }
        return filtered;
    }, [documents, docFilter]);

    const analyzedCount = documents.filter(d => d.analysis != null).length;

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="mb-4 -ml-2"
                    onClick={() => navigate('/admin')}
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Admin
                </Button>
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-orange-500/10 p-2.5">
                        <FileStack className="h-[22px] w-[22px] text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
                        <Badge variant="destructive" className="mt-1">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin Only
                        </Badge>
                    </div>
                    {isPolling && (
                        <Badge className="text-xs bg-blue-500 animate-pulse ml-auto">
                            LIVE
                        </Badge>
                    )}
                </div>
            </div>

            <Separator className="mb-6" />

            {/* Stats Cards Row */}
            {stats && (
                <div className="grid grid-cols-5 gap-3 mb-6">
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
                        <div className="text-[11px] text-muted-foreground">Total</div>
                    </Card>
                    <Card className={`p-3 text-center transition-all ${stats.processing > 0 ? 'ring-2 ring-blue-500/30' : ''}`}>
                        <div className="text-2xl font-bold tabular-nums text-blue-500">{stats.processing}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                            {stats.processing > 0 && <Loader2 className="h-3 w-3 animate-spin" />}
                            Processing
                        </div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold tabular-nums text-green-500">{stats.completed}</div>
                        <div className="text-[11px] text-muted-foreground">Completed</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold tabular-nums text-red-500">{stats.failed}</div>
                        <div className="text-[11px] text-muted-foreground">Failed</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold tabular-nums text-purple-500">{analyzedCount}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            Analyzed
                        </div>
                    </Card>
                </div>
            )}

            {/* Progress Bar */}
            {stats && stats.total > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            Overall Progress
                        </span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {isPolling && (
                                <span className="flex items-center gap-1 text-blue-500">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    #{pollCount}
                                </span>
                            )}
                            <span>{lastRefreshed && `Updated ${lastRefreshed.toLocaleTimeString()}`}</span>
                        </div>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground">
                            {stats.completed + stats.failed} / {stats.total} documents
                        </span>
                        <span className="text-[11px] font-medium tabular-nums">
                            {progressPercent}%
                        </span>
                    </div>
                </div>
            )}

            {/* Reanalyze Action */}
            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                        PDF Reanalysis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-3 mb-3">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Operation
                            </label>
                            <Select value={operation} onValueChange={(v) => setOperation(v as Operation)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Extract + Analyze (full)</SelectItem>
                                    <SelectItem value="extract">Extract text only</SelectItem>
                                    <SelectItem value="analyze">Analyze only (re-use text)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleTriggerRescan}
                            disabled={isTriggering || isPolling}
                            variant={isPolling ? 'outline' : 'default'}
                            className="gap-2 min-w-[160px]"
                        >
                            {isTriggering ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isPolling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="h-4 w-4" />
                            )}
                            {isTriggering ? 'Triggering...' : isPolling ? 'Running...' : 'Start'}
                        </Button>
                        {!isPolling && (
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchAll} title="Refresh">
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {result && (
                        <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-2.5 flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            <span className="font-medium">{result.message}</span>
                        </div>
                    )}
                    {error && (
                        <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-2.5 flex items-center gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                            <span className="text-red-600">{error}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Document List */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Documents
                            <Badge variant="outline" className="text-[10px] tabular-nums">
                                {filteredDocs.length}
                            </Badge>
                        </CardTitle>
                        <Select value={docFilter} onValueChange={(v) => setDocFilter(v as DocFilter)}>
                            <SelectTrigger className="h-7 w-[150px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All documents</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="analyzed">Analyzed</SelectItem>
                                <SelectItem value="not-analyzed">Not analyzed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Column Headers */}
                    <div className="grid grid-cols-[24px_1fr_80px_64px_70px_80px_64px] gap-2 px-4 py-2 border-b bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        <div></div>
                        <div>Document</div>
                        <div className="text-center">Status</div>
                        <div className="text-center">Pages</div>
                        <div>Quality</div>
                        <div className="text-center">Duration</div>
                        <div className="text-right">Size</div>
                    </div>

                    {/* Document Rows */}
                    <div className="max-h-[520px] overflow-y-auto divide-y">
                        {filteredDocs.map((doc) => {
                            const meta = doc.metadata;
                            const docStatus = meta?.status ?? 'unknown';
                            const hasAnalysis = doc.analysis != null;
                            const isChanged = changedIds.has(doc.id);
                            const isActive = docStatus === 'processing' || docStatus === 'queued';

                            return (
                                <div
                                    key={doc.id}
                                    className={`
                                        grid grid-cols-[24px_1fr_80px_64px_70px_80px_64px] gap-2 px-4 py-2 items-center
                                        text-sm transition-all duration-500
                                        ${isChanged ? 'bg-green-50 dark:bg-green-950/20' : ''}
                                        ${isActive ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}
                                        hover:bg-muted/40
                                    `}
                                >
                                    {/* Status Icon */}
                                    <StatusIcon status={docStatus} hasAnalysis={hasAnalysis} />

                                    {/* Filename */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <button
                                                className="text-sm font-medium truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                                                title={`Open ${doc.filename} audit log`}
                                                onClick={() => navigate(`/modules/pdf-refinery/documents?from=leases&doc=${doc.id}&view=audit`)}
                                            >
                                                {doc.filename}
                                            </button>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                            {meta?.extractionEngine && (
                                                <span className="flex items-center gap-0.5">
                                                    <Zap className="h-2.5 w-2.5" />
                                                    {meta.extractionEngine.replace('azure-document-intelligence', 'Azure DI')}
                                                </span>
                                            )}
                                            {meta?.extractedChars && (
                                                <span>{(meta.extractedChars / 1000).toFixed(1)}k chars</span>
                                            )}
                                            {hasAnalysis && (
                                                <Badge variant="outline" className="text-[8px] py-0 px-1 h-3.5 border-green-300 text-green-600">
                                                    AI
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="text-center">
                                        <Badge
                                            variant={
                                                docStatus === 'completed' ? 'default' :
                                                docStatus === 'failed' ? 'destructive' :
                                                'secondary'
                                            }
                                            className={`text-[10px] ${
                                                docStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                docStatus === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                docStatus === 'queued' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                ''
                                            }`}
                                        >
                                            {docStatus === 'processing' && <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />}
                                            {docStatus}
                                        </Badge>
                                    </div>

                                    {/* Pages */}
                                    <div className="text-center text-xs tabular-nums text-muted-foreground">
                                        {meta?.pageCount ?? '—'}
                                    </div>

                                    {/* Quality */}
                                    <QualityBar quality={meta?.quality ?? null} />

                                    {/* Duration */}
                                    <div className="text-center text-[11px] tabular-nums text-muted-foreground flex items-center justify-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5" />
                                        {formatDuration(meta?.extractionDurationMs)}
                                    </div>

                                    {/* Size */}
                                    <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                                        {formatBytes(doc.sizeBytes)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredDocs.length === 0 && (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No documents match the current filter.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
