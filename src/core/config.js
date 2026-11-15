/**
 * Shared configuration schema, presets, and strict CSS/XSS sanitization for Antigravity RTL Math.
 * Safe to run in both Node.js (main process / CLI) and renderer / browser contexts.
 */

export const CONFIG_FILENAME = '.antigravity-rtl.json';

export const DIRECTION_MODES = ['smart', 'auto', 'force'];
export const DISPLAY_MATH_ALIGNS = ['center', 'left', 'right'];
export const UI_LANGS = ['en', 'fa'];
export const PRESET_NAMES = ['default', 'reading', 'compact'];

export const DEFAULT_CONFIG = Object.freeze({
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
});

export const PRESETS = Object.freeze({
    default: Object.freeze({
        directionMode: 'smart',
        mathIsolation: true,
        mathPersianText: true,
        mathDisplayAlign: 'center',
        mathScale: '1.0',
        lh: '1.6',
        fs: '16'
    }),
    reading: Object.freeze({
        directionMode: 'smart',
        mathIsolation: true,
        mathPersianText: true,
        mathDisplayAlign: 'center',
        mathScale: '1.05',
        lh: '1.9',
        fs: '17'
    }),
    compact: Object.freeze({
        directionMode: 'smart',
        mathIsolation: true,
        mathPersianText: true,
        mathDisplayAlign: 'center',
        mathScale: '0.95',
        lh: '1.4',
        fs: '14'
    })
});

const SAFE_FONT_NAME_RE = /^[\p{L}\p{N} ._-]{0,64}$/u;

function clampNumericString(value, min, max, decimals, fallback) {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const raw = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    const clamped = Math.min(max, Math.max(min, num));
    return decimals === 0 ? String(Math.round(clamped)) : clamped.toFixed(decimals).replace(/\.0+$/, '.0');
}

/**
 * Sanitizes an untrusted config object (e.g., from disk or renderer console-message).
 * Never lets arbitrary strings reach generated CSS.
 */
export function sanitizeConfig(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = { ...DEFAULT_CONFIG };

    if (typeof src.isRTL === 'boolean') out.isRTL = src.isRTL;
    if (typeof src.mathIsolation === 'boolean') out.mathIsolation = src.mathIsolation;
    if (typeof src.mathPersianText === 'boolean') out.mathPersianText = src.mathPersianText;

    if (typeof src.directionMode === 'string' && DIRECTION_MODES.includes(src.directionMode)) {
        out.directionMode = src.directionMode;
        out.forceRTL = out.directionMode === 'force';
    } else if (typeof src.forceRTL === 'boolean') {
        out.forceRTL = src.forceRTL;
        out.directionMode = src.forceRTL ? 'force' : DEFAULT_CONFIG.directionMode;
    }

    if (typeof src.mathDisplayAlign === 'string' && DISPLAY_MATH_ALIGNS.includes(src.mathDisplayAlign)) {
        out.mathDisplayAlign = src.mathDisplayAlign;
    }

    if (typeof src.uiLang === 'string' && UI_LANGS.includes(src.uiLang)) {
        out.uiLang = src.uiLang;
    }

    for (const key of ['faFont', 'enFont', 'codeFont']) {
        if (typeof src[key] === 'string') {
            const trimmed = src[key].trim();
            if (SAFE_FONT_NAME_RE.test(trimmed)) {
                out[key] = trimmed;
            }
        }
    }

    out.lh = clampNumericString(src.lh, 1.0, 3.0, 1, DEFAULT_CONFIG.lh);
    out.fs = clampNumericString(src.fs, 10, 28, 0, DEFAULT_CONFIG.fs);
    out.mathScale = clampNumericString(src.mathScale, 0.75, 1.5, 2, DEFAULT_CONFIG.mathScale);

    return out;
}

/**
 * Returns a sanitized config with the named preset merged on top of existing user settings.
 */
export function applyPreset(currentConfig, presetName) {
    const base = sanitizeConfig(currentConfig);
    const preset = PRESETS[presetName];
    if (!preset) return base;
    return sanitizeConfig({ ...base, ...preset });
}
