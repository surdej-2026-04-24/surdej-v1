import { useState, useEffect, useCallback, type DragEvent } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { RING_LABELS } from '@/core/features/FeatureContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Users, GripVertical, X, ChevronDown, ChevronUp, Shield, Crown, User } from 'lucide-react';
import { useTranslation } from '@/core/i18n';

// ─── Types ──────────────────────────────────────────────────────

interface UserInfo {
    id: string;
    name: string | null;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role?: string;
}

interface RoleInfo {
    slug: string;
    name: string;
    priority: number;
    isBuiltIn: boolean;
    description?: string | null;
}

interface FeatureUserOverride {
    userId: string;
    enabled: boolean;
    ringOverride: number | null;
    user: UserInfo;
}

interface FeatureRoleOverride {
    id: string;
    role: string;
    enabled: boolean;
    ringOverride: number | null;
}

interface FeatureWithOverrides {
    id: string;
    featureId: string;
    title: string;
    description: string | null;
    ring: number;
    enabledByDefault: boolean;
    category: string | null;
    userOverrides: FeatureUserOverride[];
    roleOverrides: FeatureRoleOverride[];
}

interface MatrixData {
    features: FeatureWithOverrides[];
    users: UserInfo[];
    roles: RoleInfo[];
}

// ─── Constants ──────────────────────────────────────────────────

const RING_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
    1: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
    2: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
    3: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
    4: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
};

const RING_DESCRIPTIONS: Record<number, string> = {
    1: 'Internal users & developers only',
    2: 'Beta testers and early adopters',
    3: 'Preview for selected users',
    4: 'Available for all users',
};

const ROLE_ICONS: Record<string, string> = {
    SUPER_ADMIN: '👑',
    ADMIN: '🛡️',
    SESSION_MASTER: '🎯',
    MEMBER: '👤',
    BOOK_KEEPER: '📒',
};

const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    ADMIN: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    SESSION_MASTER: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
    MEMBER: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600',
    BOOK_KEEPER: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
};

type DragPayload = { type: 'user'; id: string; featureId?: string } | { type: 'role'; slug: string; featureId?: string };

// ─── Component ──────────────────────────────────────────────────

export function FeatureMatrixPage() {
    const [data, setData] = useState<MatrixData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<{ featureId: string; ring: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const [panelTab, setPanelTab] = useState<'users' | 'roles'>('roles');
    const { t } = useTranslation();

    const loadMatrix = useCallback(async () => {
        try {
            const res = await api.get<MatrixData>('/features/matrix');
            setData(res);
        } catch (e) {
            console.error('Failed to load feature matrix:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadMatrix(); }, [loadMatrix]);

    // ─── Drag & Drop ────────────────────────────────────────────

    const handleDragStart = useCallback((e: DragEvent, payload: DragPayload) => {
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = payload.featureId ? 'move' : 'copy';
        // Slightly reduce opacity to show it's being dragged
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.4';
            setTimeout(() => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1'; }, 0);
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent, featureId: string, ring: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverTarget({ featureId, ring });
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverTarget(null);
    }, []);

    const handleDrop = useCallback(async (e: DragEvent, featureId: string, ring: number) => {
        e.preventDefault();
        setDragOverTarget(null);

        let payload: DragPayload;
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'));
        } catch {
            return;
        }

        setSaving(true);
        try {
            if (payload.type === 'user') {
                await api.post(`/features/${featureId}/users`, {
                    userId: payload.id,
                    enabled: true,
                    ringOverride: ring,
                });
            } else if (payload.type === 'role') {
                await api.post(`/features/${featureId}/roles`, {
                    role: payload.slug,
                    enabled: true,
                    ringOverride: ring,
                });
            }
            await loadMatrix();
        } catch (err) {
            console.error('Failed to assign:', err);
        } finally {
            setSaving(false);
        }
    }, [loadMatrix]);

    const handleRemoveUser = useCallback(async (featureId: string, userId: string) => {
        setSaving(true);
        try {
            await fetch(`/api/features/${featureId}/users/${userId}`, { method: 'DELETE' });
            await loadMatrix();
        } catch (err) {
            console.error('Failed to remove user:', err);
        } finally {
            setSaving(false);
        }
    }, [loadMatrix]);

    const handleRemoveRole = useCallback(async (featureId: string, role: string) => {
        setSaving(true);
        try {
            await fetch(`/api/features/${featureId}/roles/${role}`, { method: 'DELETE' });
            await loadMatrix();
        } catch (err) {
            console.error('Failed to remove role:', err);
        } finally {
            setSaving(false);
        }
    }, [loadMatrix]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full animate-pulse text-muted-foreground">
                {t('featureMatrix.loading')}
            </div>
        );
    }

    if (!data) return null;

    const rings = [1, 2, 3, 4];

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-5 border-b">
                <div className="flex items-center gap-3 mb-1">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Zap className="h-[22px] w-[22px] text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('featureMatrix.title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('featureMatrix.subtitle')} • {t('featureMatrix.stats', { features: data.features.length, users: data.users.length, roles: data.roles.length })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* ─── Matrix (left) ─── */}
                <div className="flex-1 overflow-auto">
                    {/* Ring column headers */}
                    <div className="sticky top-0 z-10 bg-background border-b">
                        <div className="grid grid-cols-[280px_repeat(4,1fr)] gap-0">
                            <div className="px-4 py-3 border-r">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('featureMatrix.feature')}</span>
                            </div>
                            {rings.map(ring => {
                                const colors = RING_COLORS[ring];
                                return (
                                    <div key={ring} className={cn('px-4 py-3 text-center border-r last:border-r-0', colors?.bg)}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <div className={cn('w-2.5 h-2.5 rounded-full', colors?.dot)} />
                                            <span className={cn('text-xs font-semibold uppercase tracking-wider', colors?.text)}>
                                                Ring {ring}: {RING_LABELS[ring]}
                                            </span>
                                        </div>
                                        <div className={cn('text-[10px] mt-0.5', colors?.text, 'opacity-70')}>
                                            {RING_DESCRIPTIONS[ring]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Feature rows */}
                    <div>
                        {data.features.map(feature => {
                            const isExpanded = expandedFeature === feature.featureId;

                            // Group user overrides by ring
                            const usersByRing = new Map<number, FeatureUserOverride[]>();
                            for (const ov of feature.userOverrides) {
                                const ring = ov.ringOverride ?? feature.ring;
                                if (!usersByRing.has(ring)) usersByRing.set(ring, []);
                                usersByRing.get(ring)!.push(ov);
                            }

                            // Group role overrides by ring
                            const rolesByRing = new Map<number, FeatureRoleOverride[]>();
                            for (const ov of feature.roleOverrides) {
                                const ring = ov.ringOverride ?? feature.ring;
                                if (!rolesByRing.has(ring)) rolesByRing.set(ring, []);
                                rolesByRing.get(ring)!.push(ov);
                            }

                            const totalOverrides = feature.userOverrides.length + feature.roleOverrides.length;

                            return (
                                <div key={feature.featureId} className="border-b last:border-b-0 transition-colors hover:bg-muted/30">
                                    <div className="grid grid-cols-[280px_repeat(4,1fr)] gap-0">
                                        {/* Feature name cell */}
                                        <div className="px-4 py-3 border-r flex items-start gap-2">
                                            <button
                                                onClick={() => setExpandedFeature(isExpanded ? null : feature.featureId)}
                                                className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                            </button>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn('w-2 h-2 rounded-full shrink-0', RING_COLORS[feature.ring]?.dot)} />
                                                    <span className="text-sm font-medium truncate">{feature.title}</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                                    <code className="bg-muted px-1 py-0.5 rounded">{feature.featureId}</code>
                                                    {feature.category && <span className="ml-1.5">• {feature.category}</span>}
                                                </div>
                                                {totalOverrides > 0 && (
                                                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                                                        {feature.userOverrides.length > 0 && (
                                                            <span className="text-primary">
                                                                <Users className="inline h-3 w-3 mr-0.5" />
                                                                {feature.userOverrides.length}
                                                            </span>
                                                        )}
                                                        {feature.roleOverrides.length > 0 && (
                                                            <span className="text-violet-600 dark:text-violet-400">
                                                                <Shield className="inline h-3 w-3 mr-0.5" />
                                                                {feature.roleOverrides.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ring cells */}
                                        {rings.map(ring => {
                                            const isFeatureRing = feature.ring === ring;
                                            const usersInRing = usersByRing.get(ring) ?? [];
                                            const rolesInRing = rolesByRing.get(ring) ?? [];
                                            const isDragOver = dragOverTarget?.featureId === feature.featureId && dragOverTarget?.ring === ring;
                                            const hasContent = usersInRing.length > 0 || rolesInRing.length > 0;

                                            return (
                                                <div
                                                    key={ring}
                                                    className={cn(
                                                        'px-3 py-3 border-r last:border-r-0 min-h-[60px] transition-all duration-150',
                                                        isFeatureRing && RING_COLORS[ring]?.bg,
                                                        isFeatureRing && RING_COLORS[ring]?.border,
                                                        isFeatureRing && 'border-2 border-dashed',
                                                        isDragOver && 'ring-2 ring-primary ring-inset bg-primary/5',
                                                    )}
                                                    onDragOver={(e) => handleDragOver(e, feature.featureId, ring)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, feature.featureId, ring)}
                                                >
                                                    {isFeatureRing && (
                                                        <Badge variant="secondary" className={cn('text-[9px] mb-2', RING_COLORS[ring]?.text)}>
                                                            {t('featureMatrix.defaultRing')}
                                                        </Badge>
                                                    )}

                                                    {/* Role chips in this ring */}
                                                    {rolesInRing.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-1">
                                                            {rolesInRing.map(ov => (
                                                                <RoleChip
                                                                    key={ov.role}
                                                                    role={ov.role}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, { type: 'role', slug: ov.role, featureId: feature.featureId })}
                                                                    onRemove={() => handleRemoveRole(feature.featureId, ov.role)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* User chips in this ring */}
                                                    {usersInRing.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {usersInRing.map(ov => (
                                                                <UserChip
                                                                    key={ov.userId}
                                                                    user={ov.user}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, { type: 'user', id: ov.userId, featureId: feature.featureId })}
                                                                    onRemove={() => handleRemoveUser(feature.featureId, ov.userId)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!hasContent && isDragOver && (
                                                        <div className="text-[10px] text-primary text-center py-2 animate-pulse">
                                                            {t('featureMatrix.dropHere')}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="px-6 py-4 bg-muted/20 border-t">
                                            <div className="text-sm text-muted-foreground mb-2">{feature.description}</div>
                                            <div className="text-xs">
                                                <span className="font-medium">{t('featureMatrix.default')}</span> Ring {feature.ring} ({RING_LABELS[feature.ring]})
                                                {' • '}
                                                <span className="font-medium">{t('featureMatrix.enabledByDefault')}</span> {feature.enabledByDefault ? t('tenantEditor.yes') : t('tenantEditor.no')}
                                                {feature.category && <>{' • '}<span className="font-medium">{t('featureMatrix.category')}</span> {feature.category}</>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Right Panel: Users + Roles ─── */}
                <div className="w-[280px] shrink-0 border-l bg-muted/20 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b bg-background">
                        <button
                            onClick={() => setPanelTab('roles')}
                            className={cn(
                                'flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                                'flex items-center justify-center gap-1.5',
                                panelTab === 'roles'
                                    ? 'text-violet-700 dark:text-violet-300 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                            )}
                        >
                            <Shield className="h-3.5 w-3.5" />
                            {t('featureMatrix.roles', { count: data.roles.length })}
                        </button>
                        <button
                            onClick={() => setPanelTab('users')}
                            className={cn(
                                'flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                                'flex items-center justify-center gap-1.5',
                                panelTab === 'users'
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                            )}
                        >
                            <Users className="h-3.5 w-3.5" />
                            {t('featureMatrix.users', { count: data.users.length })}
                        </button>
                    </div>

                    <div className="px-3 py-2 text-[10px] text-muted-foreground border-b">
                        {t('featureMatrix.dragHint', { type: panelTab === 'roles' ? 'role' : 'user' })}
                    </div>

                    <div className="flex-1 overflow-auto py-1">
                        {panelTab === 'roles' ? (
                            /* ─── Roles list ─── */
                            data.roles.map(role => (
                                <div
                                    key={role.slug}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, { type: 'role', slug: role.slug })}
                                    className={cn(
                                        'flex items-center gap-2.5 px-4 py-2.5 cursor-grab active:cursor-grabbing',
                                        'hover:bg-muted/50 transition-colors select-none',
                                        'border-b border-transparent hover:border-border/30',
                                    )}
                                >
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 border',
                                        ROLE_COLORS[role.slug] ?? 'bg-gray-100 text-gray-700 border-gray-300',
                                    )}>
                                        {ROLE_ICONS[role.slug] ?? '🔑'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium truncate">{role.name}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                            {role.description ?? role.slug}
                                            {role.isBuiltIn && ' • Built-in'}
                                        </div>
                                    </div>
                                    <div className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                                        P{role.priority}
                                    </div>
                                </div>
                            ))
                        ) : (
                            /* ─── Users list ─── */
                            data.users.map(user => (
                                <div
                                    key={user.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, { type: 'user', id: user.id })}
                                    className={cn(
                                        'flex items-center gap-2.5 px-4 py-2 cursor-grab active:cursor-grabbing',
                                        'hover:bg-muted/50 transition-colors select-none',
                                        'border-b border-transparent hover:border-border/30',
                                    )}
                                >
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                    <UserAvatar user={user} size={28} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium truncate">
                                            {user.displayName ?? user.name ?? user.email.split('@')[0]}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                                    </div>
                                    {user.role && (
                                        <Badge variant="outline" className="text-[9px] shrink-0">
                                            {ROLE_ICONS[user.role] ?? '🔑'} {user.role}
                                        </Badge>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Saving indicator */}
            {saving && (
                <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    {t('featureMatrix.saving')}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────

function UserAvatar({ user, size = 24 }: { user: UserInfo; size?: number }) {
    const initials = (user.displayName ?? user.name ?? user.email)
        .split(/[\s@]/)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase() ?? '')
        .join('');

    if (user.avatarUrl) {
        return (
            <img
                src={user.avatarUrl}
                alt={user.name ?? user.email}
                className="rounded-full shrink-0 object-cover"
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <div
            className="rounded-full shrink-0 bg-primary/10 text-primary flex items-center justify-center font-medium"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {initials}
        </div>
    );
}

function UserChip({ user, onRemove, draggable, onDragStart }: {
    user: UserInfo;
    onRemove: () => void;
    draggable?: boolean;
    onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
}) {
    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            className={cn(
                'flex items-center gap-1 pl-1 pr-0.5 py-0.5 rounded-full',
                'bg-background border border-border/50 shadow-sm',
                'text-[10px] font-medium group hover:border-destructive/30 transition-colors',
                draggable && 'cursor-grab active:cursor-grabbing',
            )}
        >
            <UserAvatar user={user} size={16} />
            <span className="truncate max-w-[60px]">
                {user.displayName ?? user.name ?? user.email.split('@')[0]}
            </span>
            <button
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded-full hover:bg-destructive/10"
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </div>
    );
}

function RoleChip({ role, onRemove, draggable, onDragStart }: {
    role: string;
    onRemove: () => void;
    draggable?: boolean;
    onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
}) {
    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            className={cn(
                'flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-md',
                'border shadow-sm text-[10px] font-semibold',
                'group hover:border-destructive/30 transition-colors',
                draggable && 'cursor-grab active:cursor-grabbing',
                ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
            )}
        >
            <span className="text-xs">{ROLE_ICONS[role] ?? '🔑'}</span>
            <span className="truncate max-w-[70px]">{role}</span>
            <button
                onClick={onRemove}
                className="text-current opacity-50 hover:opacity-100 hover:text-destructive transition-all p-0.5 rounded hover:bg-destructive/10"
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </div>
    );
}
