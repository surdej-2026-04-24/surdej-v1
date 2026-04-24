import { useState, useEffect } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';
import { LivshjuletChart } from './LivshjuletChart.js';
import { LIVSHJULET_DIMENSIONS } from '@surdej/module-mental-klarhed-shared';
import type { Evaluation, LivshjuletScores } from '@surdej/module-mental-klarhed-shared';

interface Props {
    locale: 'da' | 'en';
}

export function EvaluationView({ locale }: Props) {
    const api = useMentalKlarhedApi();
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getEvaluation().then(setEvaluation).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-6 text-muted-foreground">{locale === 'da' ? 'Indlæser evaluering...' : 'Loading evaluation...'}</div>;
    if (!evaluation) return <div className="p-6 text-muted-foreground">{locale === 'da' ? 'Evalueringen er endnu ikke tilgængelig.' : 'Evaluation not available yet.'}</div>;

    const title = locale === 'da' ? 'Din rejse — Mental Klarhed' : 'Your journey — Mental Klarhed';
    const initialLabel = locale === 'da' ? 'Start' : 'Start';
    const finalLabel = locale === 'da' ? 'Nu' : 'Now';
    const progressTitle = locale === 'da' ? 'Din fremgang' : 'Your progress';

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {locale === 'da'
                        ? 'Her kan du se din udvikling fra start til slut af forløbet.'
                        : 'Here you can see your development from the start to the end of your programme.'}
                </p>
            </div>

            <div className="space-y-2">
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 bg-gray-300 inline-block border-dashed" style={{ borderTop: '2px dashed #d1d5db' }} />
                        {initialLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 bg-gray-900 inline-block" />
                        {finalLabel}
                    </span>
                </div>
                <LivshjuletChart
                    scores={evaluation.final.scores as LivshjuletScores}
                    comparisonScores={evaluation.initial.scores as LivshjuletScores}
                    locale={locale}
                />
            </div>

            <div>
                <h2 className="text-base font-medium mb-3">{progressTitle}</h2>
                <div className="space-y-3">
                    {LIVSHJULET_DIMENSIONS.map(dim => {
                        const key = dim.key as keyof LivshjuletScores;
                        const iScore = (evaluation.initial.scores as LivshjuletScores)[key];
                        const fScore = (evaluation.final.scores as LivshjuletScores)[key];
                        const delta = fScore - iScore;
                        const label = locale === 'da' ? dim.da : dim.en;
                        const isGain = evaluation.biggestGains.includes(key);
                        return (
                            <div key={key} className={`flex items-center justify-between p-3 rounded-lg ${isGain ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}>
                                <span className="text-sm font-medium">{label}</span>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-muted-foreground">{iScore}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="font-bold">{fScore}</span>
                                    <span className={`text-xs font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                        {delta > 0 ? `+${delta}` : delta}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
