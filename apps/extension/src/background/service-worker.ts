/**
 * Background Service Worker
 *
 * - Opens the side panel when the extension icon is clicked.
 * - Manages endpoint configuration via chrome.storage.sync.
 * - Relays bridge messages between the side panel and content scripts.
 */

// Default API endpoint — configurable via the options/popup page
const DEFAULT_ENDPOINT = 'http://localhost:4001';

// Open side panel when user clicks the extension action icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[surdej-ext] Failed to set panel behavior:', err));

// Initialize storage with default endpoint if not already set
// and open the welcome page on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
    const { endpoint } = await chrome.storage.sync.get('endpoint');
    if (!endpoint) {
        await chrome.storage.sync.set({ endpoint: DEFAULT_ENDPOINT });
        console.log('[surdej-ext] Initialized endpoint:', DEFAULT_ENDPOINT);
    }

    // Open welcome page on install or update
    if (details.reason === 'install' || details.reason === 'update') {
        // Store reason so the welcome page can show the right badge
        await chrome.storage.sync.set({ _installReason: details.reason });
        const welcomeUrl = chrome.runtime.getURL('src/welcome/index.html');
        chrome.tabs.create({ url: welcomeUrl });
        console.log(`[surdej-ext] Opened welcome page (${details.reason})`);
    }
});

// Listen for messages from content scripts / side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // ─── Endpoint management ────────────────────────────────
    if (message.type === 'GET_ENDPOINT') {
        chrome.storage.sync.get('endpoint').then(({ endpoint }) => {
            sendResponse({ endpoint: endpoint ?? DEFAULT_ENDPOINT });
        });
        return true; // async response
    }

    if (message.type === 'SET_ENDPOINT') {
        chrome.storage.sync.set({ endpoint: message.endpoint }).then(() => {
            sendResponse({ ok: true });
        });
        return true;
    }

    // ─── Capture visible tab screenshot ─────────────────────
    if (message.type === 'CAPTURE_VISIBLE_TAB') {
        chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ dataUrl: null, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl });
            }
        });
        return true;
    }

    // ─── Use Case selection (from main app) ─────────────────
    if (message.type === 'SET_USE_CASE') {
        // Store the use case so the sidepanel can pick it up
        chrome.storage.local.set({ activeUseCase: message.useCase }).then(() => {
            // Try to open the side panel on the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tabId = tabs[0]?.id;
                let panelOpened = false;
                if (tabId) {
                    try {
                        await chrome.sidePanel.open({ tabId });
                        panelOpened = true;
                    } catch (err) {
                        console.warn('[surdej-ext] Side panel open failed (user gesture required):', err);
                    }
                }
                sendResponse({ ok: true, panelOpened });
            });
        });
        return true;
    }

    // ─── Bridge relay: side panel → content script ──────────
    if (message.type === 'BRIDGE_TO_CONTENT') {
        // CAPTURE_TAB is handled in the background, not content script
        if (message.payload?.type === 'CAPTURE_TAB') {
            chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ ok: true, data: { dataUrl } });
                }
            });
            return true;
        }
        // Forward the bridge request to the content script on the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                sendResponse({ ok: false, error: 'No active tab' });
                return;
            }

            // Try sending; if it fails, inject the content script and retry once
            const trySend = (retry: boolean) => {
                chrome.tabs.sendMessage(tabId, {
                    type: 'BRIDGE_REQUEST',
                    payload: message.payload,
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        const errMsg = chrome.runtime.lastError.message ?? '';
                        // Content script not injected — try programmatic injection
                        if (retry && errMsg.includes('Receiving end does not exist')) {
                            console.log('[surdej-ext] Content script missing, injecting programmatically...');
                            // Read content script filename from manifest (survives hash changes)
                            const manifest = chrome.runtime.getManifest();
                            const contentJs = manifest.content_scripts?.[0]?.js?.[0];
                            if (!contentJs) {
                                sendResponse({ ok: false, error: 'No content script in manifest' });
                                return;
                            }
                            chrome.scripting.executeScript({
                                target: { tabId },
                                files: [contentJs],
                            }).then(() => {
                                // Give the content script a moment to initialize
                                setTimeout(() => trySend(false), 200);
                            }).catch((injectErr) => {
                                sendResponse({
                                    ok: false,
                                    error: `Failed to inject content script: ${injectErr.message}`,
                                });
                            });
                            return;
                        }
                        sendResponse({ ok: false, error: errMsg || 'Content script not reachable' });
                    } else {
                        sendResponse(response);
                    }
                });
            };

            trySend(true);
        });
        return true; // async response
    }
});
