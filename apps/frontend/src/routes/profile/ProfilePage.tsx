/**
 * Profile Page
 *
 * Displays the current user's profile information,
 * role, tenant membership, and session details.
 */

import { useAuth } from '@/core/auth/AuthContext';
import { useTenant } from '@/core/tenants/TenantContext';
import { useTranslation } from '@/core/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    User, Mail, Shield, Building, Calendar, Clock,
    LogOut, Key, Globe,
} from 'lucide-react';
import { MfaSetup } from './MfaSetup';

function InfoRow({ icon: Icon, label, value, mono, fallback }: {
    icon: React.FC<{ className?: string }>;
    label: string;
    value?: string | null;
    mono?: boolean;
    fallback?: string;
}) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-sm font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}>
                    {value || <span className="text-muted-foreground/50 italic">{fallback}</span>}
                </p>
            </div>
        </div>
    );
}

export function ProfilePage() {
    const { user, logout } = useAuth();
    const { activeTenant } = useTenant();
    const { t } = useTranslation();

    const initials = user?.displayName
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) ?? '?';

    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-2xl mx-auto p-8 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight truncate">
                            {user?.displayName ?? t('profile.fallbackName')}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {user?.email ?? t('profile.noEmail')}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                {user?.role ?? t('profile.unknownRole')}
                            </Badge>
                            {activeTenant && (
                                <Badge variant="outline" className="text-xs">
                                    <Building className="h-3 w-3 mr-1" />
                                    {activeTenant.name}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Account Details */}
                <section>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        {t('profile.account')}
                    </h2>
                    <div className="rounded-lg border bg-card p-4 space-y-0.5">
                        <InfoRow icon={User} label={t('profile.displayName')} value={user?.displayName} fallback={t('common.notSet')} />
                        <InfoRow icon={Mail} label={t('profile.email')} value={user?.email} fallback={t('common.notSet')} />
                        <InfoRow icon={Shield} label={t('profile.role')} value={user?.role} fallback={t('profile.unknownRole')} />
                        <InfoRow icon={Key} label={t('profile.loginMethod')} value={user?.authProvider || t('profile.unknownRole')} />
                        <InfoRow icon={Key} label={t('profile.userId')} value={user?.id} mono fallback={t('common.notSet')} />
                    </div>
                </section>

                {/* Security — MFA */}
                <MfaSetup />

                {/* Tenant */}
                {activeTenant && (
                    <section>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            {t('profile.tenant')}
                        </h2>
                        <div className="rounded-lg border bg-card p-4 space-y-0.5">
                            <InfoRow icon={Building} label={t('profile.organization')} value={activeTenant.name} />
                            <InfoRow icon={Globe} label={t('profile.slug')} value={activeTenant.slug} mono />
                            <InfoRow icon={Key} label={t('profile.tenantId')} value={activeTenant.id} mono />
                            {activeTenant.createdAt && (
                                <InfoRow icon={Calendar} label={t('profile.created')} value={new Date(activeTenant.createdAt).toLocaleDateString()} />
                            )}
                        </div>
                    </section>
                )}

                {/* Session */}
                <section>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        {t('profile.session')}
                    </h2>
                    <div className="rounded-lg border bg-card p-4 space-y-0.5">
                        <InfoRow icon={Clock} label={t('profile.currentTime')} value={new Date().toLocaleString()} />
                        <InfoRow icon={Globe} label={t('profile.browser')} value={navigator.userAgent.split(' ').pop()?.split('/')[0]} />
                    </div>
                </section>

                {/* Actions */}
                <div className="flex justify-end pt-2">
                    <Button variant="destructive" onClick={logout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        {t('profile.signOut')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
