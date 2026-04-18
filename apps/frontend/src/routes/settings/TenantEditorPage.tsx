/**
 * Tenant Editor Page
 *
 * Edit tenant details: name, slug, description, logo, metadata.
 * Route: /settings/tenants/:tenantId
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
    ArrowLeft, Save, Loader2, Check, Building, Globe, Type,
    FileText, Image, Braces, Trash2, RotateCcw, Upload,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useTenant, type Tenant } from '@/core/tenants/TenantContext';
import { useTranslation } from '@/core/i18n';

export function TenantEditorPage() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const { refreshTenants, switchTenant, activeTenant } = useTenant();
    const { t } = useTranslation();

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Editor state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBackground, setUploadingBackground] = useState(false);
    const [metadataJson, setMetadataJson] = useState('{}');
    const [metadataError, setMetadataError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Restore state
    const [restoring, setRestoring] = useState(false);

    // ─── Load tenant ───

    useEffect(() => {
        if (!tenantId) return;
        (async () => {
            try {
                const t = await api.get<Tenant>(`/tenants/${tenantId}`);
                setTenant(t);
                setName(t.name);
                setSlug(t.slug);
                setDescription(t.description ?? '');
                setLogoUrl(t.logoUrl ?? '');
                setBackgroundUrl(t.backgroundUrl ?? '');
                setMetadataJson(t.metadata ? JSON.stringify(t.metadata, null, 2) : '{}');
            } catch {
                // API unavailable — try local context
                navigate('/settings/tenants');
            } finally {
                setLoading(false);
            }
        })();
    }, [tenantId, navigate]);

    // ─── Mark dirty ───

    const markDirty = useCallback(() => {
        setDirty(true);
        setSaved(false);
    }, []);

    // ─── Upload ───

    const handleUpload = async (file: File, type: 'logo' | 'background') => {
        if (!file) return;
        const setUploading = type === 'logo' ? setUploadingLogo : setUploadingBackground;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            // Upload
            const blob = await api.post<{ id: string }>('/blobs', formData);
            const url = `/api/blobs/${blob.id}`;

            if (type === 'logo') {
                setLogoUrl(url);
            } else {
                setBackgroundUrl(url);
            }
            markDirty();
        } catch (err) {
            console.error('Upload failed', err);
            // TODO: show error toast
        } finally {
            setUploading(false);
        }
    };

    // ─── Save ───

    const handleSave = useCallback(async () => {
        if (!tenantId || !tenant) return;

        // Validate JSON
        let parsedMetadata: Record<string, unknown> = {};
        try {
            parsedMetadata = JSON.parse(metadataJson);
            setMetadataError('');
        } catch {
            setMetadataError('Invalid JSON');
            return;
        }

        setSaving(true);
        try {
            const updated = await api.put<Tenant>(`/tenants/${tenantId}`, {
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim() || undefined,
                logoUrl: logoUrl.trim() || undefined,
                backgroundUrl: backgroundUrl.trim() || undefined,
                metadata: parsedMetadata,
            });
            setTenant(updated);
            setDirty(false);
            setSaved(true);
            await refreshTenants();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save tenant:', err);
        } finally {
            setSaving(false);
        }
    }, [tenantId, tenant, name, slug, description, logoUrl, backgroundUrl, metadataJson, refreshTenants]);

    // ─── Soft-delete ───

    const handleDelete = async () => {
        if (!tenantId) return;
        setDeleting(true);
        try {
            await api.del(`/tenants/${tenantId}`);
        } catch {
            // API unavailable
        }
        await refreshTenants();
        setDeleting(false);
        setShowDelete(false);
        navigate('/settings/tenants');
    };

    // ─── Restore ───

    const handleRestore = async () => {
        if (!tenantId) return;
        setRestoring(true);
        try {
            const restored = await api.put<Tenant>(`/tenants/${tenantId}/restore`, {});
            setTenant(restored);
        } catch {
            // API unavailable
        }
        await refreshTenants();
        setRestoring(false);
    };

    // ─── Loading ───

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                {t('tenantEditor.notFound')}
            </div>
        );
    }

    const isActive = activeTenant?.id === tenant.id;
    const isDeleted = !!tenant.deletedAt;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/settings/tenants')} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        {t('tenantEditor.backToTenants')}
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <div>
                        <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            <h1 className="text-2xl font-bold tracking-tight">{name || t('tenantEditor.untitled')}</h1>
                            {tenant.isDemo && (
                                <Badge variant="secondary" className="text-[10px] gap-0.5">
                                    Demo
                                </Badge>
                            )}
                            {isActive && (
                                <Badge variant="default" className="text-[10px] gap-0.5">
                                    <Check className="h-2.5 w-2.5" /> {t('tenants.activate')}
                                </Badge>
                            )}
                            {isDeleted && (
                                <Badge variant="destructive" className="text-[10px] gap-0.5">
                                    <Trash2 className="h-2.5 w-2.5" /> {t('tenants.archive')}
                                </Badge>
                            )}
                            {dirty && (
                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                    {t('tenantEditor.unsaved')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{slug}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isActive && !isDeleted && (
                        <Button variant="ghost" size="sm" onClick={() => switchTenant(tenant.id)} className="gap-1.5 text-xs">
                            <Check className="h-3.5 w-3.5" /> {t('tenants.activate')}
                        </Button>
                    )}
                    {isDeleted && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRestore}
                            disabled={restoring}
                            className="gap-1.5 text-xs"
                        >
                            {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {t('tenants.restore')}
                        </Button>
                    )}
                    {!tenant.isDemo && !isDeleted && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDelete(true)}
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> {t('tenants.archive')}
                        </Button>
                    )}
                    {!isDeleted && (
                        <Button
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={handleSave}
                            className="gap-1.5 text-xs min-w-[80px]"
                        >
                            {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : saved ? (
                                <><Check className="h-3.5 w-3.5" /> {t('tenantEditor.saved')}</>
                            ) : (
                                <><Save className="h-3.5 w-3.5" /> {t('common.save')}</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Archived warning */}
            {isDeleted && (
                <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-start gap-3">
                    <Trash2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                        <div className="font-medium">{t('tenantEditor.archivedWarning')}</div>
                        <div className="text-xs mt-0.5 opacity-75">
                            {t('tenantEditor.archivedHint')}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Identity ─── */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Building className="h-4 w-4 text-primary" />
                        {t('tenantEditor.identity')}
                    </div>

                    <Card>
                        <CardContent className="p-5 space-y-5">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Type className="h-3 w-3" /> {t('tenantEditor.nameLabel')}
                                </Label>
                                <Input
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); markDirty(); }}
                                    disabled={isDeleted}
                                    className="h-9 text-sm"
                                />
                            </div>

                            {/* Slug */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Globe className="h-3 w-3" /> {t('tenantEditor.slugLabel')}
                                </Label>
                                <Input
                                    value={slug}
                                    onChange={(e) => { setSlug(e.target.value); markDirty(); }}
                                    disabled={isDeleted}
                                    className="h-9 text-sm font-mono"
                                />
                                <p className="text-[10px] text-muted-foreground">{t('tenantEditor.slugHint')}</p>
                            </div>

                            <Separator />

                            {/* Description */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> {t('tenantEditor.descLabel')}
                                </Label>
                                <Input
                                    value={description}
                                    onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                                    disabled={isDeleted}
                                    placeholder="A brief description…"
                                    className="h-9 text-sm"
                                />
                            </div>

                            {/* Logo URL */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Image className="h-3 w-3" /> {t('tenantEditor.logoUrl')}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={logoUrl}
                                        onChange={(e) => { setLogoUrl(e.target.value); markDirty(); }}
                                        disabled={isDeleted}
                                        placeholder="https://example.com/logo.svg"
                                        className="h-9 text-sm flex-1"
                                    />
                                    <div className="relative">
                                        <Button
                                            variant="outline" size="sm"
                                            className="h-9 w-9 p-0"
                                            disabled={uploadingLogo || isDeleted}
                                        >
                                            {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        </Button>
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                            disabled={uploadingLogo || isDeleted}
                                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')}
                                        />
                                    </div>
                                </div>
                                {logoUrl && (
                                    <div className="mt-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-center">
                                        <img
                                            key={logoUrl}
                                            src={logoUrl}
                                            alt="Logo preview"
                                            className="max-h-12 max-w-full object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Background URL */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Image className="h-3 w-3" /> {t('tenantEditor.backgroundUrl')}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={backgroundUrl}
                                        onChange={(e) => { setBackgroundUrl(e.target.value); markDirty(); }}
                                        disabled={isDeleted}
                                        placeholder="https://example.com/bg.jpg"
                                        className="h-9 text-sm flex-1"
                                    />
                                    <div className="relative">
                                        <Button
                                            variant="outline" size="sm"
                                            className="h-9 w-9 p-0"
                                            disabled={uploadingBackground || isDeleted}
                                        >
                                            {uploadingBackground ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        </Button>
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                            disabled={uploadingBackground || isDeleted}
                                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'background')}
                                        />
                                    </div>
                                </div>
                                {backgroundUrl && (
                                    <div className="mt-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden h-32 relative">
                                        <img
                                            key={backgroundUrl}
                                            src={backgroundUrl}
                                            alt="Background preview"
                                            className="absolute inset-0 w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ─── Right: Metadata ─── */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Braces className="h-4 w-4 text-primary" />
                        {t('tenantEditor.metadata')}
                    </div>

                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                {t('tenantEditor.metadataHint')}
                            </p>
                            <textarea
                                value={metadataJson}
                                onChange={(e) => {
                                    setMetadataJson(e.target.value);
                                    markDirty();
                                    // Validate on type
                                    try { JSON.parse(e.target.value); setMetadataError(''); } catch { setMetadataError('Invalid JSON'); }
                                }}
                                disabled={isDeleted}
                                spellCheck={false}
                                className="w-full h-48 rounded-lg border bg-muted/30 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            />
                            {metadataError && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                    ⚠ {metadataError}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info card */}
                    <Card className="bg-muted/20">
                        <CardContent className="p-4 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">{t('tenantEditor.tenantInfo')}</div>
                            <div className="space-y-1.5">
                                <InfoRow label={t('tenantEditor.id')} value={tenant.id} mono />
                                <InfoRow label={t('tenantEditor.created')} value={new Date(tenant.createdAt).toLocaleString()} />
                                <InfoRow label={t('tenantEditor.updated')} value={new Date(tenant.updatedAt).toLocaleString()} />
                                {tenant.deletedAt && (
                                    <InfoRow label={t('tenants.archive')} value={new Date(tenant.deletedAt).toLocaleString()} />
                                )}
                                <InfoRow label={t('tenantEditor.demo')} value={tenant.isDemo ? t('tenantEditor.yes') : t('tenantEditor.no')} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ─── Delete Confirmation ─── */}
            <Dialog open={showDelete} onOpenChange={setShowDelete}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            {t('tenants.archiveTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            This will soft-delete <strong>{name}</strong>. The tenant will be hidden
                            from the selector but can be restored later. No data is permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowDelete(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="gap-1.5"
                        >
                            {deleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                            )}
                            {t('tenants.archive')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Small helper ───

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className={`truncate max-w-[200px] ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
        </div>
    );
}
