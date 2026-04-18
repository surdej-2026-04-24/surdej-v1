import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    HelpCircle, BookOpen, MessageCircle, ExternalLink, FileText, Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { useTranslation } from '@/core/i18n';

interface HelpItem {
    titleKey: string;
    descKey: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    href?: string;
    external?: boolean;
}

const HELP_ITEMS: HelpItem[] = [
    {
        titleKey: 'help.documentation',
        descKey: 'help.documentationDesc',
        icon: BookOpen,
        color: 'from-blue-500 to-indigo-600',
        href: '/knowledge',
    },
    {
        titleKey: 'help.sendFeedback',
        descKey: 'help.sendFeedbackDesc',
        icon: MessageCircle,
        color: 'from-emerald-500 to-teal-600',
        href: '/feedback',
    },
    {
        titleKey: 'help.releaseNotes',
        descKey: 'help.releaseNotesDesc',
        icon: FileText,
        color: 'from-violet-500 to-purple-600',
    },
    {
        titleKey: 'help.videoTutorials',
        descKey: 'help.videoTutorialsDesc',
        icon: Video,
        color: 'from-pink-500 to-rose-500',
    },
];

export function HelpPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 mb-4">
                    <HelpCircle className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{t('help.title')}</h1>
                <p className="text-base text-muted-foreground max-w-md mx-auto">
                    {t('help.subtitle')}
                </p>
            </div>

            <Separator className="mb-8" />

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HELP_ITEMS.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Card
                            key={item.titleKey}
                            className={cn(
                                'group transition-all duration-300',
                                item.href && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
                                !item.href && 'opacity-60',
                            )}
                            onClick={() => {
                                if (item.href) navigate(item.href);
                            }}
                        >
                            <CardContent className="flex items-start gap-4 p-5">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm">{t(item.titleKey)}</span>
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                        {t(item.descKey)}
                                    </p>
                                </div>
                                {item.href && (
                                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Version info */}
            <div className="mt-12 text-center text-xs text-muted-foreground">
                {t('help.versionLine')}
            </div>
        </div>
    );
}
