/**
 * Bridge Consent Prompt
 *
 * Inline prompt shown when the bridge encounters a domain
 * the user hasn't consented to yet. Offers READ vs READ_WRITE.
 */


import { Shield, ShieldCheck, ShieldX, X, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConsentLevel } from '@/core/extension/useBridgeConsent';

interface ConsentPromptProps {
    domain: string;
    onAlwaysAllow: (level: ConsentLevel) => void;
    onAllowOnce: (level: ConsentLevel) => void;
    onDeny: () => void;
    onDismiss: () => void;
    className?: string;
}

export function ConsentPrompt({
    domain,
    onAlwaysAllow,
    onAllowOnce,
    onDeny,
    onDismiss,
    className,
}: ConsentPromptProps) {
    return (
        <div className={cn(
            'mx-3 my-2 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-3 shadow-md shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-200',
            className,
        )}>
            <div className="flex items-start gap-2.5">
                <Shield className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-2.5">
                    <div>
                        <div className="text-sm font-medium">
                            Tillad Surdej adgang til
                        </div>
                        <div className="text-sm font-mono text-amber-600 dark:text-amber-400 truncate">
                            {domain}
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Vælg adgangsniveau for dette domæne.
                    </p>

                    {/* READ level buttons */}
                    <div className="space-y-1.5">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Eye className="h-2.5 w-2.5" /> Læseadgang
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => onAlwaysAllow('READ')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Tillad altid (læs)
                            </button>
                            <button
                                onClick={() => onAllowOnce('READ')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 transition-colors"
                            >
                                Én gang (læs)
                            </button>
                        </div>
                    </div>

                    {/* READ_WRITE level buttons */}
                    <div className="space-y-1.5">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Pencil className="h-2.5 w-2.5" /> Læs + skriv
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => onAlwaysAllow('READ_WRITE')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Tillad altid (læs+skriv)
                            </button>
                            <button
                                onClick={() => onAllowOnce('READ_WRITE')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 transition-colors"
                            >
                                Én gang (læs+skriv)
                            </button>
                        </div>
                    </div>

                    {/* Deny */}
                    <button
                        onClick={onDeny}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <ShieldX className="h-2.5 w-2.5" />
                        Afvis
                    </button>
                </div>
                <button
                    onClick={onDismiss}
                    className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                    title="Luk"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

// ─── Consent Status Icon (toolbar) ──────────────────────────────

interface ConsentStatusIconProps {
    domain: string | null;
    consent: {
        decision: 'allowed' | 'denied';
        level: 'READ' | 'READ_WRITE';
        source: 'tenant' | 'user' | 'session';
    } | null;
    connected?: boolean;
    onRevoke: () => void;
    onReshow?: () => void;
}

export function ConsentStatusIcon({ domain, consent, connected = true, onRevoke, onReshow }: ConsentStatusIconProps) {
    // Disconnected → gray eye
    if (!connected) {
        return (
            <div className="flex items-center px-1.5 py-1 shrink-0" title="Ikke forbundet">
                <Eye className="h-4 w-4 text-muted-foreground/40" />
            </div>
        );
    }

    // Connected but no consent data yet → neutral eye
    if (!consent) {
        return (
            <div className="flex items-center px-1.5 py-1 shrink-0" title={domain ? `Tjekker ${domain}…` : 'Ingen side'}>
                <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
        );
    }

    const isRead = consent.level === 'READ';
    const levelLabel = isRead ? 'Læseadgang' : 'Læs + skriv';

    // Click the icon → re-show the consent dialog
    return (
        <button
            onClick={() => onReshow?.()}
            className={cn(
                'flex items-center gap-1 px-1.5 py-1 rounded transition-colors shrink-0',
                consent.decision === 'allowed'
                    ? isRead
                        ? 'text-emerald-500 hover:bg-emerald-500/10'
                        : 'text-blue-500 hover:bg-blue-500/10'
                    : 'text-red-500 hover:bg-red-500/10',
            )}
            title={`${levelLabel} — klik for at ændre`}
        >
            {consent.decision === 'allowed' ? (
                isRead ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />
            ) : (
                <ShieldX className="h-4 w-4" />
            )}
        </button>
    );
}


