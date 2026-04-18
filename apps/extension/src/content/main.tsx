/**
 * Content Script Bridge Handler
 *
 * Injected into every page. Listens for bridge requests from:
 * 1. chrome.runtime.onMessage (from side panel via background worker)
 * 2. window.postMessage (from an iframe, if applicable)
 *
 * Executes DOM queries / interactions on the host page and responds.
 *
 * This is intentionally lightweight — no React, no UI injection.
 */

import {
  BRIDGE_NAMESPACE,
  type BridgeRequest,
  type BridgeResponse,
  type PageInfo,
  type PageSnapshot,
  type QuerySelectorResult,
  type QuerySelectorAllResult,
  type FormFieldInfo,
  type FormFieldsResult,
} from '../shared/protocol';

console.log('[surdej-ext] Bridge content script loaded');
document.documentElement.setAttribute('data-surdej-extension', 'true');

// ─── chrome.runtime message handler (side panel → background → here) ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'BRIDGE_REQUEST') return;

  const bridgeReq = message.payload as BridgeRequest;

  handleRequest(bridgeReq)
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });

  return true; // async response
});

// ─── postMessage handler (iframe → content script, legacy/fallback) ───

window.addEventListener('message', async (event) => {
  // Allow main page to open sidebar directly if they send exact message
  if (event.data?.type === 'SURDEJ_OPEN_SIDEBAR') {
    chrome.runtime.sendMessage({ type: 'SET_USE_CASE', useCase: event.data.useCase }, (response) => {
      window.postMessage({
        type: 'SURDEJ_SIDEBAR_ACK',
        ok: response?.ok ?? false,
        panelOpened: response?.panelOpened ?? false,
        useCase: event.data.useCase,
      }, '*');
    });
    return;
  }

  // Capture visible tab screenshot via background worker
  if (event.data?.type === 'SURDEJ_CAPTURE_TAB') {
    chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (response) => {
      window.postMessage({ type: 'SURDEJ_CAPTURE_TAB_RESULT', dataUrl: response?.dataUrl ?? null }, '*');
    });
    return;
  }
  // Only accept messages from our namespace
  if (event.data?.namespace !== BRIDGE_NAMESPACE) return;
  if (event.data?.direction !== 'iframe-to-host') return;

  const request = event.data as BridgeRequest;

  try {
    const data = await handleRequest(request);
    respond(request.id, true, data);
  } catch (err) {
    respond(request.id, false, undefined, err instanceof Error ? err.message : String(err));
  }
});

function respond(id: string, ok: boolean, data?: unknown, error?: string) {
  const response: BridgeResponse = {
    namespace: BRIDGE_NAMESPACE,
    id,
    direction: 'host-to-iframe',
    ok,
    data,
    error,
  };
  window.postMessage(response, '*');
}

// ─── Request Handlers ───────────────────────────────────────────

async function handleRequest(req: BridgeRequest): Promise<unknown> {
  switch (req.type) {
    case 'PING':
      return { pong: true, timestamp: Date.now() };

    case 'GET_PAGE_INFO':
      return getPageInfo();

    case 'GET_PAGE_TEXT':
      return { text: getVisibleText() };

    case 'GET_SELECTION':
      return { text: window.getSelection()?.toString() ?? '' };

    case 'QUERY_SELECTOR':
      return querySelector(req.payload as { selector: string });

    case 'QUERY_SELECTOR_ALL':
      return querySelectorAll(req.payload as { selector: string; limit?: number });

    case 'CLICK_ELEMENT':
      return clickElement(req.payload as { selector: string });

    case 'FILL_INPUT':
      return fillInput(req.payload as { selector: string; value: string });

    case 'GET_PAGE_SNAPSHOT':
      return getPageSnapshot();

    case 'EXECUTE_SCRIPT':
      return { error: 'EXECUTE_SCRIPT is disabled for security' };

    case 'FETCH_PAGE':
      return fetchPage(req.payload as {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
      });

    case 'GET_XSRF_TOKEN':
      return getXsrfToken();

    case 'GET_FORM_FIELDS':
      return getFormFields();

    case 'FETCH_IMAGE':
      return fetchImage(req.payload as { url: string; headers?: Record<string, string> });

    default:
      throw new Error(`Unknown request type: ${req.type}`);
  }
}

// ─── DOM Helpers ────────────────────────────────────────────────

function getPageInfo(): PageInfo {
  const meta = document.querySelector('meta[name="description"]');
  const favicon =
    (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href ??
    (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)?.href ??
    `${location.origin}/favicon.ico`;

  // Extract Open Graph meta tags
  const getOgContent = (property: string): string | undefined => {
    const el = document.querySelector(`meta[property="og:${property}"]`) as HTMLMetaElement | null;
    return el?.content || undefined;
  };

  const og: PageInfo['og'] = {};
  const ogTitle = getOgContent('title');
  const ogDescription = getOgContent('description');
  const ogImage = getOgContent('image');
  const ogType = getOgContent('type');
  const ogUrl = getOgContent('url');
  const ogSiteName = getOgContent('site_name');

  if (ogTitle) og.title = ogTitle;
  if (ogDescription) og.description = ogDescription;
  if (ogImage) og.image = ogImage;
  if (ogType) og.type = ogType;
  if (ogUrl) og.url = ogUrl;
  if (ogSiteName) og.siteName = ogSiteName;

  return {
    url: location.href,
    title: document.title,
    description: meta?.getAttribute('content') ?? '',
    hostname: location.hostname,
    pathname: location.pathname,
    lang: document.documentElement.lang ?? '',
    favicon,
    og: Object.keys(og).length > 0 ? og : undefined,
  };
}

function getVisibleText(): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const tag = el.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (el.offsetParent === null && tag !== 'BODY') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const chunks: string[] = [];
  let total = 0;
  const MAX_CHARS = 10_000;

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (!text) continue;
    chunks.push(text);
    total += text.length;
    if (total >= MAX_CHARS) break;
  }

  return chunks.join('\n');
}

function getPageSnapshot(): PageSnapshot {
  const headings: string[] = [];
  document.querySelectorAll('h1, h2, h3').forEach((el) => {
    const text = el.textContent?.trim();
    if (text) headings.push(`${el.tagName}: ${text}`);
  });

  return {
    url: location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    textContent: getVisibleText(),
    selectedText: window.getSelection()?.toString() ?? '',
    linkCount: document.querySelectorAll('a[href]').length,
    imageCount: document.querySelectorAll('img').length,
    inputCount: document.querySelectorAll('input, textarea, select').length,
    headings,
  };
}

function getElementAttrs(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of el.attributes) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function querySelector(payload: { selector: string }): QuerySelectorResult {
  const el = document.querySelector(payload.selector);
  if (!el) {
    return { count: 0, text: null, html: null, tagName: null, attributes: {} };
  }
  return {
    count: document.querySelectorAll(payload.selector).length,
    text: el.textContent?.trim()?.slice(0, 2000) ?? null,
    html: el.outerHTML.slice(0, 2000),
    tagName: el.tagName,
    attributes: getElementAttrs(el),
  };
}

function querySelectorAll(payload: { selector: string; limit?: number }): QuerySelectorAllResult {
  const els = document.querySelectorAll(payload.selector);
  const limit = Math.min(payload.limit ?? 20, 50);
  const elements: QuerySelectorAllResult['elements'] = [];

  els.forEach((el, i) => {
    if (i >= limit) return;
    elements.push({
      text: el.textContent?.trim()?.slice(0, 500) ?? '',
      tagName: el.tagName,
      attributes: getElementAttrs(el),
    });
  });

  return { count: els.length, elements };
}

function clickElement(payload: { selector: string }): { clicked: boolean } {
  const el = document.querySelector(payload.selector) as HTMLElement | null;
  if (!el) throw new Error(`Element not found: ${payload.selector}`);
  el.click();
  return { clicked: true };
}

function fillInput(payload: { selector: string; value: string }): { filled: boolean } {
  const el = document.querySelector(payload.selector) as HTMLInputElement | null;
  if (!el) throw new Error(`Input not found: ${payload.selector}`);
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, payload.value);
  } else {
    el.value = payload.value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { filled: true };
}

// ─── Extension API Helpers ─────────────────────────────────────────

async function fetchPage(payload: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ data?: unknown; error?: string; rateLimit: { remaining: number; limit: number } }> {
  try {
    const response = await fetch(payload.url, {
      method: payload.method || 'POST',
      headers: payload.headers || {},
      body: payload.body ? JSON.stringify(payload.body) : undefined,
      credentials: 'include',
    });

    const rateLimit = {
      remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '600', 10),
      limit: parseInt(response.headers.get('x-ratelimit-limit') || '600', 10),
    };

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, rateLimit };
    }

    const data = await response.json();
    return { data, rateLimit };
  } catch (err: any) {
    return { error: err.message, rateLimit: { remaining: 600, limit: 600 } };
  }
}

function getXsrfToken(): { token: string | null } {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') {
      return { token: decodeURIComponent(rest.join('=')) };
    }
  }
  return { token: null };
}

// ─── Form Fields Extraction ─────────────────────────────────────

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${name}"]`;
  const type = el.getAttribute('type');
  if (type) return `${tag}[type="${type}"]`;
  return tag;
}

function getFieldLabel(el: Element, doc: Document): string {
  // Check for associated label via 'for' attribute
  const id = el.getAttribute('id');
  if (id) {
    const label = doc.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() || '';
  }
  // Check for parent label
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
    return clone.textContent?.trim() || '';
  }
  // Check aria-label
  return el.getAttribute('aria-label') || '';
}

function extractFieldsFromDocument(doc: Document, source: string): FormFieldInfo[] {
  const fields: FormFieldInfo[] = [];
  const elements = doc.querySelectorAll('input, select, textarea');

  elements.forEach(el => {
    const tagName = el.tagName;
    const inputEl = el as HTMLInputElement;
    const selectEl = el as HTMLSelectElement;
    const type = inputEl.type || (tagName === 'SELECT' ? 'select' : tagName === 'TEXTAREA' ? 'textarea' : 'text');

    const field: FormFieldInfo = {
      selector: buildSelector(el),
      tagName,
      type,
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: inputEl.placeholder || '',
      value: type === 'password' ? '••••••' : (type === 'checkbox' || type === 'radio' ? String(inputEl.checked) : (inputEl.value || '').slice(0, 200)),
      label: getFieldLabel(el, doc),
      required: inputEl.required || false,
      disabled: inputEl.disabled || false,
      source,
    };

    // Extract select options
    if (tagName === 'SELECT') {
      field.options = Array.from(selectEl.options).slice(0, 30).map(opt => ({
        value: opt.value,
        text: opt.text.trim(),
        selected: opt.selected,
      }));
    }

    fields.push(field);
  });

  return fields;
}

function getFormFields(): FormFieldsResult {
  let allFields: FormFieldInfo[] = [];
  const iframes = document.querySelectorAll('iframe');
  let iframesAccessible = 0;

  // Extract from main page
  allFields = extractFieldsFromDocument(document, 'page');

  // Extract from iframes (same-origin only)
  iframes.forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        iframesAccessible++;
        const src = iframe.src || iframe.getAttribute('srcdoc') ? 'srcdoc' : 'about:blank';
        const iframeFields = extractFieldsFromDocument(iframeDoc, `iframe: ${src}`);
        allFields = [...allFields, ...iframeFields];
      }
    } catch {
      // Cross-origin iframe — can't access
    }
  });

  return {
    fields: allFields,
    formCount: document.querySelectorAll('form').length,
    iframeCount: iframes.length,
    iframesAccessible,
  };
}

// ─── Image Fetch (via authenticated session) ────────────────────

async function fetchImage(payload: {
  url: string;
  headers?: Record<string, string>;
}): Promise<{ dataUrl: string; contentType: string; size: number }> {
  console.log('[surdej-ext] fetchImage:', payload.url);
  const response = await fetch(payload.url, {
    credentials: 'include',
    headers: payload.headers || {},
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const contentType = blob.type || '';
  const size = blob.size;

  console.log('[surdej-ext] fetchImage response:', contentType, size, 'bytes');

  // Validate it's actually an image
  if (!contentType.startsWith('image/')) {
    // If it's small enough, peek at the content for debugging
    if (size < 2000) {
      const text = await blob.text();
      console.warn('[surdej-ext] fetchImage got non-image:', contentType, text.slice(0, 200));
    }
    throw new Error(`Not an image: ${contentType || 'unknown type'} (${size} bytes)`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        dataUrl: reader.result as string,
        contentType,
        size,
      });
    };
    reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
    reader.readAsDataURL(blob);
  });
}
