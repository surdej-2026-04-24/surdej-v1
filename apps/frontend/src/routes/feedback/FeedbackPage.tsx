import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    MessageSquarePlus, Camera, Mic, Video, Navigation,
    Clock, CheckCircle2, Pause, ChevronRight, Trash2,
    Download, ExternalLink, Play, Image, Globe, Calendar,
    Timer, RotateCcw, MessageSquare, FileCode2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    useFeedbackStore,
    getAllSessions,
    getScreenshotBlobByPath,
    getRecordingBlobByPath,
    type FeedbackSession,
} from '@/core/feedback/feedbackStore';
import type { FeedbackChatTranscript } from '@/core/feedback/feedbackStore';
import { useTranslation } from '@/core/i18n';

// ── Session status helper ──

function useStatusBadge() {
    const { t } = useTranslation();
    return (status: FeedbackSession['status']) => {
        switch (status) {
            case 'active':
                return (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                        {t('feedback.statusActive')}
                    </Badge>
                );
            case 'paused':
                return (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]">
                        <Pause className="h-3 w-3 mr-1" />
                        {t('feedback.statusPaused')}
                    </Badge>
                );
            case 'completed':
                return (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t('feedback.statusCompleted')}
                    </Badge>
                );
        }
    };
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getSessionDuration(session: FeedbackSession): string {
    const start = new Date(session.createdAt).getTime();
    const end = session.completedAt
        ? new Date(session.completedAt).getTime()
        : Date.now();
    return formatDuration((end - start) / 1000);
}

// ── Main Page ──

export function FeedbackPage() {
    const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const statusBadge = useStatusBadge();
    const [sessions, setSessions] = useState<FeedbackSession[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(urlSessionId ?? null);
    const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');
    const activeSession = useFeedbackStore((s) => s.activeSession);

    const selectSession = useCallback((id: string | null) => {
        setSelectedId(id);
        if (id) {
            navigate(`/feedback/${id}`, { replace: true });
        } else {
            navigate('/feedback', { replace: true });
        }
    }, [navigate]);

    const loadSessions = useCallback(async () => {
        try {
            const all = await getAllSessions();
            setSessions(all);
        } catch (err) {
            console.error('Failed to load feedback sessions:', err);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Auto-select from URL deep-link
    useEffect(() => {
        if (urlSessionId && urlSessionId !== selectedId) {
            setSelectedId(urlSessionId);
        }
    }, [urlSessionId]);

    // Refresh list when active session changes (e.g., completed)
    useEffect(() => {
        loadSessions();
    }, [activeSession, loadSessions]);

    const filteredSessions = sessions.filter((s) => {
        if (filterMode === 'active') return s.status === 'active' || s.status === 'paused';
        if (filterMode === 'completed') return s.status === 'completed';
        return true;
    });

    const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

    const filterLabels: Record<string, string> = {
        all: t('feedback.filterAll'),
        active: t('feedback.filterActive'),
        completed: t('feedback.filterCompleted'),
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <MessageSquarePlus className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold tracking-tight">{t('feedback.title')}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('feedback.pageSubtitle')}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadSessions}
                        className="gap-1.5"
                    >
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>

            <Separator className="mb-6" />

            <div className="flex gap-6 min-h-[60vh]">
                {/* Left: session list */}
                <div className="w-80 shrink-0 space-y-3">
                    {/* Filter tabs */}
                    <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                        {(['all', 'active', 'completed'] as const).map((mode) => (
                            <button
                                key={mode}
                                className={cn(
                                    'flex-1 text-xs py-1.5 rounded-md transition-colors',
                                    filterMode === mode ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => setFilterMode(mode)}
                            >
                                {filterLabels[mode]}
                                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                                    {sessions.filter((s) => {
                                        if (mode === 'active') return s.status === 'active' || s.status === 'paused';
                                        if (mode === 'completed') return s.status === 'completed';
                                        return true;
                                    }).length}
                                </Badge>
                            </button>
                        ))}
                    </div>

                    {/* Sessions */}
                    {filteredSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <MessageSquarePlus className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">{t('feedback.noSessions')}</p>
                            <p className="text-xs mt-1">{t('feedback.noSessionsDesc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredSessions.map((session) => {
                                const isActive = selectedId === session.id;
                                return (
                                    <button
                                        key={session.id}
                                        className={cn(
                                            'w-full text-left p-3 rounded-lg transition-all border',
                                            isActive
                                                ? 'bg-primary/5 border-primary/30 shadow-sm'
                                                : 'border-transparent hover:bg-muted/50',
                                        )}
                                        onClick={() => selectSession(session.id)}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium truncate">
                                                        {session.title}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                    {session.description || t('feedback.noDescription')}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    {statusBadge(session.status)}
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {formatDate(session.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                                    {session.screenshots.length > 0 && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Camera className="h-2.5 w-2.5" />
                                                            {session.screenshots.length}
                                                        </span>
                                                    )}
                                                    {session.voiceRecordings.length > 0 && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Mic className="h-2.5 w-2.5" />
                                                            {session.voiceRecordings.length}
                                                        </span>
                                                    )}
                                                    {session.videoRecordings.length > 0 && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Video className="h-2.5 w-2.5" />
                                                            {session.videoRecordings.length}
                                                        </span>
                                                    )}
                                                    {session.navigationHistory.length > 0 && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Navigation className="h-2.5 w-2.5" />
                                                            {session.navigationHistory.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: session detail */}
                <div className="flex-1 min-w-0">
                    {selectedSession ? (
                        <SessionDetail session={selectedSession} onRefresh={loadSessions} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-20">
                            <MessageSquarePlus className="h-16 w-16 mb-4 opacity-10" />
                            <p className="text-lg font-medium mb-1">{t('feedback.selectSession')}</p>
                            <p className="text-sm max-w-sm">
                                {t('feedback.selectSessionDesc')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Session Detail ──

function SessionDetail({ session, onRefresh }: { session: FeedbackSession; onRefresh: () => void }) {
    const { t } = useTranslation();
    const statusBadge = useStatusBadge();
    const activeSession = useFeedbackStore((s) => s.activeSession);
    const resumeSessionById = useFeedbackStore((s) => s.resumeSessionById);
    const canResume = session.status !== 'active' && !activeSession;

    const handleResume = async () => {
        await resumeSessionById(session.id);
        onRefresh();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Title + meta */}
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <h2 className="text-xl font-bold">{session.title}</h2>
                    {session.description && (
                        <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <a href={`/modules/core-issues/new?feedbackSessionId=${session.id}&title=${encodeURIComponent(session.title)}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            {t('feedback.createTicket')}
                        </Button>
                    </a>
                    {canResume && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResume}
                            className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t('feedback.resume')}
                        </Button>
                    )}
                    {statusBadge(session.status)}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3">
                <StatCard icon={Timer} label={t('feedback.duration')} value={getSessionDuration(session)} />
                <StatCard icon={Navigation} label={t('feedback.pages')} value={String(session.navigationHistory.length)} />
                <StatCard icon={Camera} label={t('feedback.screenshots')} value={String(session.screenshots.length)} />
                <StatCard icon={Mic} label={t('feedback.audio')} value={String(session.voiceRecordings.length)} />
                <StatCard icon={Video} label={t('feedback.video')} value={String(session.videoRecordings.length)} />
                {(session.chatTranscripts?.length ?? 0) > 0 && (
                    <StatCard icon={MessageSquare} label={t('feedback.chats')} value={String(session.chatTranscripts.length)} />
                )}
            </div>

            <Separator />

            {/* Navigation History */}
            {session.navigationHistory.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        {t('feedback.navigationHistory')}
                    </h3>
                    <div className="space-y-1">
                        {session.navigationHistory.map((nav, idx) => (
                            <div
                                key={nav.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 text-xs group"
                            >
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{nav.title || nav.url}</p>
                                    <p className="text-muted-foreground truncate font-mono text-[10px]">{nav.url}</p>
                                </div>
                                {nav.duration !== undefined && (
                                    <span className="text-muted-foreground text-[10px] shrink-0">
                                        {formatDuration(nav.duration)}
                                    </span>
                                )}
                                <span className="text-muted-foreground text-[10px] shrink-0">
                                    {formatDate(nav.timestamp)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Screenshots */}
            {session.screenshots.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Image className="h-3.5 w-3.5" />
                        {t('feedback.screenshotsSection', { count: session.screenshots.length })}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {session.screenshots.map((ss) => (
                            <ScreenshotCard key={ss.id} blobPath={ss.blobPath} url={ss.url} timestamp={ss.timestamp} />
                        ))}
                    </div>
                </div>
            )}

            {/* Voice Recordings */}
            {session.voiceRecordings.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5" />
                        {t('feedback.audioRecordings', { count: session.voiceRecordings.length })}
                    </h3>
                    <div className="space-y-2">
                        {session.voiceRecordings.map((rec) => (
                            <AudioCard key={rec.id} blobPath={rec.blobPath} duration={rec.duration} timestamp={rec.timestamp} />
                        ))}
                    </div>
                </div>
            )}

            {/* Video Recordings */}
            {session.videoRecordings.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5" />
                        {t('feedback.videoRecordings', { count: session.videoRecordings.length })}
                    </h3>
                    <div className="space-y-3">
                        {session.videoRecordings.map((rec) => (
                            <VideoCard key={rec.id} blobPath={rec.blobPath} duration={rec.duration} timestamp={rec.timestamp} />
                        ))}
                    </div>
                </div>
            )}

            {/* Context info */}
            <Card className="bg-muted/30">
                <CardContent className="p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {t('feedback.sessionInfo')}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-muted-foreground">{t('feedback.startUrl')}</span>{' '}
                            <span className="font-mono break-all">{session.startUrl}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">{t('feedback.createdAt')}</span>{' '}
                            <span>{new Date(session.createdAt).toLocaleString()}</span>
                        </div>
                        {session.completedAt && (
                            <div>
                                <span className="text-muted-foreground">{t('feedback.completedAt')}</span>{' '}
                                <span>{new Date(session.completedAt).toLocaleString()}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-muted-foreground">{t('feedback.sessionId')}</span>{' '}
                            <span className="font-mono text-[10px]">{session.id}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">{t('feedback.deepLink')}</span>{' '}
                            <span className="font-mono text-[10px] break-all">
                                {window.location.origin}/feedback/{session.id}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Chat Transcripts */}
            {(session.chatTranscripts?.length ?? 0) > 0 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t('feedback.chatTranscripts', { count: session.chatTranscripts.length })}
                    </h3>
                    <div className="space-y-3">
                        {session.chatTranscripts.map((transcript) => (
                            <ChatTranscriptCard key={transcript.id} transcript={transcript} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Stat Card ──

function StatCard({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
    return (
        <Card>
            <CardContent className="p-3 flex flex-col items-center gap-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-bold">{value}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
            </CardContent>
        </Card>
    );
}

// ── Screenshot Card ──

function ScreenshotCard({ blobPath, url, timestamp }: { blobPath: string; url: string; timestamp: string }) {
    const [imgSrc, setImgSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        getScreenshotBlobByPath(blobPath).then((blob) => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setImgSrc(objectUrl);
            }
        });
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [blobPath]);

    return (
        <Card className="overflow-hidden group">
            <CardContent className="p-0 relative">
                {imgSrc ? (
                    <img src={imgSrc} alt="Screenshot" className="w-full h-40 object-cover object-top rounded-t-lg" />
                ) : (
                    <div className="w-full h-40 bg-muted/50 flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                )}
                <div className="p-2 text-[10px] text-muted-foreground space-y-0.5">
                    <p className="truncate font-mono">{url}</p>
                    <p>{formatDate(timestamp)}</p>
                </div>
                {imgSrc && (
                    <a
                        href={imgSrc}
                        download={`screenshot.png`}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Button variant="secondary" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                    </a>
                )}
            </CardContent>
        </Card>
    );
}

// ── Audio Card ──

function AudioCard({ blobPath, duration, timestamp }: { blobPath: string; duration: number; timestamp: string }) {
    const { t } = useTranslation();
    const [audioSrc, setAudioSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        getRecordingBlobByPath(blobPath).then((blob) => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setAudioSrc(objectUrl);
            }
        });
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [blobPath]);

    return (
        <Card>
            <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Mic className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                    {audioSrc ? (
                        <audio controls src={audioSrc} className="w-full h-8" />
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
                    )}
                </div>
                <div className="text-right text-[10px] text-muted-foreground shrink-0">
                    <p>{formatDuration(duration)}</p>
                    <p>{formatDate(timestamp)}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Video Card ──

function VideoCard({ blobPath, duration, timestamp }: { blobPath: string; duration: number; timestamp: string }) {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        getRecordingBlobByPath(blobPath).then((blob) => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setVideoSrc(objectUrl);
            }
        });
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [blobPath]);

    return (
        <Card>
            <CardContent className="p-3 space-y-2">
                {videoSrc ? (
                    <video controls src={videoSrc} className="w-full rounded-lg max-h-64" />
                ) : (
                    <div className="w-full h-40 bg-muted/50 rounded-lg flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{formatDuration(duration)}</span>
                    <span>{formatDate(timestamp)}</span>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Chat Transcript Card ──

function ChatTranscriptCard({ transcript }: { transcript: FeedbackChatTranscript }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyAsYaml = async () => {
        const yaml = [
            `# Chat Transcript`,
            `conversation_id: "${transcript.conversationId}"`,
            `title: "${transcript.conversationTitle ?? 'Untitled'}"`,
            `model: "${transcript.model}"`,
            `message_count: ${transcript.messageCount}`,
            `captured_at: "${transcript.timestamp}"`,
            `url: "${transcript.url}"`,
            ``,
            `messages:`,
            ...transcript.messages.map((m) => [
                `  - role: "${m.role}"`,
                ...(m.createdAt ? [`    created_at: "${m.createdAt}"`] : []),
                `    content: |`,
                ...m.content.split('\n').map((line) => `      ${line}`),
            ]).flat(),
        ].join('\n');

        try {
            await navigator.clipboard.writeText(yaml);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    return (
        <Card>
            <CardContent className="p-0">
                {/* Header */}
                <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                                {transcript.conversationTitle ?? t('feedback.chatSession')}
                            </span>
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                                {transcript.model}
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t('feedback.messagesCount', { count: transcript.messageCount })} · {formatDate(transcript.timestamp)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); copyAsYaml(); }}
                            title={t('feedback.copyAsYaml')}
                        >
                            {copied ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                        </Button>
                        <a
                            href={transcript.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            title={t('feedback.openChat')}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <ChevronRight className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform',
                            expanded && 'rotate-90',
                        )} />
                    </div>
                </button>

                {/* Messages (expandable) */}
                {expanded && (
                    <div className="border-t px-4 py-3 space-y-2 max-h-96 overflow-y-auto bg-muted/10">
                        {transcript.messages.map((msg, idx) => (
                            <div key={idx} className="flex gap-2 text-xs">
                                <span className={cn(
                                    'shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5',
                                    msg.role === 'user'
                                        ? 'bg-primary/10 text-primary'
                                        : msg.role === 'assistant'
                                            ? 'bg-emerald-500/10 text-emerald-600'
                                            : 'bg-muted text-muted-foreground',
                                )}>
                                    {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-medium capitalize">{msg.role}</span>
                                        {msg.createdAt && (
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatDate(msg.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                                        {msg.content.length > 500 && !expanded
                                            ? msg.content.slice(0, 500) + '...'
                                            : msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
