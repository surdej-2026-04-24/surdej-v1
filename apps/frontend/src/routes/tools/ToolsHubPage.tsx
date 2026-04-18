/**
 * Tools Hub Page
 *
 * Route: /tools
 *
 * Central hub for platform tools and integrations:
 * - Browser Extension
 * - (future tools)
 */

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Wrench,
    Puzzle,
    ArrowRight,
    Download,
    Chrome,
    Globe2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { useTranslation } from '@/core/i18n';
import { useState, useEffect } from 'react';

interface ToolItem {
    titleKey: string;
    descKey: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    href: string;
    badgeKey?: string;
    badgeColor?: string;
    showVersion?: boolean;
}

const TOOLS: ToolItem[] = [
    {
        titleKey: 'tools.browserExtension',
        descKey: 'tools.browserExtensionDesc',
        icon: Puzzle,
        color: 'from-blue-500 to-indigo-600',
        href: '/tools/extension',
        badgeKey: 'Chrome & Edge',
        badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        showVersion: true,
    },
];

export function ToolsHubPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [latestVersion, setLatestVersion] = useState<string | null>(null);

    useEffect(() => {
        fetch('/extensions/versions.json')
            .then((r) => r.json())
            .then((data: { latest: string }) => setLatestVersion(data.latest))
            .catch(() => { /* ignore */ });
    }, []);

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 mb-4">
                    <Wrench className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{t('tools.title')}</h1>
                <p className="text-base text-muted-foreground max-w-md mx-auto">
                    {t('tools.subtitle')}
                </p>
            </div>

            <Separator className="mb-8" />

            {/* Tool Cards */}
            <div className="grid grid-cols-1 gap-4">
                {TOOLS.map((tool) => {
                    const Icon = tool.icon;

                    return (
                        <Card
                            key={tool.titleKey}
                            className={cn(
                                'group transition-all duration-300 cursor-pointer',
                                'hover:shadow-lg hover:-translate-y-0.5',
                            )}
                            onClick={() => navigate(tool.href)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200`}
                                    >
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-base">{t(tool.titleKey)}</h3>
                                            {tool.badgeKey && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn('text-[10px] px-1.5', tool.badgeColor)}
                                                >
                                                    {tool.badgeKey}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {t(tool.descKey)}
                                        </p>

                                        {/* Extra info row for extension */}
                                        {tool.showVersion && latestVersion && (
                                            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Download className="h-3.5 w-3.5" />
                                                    <span>{t('tools.latest', { version: latestVersion })}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Chrome className="h-3 w-3" />
                                                    <Globe2 className="h-3 w-3" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 mt-3" />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Future tools hint */}
            <div className="mt-8 text-center text-xs text-muted-foreground">
                {t('tools.comingSoon')}
            </div>
        </div>
    );
}
