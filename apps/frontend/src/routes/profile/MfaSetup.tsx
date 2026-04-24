import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

type MfaState = 'idle' | 'loading' | 'setup' | 'verify' | 'backup-codes' | 'disable-confirm';

export function MfaSetup({ onComplete }: { onComplete?: () => void } = {}) {
    const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
    const [state, setState] = useState<MfaState>('loading');
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            const res = await api.get<{ enabled: boolean }>('/auth/mfa/status');
            setMfaEnabled(res.enabled);
            setState('idle');
        } catch {
            setState('idle');
        }
    }

    async function startSetup() {
        setError(null);
        setSubmitting(true);
        try {
            const res = await api.post<{ qrCodeDataUrl: string; uri: string }>('/auth/mfa/setup');
            setQrCodeUrl(res.qrCodeDataUrl);
            setState('setup');
        } catch (e: any) {
            setError(e.message || 'Failed to start MFA setup');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await api.post<{ enabled: boolean; backupCodes: string[] }>('/auth/mfa/verify-setup', { token: verifyCode });
            setMfaEnabled(res.enabled);
            setBackupCodes(res.backupCodes);
            setState('backup-codes');
            setVerifyCode('');
        } catch (e: any) {
            setError(e.message || 'Invalid code');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await api.post('/auth/mfa/disable', { token: disableCode });
            setMfaEnabled(false);
            setState('idle');
            setDisableCode('');
        } catch (e: any) {
            setError(e.message || 'Invalid code');
        } finally {
            setSubmitting(false);
        }
    }

    function copyBackupCodes() {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (state === 'loading') {
        return (
            <div className="flex items-center gap-2 p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading MFA status...</span>
            </div>
        );
    }

    return (
        <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Security
            </h2>
            <div className="rounded-lg border bg-card p-4 space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">Two-Factor Authentication</p>
                            <p className="text-xs text-muted-foreground">
                                {mfaEnabled
                                    ? 'Your account is protected with an authenticator app.'
                                    : 'Add an extra layer of security to your account.'}
                            </p>
                        </div>
                    </div>
                    <Badge variant={mfaEnabled ? 'default' : 'secondary'} className="text-xs">
                        {mfaEnabled ? (
                            <><ShieldCheck className="h-3 w-3 mr-1" /> Enabled</>
                        ) : (
                            <><ShieldOff className="h-3 w-3 mr-1" /> Disabled</>
                        )}
                    </Badge>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* Idle state — show enable/disable button */}
                {state === 'idle' && !mfaEnabled && (
                    <Button onClick={startSetup} disabled={submitting} variant="outline" className="gap-2">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Enable Two-Factor Authentication
                    </Button>
                )}

                {state === 'idle' && mfaEnabled && (
                    <Button onClick={() => setState('disable-confirm')} variant="outline" className="gap-2 text-destructive hover:text-destructive">
                        <ShieldOff className="h-4 w-4" />
                        Disable Two-Factor Authentication
                    </Button>
                )}

                {/* Setup — show QR code */}
                {state === 'setup' && qrCodeUrl && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
                        </p>
                        <div className="flex justify-center">
                            <img src={qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-lg border p-2 bg-white" />
                        </div>
                        <form onSubmit={handleVerify} className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Enter the 6-digit code from your authenticator app to verify:
                            </p>
                            <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="000000"
                                value={verifyCode}
                                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                maxLength={6}
                                className="h-11 text-center tracking-[0.5em] font-mono text-lg max-w-48 mx-auto"
                                autoFocus
                                autoComplete="one-time-code"
                            />
                            <div className="flex gap-2 justify-center">
                                <Button type="submit" disabled={submitting || verifyCode.length !== 6}>
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Verify & Enable
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => { setState('idle'); setQrCodeUrl(null); setVerifyCode(''); setError(null); }}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Backup codes — show once after setup */}
                {state === 'backup-codes' && backupCodes.length > 0 && (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                            <strong>Save your backup codes!</strong> These codes can be used to access your account if you lose your authenticator app. Each code can only be used once.
                        </div>
                        <div className="grid grid-cols-2 gap-2 p-4 rounded-lg border bg-muted/50 font-mono text-sm">
                            {backupCodes.map((code, i) => (
                                <div key={i} className="text-center py-1">{code}</div>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={copyBackupCodes} className="gap-2">
                                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copied!' : 'Copy codes'}
                            </Button>
                            <Button onClick={() => { setState('idle'); setBackupCodes([]); onComplete?.(); }}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}

                {/* Disable confirmation */}
                {state === 'disable-confirm' && (
                    <form onSubmit={handleDisable} className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Enter a code from your authenticator app to confirm disabling MFA:
                        </p>
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="000000"
                            value={disableCode}
                            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            className="h-11 text-center tracking-[0.5em] font-mono text-lg max-w-48 mx-auto"
                            autoFocus
                            autoComplete="one-time-code"
                        />
                        <div className="flex gap-2 justify-center">
                            <Button type="submit" variant="destructive" disabled={submitting || disableCode.length !== 6}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Disable MFA
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => { setState('idle'); setDisableCode(''); setError(null); }}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </section>
    );
}
