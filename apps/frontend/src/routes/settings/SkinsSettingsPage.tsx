import { useSkin } from '@/core/skins/SkinContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Palette, Check, Star, Shield, Layers, Pencil, Plus, Copy, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import type { Skin } from '@/core/skins/SkinContext';
import { useTranslation } from '@/core/i18n';

export function SkinsSettingsPage() {
    const { allSkins, activeSkin, switchSkin, setDefaultSkin, refreshSkins } = useSkin();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleCreateSkin = async () => {
        try {
            const skin = await api.post<Skin>('/skins', {
                name: 'Custom Skin',
                description: 'A new custom skin',
                branding: { appName: 'Surdej' },
                sidebar: [
                    { commandId: 'navigate.home', group: 'Core' },
                    { commandId: 'navigate.chat', group: 'Core' },
                    { commandId: 'navigate.settings', group: 'System' },
                ],
            });
            await refreshSkins();
            navigate(`/settings/skins/${skin.id}`);
        } catch (err) {
            console.error('Failed to create skin:', err);
        }
    };

    const handleClone = async (skinId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const cloned = await api.post<Skin>(`/skins/${skinId}/clone`);
            await refreshSkins();
            navigate(`/settings/skins/${cloned.id}`);
        } catch (err) {
            console.error('Failed to clone skin:', err);
        }
    };

    const handleDelete = async (skin: Skin, e: React.MouseEvent) => {
        e.stopPropagation();
        if (skin.isBuiltIn) return;
        if (!window.confirm(`Delete skin "${skin.name}"? This cannot be undone.`)) return;
        try {
            await api.del(`/skins/${skin.id}`);
            await refreshSkins();
        } catch (err) {
            console.error('Failed to delete skin:', err);
            alert('Failed to delete skin. Please try again.');
        }
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <Palette className="h-[22px] w-[22px] text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('skins.titleBranding')}</h1>
                    </div>
                    <Button size="sm" onClick={handleCreateSkin} className="gap-1.5 text-xs">
                        <Plus className="h-3.5 w-3.5" /> {t('skins.newSkin')}
                    </Button>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('skins.subtitleChoose')}
                </p>
            </div>

            {/* Skin Grid */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                {allSkins.map((skin) => {
                    const isActive = activeSkin?.id === skin.id;

                    return (
                        <Card
                            key={skin.id}
                            className={`group relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                                ${isActive ? 'ring-2 ring-primary shadow-md' : ''}`}
                            onClick={() => switchSkin(skin.id)}
                        >
                            {/* Active badge */}
                            {isActive && (
                                <div className="absolute -top-2.5 -right-2.5 rounded-full bg-primary text-primary-foreground p-1 shadow-md z-10 animate-scale-in">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                            )}

                            <CardContent className="p-5">
                                {/* Header */}
                                <div className="mb-3">
                                    <h3 className="font-semibold text-base truncate">{skin.name}</h3>
                                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                        {t('skins.appLabel', { name: skin.branding?.appName ?? t('skins.unnamed') })}
                                    </p>
                                </div>

                                {/* Meta badges */}
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    {skin.isBuiltIn && (
                                        <Badge variant="default" className="text-[11px] gap-1">
                                            <Shield className="h-2.5 w-2.5" /> {t('skins.builtIn')}
                                        </Badge>
                                    )}
                                    <Badge variant="secondary" className="text-[11px] gap-1">
                                        <Layers className="h-2.5 w-2.5" /> {t('skins.itemsCount', { count: skin.sidebar.length })}
                                    </Badge>
                                </div>

                                {/* Sidebar preview */}
                                <div className="rounded-xl border bg-muted/50 p-3 space-y-1">
                                    {skin.sidebar.slice(0, 5).map((item: { commandId: string }, i: number) => (
                                        <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground">
                                            <div className="w-4 h-4 rounded bg-current opacity-20 shrink-0" />
                                            <span className="truncate">
                                                {item.commandId.replace('navigate.', '').replace('.', ' / ')}
                                            </span>
                                        </div>
                                    ))}
                                    {skin.sidebar.length > 5 && (
                                        <div className="text-[10px] px-2 pt-1 text-muted-foreground/60">
                                            {t('common.moreItems', { count: skin.sidebar.length - 5 })}
                                        </div>
                                    )}
                                </div>

                                {/* Actions on hover */}
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDefaultSkin(skin.id);
                                        }}
                                    >
                                        <Star className="h-3 w-3 mr-1.5" /> {t('skins.setDefault')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/settings/skins/${skin.id}`);
                                        }}
                                    >
                                        <Pencil className="h-3 w-3 mr-1.5" /> {t('skins.edit')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={(e) => handleClone(skin.id, e)}
                                    >
                                        <Copy className="h-3 w-3 mr-1.5" /> {t('skins.clone')}
                                    </Button>
                                    {!skin.isBuiltIn && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                                            onClick={(e) => handleDelete(skin, e)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1.5" /> {t('common.delete')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
