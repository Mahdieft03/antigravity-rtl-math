/**
 * Assembles self-contained browser/renderer scripts from the shared ESM core modules.
 * Keeps one canonical source of truth for CSS, Math isolation, BiDi engine, and Pure-DOM UI.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');

function stripModuleSyntax(code) {
    return code
        .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];\r?\n?/gm, '')
        .replace(/^export\s+(?=(?:const|let|var|function|async\s+function)\b)/gm, '');
}

/**
 * Returns the shared core library IIFE that defines `window.__agRtlMathLib`.
 */
export function buildSharedClientLib() {
    const files = [
        path.join(SRC_ROOT, 'core', 'config.js'),
        path.join(SRC_ROOT, 'core', 'rtl-math-css.js'),
        path.join(SRC_ROOT, 'core', 'rtl-math-engine.js'),
        path.join(SRC_ROOT, 'ui', 'settings-panel.js')
    ];

    const parts = files.map(f => stripModuleSyntax(fs.readFileSync(f, 'utf8')));

    return `(function(root) {
    if (root.__agRtlMathLib) return;
${parts.join('\n\n')}
    root.__agRtlMathLib = {
        DEFAULT_CONFIG,
        sanitizeConfig,
        buildWidgetCSS,
        buildDynamicCSS,
        buildDisabledCSS,
        extractProseText,
        detectTextDirection,
        applyRtlMathPass,
        watchDom,
        bindToggleShortcut,
        mountRtlMathController
    };
    if (typeof globalThis !== 'undefined' && globalThis !== root && !globalThis.__agRtlMathLib) {
        globalThis.__agRtlMathLib = root.__agRtlMathLib;
    }
})(typeof window !== 'undefined' ? window : globalThis);`;
}

/**
 * Builds the Electron renderer bootstrap script for App (`mode: 'app'`) or IDE (`mode: 'ide'`).
 * Uses placeholders `__FONT_BASE64__`, `__RTL_CONFIG__`, `__HIDE_TRIGGER__` when `placeholderMode` is true,
 * or embeds concrete values when provided.
 */
export function buildElectronClientScript({
    mode = 'app',
    hideTrigger = false,
    fontBase64 = '__FONT_BASE64__',
    initialConfig = '__RTL_CONFIG__'
} = {}) {
    const lib = buildSharedClientLib();
    const cfgExpr = typeof initialConfig === 'string' ? initialConfig : JSON.stringify(initialConfig);
    const fontExpr = fontBase64 === '__FONT_BASE64__' ? "'__FONT_BASE64__'" : JSON.stringify(fontBase64);
    const hideExpr = hideTrigger === '__HIDE_TRIGGER__' ? '"__HIDE_TRIGGER__"' : JSON.stringify(Boolean(hideTrigger));

    return `${lib}
(function() {
    try {
        if (window.__ANTIGRAVITY_RTL_MATH_LOADED__) return;
        window.__ANTIGRAVITY_RTL_MATH_LOADED__ = true;

        var fontBase64 = ${fontExpr};
        var rtlConfig = ${cfgExpr};
        var hideTrigger = ${hideExpr};
        var mode = ${JSON.stringify(mode)};

        function isUiReady() {
            try {
                if (!document || !document.body) return false;
                if (mode === 'ide') {
                    return document.body.children.length > 0;
                }
                var root = document.getElementById('root');
                if (root) {
                    if (!root.children || root.children.length === 0) return false;
                    return Boolean(
                        document.querySelector('[role="navigation"]') ||
                        document.querySelector('[role="main"]') ||
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('.prose') ||
                        document.querySelector('.leading-relaxed') ||
                        document.querySelector('[data-testid="conversation-view"]')
                    );
                }
                return document.body.children.length > 0;
            } catch (_) {
                return false;
            }
        }

        function boot() {
            window.__agRtlMathLib.mountRtlMathController({
                doc: document,
                win: window,
                mode: mode,
                hideTrigger: hideTrigger,
                initialConfig: rtlConfig,
                fontSource: fontBase64,
                onSaveConfig: function(nextCfg) {
                    console.log('SAVE_RTL_CONFIG|' + JSON.stringify(nextCfg));
                }
            });
        }

        if (isUiReady()) {
            boot();
            return;
        }

        var booted = false;
        var timer = null;
        var fallbackTimer = null;
        var obs = null;

        function tryBoot(force) {
            if (booted) return;
            if (isUiReady() || (force && document && document.body && document.body.children.length > 0)) {
                booted = true;
                if (timer) clearInterval(timer);
                if (fallbackTimer) clearTimeout(fallbackTimer);
                if (obs) { try { obs.disconnect(); } catch (_) {} }
                boot();
            }
        }

        try {
            obs = new MutationObserver(function() { tryBoot(false); });
            obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        } catch (_) {}
        timer = setInterval(function() { tryBoot(false); }, 200);
        fallbackTimer = setTimeout(function() { tryBoot(true); }, 3500);
    } catch (err) {
        console.error('[Antigravity RTL Math] Boot error:', err);
    }
})();`;
}

/**
 * Builds the Chrome/Arc/Edge MV3 content script for Remote Control.
 */
export function buildRemoteExtensionScript() {
    const lib = buildSharedClientLib();
    return `${lib}
(function() {
    try {
        if (window.__ANTIGRAVITY_RTL_MATH_LOADED__) return;
        if (!document || !document.body) return;
        window.__ANTIGRAVITY_RTL_MATH_LOADED__ = true;

        var fontUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
            ? chrome.runtime.getURL('Vazirmatn-Variable.woff2')
            : '';

        function initWithConfig(stored) {
            var cfg = (stored && stored.agRtlConfig && typeof stored.agRtlConfig === 'object')
                ? stored.agRtlConfig
                : (stored && typeof stored.rtl === 'boolean' ? { isRTL: stored.rtl } : {});

            window.__agRtlMathLib.mountRtlMathController({
                doc: document,
                win: window,
                mode: 'remote',
                initialConfig: cfg,
                fontSource: fontUrl,
                onSaveConfig: function(nextCfg) {
                    try {
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ agRtlConfig: nextCfg, rtl: nextCfg.isRTL });
                        }
                    } catch (_) {}
                }
            });
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['agRtlConfig', 'rtl'], initWithConfig);
        } else {
            initWithConfig({});
        }
    } catch (err) {
        console.error('[Antigravity RTL Math Remote] Error:', err);
    }
})();`;
}
