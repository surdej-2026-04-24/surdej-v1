import { Camera, Check, Mic, Video, Pause, Play, Square, ExternalLink, CircleDot } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useFeedbackStore } from './feedbackStore';
import { cn } from '@/lib/utils';

/**
 * Feedback session controls that render inline in the Header toolbar
 * when a feedback session is active.
 */
export function FeedbackToolbar() {
    const navigate = useNavigate();
    const activeSession = useFeedbackStore((s) => s.activeSession);
    const isCapturing = useFeedbackStore((s) => s.isCapturing);
    const isRecordingVoice = useFeedbackStore((s) => s.isRecordingVoice);
    const isRecordingVideo = useFeedbackStore((s) => s.isRecordingVideo);
    const countdown = useFeedbackStore((s) => s.countdown);
    const lastScreenshotTs = useFeedbackStore((s) => s._lastScreenshotTs);
    const captureScreenshot = useFeedbackStore((s) => s.captureScreenshot);
    const startVoiceRecording = useFeedbackStore((s) => s.startVoiceRecording);
    const stopVoiceRecording = useFeedbackStore((s) => s.stopVoiceRecording);
    const startVideoRecording = useFeedbackStore((s) => s.startVideoRecording);
    const stopVideoRecording = useFeedbackStore((s) => s.stopVideoRecording);
    const pauseSession = useFeedbackStore((s) => s.pauseSession);
    const resumeSession = useFeedbackStore((s) => s.resumeSession);
    const completeSession = useFeedbackStore((s) => s.completeSession);

    // ── Completed session prompt ──────────────────────────────────
    const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

    const handleStop = useCallback(async () => {
        const sessionId = await completeSession();
        if (sessionId) {
            setCompletedSessionId(sessionId);
        }
    }, [completeSession]);

    // Auto-dismiss the prompt after 8s
    useEffect(() => {
        if (!completedSessionId) return;
        const timer = setTimeout(() => setCompletedSessionId(null), 8000);
        return () => clearTimeout(timer);
    }, [completedSessionId]);

    // ── Screenshot flash feedback ────────────────────────────────────
    const [showScreenshotFlash, setShowScreenshotFlash] = useState(false);
    const [showScreenshotSuccess, setShowScreenshotSuccess] = useState(false);

    useEffect(() => {
        if (lastScreenshotTs === 0) return;

        // Flash the screen
        setShowScreenshotFlash(true);
        const flashTimer = setTimeout(() => setShowScreenshotFlash(false), 300);

        // Show success checkmark on the camera button
        setShowScreenshotSuccess(true);
        const successTimer = setTimeout(() => setShowScreenshotSuccess(false), 2000);

        return () => {
            clearTimeout(flashTimer);
            clearTimeout(successTimer);
        };
    }, [lastScreenshotTs]);

    // ── Post-stop prompt ──────────────────────────────────────────
    if (completedSessionId) {
        return (
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r pr-4 animate-in fade-in slide-in-from-right-5">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-md text-xs font-medium border border-emerald-500/20">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-400">Session afsluttet</span>
                </div>
                <button
                    onClick={() => {
                        navigate(`/feedback/${completedSessionId}`);
                        setCompletedSessionId(null);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                    <ExternalLink className="h-3 w-3" />
                    Åbn
                </button>
                <button
                    onClick={() => {
                        const title = `Session ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
                        navigate(`/modules/core-issues/new?feedbackSessionId=${completedSessionId}&title=${encodeURIComponent(title)}`);
                        setCompletedSessionId(null);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <CircleDot className="h-3 w-3" />
                    Opret Issue
                </button>
                <button
                    onClick={() => setCompletedSessionId(null)}
                    className="text-muted-foreground/50 hover:text-muted-foreground text-xs px-1"
                    title="Luk"
                >
                    ✕
                </button>
            </div>
        );
    }

    if (!activeSession) return null;

    const isPaused = activeSession.status === 'paused';

    // Show countdown overlay
    if (countdown !== null) {
        return (
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r pr-4 animate-in fade-in">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground border-4 border-primary/20 shadow-lg animate-pulse">
                    <span className="text-xl font-bold">{countdown}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium">Optager…</span>
                    <span className="text-xs text-muted-foreground">Forbereder skærmbillede</span>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Full-screen screenshot flash */}
            {showScreenshotFlash && (
                <div
                    className="fixed inset-0 z-[9999] pointer-events-none bg-white"
                    style={{
                        animation: 'screenshot-flash 300ms ease-out forwards',
                    }}
                />
            )}

            {/* Screenshot flash animation style */}
            <style>{`
                @keyframes screenshot-flash {
                    0% { opacity: 0.85; }
                    100% { opacity: 0; }
                }
            `}</style>

            <div className="hidden sm:flex items-center gap-2 mr-2 border-r pr-4 animate-in fade-in slide-in-from-right-5">
                {/* Status badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-xs font-medium border">
                    <span
                        className={cn(
                            'h-2 w-2 rounded-full',
                            isPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse',
                        )}
                    />
                    {isPaused ? 'Sat på pause' : 'Optager'}
                </div>

                {/* Screenshot */}
                <button
                    onClick={() => captureScreenshot()}
                    disabled={isCapturing || isPaused}
                    title="Tag skærmbillede"
                    className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md transition-all border shadow-sm relative',
                        showScreenshotSuccess
                            ? 'bg-green-500 text-white border-green-500 scale-110'
                            : isCapturing
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent hover:text-accent-foreground',
                        (isCapturing || isPaused) && !showScreenshotSuccess && 'opacity-50 cursor-not-allowed',
                    )}
                >
                    {showScreenshotSuccess ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Camera className="h-4 w-4" />
                    )}
                </button>

                {/* Voice */}
                <button
                    onClick={() => (isRecordingVoice ? stopVoiceRecording() : startVoiceRecording())}
                    disabled={isPaused || isRecordingVideo}
                    title={isRecordingVoice ? 'Stop lydoptagelse' : 'Start lydoptagelse'}
                    className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md transition-colors border shadow-sm',
                        isRecordingVoice
                            ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                            : 'hover:bg-accent hover:text-accent-foreground',
                        (isPaused || isRecordingVideo) && 'opacity-50 cursor-not-allowed',
                    )}
                >
                    <Mic className="h-4 w-4" />
                </button>

                {/* Video */}
                <button
                    onClick={() => (isRecordingVideo ? stopVideoRecording() : startVideoRecording())}
                    disabled={isPaused || isRecordingVoice}
                    title={isRecordingVideo ? 'Stop videooptagelse' : 'Start videooptagelse'}
                    className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md transition-colors border shadow-sm',
                        isRecordingVideo
                            ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                            : 'hover:bg-accent hover:text-accent-foreground',
                        (isPaused || isRecordingVoice) && 'opacity-50 cursor-not-allowed',
                    )}
                >
                    <Video className="h-4 w-4" />
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-border" />

                {/* Pause / Resume */}
                <button
                    onClick={() => (isPaused ? resumeSession() : pauseSession())}
                    title={isPaused ? 'Genoptag' : 'Pause'}
                    className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors border shadow-sm"
                >
                    {isPaused ? <Play className="h-4 w-4 ml-0.5" /> : <Pause className="h-4 w-4" />}
                </button>

                {/* Stop */}
                <button
                    onClick={handleStop}
                    title="Afslut session"
                    className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors border shadow-sm"
                >
                    <Square className="h-4 w-4 fill-current" />
                </button>
            </div>
        </>
    );
}
