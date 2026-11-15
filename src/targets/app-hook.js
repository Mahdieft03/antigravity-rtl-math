/**
 * Template snippet injected into Antigravity Standalone App's `dist/utils.js` before `void win.loadURL(url);`.
 * Placeholders `__CLIENT_BUNDLE__` and `__SANITIZE_MODULE__` are filled at patch time.
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
    win.webContents.on('console-message', (event, ...args) => {
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
    void win.loadURL(url);
    const __agRtlTemplate = ${JSON.stringify(clientScriptTemplate)};
    const __agRtlIsLocalUrl = (u) => Boolean(u && /^https?:\\/\\/(127\\.0\\.0\\.1|localhost):\\d+/i.test(u));
    const __agRtlBuildForFrame = (hideTrig) => {
        const fontPath = __agRtlPath.join(__dirname, 'Vazirmatn-Variable.woff2');
        const fontBase64 = __agRtlFs.existsSync(fontPath) ? __agRtlFs.readFileSync(fontPath).toString('base64') : '';
        const rtlConfig = __agRtlReadConfig();
        return __agRtlTemplate
            .replaceAll('__FONT_BASE64__', () => fontBase64)
            .replaceAll('__RTL_CONFIG__', () => JSON.stringify(rtlConfig))
            .replaceAll('"__HIDE_TRIGGER__"', () => JSON.stringify(Boolean(hideTrig)));
    };
    win.webContents.on('dom-ready', () => {
        try {
            if (!__agRtlIsLocalUrl(win.webContents.getURL())) return;
            win.webContents.executeJavaScript(__agRtlBuildForFrame(false)).catch(() => {});
        } catch (_) {}
    });
    win.webContents.on('did-frame-finish-load', () => {
        try {
            if (!__agRtlIsLocalUrl(win.webContents.getURL())) return;
            const frames = win.webContents.mainFrame && win.webContents.mainFrame.framesInSubtree;
            if (!Array.isArray(frames)) return;
            const code = __agRtlBuildForFrame(true);
            for (const f of frames) {
                if (f !== win.webContents.mainFrame && __agRtlIsLocalUrl(f.url)) {
                    Promise.resolve(f.executeJavaScript(code)).catch(() => {});
                }
            }
        } catch (_) {}
    });
/* END ANTIGRAVITY RTL MATH PATCH */`;
}
