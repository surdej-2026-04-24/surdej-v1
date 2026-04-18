/**
 * Virtual Page Compiler
 *
 * Client-side TSX → JS transpilation using Babel Standalone.
 * Generates sandboxed iframe HTML with React UMD bundles inlined.
 */

import * as Babel from '@babel/standalone';
import type { CompileResult } from '@/types/virtual-page';

// ── Compiler ──

export function compileVirtualPage(source: string): CompileResult {
    try {
        const transformed = Babel.transform(source, {
            presets: ['react', 'typescript'],
            filename: 'virtual-page.tsx',
        });

        return {
            success: true,
            code: transformed.code || '',
            errors: [],
        };
    } catch (err: unknown) {
        const error = err as Error & { loc?: { line: number; column: number } };
        const line = error.loc?.line ?? 1;
        const column = error.loc?.column ?? 0;

        return {
            success: false,
            errors: [
                {
                    line,
                    column,
                    message: error.message.replace(/^.*?:\s*/, ''),
                    severity: 'error',
                },
            ],
        };
    }
}

// ── React UMD Loading ──

let reactUmdCache: { react: string; reactDom: string } | null = null;

export async function getReactUmd(): Promise<{ react: string; reactDom: string }> {
    if (reactUmdCache) return reactUmdCache;

    const [reactRes, reactDomRes] = await Promise.all([
        fetch('/vendor/react.production.min.js'),
        fetch('/vendor/react-dom.production.min.js'),
    ]);

    if (!reactRes.ok || !reactDomRes.ok) {
        throw new Error('Failed to load React UMD bundles from /vendor/');
    }

    reactUmdCache = {
        react: await reactRes.text(),
        reactDom: await reactDomRes.text(),
    };
    return reactUmdCache;
}

// ── Iframe HTML Generation ──

export function generateIframeHtml(
    compiledCode: string,
    _origin: string,
    reactUmd: { react: string; reactDom: string },
): string {
    const encodedCode = btoa(unescape(encodeURIComponent(compiledCode)));

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script>${reactUmd.react}</script>
<script>${reactUmd.reactDom}</script>
<script>
// Make hooks available globally
var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
var useMemo = React.useMemo;
var useCallback = React.useCallback;
var useReducer = React.useReducer;
var useContext = React.useContext;
var createContext = React.createContext;
var Fragment = React.Fragment;

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    window.parent.postMessage({
      type: 'VP_ERROR',
      payload: {
        message: error.message,
        stack: error.stack,
        componentStack: info?.componentStack,
        timestamp: new Date().toISOString(),
      }
    }, '*');
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: 24, color: '#ef4444', fontFamily: 'monospace', fontSize: 13 }
      }, '⚠ ' + (this.state.error?.message || 'Component error'));
    }
    return this.props.children;
  }
}

// Global error handlers
window.onerror = function(msg, src, line, col, err) {
  window.parent.postMessage({
    type: 'VP_ERROR',
    payload: { message: String(msg), stack: err?.stack, timestamp: new Date().toISOString() }
  }, '*');
};
window.addEventListener('unhandledrejection', function(e) {
  window.parent.postMessage({
    type: 'VP_ERROR',
    payload: { message: 'Unhandled: ' + String(e.reason), timestamp: new Date().toISOString() }
  }, '*');
});

// Execute user code
try {
  var code = decodeURIComponent(escape(atob('${encodedCode}')));
  var module = { exports: {} };
  var exports = module.exports;
  (new Function('module', 'exports', 'React', 'ReactDOM', code))(module, exports, React, ReactDOM);

  // Find the Component
  var Component = module.exports.default || module.exports.Component || window.Component;
  if (!Component) {
    // Try evaluating as a function declaration
    var fn = (new Function('React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
      code + '; return typeof Component !== "undefined" ? Component : null;'))(
      React, useState, useEffect, useRef, useMemo, useCallback);
    Component = fn;
  }

  if (Component) {
    var root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(ErrorBoundary, null, React.createElement(Component)));
    window.parent.postMessage({ type: 'VP_READY' }, '*');
  } else {
    window.parent.postMessage({
      type: 'VP_ERROR',
      payload: { message: 'No "Component" function found in source', timestamp: new Date().toISOString() }
    }, '*');
  }
} catch (e) {
  window.parent.postMessage({
    type: 'VP_ERROR',
    payload: { message: e.message, stack: e.stack, timestamp: new Date().toISOString() }
  }, '*');
}
</script>
</body>
</html>`;
}
