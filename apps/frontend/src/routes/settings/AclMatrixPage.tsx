import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Shield, Check, X as XIcon, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '@/core/i18n';

// ─── Types ──────────────────────────────────────────────────────

interface RoleInfo {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    priority: number;
    isBuiltIn: boolean;
}

interface PermissionInfo {
    id: string;
    resource: string;
    action: string;
    description: string | null;
}

interface MatrixCell {
    permissionId: string;
    resource: string;
    action: string;
    granted: boolean;
}

interface MatrixRow {
    roleId: string;
    roleSlug: string;
    roleName: string;
    permissions: MatrixCell[];
}

interface AclMatrixData {
    roles: RoleInfo[];
    permissions: PermissionInfo[];
    resources: string[];
    matrix: MatrixRow[];
}

// ─── Constants ──────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'super-admin': { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    admin: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    'session-master': { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
    member: { bg: 'bg-gray-50 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' },
    'book-keeper': { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
};

const ROLE_ICONS: Record<string, string> = {
    'super-admin': '👑',
    admin: '🛡️',
    'session-master': '🎯',
    member: '👤',
    'book-keeper': '📒',
};

const ACTION_COLORS: Record<string, string> = {
    read: 'text-blue-600 dark:text-blue-400',
    write: 'text-amber-600 dark:text-amber-400',
    delete: 'text-red-600 dark:text-red-400',
    manage: 'text-purple-600 dark:text-purple-400',
};

// ─── Component ──────────────────────────────────────────────────

export function AclMatrixPage() {
    const [data, setData] = useState<AclMatrixData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
    const { t } = useTranslation();

    const loadMatrix = useCallback(async () => {
        try {
            const res = await api.get<AclMatrixData>('/acl/matrix');
            setData(res);
            // Expand all resources by default
            setExpandedResources(new Set(res.resources));
        } catch (e) {
            console.error('Failed to load ACL matrix:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadMatrix(); }, [loadMatrix]);

    const toggleGrant = useCallback(async (roleId: string, permissionId: string, currentlyGranted: boolean) => {
        setSaving(true);
        try {
            if (currentlyGranted) {
                await api.post('/acl/revoke', { roleId, permissionId });
            } else {
                await api.post('/acl/grant', { roleId, permissionId });
            }
            await loadMatrix();
        } catch (err) {
            console.error('Failed to toggle permission:', err);
        } finally {
            setSaving(false);
        }
    }, [loadMatrix]);

    const toggleResource = useCallback((resource: string) => {
        setExpandedResources(prev => {
            const next = new Set(prev);
            if (next.has(resource)) next.delete(resource);
            else next.add(resource);
            return next;
        });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full animate-pulse text-muted-foreground">
                {t('acl.loading')}
            </div>
        );
    }

    if (!data) return null;

    // Group permissions by resource
    const permsByResource = new Map<string, PermissionInfo[]>();
    for (const p of data.permissions) {
        if (!permsByResource.has(p.resource)) permsByResource.set(p.resource, []);
        permsByResource.get(p.resource)!.push(p);
    }

    // Build a quick lookup for matrix: roleId → permissionId → granted
    const grantLookup = new Map<string, Map<string, boolean>>();
    for (const row of data.matrix) {
        const perms = new Map<string, boolean>();
        for (const cell of row.permissions) {
            perms.set(cell.permissionId, cell.granted);
        }
        grantLookup.set(row.roleId, perms);
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-5 border-b">
                <div className="flex items-center gap-3 mb-1">
                    <div className="rounded-xl bg-violet-500/10 p-2.5">
                        <Shield className="h-[22px] w-[22px] text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('acl.title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('acl.subtitle')} • {t('acl.stats', { roles: data.roles.length, permissions: data.permissions.length, resources: data.resources.length })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-background">
                        <tr>
                            <th className="px-4 py-3 text-left border-b border-r w-[220px]">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {t('acl.resourceAction')}
                                </span>
                            </th>
                            {data.roles.map(role => {
                                const colors = ROLE_COLORS[role.slug] ?? ROLE_COLORS['member'];
                                return (
                                    <th
                                        key={role.id}
                                        className={cn('px-3 py-3 text-center border-b border-r last:border-r-0 min-w-[120px]', colors.bg)}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-base">{ROLE_ICONS[role.slug] ?? '🔑'}</span>
                                            <span className={cn('text-xs font-semibold uppercase tracking-wider', colors.text)}>
                                                {role.name}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">P{role.priority}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {data.resources.map(resource => {
                            const perms = permsByResource.get(resource) ?? [];
                            const isExpanded = expandedResources.has(resource);

                            // Count granted per role for this resource
                            const grantedCounts = data.roles.map(role => {
                                const roleGrants = grantLookup.get(role.id);
                                return perms.filter(p => roleGrants?.get(p.id)).length;
                            });

                            return (
                                <React.Fragment key={resource}>
                                    {/* Resource header row */}
                                    <tr
                                        className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                                        onClick={() => toggleResource(resource)}
                                    >
                                        <td className="px-4 py-2 border-b border-r">
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                                <span className="text-xs font-bold uppercase tracking-wider">{resource}</span>
                                                <Badge variant="secondary" className="text-[9px]">{perms.length}</Badge>
                                            </div>
                                        </td>
                                        {data.roles.map((role, i) => (
                                            <td key={role.id} className="px-3 py-2 text-center border-b border-r last:border-r-0">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {grantedCounts[i]}/{perms.length}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Permission rows */}
                                    {isExpanded && perms.map(perm => (
                                        <tr key={perm.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="pl-10 pr-4 py-1.5 border-b border-r">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn('text-xs font-mono font-medium', ACTION_COLORS[perm.action] ?? 'text-foreground')}>
                                                        {perm.action}
                                                    </span>
                                                    {perm.description && (
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={perm.description}>
                                                            {perm.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {data.roles.map(role => {
                                                const granted = grantLookup.get(role.id)?.get(perm.id) ?? false;
                                                const isSuperAdmin = role.slug === 'super-admin';

                                                return (
                                                    <td key={role.id} className="px-3 py-1.5 text-center border-b border-r last:border-r-0">
                                                        <button
                                                            onClick={() => !isSuperAdmin && toggleGrant(role.id, perm.id, granted)}
                                                            disabled={saving || isSuperAdmin}
                                                            className={cn(
                                                                'inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150',
                                                                granted
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                                                                    : 'bg-transparent text-muted-foreground/30 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400',
                                                                isSuperAdmin && 'cursor-not-allowed opacity-60',
                                                                saving && 'pointer-events-none',
                                                            )}
                                                            title={isSuperAdmin ? t('acl.superAdminAll') : granted ? t('acl.clickToRevoke') : t('acl.clickToGrant')}
                                                        >
                                                            {isSuperAdmin ? (
                                                                <Lock className="h-3.5 w-3.5 text-purple-500" />
                                                            ) : granted ? (
                                                                <Check className="h-4 w-4" />
                                                            ) : (
                                                                <span className="w-4 h-4"> </span>
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Saving indicator */}
            {saving && (
                <div className="absolute bottom-4 right-4 bg-violet-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    {t('acl.saving')}
                </div>
            )}
        </div>
    );
}

import React from 'react';
