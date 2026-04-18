/**
 * Skin Editor (Phase 3.11)
 *
 * Drag-and-drop sidebar customisation, branding editor, clone/save, JSON export/import.
 * Route: /settings/skins/:skinId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Save, Copy, Download, Upload, Plus, X, GripVertical,
    Palette, Layout, Type, Paintbrush, Layers, ChevronDown, ChevronRight,
    Star, Shield, Loader2, Check, PanelLeft, Trash2,
    Home, Database, Settings, Users, FileText, BarChart3, Globe, Folder,
    Bell, BookOpen, Cpu, Zap, Heart, Package, Lock, Key, Server,
    Table2, HardDrive, Inbox, Search, Eye, Code2, MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Skin, SkinBranding, SkinSidebarItem, SkinActivityBarItem } from '@/core/skins/SkinContext';
import { useSkin } from '@/core/skins/SkinContext';
import { VirtualPageManager } from '@/core/virtual-pages/VirtualPageManager';
import { ExportButton } from '@/core/virtual-pages/ExportButton';
import { ImportDialog } from '@/core/virtual-pages/ImportDialog';
import { useTranslation } from '@/core/i18n';
import { useCommandRegistry } from '@/core/commands/CommandRegistry';

// ─── Sidebar commands are sourced dynamically from CommandRegistry ───

const FONT_OPTIONS = [
    "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    'Inter, sans-serif',
    'Roboto, sans-serif',
    'Outfit, sans-serif',
    'JetBrains Mono, monospace',
    'system-ui, sans-serif',
];

const COLOR_PRESETS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#0ea5e9', // Sky
];

// ─── Available icons for activity bar items ───

const ACTIVITY_BAR_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Home, Database, Settings, Users, FileText, BarChart3, Globe, Folder,
    Bell, BookOpen, Cpu, Zap, Heart, Package, Lock, Key, Server,
    Table2, HardDrive, Inbox, Search, Eye, Code2, MessageSquare,
    Layers, Palette, Star,
};

const ACTIVITY_BAR_ICON_NAMES = Object.keys(ACTIVITY_BAR_ICON_MAP);

// ─── Component ───

export function SkinEditorPage() {
    const { skinId } = useParams<{ skinId: string }>();
    const navigate = useNavigate();
    const { refreshSkins, switchSkin } = useSkin();
    const { t } = useTranslation();
    const allRegisteredCommands = useCommandRegistry((s) => s.getAll)();

    // Build sidebar-eligible commands from the live registry
    const allSidebarCommands = allRegisteredCommands.map((cmd) => ({
        commandId: cmd.id,
        group: cmd.group ?? 'Other',
        label: cmd.label,
    }));

    const [skin, setSkin] = useState<Skin | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Editor state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [branding, setBranding] = useState<SkinBranding>({ appName: 'Surdej' });
    const [sidebar, setSidebar] = useState<SkinSidebarItem[]>([]);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        branding: true,
        sidebar: true,
        activityBar: true,
        homepage: true,
    });

    // Homepage config state
    const [homepageConfig, setHomepageConfig] = useState<string>('{}');
    const [homepageConfigValid, setHomepageConfigValid] = useState(true);

    // Activity bar state
    const [activityBar, setActivityBar] = useState<SkinActivityBarItem[]>([]);
    const [abDragIndex, setAbDragIndex] = useState<number | null>(null);
    const [abDragOverIndex, setAbDragOverIndex] = useState<number | null>(null);

    // Drag state
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // ─── Load skin ───

    useEffect(() => {
        if (!skinId) return;
        (async () => {
            try {
                const s = await api.get<Skin>(`/skins/${skinId}`);
                const b = typeof s.branding === 'string' ? JSON.parse(s.branding as unknown as string) : s.branding;
                const sb = typeof s.sidebar === 'string' ? JSON.parse(s.sidebar as unknown as string) : s.sidebar;
                const ab = typeof s.activityBar === 'string' ? JSON.parse(s.activityBar as unknown as string) : s.activityBar;
                setSkin(s);
                setName(s.name);
                setDescription(s.description ?? '');
                setBranding(b ?? { appName: 'Surdej' });
                setSidebar(Array.isArray(sb) ? sb : []);
                setActivityBar(Array.isArray(ab) ? ab : []);
                setHomepageConfig(JSON.stringify(s.homepageConfig ?? {}, null, 2));
            } catch {
                navigate('/settings/skins');
            } finally {
                setLoading(false);
            }
        })();
    }, [skinId, navigate]);

    // ─── Mark dirty on changes ───

    const markDirty = useCallback(() => {
        setDirty(true);
        setSaved(false);
    }, []);

    const updateBranding = useCallback((patch: Partial<SkinBranding>) => {
        setBranding((prev) => ({ ...prev, ...patch }));
        setDirty(true);
        setSaved(false);
    }, []);

    // ─── Save ───

    const handleSave = useCallback(async () => {
        if (!skinId || !skin) return;
        setSaving(true);
        setSaveError(null);
        try {
            let parsedHomepage: unknown = {};
            try {
                parsedHomepage = JSON.parse(homepageConfig);
            } catch {
                setSaveError('Invalid homepage config JSON — will be saved as empty object');
                // Continue saving with empty config
            }
            await api.put(`/skins/${skinId}`, {
                name,
                description: description || undefined,
                branding,
                sidebar,
                activityBar,
                homepageConfig: parsedHomepage,
            });
            setDirty(false);
            setSaved(true);
            await refreshSkins();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save skin:', err);
            setSaveError('Failed to save skin. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [skinId, skin, name, description, branding, sidebar, activityBar, homepageConfig, refreshSkins]);

    // ─── Clone ───

    const handleClone = useCallback(async () => {
        if (!skinId) return;
        try {
            const cloned = await api.post<Skin>(`/skins/${skinId}/clone`, {});
            await refreshSkins();
            navigate(`/settings/skins/${cloned.id}`);
        } catch (err) {
            console.error('Failed to clone skin:', err);
        }
    }, [skinId, refreshSkins, navigate]);

    // ─── Set as active ───

    const handleActivate = useCallback(async () => {
        if (!skinId) return;
        await switchSkin(skinId);
    }, [skinId, switchSkin]);

    // ─── Delete ───

    const handleDelete = useCallback(async () => {
        if (!skinId || !skin || skin.isBuiltIn) return;
        if (!window.confirm(`Delete skin "${name}"? This cannot be undone.`)) return;
        setDeleteError(null);
        try {
            await api.del(`/skins/${skinId}`);
            await refreshSkins();
            navigate('/settings/skins');
        } catch (err: any) {
            const msg = err?.body ? (() => { try { return JSON.parse(err.body)?.error; } catch { return null; } })() : null;
            setDeleteError(msg || 'Failed to delete skin. Please try again.');
        }
    }, [skinId, skin, name, refreshSkins, navigate]);

    // ─── Export YAML ───

    const handleExport = useCallback(async () => {
        if (!skinId) return;
        try {
            const yaml = await (await import('@/services/virtualPageApi')).exportSkin(skinId);
            const { downloadYaml } = await import('@/services/virtualPageApi');
            downloadYaml(yaml, `${name.toLowerCase().replace(/\s+/g, '-')}.yaml`);
        } catch (err) {
            console.error('Export failed:', err);
        }
    }, [skinId, name]);

    // ─── Import YAML ───

    const [skinImportOpen, setSkinImportOpen] = useState(false);

    // ─── Drag & drop handlers ───

    const handleDragStart = useCallback((index: number) => {
        setDragIndex(index);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    }, []);

    const handleDrop = useCallback((index: number) => {
        if (dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }
        const newSidebar = [...sidebar];
        const [moved] = newSidebar.splice(dragIndex, 1);
        newSidebar.splice(index, 0, moved!);
        setSidebar(newSidebar);
        setDirty(true);
        setSaved(false);
        setDragIndex(null);
        setDragOverIndex(null);
    }, [dragIndex, sidebar]);

    const handleDragEnd = useCallback(() => {
        setDragIndex(null);
        setDragOverIndex(null);
    }, []);

    // ─── Add / remove sidebar item ───

    const addSidebarItem = useCallback((commandId: string, group?: string) => {
        setSidebar((prev) => [...prev, { commandId, group }]);
        setDirty(true);
        setSaved(false);
    }, []);

    const removeSidebarItem = useCallback((index: number) => {
        setSidebar((prev) => prev.filter((_, i) => i !== index));
        setDirty(true);
        setSaved(false);
    }, []);

    // ─── Activity Bar drag & drop ───

    const handleAbDragStart = useCallback((index: number) => {
        setAbDragIndex(index);
    }, []);

    const handleAbDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        setAbDragOverIndex(index);
    }, []);

    const handleAbDrop = useCallback((index: number) => {
        if (abDragIndex === null || abDragIndex === index) {
            setAbDragIndex(null);
            setAbDragOverIndex(null);
            return;
        }
        const newItems = [...activityBar];
        const [moved] = newItems.splice(abDragIndex, 1);
        newItems.splice(index, 0, moved!);
        setActivityBar(newItems);
        setDirty(true);
        setSaved(false);
        setAbDragIndex(null);
        setAbDragOverIndex(null);
    }, [abDragIndex, activityBar]);

    const handleAbDragEnd = useCallback(() => {
        setAbDragIndex(null);
        setAbDragOverIndex(null);
    }, []);

    // ─── Activity Bar add / remove / update ───

    const addActivityBarItem = useCallback(() => {
        const nextId = `item-${Date.now()}`;
        setActivityBar((prev) => [...prev, { id: nextId, label: 'New Tab', icon: 'FileText', path: `/${nextId}` }]);
        setDirty(true);
        setSaved(false);
    }, []);

    const removeActivityBarItem = useCallback((index: number) => {
        setActivityBar((prev) => prev.filter((_, i) => i !== index));
        setDirty(true);
        setSaved(false);
    }, []);

    const updateActivityBarItem = useCallback((index: number, patch: Partial<SkinActivityBarItem>) => {
        setActivityBar((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
        setDirty(true);
        setSaved(false);
    }, []);

    // ─── Toggle section ───

    const toggleSection = useCallback((section: string) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    }, []);

    // ─── Which commands aren't in sidebar yet? ───

    const availableCommands = allSidebarCommands.filter(
        (c) => !sidebar.some((s) => s.commandId === c.commandId),
    );

    // ─── Loading state ───

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!skin) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                {t('skinEditor.shinNotFound')}
            </div>
        );
    }

    const isBuiltIn = skin.isBuiltIn;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/settings/skins')} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Skins
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{name || t('skinEditor.untitled')}</h1>
                            {isBuiltIn && (
                                <Badge variant="secondary" className="text-[10px] gap-0.5">
                                    <Shield className="h-2.5 w-2.5" /> {t('skinEditor.builtIn')}
                                </Badge>
                            )}
                            {dirty && (
                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                    {t('skinEditor.unsaved')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sidebar.length} sidebar items · {activityBar.length} activity bar items</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleActivate} className="gap-1.5 text-xs">
                        <Star className="h-3.5 w-3.5" /> {t('tenants.activate')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClone} className="gap-1.5 text-xs">
                        <Copy className="h-3.5 w-3.5" /> {t('skinEditor.clone')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
                        <Download className="h-3.5 w-3.5" /> {t('skinEditor.export')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSkinImportOpen(true)} className="gap-1.5 text-xs">
                        <Upload className="h-3.5 w-3.5" /> {t('skinEditor.import')}
                    </Button>
                    <ImportDialog
                        open={skinImportOpen}
                        onOpenChange={setSkinImportOpen}
                        onImported={async () => {
                            await refreshSkins();
                            if (skinId) {
                                const s = await api.get<Skin>(`/skins/${skinId}`);
                                setSkin(s);
                                setName(s.name);
                                setDescription(s.description || '');
                                setBranding(s.branding as SkinBranding);
                                setSidebar((s.sidebar ?? []) as SkinSidebarItem[]);
                                setActivityBar((s.activityBar ?? []) as SkinActivityBarItem[]);
                            }
                        }}
                    />

                    {!isBuiltIn && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                        </Button>
                    )}

                    {!isBuiltIn && (
                        <Button
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={handleSave}
                            className="gap-1.5 text-xs min-w-[80px]"
                        >
                            {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : saved ? (
                                <><Check className="h-3.5 w-3.5" /> {t('skinEditor.saved')}</>
                            ) : (
                                <><Save className="h-3.5 w-3.5" /> {t('common.save')}</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {saveError && (
                <div className="mb-4 p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm">
                    {saveError}
                </div>
            )}

            {deleteError && (
                <div className="mb-4 p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm">
                    {deleteError}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Left: Branding ─── */}
                <div className="space-y-4">
                    <SectionHeader
                        icon={Paintbrush}
                        title={t('skinEditor.branding')}
                        expanded={expandedSections.branding ?? true}
                        onToggle={() => toggleSection('branding')}
                    />

                    {expandedSections.branding && (
                        <Card>
                            <CardContent className="p-5 space-y-5">
                                {/* Skin Name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Type className="h-3 w-3" /> {t('skinEditor.skinName')}
                                    </Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => { setName(e.target.value); markDirty(); }}
                                        disabled={isBuiltIn}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">{t('tenantEditor.descLabel')}</Label>
                                    <Input
                                        value={description}
                                        onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                                        disabled={isBuiltIn}
                                        placeholder="A short description…"
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <Separator />

                                {/* App Name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Layout className="h-3 w-3" /> {t('skinEditor.appName')}
                                    </Label>
                                    <Input
                                        value={branding.appName}
                                        onChange={(e) => updateBranding({ appName: e.target.value })}
                                        disabled={isBuiltIn}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                {/* Primary Color */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Palette className="h-3 w-3" /> {t('skinEditor.primaryColor')}
                                    </Label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {COLOR_PRESETS.map((color) => (
                                            <button
                                                key={color}
                                                disabled={isBuiltIn}
                                                onClick={() => updateBranding({ primaryColor: color })}
                                                className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${branding.primaryColor === color
                                                    ? 'border-foreground scale-110 shadow-md'
                                                    : 'border-transparent'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={branding.primaryColor ?? '#6366f1'}
                                            onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                                            disabled={isBuiltIn}
                                            className="w-9 h-9 rounded border cursor-pointer"
                                        />
                                        <Input
                                            value={branding.primaryColor ?? ''}
                                            onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                                            placeholder="#6366f1"
                                            disabled={isBuiltIn}
                                            className="h-9 text-sm font-mono flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Font Family */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Type className="h-3 w-3" /> {t('skinEditor.fontFamily')}
                                    </Label>
                                    <div className="space-y-1.5">
                                        {FONT_OPTIONS.map((font) => (
                                            <button
                                                key={font}
                                                disabled={isBuiltIn}
                                                onClick={() => updateBranding({ fontFamily: font })}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${branding.fontFamily === font
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-transparent hover:bg-muted/50 text-muted-foreground'
                                                    }`}
                                                style={{ fontFamily: font }}
                                            >
                                                {font.split(',')[0]}
                                                <span className="text-[10px] text-muted-foreground/50 ml-2">
                                                    The quick brown fox
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ─── Live Preview ─── */}
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-3 border-b bg-muted/30">
                                <span className="text-xs font-medium text-muted-foreground">{t('skinEditor.livePreview')}</span>
                            </div>
                            <div className="flex h-48">
                                {/* Fake sidebar */}
                                <div className="w-48 border-r bg-card p-3 space-y-1 overflow-hidden" style={{ fontFamily: branding.fontFamily }}>
                                    <div className="text-xs font-bold mb-3 truncate" style={{ color: branding.primaryColor }}>
                                        {branding.appName}
                                    </div>
                                    {sidebar.slice(0, 7).map((item, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted/50"
                                        >
                                            <div
                                                className="w-3 h-3 rounded-sm"
                                                style={{ backgroundColor: i === 0 ? (branding.primaryColor ?? '#6366f1') : 'currentColor', opacity: i === 0 ? 1 : 0.15 }}
                                            />
                                            <span className="truncate">{item.commandId.split('.').pop()}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Fake main area */}
                                <div className="flex-1 p-4 bg-background">
                                    <div
                                        className="w-24 h-3 rounded-full mb-2"
                                        style={{ backgroundColor: branding.primaryColor ?? '#6366f1', opacity: 0.7 }}
                                    />
                                    <div className="w-full h-2 rounded-full bg-muted mb-1.5" />
                                    <div className="w-3/4 h-2 rounded-full bg-muted mb-1.5" />
                                    <div className="w-1/2 h-2 rounded-full bg-muted" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ─── Right: Sidebar Items ─── */}
                <div className="space-y-4">
                    <SectionHeader
                        icon={Layers}
                        title={t('skinEditor.sidebarItems')}
                        count={sidebar.length}
                        expanded={expandedSections.sidebar ?? true}
                        onToggle={() => toggleSection('sidebar')}
                    />

                    {expandedSections.sidebar && (
                        <>
                            {/* Drag & drop list */}
                            <Card>
                                <CardContent className="p-3">
                                    {sidebar.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            {t('skinEditor.noItems')}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {sidebar.map((item, index) => {
                                                const label = allSidebarCommands.find(
                                                    (c) => c.commandId === item.commandId,
                                                )?.label ?? item.commandId;

                                                return (
                                                    <div
                                                        key={`${item.commandId}-${index}`}
                                                        draggable={!isBuiltIn}
                                                        onDragStart={() => handleDragStart(index)}
                                                        onDragOver={(e) => handleDragOver(e, index)}
                                                        onDrop={() => handleDrop(index)}
                                                        onDragEnd={handleDragEnd}
                                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-sm group ${dragOverIndex === index
                                                            ? 'bg-primary/10 border border-primary/30'
                                                            : dragIndex === index
                                                                ? 'opacity-40'
                                                                : 'hover:bg-muted/50'
                                                            }`}
                                                    >
                                                        {!isBuiltIn && (
                                                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab shrink-0" />
                                                        )}
                                                        <span className="flex-1 truncate">{label}</span>
                                                        {item.group && (
                                                            <Badge variant="outline" className="text-[9px] shrink-0">
                                                                {item.group}
                                                            </Badge>
                                                        )}
                                                        {!isBuiltIn && (
                                                            <button
                                                                onClick={() => removeSidebarItem(index)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Available commands to add */}
                            {!isBuiltIn && availableCommands.length > 0 && (
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                            <Plus className="h-3 w-3" /> {t('skinEditor.availableItems')}
                                        </div>
                                        <div className="space-y-1">
                                            {availableCommands.map((cmd) => (
                                                <button
                                                    key={cmd.commandId}
                                                    onClick={() => addSidebarItem(cmd.commandId, cmd.group)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors text-left"
                                                >
                                                    <Plus className="h-3 w-3 shrink-0 text-primary/50" />
                                                    <span className="flex-1 truncate">{cmd.label}</span>
                                                    <Badge variant="outline" className="text-[9px]">
                                                        {cmd.group}
                                                    </Badge>
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>

                {/* ─── Column 3: Activity Bar Items ─── */}
                <div className="space-y-4">
                    <SectionHeader
                        icon={PanelLeft}
                        title={t('skinEditor.activityBar')}
                        count={activityBar.length}
                        expanded={expandedSections.activityBar ?? true}
                        onToggle={() => toggleSection('activityBar')}
                    />

                    {expandedSections.activityBar && (
                        <>
                            <p className="text-xs text-muted-foreground">
                                {t('skinEditor.activityBarHint')}
                            </p>

                            {/* Drag & drop list */}
                            <Card>
                                <CardContent className="p-3">
                                    {activityBar.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            <PanelLeft className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            {t('skinEditor.noAbItems')}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {activityBar.map((item, index) => (
                                                <div
                                                    key={`${item.id}-${index}`}
                                                    draggable={!isBuiltIn}
                                                    onDragStart={() => handleAbDragStart(index)}
                                                    onDragOver={(e) => handleAbDragOver(e, index)}
                                                    onDrop={() => handleAbDrop(index)}
                                                    onDragEnd={handleAbDragEnd}
                                                    className={`rounded-lg border p-3 transition-all group ${abDragOverIndex === index
                                                        ? 'bg-primary/10 border-primary/30'
                                                        : abDragIndex === index
                                                            ? 'opacity-40'
                                                            : 'hover:bg-muted/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {!isBuiltIn && (
                                                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab shrink-0" />
                                                        )}
                                                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                                            {(() => {
                                                                const IconComponent = ACTIVITY_BAR_ICON_MAP[item.icon] ?? FileText;
                                                                return <IconComponent className="h-4 w-4" />;
                                                            })()}
                                                        </div>
                                                        <span className="font-medium text-sm flex-1 truncate">{item.label}</span>
                                                        <Badge variant="outline" className="text-[9px] font-mono">{item.path || '/'}</Badge>
                                                        {!isBuiltIn && (
                                                            <button
                                                                onClick={() => removeActivityBarItem(index)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {!isBuiltIn && (
                                                        <div className="grid grid-cols-3 gap-2 pl-6">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">{t('skinEditor.label')}</Label>
                                                                <Input
                                                                    value={item.label}
                                                                    onChange={(e) => updateActivityBarItem(index, { label: e.target.value })}
                                                                    className="h-7 text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">{t('skinEditor.path')}</Label>
                                                                <Input
                                                                    value={item.path}
                                                                    onChange={(e) => updateActivityBarItem(index, { path: e.target.value })}
                                                                    className="h-7 text-xs font-mono"
                                                                    placeholder="/section"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">{t('skinEditor.icon')}</Label>
                                                                <select
                                                                    value={item.icon}
                                                                    onChange={(e) => updateActivityBarItem(index, { icon: e.target.value })}
                                                                    className="flex h-7 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                                >
                                                                    {ACTIVITY_BAR_ICON_NAMES.map((name) => (
                                                                        <option key={name} value={name}>{name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Add button */}
                            {!isBuiltIn && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addActivityBarItem}
                                    className="w-full gap-1.5 text-xs"
                                >
                                    <Plus className="h-3.5 w-3.5" /> {t('skinEditor.addAbItem')}
                                </Button>
                            )}
                        </>
                    )}

                    {/* ─── Homepage Configuration ─── */}
                    <SectionHeader
                        icon={Home}
                        title={t('skinEditor.homepageConfig')}
                        expanded={expandedSections.homepage ?? true}
                        onToggle={() => toggleSection('homepage')}
                    />

                    {expandedSections.homepage && (
                        <Card>
                            <CardContent className="p-3 space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    Configure the homepage layout JSON.
                                </p>
                                <div className="space-y-2">
                                    <textarea
                                        value={homepageConfig}
                                        onChange={(e) => {
                                            setHomepageConfig(e.target.value);
                                            try {
                                                JSON.parse(e.target.value);
                                                setHomepageConfigValid(true);
                                            } catch {
                                                setHomepageConfigValid(false);
                                            }
                                            markDirty();
                                        }}
                                        disabled={isBuiltIn}
                                        className={`w-full h-64 font-mono text-xs p-2 rounded border focus:outline-none focus:ring-2 ${homepageConfigValid ? 'border-input focus:ring-primary/30' : 'border-destructive focus:ring-destructive/30'
                                            }`}
                                    />
                                    {!homepageConfigValid && (
                                        <p className="text-[10px] text-destructive">Invalid JSON format</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* ─── Virtual Pages Section ─── */}
            {!isBuiltIn && skinId && (
                <div className="mt-8">
                    <Separator className="mb-6" />
                    <VirtualPageManager
                        skinId={skinId}
                        onEditPage={(pageId) => {
                            // Find the page slug from the list to build the correct URL
                            window.open(`/vp/${skinId}/${pageId}`, '_blank');
                        }}
                    />
                </div>
            )}

            {/* Built-in warning */}
            {isBuiltIn && (
                <div className="mt-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-3">
                    <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                        <div className="font-medium">Built-in skins cannot be modified</div>
                        <div className="text-xs mt-0.5 opacity-75">
                            Clone this skin to create a custom version you can edit.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Section Header ───

function SectionHeader({
    icon: Icon,
    title,
    count,
    expanded,
    onToggle,
}: {
    icon: React.ElementType;
    title: string;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="flex items-center gap-2 w-full text-left group"
        >
            {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <Icon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{title}</span>
            {count !== undefined && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                    {count}
                </Badge>
            )}
        </button>
    );
}
