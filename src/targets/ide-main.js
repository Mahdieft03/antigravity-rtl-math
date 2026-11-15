/**
 * Antigravity RTL Math Main-Process Injection Hook for Antigravity IDE (VS Code Edition).
 * Copied into `resources/app/out/antigravity-rtl-main.js` and imported at top of `out/main.js`.
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(os.homedir(), '.antigravity-rtl.json');
const LOG_FILE = path.join(os.tmpdir(), 'antigravity-rtl-math.log');
const SAFE_FONT_RE = /^[\p{L}\p{N} ._-]{0,64}$/u;

function log(...args) {
    try {
        const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
        fs.appendFileSync(LOG_FILE, line);
    } catch (_) {}
}

function sanitizeConfig(raw) {
    const defaults = {
        isRTL: true,
        forceRTL: false,
        directionMode: 'smart',
        mathIsolation: true,
        mathPersianText: true,
        mathDisplayAlign: 'center',
        mathScale: '1.0',
        faFont: '',
        enFont: '',
        codeFont: '',
        lh: '1.6',
        fs: '16',
        uiLang: 'en'
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
        if (typeof raw[k] === 'string' && SAFE_FONT_RE.test(raw[k].trim())) out[k] = raw[k].trim();
    }
    const clamp = (v, min, max, dec, fb) => {
        if (typeof v !== 'string' && typeof v !== 'number') return fb;
        const s = String(v).trim();
        if (!/^\d+(\.\d+)?$/.test(s)) return fb;
        const n = Math.min(max, Math.max(min, Number(s)));
        return dec === 0 ? String(Math.round(n)) : n.toFixed(dec).replace(/\.0+$/, '.0');
    };
    out.lh = clamp(raw.lh, 1.0, 3.0, 1, defaults.lh);
    out.fs = clamp(raw.fs, 10, 28, 0, defaults.fs);
    out.mathScale = clamp(raw.mathScale, 0.75, 1.5, 2, defaults.mathScale);
    return out;
}

function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return sanitizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
        }
    } catch (_) {}
    return sanitizeConfig({});
}

let cachedFontBase64 = null;
function getFontBase64() {
    if (cachedFontBase64 === null) {
        const fontPath = path.join(__dirname, 'Vazirmatn-Variable.woff2');
        cachedFontBase64 = fs.existsSync(fontPath) ? fs.readFileSync(fontPath).toString('base64') : '';
    }
    return cachedFontBase64;
}

function buildClientPayload(hideTrigger) {
    const clientPath = path.join(__dirname, 'antigravity-rtl-client.js');
    if (!fs.existsSync(clientPath)) return null;
    const fontBase64 = getFontBase64();
    const rtlConfig = readConfig();
    return fs.readFileSync(clientPath, 'utf8')
        .replaceAll('__FONT_BASE64__', () => fontBase64)
        .replaceAll('__RTL_CONFIG__', () => JSON.stringify(rtlConfig))
        .replaceAll('"__HIDE_TRIGGER__"', () => JSON.stringify(Boolean(hideTrigger)));
}

function attachConsoleSaver(wc) {
    wc.on('console-message', (_e, ...args) => {
        let msg = '';
        if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            msg = args[0].message;
        } else {
            msg = args[1];
        }
        if (typeof msg === 'string' && msg.startsWith('SAVE_RTL_CONFIG|')) {
            try {
                const incoming = sanitizeConfig(JSON.parse(msg.substring(16)));
                let existing = {};
                if (fs.existsSync(CONFIG_FILE)) {
                    try { existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}
                }
                const merged = { ...existing, ...incoming };
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
                log('Config saved');
            } catch (err) {
                log('Save config error:', err.message);
            }
        }
    });
}

function isWorkbenchUrl(url) {
    return url.includes('workbench') || url.includes('jetski') || url.endsWith('.html') || url === '';
}

function isSubframeTargetUrl(url) {
    return /^(?:vscode-webview:|vscode-file:|https?:\/\/(?:127\.0\.0\.1|localhost):\d+)/i.test(url || '');
}

app.on('browser-window-created', (_event, win) => {
    attachConsoleSaver(win.webContents);

    win.webContents.on('dom-ready', async () => {
        try {
            const url = win.webContents.getURL() || '';
            if (!isWorkbenchUrl(url)) return;
            const code = buildClientPayload(false);
            if (!code) return;
            await win.webContents.executeJavaScript(code);
            log('Injected into main window:', url);
        } catch (err) {
            log('Main window injection error:', err.message);
        }
    });

    win.webContents.on('did-frame-finish-load', () => {
        try {
            const frames = win.webContents.mainFrame?.framesInSubtree;
            if (!Array.isArray(frames)) return;
            const code = buildClientPayload(true);
            if (!code) return;
            for (const f of frames) {
                if (f !== win.webContents.mainFrame && isSubframeTargetUrl(f.url)) {
                    Promise.resolve(f.executeJavaScript(code)).catch(() => {});
                }
            }
        } catch (_) {}
    });
});

app.on('web-contents-created', (_event, wc) => {
    try {
        if (typeof wc.getType === 'function' && wc.getType() === 'webview') {
            wc.on('dom-ready', async () => {
                try {
                    const url = wc.getURL() || '';
                    if (!isSubframeTargetUrl(url)) return;
                    const code = buildClientPayload(true);
                    if (!code) return;
                    await wc.executeJavaScript(code);
                    log('Injected into webview:', url);
                } catch (_) {}
            });
        }
    } catch (_) {}
});
