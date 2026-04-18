import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
    auth: {
        // Replace with your Azure AD app registration
        clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
        authority: import.meta.env.VITE_MSAL_AUTHORITY || 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const graphScopes = [
    'Sites.Read.All',
    'Files.Read.All',
];

export async function getGraphToken(): Promise<string> {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error('No MSAL account — please sign in first');
    }

    try {
        const result = await msalInstance.acquireTokenSilent({
            scopes: graphScopes,
            account: accounts[0],
        });
        return result.accessToken;
    } catch {
        const result = await msalInstance.acquireTokenPopup({
            scopes: graphScopes,
        });
        return result.accessToken;
    }
}
