/**
 * Tenant Home Page — Overview / Editor
 *
 * The "home" view inside the tenant workspace.
 * Displays and edits tenant identity, metadata, and info.
 *
 * Route: /settings/tenants/:tenantId  (index route inside workspace)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Save, Loader2, Check, Building, Globe, Type,
    FileText, Image, Braces, Trash2, RotateCcw,
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

export function TenantHomePage() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const { tenant: contextTenant, setTenant: setContextTenant } = useOutletContext<{
        tenant: Tenant;
        setTenant: React.Dispatch<React.SetStateAction<Tenant | null>>;
    }>();
    const { refreshTenants, switchTenant, activeTenant } = useTenant();

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Editor state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [metadataJson, setMetadataJson] = useState('{}');
    const [metadataError, setMetadataError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Restore state
    const [restoring, setRestoring] = useState(false);

    // ── Populate from context tenant ──
    useEffect(() => {
        if (!contextTenant) return;
        setName(contextTenant.name);
        setSlug(contextTenant.slug);
        setDescription(contextTenant.description ?? '');
        setLogoUrl(contextTenant.logoUrl ?? '');
        setMetadataJson(contextTenant.metadata ? JSON.stringify(contextTenant.metadata, null, 2) : '{}');
    }, [contextTenant]);

    const tenant = contextTenant;

    // ─── Mark dirty ───
    const markDirty = useCallback(() => {
        setDirty(true);
        setSaved(false);
    }, []);

    // ─── Save ───
    const handleSave = useCallback(async () => {
        if (!tenantId || !tenant) return;

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
                metadata: parsedMetadata,
            });
            setContextTenant(updated);
            setDirty(false);
            setSaved(true);
            await refreshTenants();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save tenant:', err);
        } finally {
            setSaving(false);
        }
    }, [tenantId, tenant, name, slug, description, logoUrl, metadataJson, refreshTenants, setContextTenant]);

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
            setContextTenant(restored);
        } catch {
            // API unavailable
        }
        await refreshTenants();
        setRestoring(false);
    };

    if (!tenant) return null;

    const isActive = activeTenant?.id === tenant.id;
    const isDeleted = !!tenant.deletedAt;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header actions */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Overview</h2>
                    {dirty && (
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                            Unsaved
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isActive && !isDeleted && (
                        <Button variant="ghost" size="sm" onClick={() => switchTenant(tenant.id)} className="gap-1.5 text-xs">
                            <Check className="h-3.5 w-3.5" /> Activate
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
                            Restore
                        </Button>
                    )}
                    {!tenant.isDemo && !isDeleted && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDelete(true)}
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Archive
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
                                <><Check className="h-3.5 w-3.5" /> Saved</>
                            ) : (
                                <><Save className="h-3.5 w-3.5" /> Save</>
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
                        <div className="font-medium">This tenant is archived</div>
                        <div className="text-xs mt-0.5 opacity-75">
                            Archived tenants are hidden from the tenant selector. Restore it to make it active again.
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Identity ─── */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Building className="h-4 w-4 text-primary" />
                        Identity
                    </div>

                    <Card>
                        <CardContent className="p-5 space-y-5">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Type className="h-3 w-3" /> Name
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
                                    <Globe className="h-3 w-3" /> Slug
                                </Label>
                                <Input
                                    value={slug}
                                    onChange={(e) => { setSlug(e.target.value); markDirty(); }}
                                    disabled={isDeleted}
                                    className="h-9 text-sm font-mono"
                                />
                                <p className="text-[10px] text-muted-foreground">URL-safe identifier for API resolution.</p>
                            </div>

                            <Separator />

                            {/* Description */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> Description
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
                                    <Image className="h-3 w-3" /> Logo URL
                                </Label>
                                <Input
                                    value={logoUrl}
                                    onChange={(e) => { setLogoUrl(e.target.value); markDirty(); }}
                                    disabled={isDeleted}
                                    placeholder="https://example.com/logo.svg"
                                    className="h-9 text-sm"
                                />
                                {logoUrl && (
                                    <div className="mt-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-center">
                                        <img
                                            src={logoUrl}
                                            alt="Logo preview"
                                            className="max-h-12 max-w-full object-contain"
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
                        Metadata
                    </div>

                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Arbitrary JSON metadata for this tenant — industry, locale, timezone, brand color, etc.
                            </p>
                            <textarea
                                value={metadataJson}
                                onChange={(e) => {
                                    setMetadataJson(e.target.value);
                                    markDirty();
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
                            <div className="text-xs font-medium text-muted-foreground">Tenant Info</div>
                            <div className="space-y-1.5">
                                <InfoRow label="ID" value={tenant.id} mono />
                                <InfoRow label="Created" value={new Date(tenant.createdAt).toLocaleString()} />
                                <InfoRow label="Updated" value={new Date(tenant.updatedAt).toLocaleString()} />
                                {tenant.deletedAt && (
                                    <InfoRow label="Archived" value={new Date(tenant.deletedAt).toLocaleString()} />
                                )}
                                <InfoRow label="Demo" value={tenant.isDemo ? 'Yes' : 'No'} />
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
                            Archive Tenant
                        </DialogTitle>
                        <DialogDescription>
                            This will soft-delete <strong>{name}</strong>. The tenant will be hidden
                            from the selector but can be restored later. No data is permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowDelete(false)}>
                            Cancel
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
                            Archive
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
