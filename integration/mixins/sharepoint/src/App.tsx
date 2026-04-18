import { useState, useEffect, useCallback } from 'react';
import { SurdejMixinClient } from '@surdej/mixin-sdk';
import { msalInstance, graphScopes } from './auth';
import {
    searchSites,
    getSiteLibraries,
    getDriveChildren,
    type GraphSite,
    type GraphList,
    type DriveItem,
} from './graph';

// ─── Surdej SDK Connection ─────────────────────────────────────

const surdej = new SurdejMixinClient();

function useSurdejConnection() {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        surdej.connect()
            .then(() => setConnected(true))
            .catch(() => {
                console.warn('[SharePoint Mixin] Running standalone (no Surdej host)');
                setConnected(false);
            });
    }, []);

    return connected;
}

// ─── MSAL Auth Hook ─────────────────────────────────────────────

function useMsalAuth() {
    const [signedIn, setSignedIn] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        msalInstance.initialize().then(() => {
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                setSignedIn(true);
                setUserName(accounts[0].name ?? accounts[0].username);
            }
            setInitializing(false);
        });
    }, []);

    const signIn = useCallback(async () => {
        try {
            const result = await msalInstance.loginPopup({ scopes: graphScopes });
            setSignedIn(true);
            setUserName(result.account?.name ?? result.account?.username ?? null);
        } catch (err) {
            console.error('MSAL sign-in failed:', err);
        }
    }, []);

    const signOut = useCallback(async () => {
        await msalInstance.logoutPopup();
        setSignedIn(false);
        setUserName(null);
    }, []);

    return { signedIn, userName, initializing, signIn, signOut };
}

// ─── Breadcrumb types ───────────────────────────────────────────

type NavStep = 'sites' | 'libraries' | 'browse';

interface NavState {
    step: NavStep;
    site: GraphSite | null;
    library: GraphList | null;
    folderStack: Array<{ id: string; name: string }>;
}

// ─── App ────────────────────────────────────────────────────────

export default function App() {
    const surdejConnected = useSurdejConnection();
    const { signedIn, userName, initializing, signIn, signOut } = useMsalAuth();

    const [nav, setNav] = useState<NavState>({
        step: 'sites',
        site: null,
        library: null,
        folderStack: [],
    });

    // Data
    const [siteQuery, setSiteQuery] = useState('');
    const [sites, setSites] = useState<GraphSite[]>([]);
    const [libraries, setLibraries] = useState<GraphList[]>([]);
    const [items, setItems] = useState<DriveItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Search sites ────────────────────────────────────────────
    const handleSearch = useCallback(async () => {
        if (!siteQuery.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const results = await searchSites(siteQuery);
            setSites(results);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setLoading(false);
        }
    }, [siteQuery]);

    // ── Select site → show libraries ────────────────────────────
    const selectSite = useCallback(async (site: GraphSite) => {
        setLoading(true);
        setError(null);
        try {
            const libs = await getSiteLibraries(site.id);
            setLibraries(libs);
            setNav({ step: 'libraries', site, library: null, folderStack: [] });

            // Persist selection to Surdej KV
            if (surdejConnected) {
                surdej.kv.set('selected-site', {
                    id: site.id,
                    name: site.displayName,
                    url: site.webUrl,
                }).catch(() => {});
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load libraries');
        } finally {
            setLoading(false);
        }
    }, [surdejConnected]);

    // ── Select library → browse root ────────────────────────────
    const selectLibrary = useCallback(async (lib: GraphList) => {
        if (!nav.site) return;
        setLoading(true);
        setError(null);
        try {
            const children = await getDriveChildren(nav.site.id, lib.id);
            setItems(children);
            setNav({ ...nav, step: 'browse', library: lib, folderStack: [] });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load library');
        } finally {
            setLoading(false);
        }
    }, [nav]);

    // ── Navigate into folder ────────────────────────────────────
    const openFolder = useCallback(async (item: DriveItem) => {
        if (!nav.site || !nav.library) return;
        setLoading(true);
        setError(null);
        try {
            const children = await getDriveChildren(nav.site.id, nav.library.id, item.id);
            setItems(children);
            setNav({
                ...nav,
                folderStack: [...nav.folderStack, { id: item.id, name: item.name }],
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to open folder');
        } finally {
            setLoading(false);
        }
    }, [nav]);

    // ── Navigate up ─────────────────────────────────────────────
    const goUp = useCallback(async (targetIndex: number) => {
        if (!nav.site || !nav.library) return;
        setLoading(true);
        setError(null);
        try {
            const parentId = targetIndex < 0 ? undefined : nav.folderStack[targetIndex].id;
            const children = await getDriveChildren(nav.site.id, nav.library.id, parentId);
            setItems(children);
            setNav({
                ...nav,
                folderStack: nav.folderStack.slice(0, targetIndex + 1),
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Navigation failed');
        } finally {
            setLoading(false);
        }
    }, [nav]);

    // ── Go back to previous step ────────────────────────────────
    const goBack = useCallback(() => {
        if (nav.step === 'browse' && nav.folderStack.length > 0) {
            goUp(nav.folderStack.length - 2);
        } else if (nav.step === 'browse') {
            setNav({ ...nav, step: 'libraries', library: null });
        } else if (nav.step === 'libraries') {
            setNav({ step: 'sites', site: null, library: null, folderStack: [] });
        }
    }, [nav, goUp]);

    // ── Loading / init ──────────────────────────────────────────
    if (initializing) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-sm text-gray-500">Initializing…</div>
            </div>
        );
    }

    // ── Sign-in screen ──────────────────────────────────────────
    if (!signedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">SharePoint Explorer</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Sign in with your Microsoft account to browse SharePoint
                    </p>
                </div>
                <button
                    onClick={signIn}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Sign in with Microsoft
                </button>
                {surdejConnected && (
                    <div className="text-[10px] text-green-600">
                        ✓ Connected to Surdej
                    </div>
                )}
            </div>
        );
    }

    // ── Main UI ─────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-white shrink-0">
                <div className="flex items-center gap-2">
                    {nav.step !== 'sites' && (
                        <button
                            onClick={goBack}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            ← Back
                        </button>
                    )}
                    <span className="text-xs font-medium">SharePoint Explorer</span>
                    {surdejConnected && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            SDK
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{userName}</span>
                    <button
                        onClick={signOut}
                        className="text-[10px] text-red-500 hover:underline"
                    >
                        Sign out
                    </button>
                </div>
            </div>

            {/* Breadcrumb */}
            {nav.step !== 'sites' && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-gray-50 text-[10px] text-gray-500 overflow-x-auto shrink-0">
                    <button onClick={() => setNav({ step: 'sites', site: null, library: null, folderStack: [] })} className="hover:text-blue-600">
                        Sites
                    </button>
                    {nav.site && (
                        <>
                            <span>/</span>
                            <button
                                onClick={() => { setNav({ ...nav, step: 'libraries', library: null, folderStack: [] }); }}
                                className="hover:text-blue-600 truncate max-w-[120px]"
                            >
                                {nav.site.displayName}
                            </button>
                        </>
                    )}
                    {nav.library && (
                        <>
                            <span>/</span>
                            <button
                                onClick={() => goUp(-1)}
                                className="hover:text-blue-600 truncate max-w-[120px]"
                            >
                                {nav.library.displayName}
                            </button>
                        </>
                    )}
                    {nav.folderStack.map((folder, i) => (
                        <span key={folder.id} className="flex items-center gap-1">
                            <span>/</span>
                            <button
                                onClick={() => goUp(i)}
                                className="hover:text-blue-600 truncate max-w-[100px]"
                            >
                                {folder.name}
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b">
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-xs text-gray-500">Loading…</div>
                    </div>
                )}

                {!loading && nav.step === 'sites' && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={siteQuery}
                                onChange={(e) => setSiteQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search SharePoint sites…"
                                className="flex-1 h-8 px-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                            />
                            <button
                                onClick={handleSearch}
                                className="px-3 h-8 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                                Search
                            </button>
                        </div>
                        <div className="space-y-1">
                            {sites.map((site) => (
                                <button
                                    key={site.id}
                                    onClick={() => selectSite(site)}
                                    className="w-full text-left px-3 py-2 rounded-md border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                                >
                                    <div className="text-xs font-medium">{site.displayName}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{site.webUrl}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && nav.step === 'libraries' && (
                    <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide font-semibold">
                            Document Libraries
                        </div>
                        {libraries.map((lib) => (
                            <button
                                key={lib.id}
                                onClick={() => selectLibrary(lib)}
                                className="w-full text-left px-3 py-2 rounded-md border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                            >
                                <div className="text-xs font-medium">{lib.displayName}</div>
                            </button>
                        ))}
                        {libraries.length === 0 && (
                            <div className="text-xs text-gray-400 py-4 text-center">No libraries found</div>
                        )}
                    </div>
                )}

                {!loading && nav.step === 'browse' && (
                    <div className="space-y-1">
                        {items.length === 0 && (
                            <div className="text-xs text-gray-400 py-4 text-center">Empty folder</div>
                        )}
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50 transition-colors"
                            >
                                <span className="text-sm">
                                    {item.folder ? '📁' : '📄'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    {item.folder ? (
                                        <button
                                            onClick={() => openFolder(item)}
                                            className="text-xs font-medium text-blue-600 hover:underline truncate block"
                                        >
                                            {item.name}
                                        </button>
                                    ) : (
                                        <a
                                            href={item.webUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium text-blue-600 hover:underline truncate block"
                                        >
                                            {item.name}
                                        </a>
                                    )}
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        {item.lastModifiedBy?.user?.displayName && (
                                            <span>{item.lastModifiedBy.user.displayName}</span>
                                        )}
                                        <span>{new Date(item.lastModifiedDateTime).toLocaleDateString()}</span>
                                        {item.size != null && !item.folder && (
                                            <span>{formatSize(item.size)}</span>
                                        )}
                                        {item.folder && (
                                            <span>{item.folder.childCount} items</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
