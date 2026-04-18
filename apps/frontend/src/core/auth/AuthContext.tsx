import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { api } from '@/lib/api';

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'PLEASE_SEND_MSAL_CONFIG') {
      const configStr = localStorage.getItem('surdej_msal_config');
      if (configStr && e.source) {
        (e.source as Window).postMessage(
          { type: 'HERE_IS_MSAL_CONFIG', config: configStr },
          { targetOrigin: e.origin },
        );
      }
    }
  });
}

// ─── PKCE Helpers ───

function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(hash));
}

function generateRandomString(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

// ─── Manual Popup Auth ───
// Bypasses MSAL's broken popup mechanism entirely.
// We open the popup, monitor it ourselves, and exchange the code manually.

async function loginWithPopup(
  clientId: string,
  tenantId: string,
  popup: Window, // Must be opened BEFORE calling this (Safari requires sync window.open)
): Promise<{ idToken: string; accessToken: string;[key: string]: any }> {
  const redirectUri = window.location.origin;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString();
  const nonce = generateRandomString();

  console.log('[AuthPopup] 🚀 Starting manual popup auth…', {
    clientId: clientId.substring(0, 8) + '…',
    redirectUri,
  });

  // Build the authorization URL
  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'User.Read openid profile email');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('response_mode', 'fragment');

  // Navigate the already-open popup to the auth URL
  if (!popup || popup.closed) {
    throw new Error('Popup was blocked by the browser. Please allow popups for this site.');
  }
  popup.location.href = authUrl.toString();

  console.log('[AuthPopup] 📱 Popup navigated to Microsoft login. Monitoring for redirect…');

  // Monitor the popup for the redirect back to our origin
  const authCode = await new Promise<string>((resolve, reject) => {
    const pollInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollInterval);
          reject(new Error('User closed the popup'));
          return;
        }

        // Try reading the popup URL (throws cross-origin error while on Microsoft's domain)
        const currentUrl = popup.location.href;

        // Check if the popup has redirected back to our origin
        if (currentUrl && currentUrl.startsWith(redirectUri)) {
          clearInterval(pollInterval);

          const url = new URL(currentUrl);
          const hash = url.hash.substring(1); // Remove the #
          const params = new URLSearchParams(hash);

          // Check for errors
          const error = params.get('error');
          if (error) {
            const errorDescription = params.get('error_description') || error;
            console.error('[AuthPopup] ❌ Auth error:', error, errorDescription);
            popup.close();
            reject(new Error(`${error}: ${errorDescription}`));
            return;
          }

          // Check state matches
          const returnedState = params.get('state');
          if (returnedState !== state) {
            popup.close();
            reject(new Error('State mismatch — possible CSRF attack'));
            return;
          }

          const code = params.get('code');
          if (!code) {
            popup.close();
            reject(new Error('No authorization code received'));
            return;
          }

          console.log('[AuthPopup] ✅ Got authorization code from popup');
          popup.close();
          resolve(code);
        }
      } catch {
        // Cross-origin error — popup is still on Microsoft's domain. Keep polling.
      }
    }, 200);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (!popup.closed) popup.close();
      reject(new Error('Authentication timed out'));
    }, 120_000);
  });

  // Exchange the authorization code for tokens using Microsoft's token endpoint
  console.log('[AuthPopup] 🔄 Exchanging code for tokens…');
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: 'User.Read openid profile email',
      }),
    },
  );

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('[AuthPopup] ❌ Token exchange failed:', tokenResponse.status, errorBody);
    throw new Error(`Token exchange failed: ${tokenResponse.status}`);
  }

  const tokens = await tokenResponse.json();
  console.log('[AuthPopup] ✅ Tokens received!', {
    hasAccessToken: !!tokens.access_token,
    hasIdToken: !!tokens.id_token,
  });

  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type,
    scope: tokens.scope,
  };
}

// ─── Types ───

export interface User {
  id: string;
  email: string;
  name: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  authProvider?: string;
  preferences?: Record<string, any>;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  loginWithMicrosoft: (clientId?: string, tenantId?: string) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
}

// ─── Context ───

const AuthContext = createContext<AuthState | null>(null);

// ─── Provider ───

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount + handle MSAL redirect
  useEffect(() => {
    let isMounted = true;

    async function init() {
      console.log('[AuthContext] Initializing…');

      // If this is a popup window that was opened by our manual popup flow
      // OR by MSAL, just do nothing — the parent is monitoring us.
      if (
        window.opener &&
        (window.location.hash.includes('code=') || window.location.hash.includes('error='))
      ) {
        console.log(
          '[AuthContext] Popup window with auth hash — halting (parent is reading this).',
        );
        return;
      }

      let currentUser: User | null = null;
      let currentToken = localStorage.getItem('surdej_token');

      // Optimistic restore
      const storedUser = localStorage.getItem('surdej_user');
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
          if (isMounted) setUser(currentUser);
          if (currentToken) api.setToken(currentToken);
          if (isMounted) setIsLoading(false);
        } catch {
          localStorage.removeItem('surdej_user');
        }
      }

      // MSAL redirect handling and silent reauth
      const msalConfigStr = localStorage.getItem('surdej_msal_config');

      if (msalConfigStr) {
        try {
          const config = JSON.parse(msalConfigStr);
          const pca = new PublicClientApplication({
            auth: {
              clientId: config.clientId,
              authority: config.authority,
              redirectUri: window.location.origin,
            },
            cache: { cacheLocation: 'localStorage' as const },
          });

          await pca.initialize();
          
          // ALWAYS call handleRedirectPromise exactly once on page load
          const response = await pca.handleRedirectPromise();

          if (response?.accessToken) {
            console.log('[AuthContext] MSAL Redirect → exchanging with backend…');
            const res = await api.post<{ token: string; user: User }>(
              '/auth/callback/microsoft-spa',
              {
                idToken: response.idToken,
                accessToken: response.accessToken,
                tenantId: config.appTenantId,
                clientId: config.clientId,
                payload: response,
              },
            );
            localStorage.setItem('surdej_token', res.token);
            localStorage.setItem('surdej_user', JSON.stringify(res.user));
            currentToken = res.token;
            api.setToken(res.token);
            if (isMounted) {
              setUser(res.user);
              currentUser = res.user;
              setIsLoading(false);
            }
            window.history.replaceState(null, '', '/');
          } else if (!currentToken) {
            // Silent reauth via MSAL
            const accounts = pca.getAllAccounts();
            if (accounts.length > 0) {
              const lastEmail = localStorage.getItem('surdej_last_email');
              const targetAccount = accounts.find((a) => a.username === lastEmail) || accounts[0];

              const silentResponse = await pca.acquireTokenSilent({
                scopes: ['User.Read', 'openid', 'profile', 'email'],
                account: targetAccount,
              });

              if (silentResponse?.accessToken && silentResponse.idToken) {
                const res = await api.post<{ token: string; user: User }>(
                  '/auth/callback/microsoft-spa',
                  {
                    idToken: silentResponse.idToken,
                    accessToken: silentResponse.accessToken,
                    tenantId: config.appTenantId,
                    clientId: config.clientId,
                    payload: silentResponse,
                  },
                );
                localStorage.setItem('surdej_token', res.token);
                localStorage.setItem('surdej_user', JSON.stringify(res.user));
                currentToken = res.token;
                api.setToken(res.token);
                if (isMounted) {
                  setUser(res.user);
                  currentUser = res.user;
                }
              }
            }
          }
        } catch (err) {
          console.error('[Auth] MSAL init/redirect/silent error:', err);
        }
      }

      // Backend validation
      if (currentToken) {
        api.setToken(currentToken);
        try {
          const u = await api.get<User>('/auth/me');
          localStorage.setItem('surdej_user', JSON.stringify(u));
          if (isMounted) setUser(u);
        } catch (e) {
          console.warn('[AuthContext] Token validation failed:', e);
          localStorage.removeItem('surdej_token');
          localStorage.removeItem('surdej_user');
          api.setToken(null);
          if (isMounted) setUser(null);
        }
      } else if (!currentUser) {
        if (isMounted) setUser(null);
      }

      if (isMounted) setIsLoading(false);
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email });
    localStorage.setItem('surdej_token', res.token);
    localStorage.setItem('surdej_user', JSON.stringify(res.user));
    api.setToken(res.token);
    setUser(res.user);
  }, []);

  const loginWithMicrosoft = useCallback(
    async (
      clientId = 'd82c0787-5b10-4faf-bc04-a792fc9195ea',
      tenantId = '31f35f1f-b9e8-432b-b233-d3ed528749c4',
    ) => {
      const authority = `https://login.microsoftonline.com/${tenantId}`;
      const redirectUri = window.location.origin;
      const isExtension = window.location.pathname.startsWith('/extension');

      console.log('[AuthContext] loginWithMicrosoft', { isExtension, redirectUri });

      // Store config for silent reauth on future page loads
      localStorage.setItem(
        'surdej_msal_config',
        JSON.stringify({ clientId, authority, appTenantId: tenantId }),
      );

      if (isExtension) {
        // ── POPUP FLOW ──
        // Open popup IMMEDIATELY (synchronous, in user gesture chain) for Safari compatibility.
        // Then generate PKCE and navigate the popup to the auth URL.
        console.log('[AuthContext] 🚀 Using manual popup flow');
        const width = 500;
        const height = 650;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          'about:blank',
          'msalAuthPopup',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
        );
        if (!popup) {
          throw new Error('Popup was blocked by the browser. Please allow popups for this site.');
        }
        const tokens = await loginWithPopup(clientId, tenantId, popup);

        console.log('[AuthContext] 🔄 Exchanging tokens with backend…');
        const res = await api.post<{ token: string; user: User }>('/auth/callback/microsoft-spa', {
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
          tenantId,
          clientId,
          payload: tokens,
        });
        localStorage.setItem('surdej_token', res.token);
        localStorage.setItem('surdej_user', JSON.stringify(res.user));
        api.setToken(res.token);
        setUser(res.user);
        console.log('[AuthContext] ✅ Login complete!');
      } else {
        // ── REDIRECT FLOW ──
        // Standard MSAL redirect for normal pages.
        console.log('[AuthContext] Using MSAL redirect flow');
        const pca = new PublicClientApplication({
          auth: { clientId, authority, redirectUri },
          cache: { cacheLocation: 'localStorage' as const },
        });
        await pca.initialize();
        await pca.loginRedirect({
          scopes: ['User.Read', 'openid', 'profile', 'email'],
        });
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }

    const msalConfigStr = localStorage.getItem('surdej_msal_config');
    if (msalConfigStr) {
      try {
        const config = JSON.parse(msalConfigStr);
        const pca = new PublicClientApplication({
          auth: {
            clientId: config.clientId,
            authority: config.authority,
            redirectUri: window.location.origin,
          },
          cache: { cacheLocation: 'localStorage' as const },
        });
        await pca.initialize();

        const accounts = pca.getAllAccounts();
        for (const account of accounts) {
          await pca.clearCache({ account });
        }

        localStorage.removeItem('surdej_msal_config');

        Object.keys(localStorage)
          .filter(
            (key) => key.startsWith('msal.') || key.includes('.login.') || key.includes('msal'),
          )
          .forEach((key) => localStorage.removeItem(key));
      } catch (err) {
        console.error('[Auth] MSAL logout error:', err);
      }
    }

    localStorage.removeItem('surdej_token');
    localStorage.removeItem('surdej_user');
    api.setToken(null);
    setUser(null);
  }, []);

  const setSession = useCallback((token: string, user: User) => {
    localStorage.setItem('surdej_token', token);
    localStorage.setItem('surdej_user', JSON.stringify(user));
    api.setToken(token);
    setUser(user);
  }, []);

  return (
    <AuthContext
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithMicrosoft,
        logout,
        setSession,
      }}
    >
      {children}
    </AuthContext>
  );
}

// ─── Hook ───

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
