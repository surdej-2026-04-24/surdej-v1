import { useState } from 'react';
import { LIVSHJULET_DIMENSIONS, type LivshjuletScores, type LivshjuletNotes } from '@surdej/module-mental-klarhed-shared';
import { LivshjuletChart } from './LivshjuletChart.js';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';

interface Props {
    sessionId: string;
    sessionNumber: number;
    isFinal: boolean;
    locale: 'da' | 'en';
    onCompleted?: () => void;
}

const LABELS = {
    da: {
        title: (n: number, isFinal: boolean) => isFinal ? 'Slutevaluering — Livshjulet' : `Forberedelse til session ${n}`,
        subtitle: 'Vurder hvert livsområde fra 1 (lavt) til 10 (højt)',
        note: 'Tilføj en kort note (valgfri)',
        consent: 'Jeg giver samtykke til, at mine besvarelser behandles fortroligt af Asger Johannes Steenholdt til brug i vores terapeutiske forløb, jf. GDPR.',
        submit: 'Indsend min besvarelse',
        submitting: 'Sender...',
    },
    en: {
        title: (n: number, isFinal: boolean) => isFinal ? 'Final Evaluation — Life Wheel' : `Preparation for session ${n}`,
        subtitle: 'Rate each life area from 1 (low) to 10 (high)',
        note: 'Add a short note (optional)',
        consent: 'I consent to my responses being processed confidentially by Asger Johannes Steenholdt for use in our therapeutic programme, in accordance with GDPR.',
        submit: 'Submit my responses',
        submitting: 'Submitting...',
    },
};

type ScoreKey = keyof LivshjuletScores;

const DEFAULT_SCORES: LivshjuletScores = {
    helbred: 5, familie: 5, relationer: 5, karriere: 5,
    oekonomi: 5, personligUdvikling: 5, fritid: 5, omgivelser: 5,
};

export function LivshjuletForm({ sessionId, sessionNumber, isFinal, locale, onCompleted }: Props) {
    const api = useMentalKlarhedApi();
    const t = LABELS[locale];
    const [scores, setScores] = useState<LivshjuletScores>(DEFAULT_SCORES);
    const [notes, setNotes] = useState<LivshjuletNotes>({});
    const [consent, setConsent] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setScore = (key: ScoreKey, val: number) =>
        setScores(prev => ({ ...prev, [key]: val }));

    const setNote = (key: string, val: string) =>
        setNotes(prev => ({ ...prev, [key]: val }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consent) {
            setError(locale === 'da' ? 'Du skal acceptere samtykket for at fortsætte.' : 'You must accept the consent to continue.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await api.submitAssessment({ sessionId, scores, notes, consentGiven: true });
            onCompleted?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">{t.title(sessionNumber, isFinal)}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t.subtitle}</p>
            </div>

            <LivshjuletChart scores={scores} locale={locale} />

            <form onSubmit={handleSubmit} className="space-y-5">
                {LIVSHJULET_DIMENSIONS.map(dim => {
                    const key = dim.key as ScoreKey;
                    const label = locale === 'da' ? dim.da : dim.en;
                    const score = scores[key];
                    return (
                        <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">{label}</label>
                                <span className="text-2xl font-bold tabular-nums w-8 text-right">{score}</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                step={1}
                                value={score}
                                onChange={e => setScore(key, parseInt(e.target.value, 10))}
                                className="w-full accent-primary"
                            />
                            <input
                                type="text"
                                maxLength={500}
                                placeholder={t.note}
                                value={notes[key as keyof LivshjuletNotes] ?? ''}
                                onChange={e => setNote(key, e.target.value)}
                                className="w-full px-3 py-1.5 border rounded text-sm text-muted-foreground"
                            />
                        </div>
                    );
                })}

                {error && <div className="text-destructive text-sm p-3 bg-destructive/10 rounded">{error}</div>}

                <label className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
                    <input
                        type="checkbox"
                        checked={consent}
                        onChange={e => setConsent(e.target.checked)}
                        className="mt-0.5 accent-primary"
                        required
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">{t.consent}</span>
                </label>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                >
                    {saving ? t.submitting : t.submit}
                </button>
            </form>
        </div>
    );
}
