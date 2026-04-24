import { useNavigate } from 'react-router';
import { useTranslation } from '@/core/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Palette, Eye, Zap, Server, Building, KeyRound, ChevronRight } from 'lucide-react';

const SECTION_DEFS = [
    { labelKey: 'settings.sections.featureFlags', descKey: 'settings.sections.featureFlagsDesc', icon: Zap, path: '/settings/features', color: 'from-amber-500 to-orange-500' },
    { labelKey: 'settings.sections.accessibility', descKey: 'settings.sections.accessibilityDesc', icon: Eye, path: '/settings/accessibility', color: 'from-blue-500 to-cyan-500' },
    { labelKey: 'settings.sections.skins', descKey: 'settings.sections.skinsDesc', icon: Palette, path: '/settings/skins', color: 'from-violet-500 to-purple-600' },
    { labelKey: 'settings.sections.keyvault', descKey: 'settings.sections.keyvaultDesc', icon: KeyRound, path: '/settings/keyvault', color: 'from-amber-500 to-orange-500' },
    { labelKey: 'settings.sections.mcp', descKey: 'settings.sections.mcpDesc', icon: Server, path: '/settings/mcp', color: 'from-emerald-500 to-teal-500' },
    { labelKey: 'settings.sections.tenants', descKey: 'settings.sections.tenantsDesc', icon: Building, path: '/settings/tenants', color: 'from-sky-500 to-indigo-500' },
] as const;

export function SettingsPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Settings className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('settings.subtitle')}
                </p>
            </div>

            {/* Section cards */}
            <div className="space-y-3 stagger-children">
                {SECTION_DEFS.map(({ labelKey, descKey, icon: Icon, path, color }) => (
                    <Card
                        key={path}
                        className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                        onClick={() => navigate(path)}
                    >
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg shrink-0`}>
                                <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{t(labelKey)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{t(descKey)}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

