import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Building2,
    Layers,
    Sparkles,
    FileText,
    Globe,
    ExternalLink,
    Search,
    AppWindow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '@/core/i18n';
import { useIframeTools } from '@/core/iframe-tools';
import type { IframeToolDef } from '@/core/iframe-tools';

// ─── Static tool registry ───────────────────────────────────────

interface ToolEntry {
    id: string;
    icon: LucideIcon;
    labelKey: string;
    descriptionKey: string;
    prompt: string;
}

interface HostToolGroup {
    /** Label shown as section header */
    label: string;
    /** URL pattern description */
    urlPattern: string;
    /** Example URL to open in browser */
    exampleUrl: string;
    /** Condition note (e.g. "requires .docx with access_token") */
    condition?: string;
    tools: ToolEntry[];
}

const HOST_TOOL_GROUPS: HostToolGroup[] = [
    {
        label: 'SharePoint Word',
        urlPattern: '*.sharepoint.com',
        exampleUrl: 'https://sharepoint.com',
        condition: 'Requires open .docx document with access token',
        tools: [
            {
                id: 'sharepoint-word',
                icon: FileText,
                labelKey: 'extension.toolWord',
                descriptionKey: 'extension.toolWordDesc',
                prompt: 'Analysér indholdet af Word-dokumentet fra SharePoint.',
            },
        ],
    },
];

// ─── Component ──────────────────────────────────────────────────

interface ToolDirectoryProps {
    onBack: () => void;
    onInjectPrompt?: (prompt: string) => void;
    onSelectIframeTool?: (tool: IframeToolDef) => void;
}

export default function ToolDirectory({ onBack, onInjectPrompt, onSelectIframeTool }: ToolDirectoryProps) {
    const [filter, setFilter] = useState('');
    const { t } = useTranslation();
    const { tools: iframeTools } = useIframeTools();

    const filtered = useMemo(() => {
        if (!filter.trim()) return HOST_TOOL_GROUPS;
        const q = filter.toLowerCase();
        return HOST_TOOL_GROUPS.map((group) => {
            const matchesGroup =
                group.label.toLowerCase().includes(q) ||
                group.urlPattern.toLowerCase().includes(q);
            const matchingTools = group.tools.filter(
                (tool) =>
                    matchesGroup ||
                    t(tool.labelKey).toLowerCase().includes(q) ||
                    t(tool.descriptionKey).toLowerCase().includes(q) ||
                    tool.id.toLowerCase().includes(q),
            );
            if (matchingTools.length === 0) return null;
            return { ...group, tools: matchingTools };
        }).filter(Boolean) as HostToolGroup[];
    }, [filter, t]);

    const filteredIframeTools = useMemo(() => {
        if (!iframeTools.length) return [];
        if (!filter.trim()) return iframeTools;
        const q = filter.toLowerCase();
        return iframeTools.filter(
            (tool) =>
                tool.name.toLowerCase().includes(q) ||
                tool.slug.toLowerCase().includes(q) ||
                (tool.description ?? '').toLowerCase().includes(q),
        );
    }, [filter, iframeTools]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium">{t('extension.toolDirectory')}</span>
            </div>

            {/* Filter */}
            <div className="px-3 py-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder={t('extension.toolDirectoryFilter')}
                        className="h-7 pl-7 text-xs"
                        autoFocus
                    />
                </div>
            </div>

            {/* Tool groups */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                {filtered.length === 0 && filteredIframeTools.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                        {t('extension.toolDirectoryEmpty')}
                    </p>
                )}
                {filtered.map((group) => (
                    <div key={group.label} className="space-y-2">
                        {/* Group header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {group.label}
                                </span>
                            </div>
                            <a
                                href={group.exampleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] text-primary hover:underline"
                            >
                                {group.urlPattern}
                                <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                        </div>
                        {group.condition && (
                            <p className="text-[9px] text-muted-foreground/70 -mt-1">
                                {group.condition}
                            </p>
                        )}

                        {/* Tool cards */}
                        <div className="grid gap-2">
                            {group.tools.map((tool) => {
                                const Icon = tool.icon;
                                return (
                                    <div
                                        key={tool.id}
                                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:bg-muted/30 transition-all group"
                                    >
                                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                            <Icon className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium leading-tight">
                                                {t(tool.labelKey)}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                                {t(tool.descriptionKey)}
                                            </p>
                                        </div>
                                        {onInjectPrompt && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => onInjectPrompt(tool.prompt)}
                                            >
                                                Use
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Iframe tools (registered mixins) */}
                {filteredIframeTools.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                            <AppWindow className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('extension.iframeTools')}
                            </span>
                        </div>
                        <div className="grid gap-2">
                            {filteredIframeTools.map((tool) => (
                                <button
                                    key={tool.slug}
                                    type="button"
                                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:bg-muted/30 transition-all group text-left w-full"
                                    onClick={() => onSelectIframeTool?.(tool)}
                                >
                                    <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
                                        <AppWindow className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium leading-tight">
                                            {tool.name}
                                        </div>
                                        {tool.description && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                                {tool.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {tool.permissions.map((p) => (
                                                <span
                                                    key={p}
                                                    className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground"
                                                >
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
