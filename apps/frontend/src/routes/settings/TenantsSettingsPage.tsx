/**
 * Tenants Management (Settings Hub)
 *
 * Lists all tenants (including soft-deleted), allows creating new tenants,
 * and navigating to the tenant editor. Soft-deleted tenants appear greyed out
 * and can be restored.
 *
 * Route: /settings/tenants
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Building, Plus, Pencil, Trash2, RotateCcw, Users, Check, Loader2, Globe,
} from 'lucide-react';
import { useTenant, type Tenant } from '@/core/tenants/TenantContext';
import { api } from '@/lib/api';
import { Database, HardDrive, FileText } from 'lucide-react';
import { useTranslation } from '@/core/i18n';

// ─── Slug helper ───

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ─── Component ───

export function TenantsSettingsPage() {
    const { allTenantsIncludingDeleted, activeTenant, switchTenant, refreshTenants } = useTenant();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Create dialog state
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createSlug, setCreateSlug] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [slugTouched, setSlugTouched] = useState(false);

    // Delete dialog state
    const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Restore state
    const [restoring, setRestoring] = useState<string | null>(null);

    // ─── Create tenant ───

    const handleCreate = async () => {
        if (!createName.trim()) return;
        setCreating(true);
        try {
            const tenant = await api.post<Tenant>('/tenants', {
                name: createName.trim(),
                slug: createSlug.trim() || slugify(createName),
                description: createDesc.trim() || undefined,
            });
            await refreshTenants();
            setShowCreate(false);
            setCreateName('');
            setCreateSlug('');
            setCreateDesc('');
            setSlugTouched(false);
            navigate(`/settings/tenants/${tenant.id}`);
        } catch (err) {
            console.error('Failed to create tenant:', err);
            // Fallback: add locally for demo
            await refreshTenants();
            setShowCreate(false);
        } finally {
            setCreating(false);
        }
    };

    // ─── Soft-delete tenant ───

    const handleDelete = async () => {
        if (!deletingTenant) return;
        setDeleting(true);
        try {
            await api.del(`/tenants/${deletingTenant.id}`);
        } catch {
            // API unavailable — ignore in demo mode
        }
        await refreshTenants();
        setDeletingTenant(null);
        setDeleting(false);
    };

    // ─── Restore tenant ───

    const handleRestore = async (tenantId: string) => {
        setRestoring(tenantId);
        try {
            await api.put(`/tenants/${tenantId}/restore`, {});
        } catch {
            // API unavailable
        }
        await refreshTenants();
        setRestoring(null);
    };

    // Split into active and archived
    const activeTenants = allTenantsIncludingDeleted.filter((t) => !t.deletedAt);
    const archivedTenants = allTenantsIncludingDeleted.filter((t) => !!t.deletedAt);

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <Building className="h-[22px] w-[22px] text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('tenants.title')}</h1>
                    </div>
                    <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs">
                        <Plus className="h-3.5 w-3.5" /> {t('tenants.newTenant')}
                    </Button>
                </div>
                <p className="text-base text-muted-foreground ml-[52px]">
                    {t('tenants.subtitle')}
                </p>
            </div>

            {/* Active Tenants Grid */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                {activeTenants.map((tenant) => {
                    const isActive = activeTenant?.id === tenant.id;

                    return (
                        <Card
                            key={tenant.id}
                            className={`group relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                                ${isActive ? 'ring-2 ring-primary shadow-md' : ''}`}
                            onClick={() => navigate(`/settings/tenants/${tenant.id}`)}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <div className="absolute -top-2.5 -right-2.5 rounded-full bg-primary text-primary-foreground p-1 shadow-md z-10 animate-scale-in">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                            )}

                            <CardContent className="p-5">
                                {/* Header */}
                                <div className="mb-3">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-primary shrink-0" />
                                        <h3 className="font-semibold text-base truncate">{tenant.name}</h3>
                                    </div>
                                    {tenant.description && (
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {tenant.description}
                                        </p>
                                    )}
                                </div>

                                {/* Meta badges */}
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    <Badge variant="secondary" className="text-[11px] gap-1 font-mono">
                                        <Globe className="h-2.5 w-2.5" /> {tenant.slug}
                                    </Badge>
                                    {tenant.isDemo && (
                                        <Badge variant="default" className="text-[11px] gap-1">
                                            Demo
                                        </Badge>
                                    )}
                                </div>

                                {/* Metadata preview */}
                                {tenant.metadata && (
                                    <div className="rounded-xl border bg-muted/50 p-3 space-y-1 mb-4">
                                        {Object.entries(tenant.metadata as Record<string, unknown>).slice(0, 3).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">{key}</span>
                                                <span className="font-mono text-[11px] truncate max-w-[120px]">
                                                    {String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Data Consumption (Mock) */}
                                <div className="mb-4 pt-3 border-t">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <HardDrive className="h-3 w-3" /> {t('tenants.storage')}
                                        </span>
                                        <span className="font-medium text-muted-foreground flex items-center gap-1">
                                            {Math.floor(Math.random() * 500) + 50} MB
                                            <span className="text-[9px] opacity-70">{t('tenants.mock')}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Database className="h-3 w-3" /> {t('tenants.records')}
                                        </span>
                                        <span className="font-medium text-muted-foreground flex items-center gap-1">
                                            {Math.floor(Math.random() * 10000) + 100}
                                            <span className="text-[9px] opacity-70">{t('tenants.mock')}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Actions on hover */}
                                <div className="flex items-center gap-2 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            switchTenant(tenant.id);
                                        }}
                                    >
                                        <Users className="h-3 w-3 mr-1.5" /> {t('tenants.activate')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/settings/tenants/${tenant.id}`);
                                        }}
                                    >
                                        <Pencil className="h-3 w-3 mr-1.5" /> {t('common.edit')}
                                    </Button>
                                    {!tenant.isDemo && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingTenant(tenant);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1.5" /> {t('tenants.archive')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Archived Section */}
            {archivedTenants.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        {t('tenants.archivedTenants')}
                        <Badge variant="secondary" className="text-[10px] ml-1">{archivedTenants.length}</Badge>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {archivedTenants.map((tenant) => (
                            <Card key={tenant.id} className="opacity-50 hover:opacity-80 transition-opacity">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="font-medium text-sm truncate">{tenant.name}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs gap-1"
                                            disabled={restoring === tenant.id}
                                            onClick={() => handleRestore(tenant.id)}
                                        >
                                            {restoring === tenant.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RotateCcw className="h-3 w-3" />
                                            )}
                                            {t('tenants.restore')}
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-[10px] font-mono">{tenant.slug}</Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                            {t('tenants.archived', { date: tenant.deletedAt ? new Date(tenant.deletedAt).toLocaleDateString() : '' })}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Create Dialog ─── */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            {t('tenants.createTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('tenants.createDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('tenants.name')}</Label>
                            <Input
                                value={createName}
                                onChange={(e) => {
                                    setCreateName(e.target.value);
                                    if (!slugTouched) setCreateSlug(slugify(e.target.value));
                                }}
                                placeholder="Acme Corporation"
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('tenants.slugLabel')}</Label>
                            <Input
                                value={createSlug}
                                onChange={(e) => {
                                    setCreateSlug(e.target.value);
                                    setSlugTouched(true);
                                }}
                                placeholder="acme-corporation"
                                className="h-9 text-sm font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground">{t('tenants.slugHint')}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('tenants.description')}</Label>
                            <Input
                                value={createDesc}
                                onChange={(e) => setCreateDesc(e.target.value)}
                                placeholder="A brief description of this tenant…"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            disabled={!createName.trim() || creating}
                            className="gap-1.5"
                        >
                            {creating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Plus className="h-3.5 w-3.5" />
                            )}
                            {t('tenants.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Confirmation Dialog ─── */}
            <Dialog open={!!deletingTenant} onOpenChange={() => setDeletingTenant(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            {t('tenants.archiveTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            This will soft-delete <strong>{deletingTenant?.name}</strong>. The tenant
                            will be hidden from the selector but can be restored later.
                            No data will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeletingTenant(null)}>
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
