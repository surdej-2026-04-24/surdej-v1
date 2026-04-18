/**
 * Surdej Extension — Options / Configuration Page
 *
 * Allows users to:
 * - View and select from saved endpoints
 * - Add custom endpoints
 * - Test connectivity to the selected endpoint
 * - Switch between light / dark / system theme
 */

import { useState, useEffect, useCallback } from 'react';

interface SavedEndpoint {
    label: string;
    url: string;
}

type Theme = 'light' | 'dark' | 'system';
type Language = 'en' | 'da';

const DEFAULT_ENDPOINTS: SavedEndpoint[] = [
    { label: 'Local Development', url: 'http://localhost:4001' },
];

function applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

export default function App() {
    const [endpoints, setEndpoints] = useState<SavedEndpoint[]>(DEFAULT_ENDPOINTS);
    const [activeUrl, setActiveUrl] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');
    const [saved, setSaved] = useState(false);
    const [theme, setTheme] = useState<Theme>('system');
    const [debugMode, setDebugMode] = useState(false);
    const [language, setLanguage] = useState<Language>('da');

    useEffect(() => {
        chrome.storage.sync.get(['endpoint', 'savedEndpoints', 'theme', 'debugMode', 'language'], (result) => {
            if (result.endpoint) setActiveUrl(result.endpoint as string);
            if (result.savedEndpoints && Array.isArray(result.savedEndpoints)) {
                setEndpoints(result.savedEndpoints);
            }
            const t = (result.theme as Theme) ?? 'system';
            setTheme(t);
            applyTheme(t);
            setDebugMode(!!result.debugMode);
            setLanguage((result.language as Language) ?? 'da');
        });
    }, []);

    const selectTheme = useCallback((t: Theme) => {
        setTheme(t);
        applyTheme(t);
        chrome.storage.sync.set({ theme: t });
    }, []);

    // Toggle debug mode
    const toggleDebug = useCallback(() => {
        setDebugMode((prev) => {
            const next = !prev;
            chrome.storage.sync.set({ debugMode: next });
            return next;
        });
    }, []);

    // Select an endpoint
    const selectEndpoint = useCallback((url: string) => {
        setActiveUrl(url);
        setTestStatus('idle');
        chrome.storage.sync.set({ endpoint: url }, () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        });
    }, []);

    // Add a new custom endpoint
    const addEndpoint = useCallback(() => {
        const url = newUrl.trim().replace(/\/+$/, '');
        const label = newLabel.trim() || new URL(url).hostname;
        if (!url) return;

        if (endpoints.some((e) => e.url === url)) {
            selectEndpoint(url);
            setNewUrl('');
            setNewLabel('');
            return;
        }

        const updated = [...endpoints, { label, url }];
        setEndpoints(updated);
        setNewUrl('');
        setNewLabel('');
        chrome.storage.sync.set({ savedEndpoints: updated, endpoint: url });
        setActiveUrl(url);
    }, [newUrl, newLabel, endpoints, selectEndpoint]);

    // Remove a custom endpoint
    const removeEndpoint = useCallback((url: string) => {
        const updated = endpoints.filter((e) => e.url !== url);
        setEndpoints(updated);
        chrome.storage.sync.set({ savedEndpoints: updated });
        if (activeUrl === url && updated.length > 0) {
            selectEndpoint(updated[0].url);
        }
    }, [endpoints, activeUrl, selectEndpoint]);

    // Test connectivity
    const testConnection = useCallback(async () => {
        if (!activeUrl) return;
        setTestStatus('testing');
        setTestMessage('');

        try {
            const res = await fetch(`${activeUrl}/api/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });

            if (res.ok) {
                const data = await res.json();
                setTestStatus('success');
                setTestMessage(`Connected • v${data.version ?? '?'} • ${Math.round(data.uptime ?? 0)}s uptime`);
            } else {
                setTestStatus('error');
                setTestMessage(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (err) {
            setTestStatus('error');
            setTestMessage(err instanceof Error ? err.message : 'Connection failed');
        }
    }, [activeUrl]);

    const isValidUrl = (s: string): boolean => {
        try {
            const u = new URL(s);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="header">
                <div className="header-logo">AI</div>
                <div>
                    <div className="header-title">Surdej Settings</div>
                    <div className="header-subtitle">Configure your extension preferences</div>
                </div>
            </div>

            {/* Theme */}
            <div className="card">
                <div className="card-title">Appearance</div>
                <div className="theme-picker">
                    <button
                        className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => selectTheme('light')}
                    >
                        ☀️ Light
                    </button>
                    <button
                        className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => selectTheme('dark')}
                    >
                        🌙 Dark
                    </button>
                    <button
                        className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                        onClick={() => selectTheme('system')}
                    >
                        💻 System
                    </button>
                </div>
            </div>

            {/* Language */}
            <div className="card">
                <div className="card-title">Language / Sprog</div>
                <div className="theme-picker">
                    <button
                        className={`theme-btn ${language === 'da' ? 'active' : ''}`}
                        onClick={() => { setLanguage('da'); chrome.storage.sync.set({ language: 'da' }); }}
                    >
                        🇩🇰 Dansk
                    </button>
                    <button
                        className={`theme-btn ${language === 'en' ? 'active' : ''}`}
                        onClick={() => { setLanguage('en'); chrome.storage.sync.set({ language: 'en' }); }}
                    >
                        🇬🇧 English
                    </button>
                </div>
            </div>

            {/* Debug Mode */}
            <div className="card">
                <div className="card-title">Developer</div>
                <div
                    className={`endpoint-item ${debugMode ? 'active' : ''}`}
                    onClick={toggleDebug}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="radio" />
                    <div style={{ flex: 1 }}>
                        <div className="label">🐛 Debug Mode</div>
                        <div className="url" style={{ fontFamily: 'inherit' }}>
                            Show debugging tools in the side panel footer
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Endpoint */}
            <div className="card">
                <div className="card-title">API Endpoint</div>

                <div className="endpoints-list">
                    {endpoints.map((ep) => (
                        <div
                            key={ep.url}
                            className={`endpoint-item ${activeUrl === ep.url ? 'active' : ''}`}
                            onClick={() => selectEndpoint(ep.url)}
                        >
                            <div className="radio" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="label">{ep.label}</div>
                                <div className="url">{ep.url}</div>
                            </div>
                            {!DEFAULT_ENDPOINTS.some((d) => d.url === ep.url) && (
                                <button
                                    className="remove"
                                    onClick={(e) => { e.stopPropagation(); removeEndpoint(ep.url); }}
                                    title="Remove"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="btn-row">
                    <button className="btn" onClick={testConnection} disabled={!activeUrl}>
                        {testStatus === 'testing' ? '⏳ Testing…' : '🔌 Test Connection'}
                    </button>
                    {saved && <span className="status success">✓ Saved</span>}
                </div>

                {testStatus === 'success' && (
                    <div className="status success">✓ {testMessage}</div>
                )}
                {testStatus === 'error' && (
                    <div className="status error">✗ {testMessage}</div>
                )}
            </div>

            {/* Add Custom Endpoint */}
            <div className="card">
                <div className="card-title">Add Custom Endpoint</div>

                <div className="field">
                    <label>Label (optional)</label>
                    <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="My staging server"
                    />
                </div>

                <div className="field">
                    <label>URL</label>
                    <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://staging.example.com"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && isValidUrl(newUrl)) addEndpoint();
                        }}
                    />
                    <div className="hint">The base URL of your Surdej frontend instance (without /api)</div>
                </div>

                <div className="btn-row">
                    <button
                        className="btn btn-primary"
                        onClick={addEndpoint}
                        disabled={!isValidUrl(newUrl)}
                    >
                        Add Endpoint
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="footer">
                Surdej Extension v{chrome.runtime.getManifest().version}
            </div>
        </div>
    );
}
