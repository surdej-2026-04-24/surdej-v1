import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Mic, Video, Navigation, WifiOff } from 'lucide-react';
import { useFeedbackStore, getAllSessions } from './feedbackStore';
import { useTranslation } from '@/core/i18n';

const WHEREBY_URL = process.env.VITE_WHEREBY_FEEDBACK_URL || 'https://whereby.com/your-room';

interface StartFeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function StartFeedbackDialog({ open, onOpenChange }: StartFeedbackDialogProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [hasHistory, setHasHistory] = useState(false);
    const [offlineMode, setOfflineMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const startSession = useFeedbackStore((s) => s.startSession);
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Set default title when opened
    useEffect(() => {
        if (open) {
            const now = new Date();
            const ts = now.toISOString().slice(0, 16).replace('T', ' ');
            setTitle(`Session ${ts}`);
            setOfflineMode(false);
            getAllSessions()
                .then((s) => setHasHistory(s.length > 0))
                .catch(() => { });
        }
    }, [open]);

    // Focus title input when switching to offline mode
    useEffect(() => {
        if (offlineMode) {
            setTimeout(() => inputRef.current?.select(), 50);
        }
    }, [offlineMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            setIsStarting(true);
            await startSession(title.trim(), description.trim() || undefined);
            setTitle('');
            setDescription('');
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to start session:', err);
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !isStarting && onOpenChange(v)}>
            <DialogContent className="sm:max-w-md overflow-hidden">
                {offlineMode ? (
                    /* ── Offline feedback form ── */
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Start feedbacksession</DialogTitle>
                            <DialogDescription>
                                Tag skærmbilleder, lydoptagelser og spor navigation
                                for at give struktureret feedback.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="fb-title">
                                    Sessionstitel <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    ref={inputRef}
                                    id="fb-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="f.eks. Navigationsproblemer"
                                    disabled={isStarting}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fb-desc">Beskrivelse (valgfri)</Label>
                                <Textarea
                                    id="fb-desc"
                                    value={description}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                                    placeholder="Beskriv hvad du vil teste eller give feedback på…"
                                    rows={3}
                                    disabled={isStarting}
                                />
                            </div>

                            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                                <p className="text-sm font-medium text-foreground">Hvad bliver registreret:</p>
                                <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <li className="flex items-center gap-1.5">
                                        <Navigation className="h-3.5 w-3.5 text-blue-500" />
                                        Sidenavigation
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <Camera className="h-3.5 w-3.5 text-emerald-500" />
                                        Skærmbilleder
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <Mic className="h-3.5 w-3.5 text-amber-500" />
                                        Lydoptagelser
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <Video className="h-3.5 w-3.5 text-red-500" />
                                        Skærmoptagelser
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setOfflineMode(false)}
                            >
                                Tilbage
                            </Button>
                            <Button type="submit" disabled={isStarting || !title.trim()}>
                                {isStarting ? 'Starter…' : 'Start session'}
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    /* ── Live support (main view) ── */
                    <>
                        <div
                            className="flex flex-col items-center justify-center relative overflow-hidden rounded-lg -mx-2 -mt-2"
                            style={{
                                backgroundImage: 'url(/happy-mates-team-1k.png)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                minHeight: 280,
                            }}
                        >
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
                            <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                                <Video className="h-10 w-10 text-emerald-400 drop-shadow-lg" />
                                <div>
                                    <h3 className="text-base font-semibold text-white drop-shadow">
                                        {t('debug.liveSupport')}
                                    </h3>
                                    <p className="text-xs text-white/70 mt-1 max-w-[220px]">
                                        {t('debug.liveSupportDesc')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => window.open(WHEREBY_URL, '_blank', 'noopener,noreferrer')}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105"
                                >
                                    <Video className="h-4 w-4" />
                                    {t('debug.startSupport')}
                                </button>
                                <p className="text-[9px] text-white/40">
                                    {t('debug.opensWherebyTab')}
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            {hasHistory && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="mr-auto text-xs text-muted-foreground"
                                    onClick={() => { onOpenChange(false); navigate('/feedback'); }}
                                >
                                    Administrer sessioner
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5"
                                onClick={() => setOfflineMode(true)}
                            >
                                <WifiOff className="h-3.5 w-3.5" />
                                Offline
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
