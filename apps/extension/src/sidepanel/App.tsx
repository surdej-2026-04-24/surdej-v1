/**
 * Side Panel App
 *
 * Renders the Surdej frontend's /extension route inside an iframe.
 * Acts as a bridge relay between the iframe (postMessage) and the
 * background worker (chrome.runtime.sendMessage).
 */

import { useState, useEffect, useRef } from 'react';
import './App.css';

const BRIDGE_NAMESPACE = 'surdej-bridge';

export default function App() {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [language, setLanguage] = useState<string>('da');
  const [pendingUseCase, setPendingUseCase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Load settings + check for pending use case
    chrome.storage.sync.get(['endpoint', 'debugMode', 'language'], (result) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message ?? 'Failed to get settings');
        return;
      }
      setEndpoint((result.endpoint as string) ?? 'http://localhost:4001');
      setDebugMode(!!result.debugMode);
      setLanguage((result.language as string) ?? 'da');
    });

    // Check for a pending use case set before the sidepanel opened
    chrome.storage.local.get('activeUseCase', (result) => {
      if (result.activeUseCase) {
        setPendingUseCase(result.activeUseCase as string);
        // Clear it so it doesn't re-apply on next open
        chrome.storage.local.remove('activeUseCase');
      }
    });

    // Listen for setting changes (sync)
    const syncListener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.debugMode) setDebugMode(!!changes.debugMode.newValue);
      if (changes.endpoint) setEndpoint(changes.endpoint.newValue as string);
      if (changes.language) setLanguage(changes.language.newValue as string);
    };
    chrome.storage.sync.onChanged.addListener(syncListener);

    // Listen for use case changes (local) — happens when the main app
    // sends SET_USE_CASE while the sidepanel is already open
    const localListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if (changes.activeUseCase?.newValue) {
        const useCaseSlug = changes.activeUseCase.newValue as string;
        // Post to the iframe so the extension page can activate it
        iframeRef.current?.contentWindow?.postMessage({
          type: 'SURDEJ_SET_USE_CASE',
          useCase: useCaseSlug,
        }, '*');
        // Clear so it doesn't persist
        chrome.storage.local.remove('activeUseCase');
      }
    };
    chrome.storage.onChanged.addListener(localListener);

    return () => {
      chrome.storage.sync.onChanged.removeListener(syncListener);
      chrome.storage.onChanged.removeListener(localListener);
    };
  }, []);

  // ─── Bridge relay: iframe postMessage → chrome.runtime → content script ──
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;

      // Handle locale change from iframe
      if (data?.type === 'SURDEJ_LOCALE_CHANGE' && data.locale) {
        setLanguage(data.locale);
        chrome.storage.sync.set({ language: data.locale });
        return;
      }

      if (data?.namespace !== BRIDGE_NAMESPACE) return;
      if (data?.direction !== 'iframe-to-host') return;

      // Forward to background worker, which relays to the content script
      chrome.runtime.sendMessage(
        { type: 'BRIDGE_TO_CONTENT', payload: data },
        (response) => {
          if (chrome.runtime.lastError) {
            // Send error back to iframe
            iframeRef.current?.contentWindow?.postMessage({
              namespace: BRIDGE_NAMESPACE,
              id: data.id,
              direction: 'host-to-iframe',
              ok: false,
              error: chrome.runtime.lastError.message ?? 'Bridge relay failed',
            }, '*');
            return;
          }

          // Forward content script response back to iframe
          iframeRef.current?.contentWindow?.postMessage({
            namespace: BRIDGE_NAMESPACE,
            id: data.id,
            direction: 'host-to-iframe',
            ok: response?.ok ?? false,
            data: response?.data,
            error: response?.error,
          }, '*');
        },
      );
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ─── Notify iframe when active tab changes ──────────────────────────
  useEffect(() => {
    function notifyTabChange() {
      iframeRef.current?.contentWindow?.postMessage({
        namespace: BRIDGE_NAMESPACE,
        type: 'TAB_CHANGED',
      }, '*');
    }

    // Tab switched
    chrome.tabs.onActivated.addListener(notifyTabChange);
    // Tab URL updated (e.g. navigation within the same tab)
    const onUpdate = (_tabId: number, changeInfo: { url?: string }, tab: { active?: boolean }) => {
      if (changeInfo.url && tab.active) notifyTabChange();
    };
    chrome.tabs.onUpdated.addListener(onUpdate);

    return () => {
      chrome.tabs.onActivated.removeListener(notifyTabChange);
      chrome.tabs.onUpdated.removeListener(onUpdate);
    };
  }, []);

  if (error) {
    return (
      <div className="sidepanel-error">
        <div className="sidepanel-error-icon">⚠️</div>
        <p>Could not connect to Surdej</p>
        <p className="sidepanel-error-detail">{error}</p>
      </div>
    );
  }

  if (!endpoint) {
    return (
      <div className="sidepanel-loading">
        <div className="sidepanel-spinner" />
        <p>Connecting to Surdej…</p>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (debugMode) params.set('debug', 'true');
  if (language) params.set('lang', language);
  // Pass pending use case as query param on initial load
  if (pendingUseCase) params.set('useCase', pendingUseCase);
  const qs = params.toString();
  const iframeSrc = `${endpoint}/extension${qs ? `?${qs}` : ''}`;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="sidepanel-iframe"
      title="Surdej"
      allow="clipboard-write"
    />
  );
}
