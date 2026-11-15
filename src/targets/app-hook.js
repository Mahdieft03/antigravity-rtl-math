/**
 * Template snippet injected into Antigravity Standalone App's `dist/utils.js` around `void win.loadURL(url);`.
 * Hooks BOTH the specific window (`before` loadURL to eliminate startup race) and process-wide `web-contents-created`.
 */

export function renderAppHookSnippet(clientScriptTemplate) {
    return `/* ANTIGRAVITY RTL MATH PATCH */
    const __agRtlPath = require('path');
    const __agRtlFs = require('fs');
    const __agRtlOs = require('os');
    const __agRtlConfigPath = __agRtlPath.join(__agRtlOs.homedir(), '.antigravity-rtl.json');
    const __agRtlSafeFontRe = /^[\\p{L}\\p{N} ._-]{0,64}$/u;
    const __agRtlSanitize = (raw) => {
        const defaults = {
            isRTL: true, forceRTL: false, directionMode: 'smart',
            mathIsolation: true, mathPersianText: true, mathDisplayAlign: 'center',
            mathScale: '1.0', faFont: '', enFont: '', codeFont: '',
            lh: '1.6', fs: '16', uiLang: 'en'
        };
        if (!raw || typeof raw !== 'object') return defaults;
        const out = { ...defaults };
        if (typeof raw.isRTL === 'boolean') out.isRTL = raw.isRTL;
        if (typeof raw.mathIsolation === 'boolean') out.mathIsolation = raw.mathIsolation;
        if (typeof raw.mathPersianText === 'boolean') out.mathPersianText = raw.mathPersianText;
        if (['smart', 'auto', 'force'].includes(raw.directionMode)) {
            out.directionMode = raw.directionMode;
            out.forceRTL = out.directionMode === 'force';
        } else if (typeof raw.forceRTL === 'boolean') {
            out.forceRTL = raw.forceRTL;
            out.directionMode = raw.forceRTL ? 'force' : 'smart';
        }
        if (['center', 'left', 'right'].includes(raw.mathDisplayAlign)) out.mathDisplayAlign = raw.mathDisplayAlign;
        if (['en', 'fa'].includes(raw.uiLang)) out.uiLang = raw.uiLang;
        for (const k of ['faFont', 'enFont', 'codeFont']) {
            if (typeof raw[k] === 'string' && __agRtlSafeFontRe.test(raw[k].trim())) out[k] = raw[k].trim();
        }
        const clamp = (v, mn, mx, d, fb) => {
            if (typeof v !== 'string' && typeof v !== 'number') return fb;
            const s = String(v).trim();
            if (!/^\\d+(\\.\\d+)?$/.test(s)) return fb;
            const n = Math.min(mx, Math.max(mn, Number(s)));
            return d === 0 ? String(Math.round(n)) : n.toFixed(d).replace(/\\.0+$/, '.0');
        };
        out.lh = clamp(raw.lh, 1.0, 3.0, 1, defaults.lh);
        out.fs = clamp(raw.fs, 10, 28, 0, defaults.fs);
        out.mathScale = clamp(raw.mathScale, 0.75, 1.5, 2, defaults.mathScale);
        return out;
    };
    const __agRtlReadConfig = () => {
        try {
            if (__agRtlFs.existsSync(__agRtlConfigPath)) {
                return __agRtlSanitize(JSON.parse(__agRtlFs.readFileSync(__agRtlConfigPath, 'utf8')));
            }
        } catch (_) {}
        return __agRtlSanitize({});
    };
    const __agRtlTemplate = ${JSON.stringify(clientScriptTemplate)};
    const __agRtlIsLocalUrl = (u) => Boolean(u && /^https?:\\/\\/(127\\.0\\.0\\.1|localhost):\\d+/i.test(u));
    const __agRtlGetFontB64 = () => {
        if (typeof globalThis.__agRtlCachedFontB64 !== 'string') {
            const fontPath = __agRtlPath.join(__dirname, 'Vazirmatn-Variable.woff2');
            globalThis.__agRtlCachedFontB64 = __agRtlFs.existsSync(fontPath)
                ? __agRtlFs.readFileSync(fontPath).toString('base64')
                : '';
        }
        return globalThis.__agRtlCachedFontB64;
    };
    const __agRtlBuildForFrame = (hideTrig) => {
        const fontBase64 = __agRtlGetFontB64();
        const rtlConfig = __agRtlReadConfig();
        return __agRtlTemplate
            .replaceAll('__FONT_BASE64__', () => fontBase64)
            .replaceAll('__RTL_CONFIG__', () => JSON.stringify(rtlConfig))
            .replaceAll('"__HIDE_TRIGGER__"', () => JSON.stringify(Boolean(hideTrig)));
    };
    const __agRtlReportErr = (err) => {
        const msg = err && err.message ? err.message : String(err || '');
        if (/destroyed|ERR_ABORTED|aborted|navigat/i.test(msg)) return;
        try { console.error('[Antigravity RTL Math]', msg); } catch (_) {}
    };
    const __agRtlAttached = globalThis.__agRtlAttachedWc || (globalThis.__agRtlAttachedWc = new WeakSet());
    const __agRtlAttachWc = (wc, isPrimaryWin) => {
        if (!wc || typeof wc.on !== 'function' || __agRtlAttached.has(wc)) return;
        __agRtlAttached.add(wc);
        wc.on('console-message', (event, ...args) => {
            let message = '';
            if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                message = args[0].message;
            } else {
                message = args[1];
            }
            if (typeof message === 'string' && message.startsWith('SAVE_RTL_CONFIG|')) {
                try {
                    const incoming = __agRtlSanitize(JSON.parse(message.substring(16)));
                    let existing = {};
                    if (__agRtlFs.existsSync(__agRtlConfigPath)) {
                        try { existing = JSON.parse(__agRtlFs.readFileSync(__agRtlConfigPath, 'utf8')); } catch (_) {}
                    }
                    const merged = { ...existing, ...incoming };
                    __agRtlFs.writeFileSync(__agRtlConfigPath, JSON.stringify(merged, null, 2));
                } catch (_) {}
            }
        });
        const injectMain = () => {
            try {
                if (wc.isDestroyed?.()) return;
                const u = typeof wc.getURL === 'function' ? wc.getURL() : '';
                if (!__agRtlIsLocalUrl(u)) return;
                const hideBtn = isPrimaryWin ? false : (typeof wc.getType === 'function' && wc.getType() === 'webview');
                Promise.resolve(wc.executeJavaScript(__agRtlBuildForFrame(hideBtn))).catch(__agRtlReportErr);
            } catch (e) {
                __agRtlReportErr(e);
            }
        };
        const injectSubframes = () => {
            try {
                if (wc.isDestroyed?.()) return;
                const u = typeof wc.getURL === 'function' ? wc.getURL() : '';
                if (!__agRtlIsLocalUrl(u)) return;
                const frames = wc.mainFrame && wc.mainFrame.framesInSubtree;
                if (!Array.isArray(frames)) return;
                const code = __agRtlBuildForFrame(true);
                for (const f of frames) {
                    if (f !== wc.mainFrame && __agRtlIsLocalUrl(f.url)) {
                        Promise.resolve(f.executeJavaScript(code)).catch(__agRtlReportErr);
                    }
                }
            } catch (e) {
                __agRtlReportErr(e);
            }
        };
        wc.on('dom-ready', injectMain);
        wc.on('did-finish-load', injectMain);
        wc.on('did-navigate-in-page', injectMain);
        wc.on('did-frame-finish-load', injectSubframes);
    };
    try {
        const __agEl = require('electron');
        if (__agEl && __agEl.app && typeof __agEl.app.on === 'function' && !globalThis.__agRtlAppHooked) {
            globalThis.__agRtlAppHooked = true;
            __agEl.app.on('web-contents-created', (_ev, contents) => {
                __agRtlAttachWc(contents, false);
            });
        }
    } catch (_) {}
    __agRtlAttachWc(win && win.webContents, true);
    void win.loadURL(url);
/* END ANTIGRAVITY RTL MATH PATCH */`;
}
