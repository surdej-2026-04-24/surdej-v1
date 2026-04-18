import { useFeatures, RING_LABELS } from '@/core/features/FeatureContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Zap, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';
import { useTranslation } from '@/core/i18n';

const RING_COLORS: Record<number, string> = {
    1: 'bg-red-500',
    2: 'bg-amber-500',
    3: 'bg-blue-500',
    4: 'bg-emerald-500',
};

export function FeaturesSettingsPage() {
    const { features, isLoading, userRing, setUserRing, isEnabled, toggleFeature } = useFeatures();
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto animate-pulse text-muted-foreground p-6">
                {t('common.loading')}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Zap className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('featureFlags.title')}</h1>
                    <Link to="/settings/features/matrix" className="ml-auto">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <LayoutGrid className="h-3.5 w-3.5" />
                            {t('featureFlags.matrix')}
                        </Button>
                    </Link>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('featureFlags.subtitleLong')}
                </p>
            </div>

            {/* Ring selector */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium">{t('featureFlags.ringLevel')}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                {t('featureFlags.ringLevelDesc')}
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            {Object.entries(RING_LABELS).map(([ring, label]) => {
                                const ringNum = Number(ring);
                                return (
                                    <Button
                                        key={ring}
                                        variant={userRing === ringNum ? 'default' : 'outline'}
                                        size="sm"
                                        className={cn(
                                            'gap-1.5 text-xs',
                                            userRing === ringNum && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                                        )}
                                        onClick={() => setUserRing(ringNum)}
                                    >
                                        <div className={cn('w-2 h-2 rounded-full', RING_COLORS[ringNum])} />
                                        {label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator className="mb-6" />

            {/* Feature list */}
            <div className="space-y-2">
                {features.map(f => {
                    const enabled = isEnabled(f.featureId);
                    const withinRing = f.ring <= userRing;

                    return (
                        <Card
                            key={f.id}
                            className={cn(
                                'transition-opacity duration-200',
                                !withinRing && 'opacity-40',
                            )}
                        >
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', RING_COLORS[f.ring] ?? 'bg-gray-400')} />
                                    <div>
                                        <div className="font-medium text-sm">{f.title}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {f.description} · <code className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded">{f.featureId}</code>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="text-[11px]">
                                        {RING_LABELS[f.ring] ?? t('featureFlags.ring', { ring: f.ring })}
                                    </Badge>
                                    <Switch
                                        checked={enabled}
                                        onCheckedChange={() => toggleFeature(f.featureId)}
                                        aria-label={`Toggle ${f.title}`}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
