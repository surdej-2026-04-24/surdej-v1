import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { LIVSHJULET_DIMENSIONS, type LivshjuletScores } from '@surdej/module-mental-klarhed-shared';

interface Props {
    scores: LivshjuletScores;
    comparisonScores?: LivshjuletScores;
    locale: 'da' | 'en';
}

export function LivshjuletChart({ scores, comparisonScores, locale }: Props) {
    const data = LIVSHJULET_DIMENSIONS.map(dim => ({
        subject: locale === 'da' ? dim.da : dim.en,
        score: scores[dim.key as keyof LivshjuletScores],
        ...(comparisonScores ? { initial: comparisonScores[dim.key as keyof LivshjuletScores] } : {}),
    }));

    return (
        <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {comparisonScores && (
                        <Radar
                            name={locale === 'da' ? 'Start' : 'Initial'}
                            dataKey="initial"
                            stroke="#d1d5db"
                            fill="#d1d5db"
                            fillOpacity={0.2}
                            strokeDasharray="4 2"
                        />
                    )}
                    <Radar
                        name={locale === 'da' ? 'Nu' : 'Now'}
                        dataKey="score"
                        stroke="#1a1a1a"
                        fill="#1a1a1a"
                        fillOpacity={0.25}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
