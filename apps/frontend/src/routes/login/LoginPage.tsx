import { useState, useEffect, useRef } from 'react';
import { useAuth, MfaRequiredError } from '@/core/auth/AuthContext';
import { useAccessibility } from '@/core/accessibility/AccessibilityContext';
import { useTranslation } from '@/core/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sun,
  Moon,
  LogIn,
  Shield,
  Code,
  User,
  UserCircle,
  Loader2,
  ArrowRight,
  Building2,
  AlertCircle,
  WifiOff,
  Phone,
  KeyRound,
} from 'lucide-react';
import { api, BASE_URL, clearApiEndpoint } from '@/lib/api';
import { PublicClientApplication } from '@azure/msal-browser';

// ─── Types ─────────────────────────────────────────────────────

type LoginStep = 'msal' | 'email' | 'phone-lookup' | 'phone-pin' | 'selection' | 'processing' | 'totp-verify';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  providers: Array<{ type: string; connectionId?: string; metadata?: any; clientId?: string }>;
}

interface DemoUserOption {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  role: string;
  avatarUrl?: string;
}

interface LookupResult {
  outcome: 'found' | 'multiple' | 'demo' | 'none';
  tenants?: TenantOption[];
  users?: DemoUserOption[];
  error?: string;
}

// ─── Component ─────────────────────────────────────────────────

export function LoginPage() {
  const { login, loginWithMicrosoft, loginWithPhonePin, verifyMfa } = useAuth();
  const { resolvedTheme, toggleTheme } = useAccessibility();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<any>(null); // Resolved tenant from hostname
  const [apiHealthy, setApiHealthy] = useState<boolean>(true); // Assume healthy initially

  // Check API health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // We use fetch directly to avoid any interceptors that might redirect on 401
        // The health endpoint should return 200 OK
        const baseUrl = BASE_URL;
        const url = baseUrl.endsWith('/') ? `${baseUrl}health` : `${baseUrl}/health`;
        const res = await fetch(url);

        if (!res.ok) throw new Error('API not healthy');
        setApiHealthy(true);
      } catch (err) {
        console.error('API Health check failed:', err);
        setApiHealthy(false);
        setError('Unable to connect to the server. Please try again later.');
      }
    };
    checkHealth();
  }, []);

  // Resolve tenant from hostname
  useEffect(() => {
    if (!apiHealthy) return; // Skip if API is down

    const resolveHost = async () => {
      try {
        const res = await api.get<{ found: boolean; tenant?: any }>(
          '/auth/resolve-host?hostname=' + window.location.hostname,
        );
        if (res.found && res.tenant) {
          setTenant(res.tenant);
        }
      } catch (e) {
        console.error('Failed to resolve host tenant', e);
      }
    };
    resolveHost();
  }, [apiHealthy]);

  // Hardcoded demo users
  const demoUsers: DemoUserOption[] = [
    {
      id: 'u1',
      email: 'admin@surdej.dev',
      name: 'Admin User',
      displayName: 'Admin',
      role: 'SUPER_ADMIN',
    },
    {
      id: 'u2',
      email: 'developer@surdej.dev',
      name: 'Developer',
      displayName: 'Dev',
      role: 'ADMIN',
    },
    {
      id: 'u3',
      email: 'member@surdej.dev',
      name: 'Team Member',
      displayName: 'Member',
      role: 'MEMBER',
    },
    {
      id: 'u4',
      email: 'guest@surdej.dev',
      name: 'Guest User',
      displayName: 'Guest',
      role: 'MEMBER',
    },
    {
      id: 'u5',
      email: 'supply@surdej.dev',
      name: 'Supply Chain User',
      displayName: 'Supply Chain',
      role: 'ADMIN',
    },
  ];

  const handleDemoLogin = async (userEmail: string) => {
    setLoading(true);
    try {
      await login(userEmail);
    } catch (e) {
      if (e instanceof MfaRequiredError) {
        setMfaToken(e.mfaToken);
        setStep('totp-verify');
        setLoading(false);
        return;
      }
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    try {
      await loginWithMicrosoft();
    } catch (e) {
      if (e instanceof MfaRequiredError) {
        setMfaToken(e.mfaToken);
        setStep('totp-verify');
        setLoading(false);
        return;
      }
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  };

  const handlePhonePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('surdej_last_phone', phone);
      await loginWithPhonePin(phone, pin);
    } catch (e: any) {
      if (e instanceof MfaRequiredError) {
        setMfaToken(e.mfaToken);
        setStep('totp-verify');
        setLoading(false);
        return;
      }
      setError(e.message || 'Invalid phone number or PIN');
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!mfaToken) throw new Error('Missing MFA token');
      await verifyMfa(mfaToken, totpCode);
    } catch (e: any) {
      setError(e.message || 'Invalid verification code');
      setTotpCode('');
      setLoading(false);
    }
  };

  const isDev = import.meta.env.DEV;

  const [email, setEmail] = useState(() => localStorage.getItem('surdej_last_email') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('surdej_last_phone') || '');
  const [pin, setPin] = useState('');
  const [phoneLookedUp, setPhoneLookedUp] = useState<{ displayName?: string; avatarUrl?: string } | null>(null);
  const [step, setStep] = useState<LoginStep>(() =>
    localStorage.getItem('surdej_last_phone') ? 'phone-pin' : 'msal',
  );
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus based on step
  useEffect(() => {
    if (step === 'phone-lookup') {
      phoneInputRef.current?.focus();
    }
    if (step === 'phone-pin') {
      pinInputRef.current?.focus();
    }
    if (step === 'totp-verify') {
      totpInputRef.current?.focus();
    }
  }, [step]);

  // If phone is saved, auto-lookup on mount and go to PIN step
  useEffect(() => {
    if (step === 'phone-pin' && phone && !phoneLookedUp) {
      lookupPhone(phone);
    }
  }, []);

  async function lookupPhone(phoneNumber: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ found: boolean; displayName?: string; avatarUrl?: string }>('/auth/lookup/phone', { phone: phoneNumber });
      if (res.found) {
        setPhoneLookedUp({ displayName: res.displayName, avatarUrl: res.avatarUrl });
        localStorage.setItem('surdej_last_phone', phoneNumber);
        setStep('phone-pin');
      } else {
        setError('No account found for this phone number.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to look up phone number');
    } finally {
      setLoading(false);
    }
  }

  const handlePhoneLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookupPhone(phone);
  };

  const handleTenantSelect = async (tenant: any) => {
    setLoading(true);
    setError(null);
    try {
      const entraProvider = tenant.providers?.find(
        (p: any) => p.type.toLowerCase() === 'entra' || p.type.toLowerCase() === 'microsoft',
      );

      if (entraProvider) {
        console.log(
          `[LoginPage] Initiating Microsoft SSO layout for ${email} in tenant ${tenant.name}`,
        );
        await loginWithMicrosoft(entraProvider.clientId, entraProvider.metadata?.tenantId);
        return; // loginWithMicrosoft redirects the entire JS thread
      }

      // Fallback to basic generic login
      console.log(
        `[LoginPage] No Entra ID configuration found for domain, falling back to local login.`,
      );
      await login(email);
    } catch (e: any) {
      setError(e.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('surdej_last_email', email);

      // 1. Let the backend resolve the domain
      const result = await api.post<LookupResult>('/auth/lookup', { email });

      // 1b. See if multiple tenants matched this domain
      if (result.outcome === 'multiple' && result.tenants && result.tenants.length > 1) {
        setAvailableTenants(result.tenants);
        setStep('selection');
        setLoading(false);
        return;
      }

      // 2. See if the resolved tenant supports Microsoft SSO
      if (result.outcome === 'found' && result.tenants && result.tenants.length > 0) {
        const tenant = result.tenants[0];
        const entraProvider = tenant.providers?.find(
          (p: any) => p.type.toLowerCase() === 'entra' || p.type.toLowerCase() === 'microsoft',
        );

        if (entraProvider) {
          console.log(`[LoginPage] Initiating Microsoft SSO layout for ${email}`);
          await loginWithMicrosoft(entraProvider.clientId, entraProvider.metadata?.tenantId);
          return; // loginWithMicrosoft redirects the entire JS thread
        }
      }

      // 3. Fallback to basic generic login (local Dev/Demo logic)
      console.log(
        `[LoginPage] No Entra ID configuration found for domain, falling back to local login.`,
      );
      await login(email);
    } catch (e: any) {
      setError(e.message || 'Login failed');
      setLoading(false);
    }
  };

  // Use tenant background image or default to team photo (skip video URLs)
  const tenantBg = tenant?.backgroundUrl;
  const isImageBg = tenantBg && !/\.(mp4|webm|mov)$/i.test(tenantBg);
  const bgUrl = isImageBg ? tenantBg : '/happy-mates-team-1k.png';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${bgUrl})`,
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-[1]" />

      {/* Theme toggle + Language switcher */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-[2]">
        <LanguageSwitcher />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {resolvedTheme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>
      </div>

      {/* Centered Login Card */}
      <Card className="w-full max-w-md border-border/50 shadow-xl backdrop-blur-xl bg-background/60 z-[2]">
        <CardHeader className="text-center pb-2 flex flex-col items-center">
          {tenant?.logoUrl ? (
            <div className="h-16 w-16 mb-4 flex items-center justify-center">
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-16 w-16 mb-4 flex items-center justify-center">
              <img
                src="/happy-mates-logo.svg"
                alt="Happy Mates"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}

          <CardTitle className="text-2xl font-bold tracking-tight mt-2">
            {tenant
              ? t('auth.signInTo', { name: tenant.name })
              : t('auth.title')}
          </CardTitle>
          {(tenant?.description || t('auth.subtitle') !== '') && (
            <CardDescription className="mt-2">
              {tenant?.description || t('auth.subtitle')}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {!apiHealthy && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>Connection lost. Check server status.</span>
              </div>
              {sessionStorage.getItem('surdej_api_url') && (
                <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-destructive/20">
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {BASE_URL}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs h-7 border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      clearApiEndpoint();
                      window.location.reload();
                    }}
                  >
                    Reset to default
                  </Button>
                </div>
              )}
            </div>
          )}
          {error && apiHealthy && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {step === 'selection' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <p className="text-sm text-center text-muted-foreground mb-4">
                Multiple accounts found. Please select one:
              </p>
              <div className="grid gap-2">
                {availableTenants.map((t: any) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 mb-2 cursor-pointer transition-colors hover:bg-muted"
                    onClick={() => handleTenantSelect(t)}
                    disabled={loading}
                  >
                    <div className="flex flex-col items-start gap-1 text-left w-full">
                      <span className="font-medium">{t.name}</span>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => {
                  setStep('msal');
                  setAvailableTenants([]);
                }}
              >
                Back
              </Button>
            </div>
          ) : step === 'msal' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <Button
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={loading || !apiHealthy}
                className="w-full h-11 bg-[#2F2F2F] hover:bg-[#1F1F1F] text-white border-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign in with Microsoft
              </Button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background/60 px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(localStorage.getItem('surdej_last_phone') ? 'phone-pin' : 'phone-lookup')}
                disabled={loading || !apiHealthy}
                className="w-full h-11"
              >
                <Phone className="h-4 w-4 mr-2" />
                Sign in with Phone + PIN
              </Button>
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  Use email instead
                </button>
              </div>
            </div>
          ) : step === 'email' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 text-center"
                    disabled={loading || !apiHealthy}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !email || !apiHealthy}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continue with Email
                </Button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setStep('msal')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    Back to Microsoft Sign In
                  </button>
                </div>
              </form>
            </div>
          ) : step === 'phone-lookup' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <form onSubmit={handlePhoneLookupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="tel"
                    placeholder="+45 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-11 text-center"
                    disabled={loading || !apiHealthy}
                    autoComplete="tel"
                    ref={phoneInputRef}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !phone || phone.length < 4 || !apiHealthy}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continue
                </Button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setStep('msal')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    Back to Microsoft Sign In
                  </button>
                </div>
              </form>
            </div>
          ) : step === 'phone-pin' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              {/* Show identified user + phone */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    {phoneLookedUp?.displayName && (
                      <p className="text-sm font-medium">{phoneLookedUp.displayName}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">{phone}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone-lookup');
                    setPin('');
                    setPhoneLookedUp(null);
                    setError(null);
                  }}
                  className="text-xs text-primary hover:underline focus:outline-none"
                >
                  Change
                </button>
              </div>
              <form onSubmit={handlePhonePinSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="PIN code"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                    minLength={4}
                    maxLength={10}
                    className="h-11 text-center tracking-[0.5em] font-mono"
                    disabled={loading || !apiHealthy}
                    autoComplete="current-password"
                    ref={pinInputRef}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !pin || pin.length < 4 || !apiHealthy}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign in
                </Button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => { setStep('msal'); setPin(''); setPhoneLookedUp(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    Back to Microsoft Sign In
                  </button>
                </div>
              </form>
            </div>
          ) : step === 'totp-verify' ? (
            <div className="w-full space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="text-center mb-4">
                <KeyRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app, or use a backup code.
                </p>
              </div>
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                    required
                    minLength={6}
                    maxLength={10}
                    className="h-11 text-center tracking-[0.5em] font-mono text-lg"
                    disabled={loading}
                    autoComplete="one-time-code"
                    ref={totpInputRef}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || totpCode.length < 6}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify
                </Button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('msal');
                      setMfaToken(null);
                      setTotpCode('');
                      setPin('');
                      setError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    Cancel and start over
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground text-center max-w-sm z-[2]">
        Protected by Surdej Auth. v{__APP_VERSION__}{' '}
        {isDev ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="underline hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm cursor-pointer">
                {t('auth.demoMode')}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Demo Login</DialogTitle>
                <DialogDescription>
                  Select a predefined user to sign in immediately.
                  {!apiHealthy && (
                    <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 text-xs rounded flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      Warning: API is unreachable. Login may fail.
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 pt-2">
                {demoUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 mb-2 cursor-pointer transition-colors hover:bg-muted"
                    onClick={() => handleDemoLogin(user.email)}
                    disabled={loading}
                  >
                    <div className="flex flex-col items-start gap-1 text-left w-full">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {user.role} • {user.email}
                      </span>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </p>
    </div>
  );
}
