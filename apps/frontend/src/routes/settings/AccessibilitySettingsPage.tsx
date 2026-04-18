import { useAccessibility } from '@/core/accessibility/AccessibilityContext';
import { useTranslation } from '@/core/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Eye, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccessibilitySettingsPage() {
    const {
        theme, highContrast, fontScale, reduceMotion,
        setTheme, setHighContrast, setFontScale, setReduceMotion,
    } = useAccessibility();
    const { t } = useTranslation();

    const THEMES: { value: 'light' | 'dark' | 'system'; labelKey: string; icon: React.ElementType }[] = [
        { value: 'light', labelKey: 'accessibility.light', icon: Sun },
        { value: 'dark', labelKey: 'accessibility.dark', icon: Moon },
        { value: 'system', labelKey: 'accessibility.system', icon: Monitor },
    ];

    const FONT_SCALES: { value: 100 | 110 | 120 | 130 | 140 | 150; label: string }[] = [
        { value: 100, label: '100%' },
        { value: 110, label: '110%' },
        { value: 120, label: '120%' },
        { value: 130, label: '130%' },
        { value: 140, label: '140%' },
        { value: 150, label: '150%' },
    ];

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Eye className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('accessibility.title')}</h1>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('accessibility.subtitle')}
                </p>
            </div>

            <div className="space-y-8">
                {/* Theme selector */}
                <section>
                    <h2 className="text-sm font-semibold mb-1">{t('accessibility.theme')}</h2>
                    <p className="text-xs text-muted-foreground mb-3">{t('accessibility.themeDesc')}</p>
                    <div className="flex gap-2">
                        {THEMES.map(({ value, labelKey, icon: Icon }) => (
                            <Button
                                key={value}
                                variant={theme === value ? 'default' : 'outline'}
                                className={cn('gap-2', theme === value && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
                                onClick={() => setTheme(value)}
                            >
                                <Icon className="h-4 w-4" />
                                {t(labelKey)}
                            </Button>
                        ))}
                    </div>
                </section>

                <Separator />

                {/* Font scale */}
                <section>
                    <h2 className="text-sm font-semibold mb-1">{t('accessibility.fontSize')}</h2>
                    <p className="text-xs text-muted-foreground mb-3">{t('accessibility.fontSizeDesc')}</p>
                    <div className="flex gap-2 flex-wrap">
                        {FONT_SCALES.map(({ value, label }) => (
                            <Button
                                key={value}
                                variant={fontScale === value ? 'default' : 'outline'}
                                size="sm"
                                className={cn(fontScale === value && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
                                onClick={() => setFontScale(value)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </section>

                <Separator />

                {/* Toggle cards */}
                <section className="space-y-3">
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <Label htmlFor="high-contrast" className="text-sm font-medium cursor-pointer">
                                    {t('accessibility.highContrast')}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {t('accessibility.highContrastDesc')}
                                </p>
                            </div>
                            <Switch
                                id="high-contrast"
                                checked={highContrast}
                                onCheckedChange={setHighContrast}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <Label htmlFor="reduce-motion" className="text-sm font-medium cursor-pointer">
                                    {t('accessibility.reduceMotion')}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {t('accessibility.reduceMotionDesc')}
                                </p>
                            </div>
                            <Switch
                                id="reduce-motion"
                                checked={reduceMotion}
                                onCheckedChange={setReduceMotion}
                            />
                        </CardContent>
                    </Card>
                </section>

                <Separator />

                {/* Language selector */}
                <section>
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold">{t('accessibility.language')}</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{t('accessibility.languageDesc')}</p>
                    <LanguageSwitcher />
                </section>
            </div>
        </div>
    );
}
