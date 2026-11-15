/**
 * Pure-DOM (Trusted Types & CSP safe) Settings Panel & Trigger Controller.
 * Zero innerHTML usage — works seamlessly in Antigravity Standalone, Antigravity IDE,
 * Remote Control Browser Extension, and the local Playground.
 */

import { DEFAULT_CONFIG, PRESETS, PRESET_NAMES, applyPreset, sanitizeConfig } from '../core/config.js';
import { buildDynamicCSS, buildWidgetCSS } from '../core/rtl-math-css.js';
import { applyRtlMathPass, bindToggleShortcut, watchDom } from '../core/rtl-math-engine.js';

const LABELS = {
    en: {
        title: 'Antigravity RTL + Math',
        enabled: 'Enabled',
        disabled: 'Disabled',
        badgeOn: 'Shield ON',
        badgeOff: 'RTL Off',
        presets: 'Preset',
        presetDefault: 'Balanced',
        presetReading: 'Reading',
        presetCompact: 'Compact',
        dirMode: 'Direction Mode',
        smart: 'Smart',
        auto: 'Auto',
        force: 'Force',
        mathShield: 'Math LTR Shield',
        mathPersian: 'Persian \\text{} in Math',
        eqAlign: 'Equation Align',
        left: 'Left',
        center: 'Center',
        right: 'Right',
        mathScale: 'Math Scale',
        faFont: 'FA/AR Font',
        enFont: 'EN Font',
        codeFont: 'Code Font',
        lineHeight: 'Line Height',
        fontSize: 'Font Size',
        resetAll: 'Reset defaults',
        phFa: 'Default: Vazirmatn',
        phEn: 'Default: System',
        phCode: 'Monaco, Consolas',
        statusOn: '⇄ RTL+Math: On',
        statusOff: '⇄ RTL+Math: Off',
        btnText: 'RTL+Math'
    },
    fa: {
        title: 'راست‌چین + فرمول ریاضی',
        enabled: 'فعال',
        disabled: 'غیرفعال',
        badgeOn: 'محافظ روشن',
        badgeOff: 'خاموش',
        presets: 'حالت آماده',
        presetDefault: 'متعادل',
        presetReading: 'مطالعه',
        presetCompact: 'فشرده',
        dirMode: 'حالت جهت‌دهی',
        smart: 'هوشمند',
        auto: 'خودکار',
        force: 'اجباری',
        mathShield: 'محافظ LTR فرمول‌ها',
        mathPersian: 'فارسی در \\text{}',
        eqAlign: 'چیدمان فرمول بلوکی',
        left: 'چپ',
        center: 'وسط',
        right: 'راست',
        mathScale: 'مقیاس فرمول',
        faFont: 'فونت فارسی/عربی',
        enFont: 'فونت انگلیسی',
        codeFont: 'فونت کد',
        lineHeight: 'فاصله خطوط',
        fontSize: 'اندازه فونت',
        resetAll: 'بازنشانی تنظیمات',
        phFa: 'پیش‌فرض: Vazirmatn',
        phEn: 'پیش‌فرض: سیستم',
        phCode: 'Monaco, Consolas',
        statusOn: '⇄ راست‌چین+ریاضی: روشن',
        statusOff: '⇄ راست‌چین+ریاضی: خاموش',
        btnText: 'RTL+Math'
    }
};

function createEl(doc, tag, styleText, children, attrs) {
    const node = doc.createElement(tag);
    if (styleText) node.style.cssText = styleText;
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'className') node.className = v;
            else if (k === 'textContent') node.textContent = v;
            else if (k in node && (k === 'id' || k === 'type' || k === 'title' || k === 'value' || k === 'placeholder' || k === 'min' || k === 'max' || k === 'step' || k === 'href')) {
                node[k] = v;
            } else {
                node.setAttribute(k, String(v));
            }
        }
    }
    if (children != null) {
        const list = Array.isArray(children) ? children : [children];
        for (const child of list) {
            if (child == null) continue;
            node.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
        }
    }
    return node;
}

function createSvgIcon(doc, viewBox, width, height, paths) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const d of paths) {
        if (typeof d === 'string') {
            const p = doc.createElementNS(NS, 'path');
            p.setAttribute('d', d);
            svg.appendChild(p);
        } else if (d.circle) {
            const c = doc.createElementNS(NS, 'circle');
            c.setAttribute('cx', d.circle[0]);
            c.setAttribute('cy', d.circle[1]);
            c.setAttribute('r', d.circle[2]);
            svg.appendChild(c);
        }
    }
    return svg;
}

function createSwitch(doc, id, checked, onChange) {
    const knob = createEl(
        doc,
        'span',
        `display:block;width:14px;height:14px;border-radius:50%;background:#ffffff;position:absolute;top:3px;left:${checked ? '21px' : '3px'};transition:left 0.18s ease;box-shadow:0 1px 2px rgba(0,0,0,0.3);`
    );
    const btn = createEl(
        doc,
        'button',
        `cursor:pointer;width:38px;height:20px;border-radius:9999px;border:none;background:${checked ? 'var(--color-primary, var(--vscode-button-background, #2563eb))' : 'rgba(148,163,184,0.38)'};position:relative;padding:0;outline:none;transition:background-color 0.18s ease;flex-shrink:0;`,
        knob,
        { id, type: 'button', role: 'switch', 'aria-checked': String(checked) }
    );
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onChange();
    });
    return {
        btn,
        setChecked(next) {
            btn.setAttribute('aria-checked', String(next));
            btn.style.background = next
                ? 'var(--color-primary, var(--vscode-button-background, #2563eb))'
                : 'rgba(148,163,184,0.38)';
            knob.style.left = next ? '21px' : '3px';
        }
    };
}

function detectActivePreset(cfg) {
    for (const name of PRESET_NAMES) {
        const p = PRESETS[name];
        const match = Object.keys(p).every(k => String(cfg[k]) === String(p[k]));
        if (match) return name;
    }
    return null;
}

function findVisibleCluster(doc, win) {
    const candidates = [
        doc.querySelector('[data-testid="titlebar-more-actions"]')?.parentElement,
        doc.querySelector('[data-testid="install-editor"]')?.parentElement
    ];
    for (const el of candidates) {
        if (!el) continue;
        try {
            if (typeof win.getComputedStyle === 'function' && win.getComputedStyle(el).display === 'none') {
                continue;
            }
        } catch (_) {}
        return el;
    }
    return null;
}

/**
 * Initializes the full RTL + Math controller and settings UI in the given window/document.
 */
export function mountRtlMathController({
    doc = document,
    win = window,
    mode = 'app',
    hideTrigger = false,
    initialConfig = {},
    fontSource = '',
    fontBase64 = '',
    onSaveConfig = null
} = {}) {
    const _setTimeout = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : (typeof setTimeout === 'function' ? setTimeout : null);
    const _setInterval = typeof win.setInterval === 'function' ? win.setInterval.bind(win) : (typeof setInterval === 'function' ? setInterval : null);
    const _clearInterval = typeof win.clearInterval === 'function' ? win.clearInterval.bind(win) : (typeof clearInterval === 'function' ? clearInterval : null);

    const state = sanitizeConfig(initialConfig);
    const resolvedFontSource = fontSource || fontBase64;
    let wStyle = null;
    let dynStyle = null;

    function ensureStylesMounted() {
        const head = doc.head || doc.documentElement || doc.body;
        if (!head) return;

        wStyle = doc.getElementById('ag-rtl-widget-style');
        if (!wStyle) {
            wStyle = doc.createElement('style');
            wStyle.id = 'ag-rtl-widget-style';
            wStyle.textContent = buildWidgetCSS();
            head.appendChild(wStyle);
        }

        dynStyle = doc.getElementById('ag-rtl-dynamic-style');
        if (!dynStyle) {
            dynStyle = doc.createElement('style');
            dynStyle.id = 'ag-rtl-dynamic-style';
            head.appendChild(dynStyle);
        }
    }

    ensureStylesMounted();

    function save() {
        if (typeof onSaveConfig === 'function') {
            try {
                onSaveConfig({ ...state });
            } catch (_) {}
        }
    }

    function applyAll() {
        ensureStylesMounted();
        if (dynStyle) {
            dynStyle.textContent = buildDynamicCSS(state, resolvedFontSource);
        }
        applyRtlMathPass(doc, state);
        if (typeof win.dispatchEvent === 'function' && typeof win.Event === 'function') {
            try {
                win.dispatchEvent(new win.Event('resize'));
            } catch (_) {}
        }
    }

    // Build Pure-DOM Settings Panel
    const existingPanel = doc.getElementById('ag-rtl-panel');
    if (existingPanel) existingPanel.remove();

    const panel = createEl(
        doc,
        'div',
        'position:fixed;z-index:2147483645;width:308px;padding:13px 14px;display:none;direction:ltr;text-align:left;font-size:12px;user-select:none;',
        null,
        { id: 'ag-rtl-panel', className: 'ag-rtl-theme-panel' }
    );

    const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || navigator.platform || '');

    // Header
    const titleSpan = createEl(doc, 'span', 'font-weight:700;font-size:12px;letter-spacing:0.2px;');
    const langBtn = createEl(
        doc,
        'button',
        'border:1px solid var(--border,rgba(148,163,184,0.25));background:transparent;color:inherit;border-radius:5px;font-size:10px;font-weight:600;padding:2px 6px;cursor:pointer;opacity:0.88;',
        state.uiLang === 'fa' ? 'EN' : 'فا',
        { id: 'ag-rtl-lang-btn', type: 'button', title: 'Switch panel language (EN/FA)' }
    );
    const kbdWrap = createEl(doc, 'span', 'display:inline-flex;align-items:center;gap:3px;', [
        createEl(doc, 'kbd', null, isMac ? '⌥' : 'Alt', { className: 'ag-rtl-kbd' }),
        createEl(doc, 'kbd', null, 'R', { className: 'ag-rtl-kbd' })
    ]);
    const closeBtn = createEl(
        doc,
        'button',
        'background:none;border:none;color:inherit;cursor:pointer;font-size:14px;line-height:1;opacity:0.65;padding:2px 4px;',
        '✕',
        { id: 'ag-rtl-close-btn', type: 'button' }
    );
    const headerRight = createEl(doc, 'div', 'display:flex;align-items:center;gap:5px;', [langBtn, kbdWrap, closeBtn]);
    panel.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [titleSpan, headerRight]));
    panel.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    // Master toggle row + status pill
    const masterLabel = createEl(doc, 'span', 'font-weight:600;font-size:12px;');
    const statusBadge = createEl(doc, 'span', null, '', { id: 'ag-rtl-status-badge', className: 'ag-rtl-badge' });
    const masterLeft = createEl(doc, 'div', 'display:flex;align-items:center;gap:7px;', [masterLabel, statusBadge]);
    const masterSwitch = createSwitch(doc, 'ag-rtl-master-btn', state.isRTL, () => {
        state.isRTL = !state.isRTL;
        save();
        syncUI();
    });
    panel.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;', [masterLeft, masterSwitch.btn]));

    const bodyBox = createEl(doc, 'div', 'display:flex;flex-direction:column;gap:8px;transition:opacity 0.15s ease;', null, { id: 'ag-rtl-body' });

    // Quick Presets row
    const presetLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const presetButtons = {};
    const presetSeg = createEl(doc, 'div', null, null, { className: 'ag-rtl-seg' });
    for (const pName of PRESET_NAMES) {
        const b = createEl(doc, 'button', null, pName, {
            id: `ag-rtl-preset-${pName}`,
            type: 'button',
            className: 'ag-rtl-seg-btn',
            'data-active': 'false'
        });
        b.addEventListener('click', () => {
            Object.assign(state, applyPreset(state, pName));
            syncInputsFromState();
            save();
            syncUI();
        });
        presetButtons[pName] = b;
        presetSeg.appendChild(b);
    }
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [presetLabel, presetSeg]));

    // Direction Mode segmented buttons
    const dirLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const dirButtons = {};
    const dirSeg = createEl(doc, 'div', null, null, { className: 'ag-rtl-seg' });
    for (const m of ['smart', 'auto', 'force']) {
        const b = createEl(doc, 'button', null, m, {
            id: `ag-rtl-dir-${m}`,
            type: 'button',
            className: 'ag-rtl-seg-btn',
            'data-active': String(state.directionMode === m)
        });
        b.addEventListener('click', () => {
            state.directionMode = m;
            state.forceRTL = m === 'force';
            save();
            syncUI();
        });
        dirButtons[m] = b;
        dirSeg.appendChild(b);
    }
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [dirLabel, dirSeg]));

    bodyBox.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    // Math Shield toggle
    const mathShieldLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.9;font-weight:500;');
    const mathShieldSwitch = createSwitch(doc, 'ag-rtl-math-shield-btn', state.mathIsolation, () => {
        state.mathIsolation = !state.mathIsolation;
        save();
        syncUI();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [mathShieldLabel, mathShieldSwitch.btn]));

    // Persian \text{} inside Math toggle
    const mathPersianLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const mathPersianSwitch = createSwitch(doc, 'ag-rtl-math-persian-btn', state.mathPersianText, () => {
        state.mathPersianText = !state.mathPersianText;
        save();
        syncUI();
    });
    const mathPersianRow = createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [mathPersianLabel, mathPersianSwitch.btn]);
    bodyBox.appendChild(mathPersianRow);

    // Display Equation Alignment segmented buttons
    const eqAlignLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const alignButtons = {};
    const alignSeg = createEl(doc, 'div', null, null, { className: 'ag-rtl-seg' });
    for (const a of ['left', 'center', 'right']) {
        const b = createEl(doc, 'button', null, a, {
            id: `ag-rtl-align-${a}`,
            type: 'button',
            className: 'ag-rtl-seg-btn',
            'data-active': String(state.mathDisplayAlign === a)
        });
        b.addEventListener('click', () => {
            state.mathDisplayAlign = a;
            save();
            syncUI();
        });
        alignButtons[a] = b;
        alignSeg.appendChild(b);
    }
    const eqAlignRow = createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [eqAlignLabel, alignSeg]);
    bodyBox.appendChild(eqAlignRow);

    // Math Scale slider
    const mathScaleLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const mathScaleVal = createEl(doc, 'span', 'font-size:10px;opacity:0.65;min-width:30px;text-align:right;', `${state.mathScale}x`);
    const mathScaleInput = createEl(doc, 'input', null, null, {
        id: 'ag-rtl-math-scale-input',
        type: 'range',
        min: '0.85',
        max: '1.30',
        step: '0.05',
        value: state.mathScale,
        className: 'ag-rtl-range'
    });
    const mathScaleReset = createEl(doc, 'button', 'background:none;border:none;color:inherit;opacity:0.6;cursor:pointer;font-size:11px;padding:0 2px;', '↺', {
        id: 'ag-rtl-math-scale-reset',
        type: 'button',
        title: 'Reset to 1.0x'
    });
    mathScaleInput.addEventListener('input', (e) => {
        state.mathScale = sanitizeConfig({ mathScale: e.target.value }).mathScale;
        mathScaleVal.textContent = `${state.mathScale}x`;
        updatePresetHighlight();
        save();
        applyAll();
    });
    mathScaleReset.addEventListener('click', () => {
        state.mathScale = DEFAULT_CONFIG.mathScale;
        mathScaleInput.value = state.mathScale;
        mathScaleVal.textContent = `${state.mathScale}x`;
        updatePresetHighlight();
        save();
        applyAll();
    });
    const mathScaleRow = createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [
        mathScaleLabel,
        createEl(doc, 'div', 'display:flex;align-items:center;gap:4px;', [mathScaleVal, mathScaleInput, mathScaleReset])
    ]);
    bodyBox.appendChild(mathScaleRow);

    bodyBox.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    // Typography inputs
    const faLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;white-space:nowrap;');
    const faInput = createEl(doc, 'input', null, null, { id: 'ag-rtl-fa-font', type: 'text', value: state.faFont, className: 'ag-rtl-input' });
    faInput.addEventListener('input', (e) => {
        state.faFont = sanitizeConfig({ faFont: e.target.value }).faFont;
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [faLabel, faInput]));

    const enLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;white-space:nowrap;');
    const enInput = createEl(doc, 'input', null, null, { id: 'ag-rtl-en-font', type: 'text', value: state.enFont, className: 'ag-rtl-input' });
    enInput.addEventListener('input', (e) => {
        state.enFont = sanitizeConfig({ enFont: e.target.value }).enFont;
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [enLabel, enInput]));

    const codeLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;white-space:nowrap;');
    const codeInput = createEl(doc, 'input', null, null, { id: 'ag-rtl-code-font', type: 'text', value: state.codeFont, className: 'ag-rtl-input' });
    codeInput.addEventListener('input', (e) => {
        state.codeFont = sanitizeConfig({ codeFont: e.target.value }).codeFont;
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [codeLabel, codeInput]));

    // Line Height slider
    const lhLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const lhVal = createEl(doc, 'span', 'font-size:10px;opacity:0.65;min-width:24px;text-align:right;', state.lh);
    const lhInput = createEl(doc, 'input', null, null, { id: 'ag-rtl-lh-input', type: 'range', min: '1.2', max: '2.5', step: '0.1', value: state.lh, className: 'ag-rtl-range' });
    const lhReset = createEl(doc, 'button', 'background:none;border:none;color:inherit;opacity:0.6;cursor:pointer;font-size:11px;padding:0 2px;', '↺', { id: 'ag-rtl-lh-reset', type: 'button', title: 'Reset to 1.6' });
    lhInput.addEventListener('input', (e) => {
        state.lh = sanitizeConfig({ lh: e.target.value }).lh;
        lhVal.textContent = state.lh;
        updatePresetHighlight();
        save();
        applyAll();
    });
    lhReset.addEventListener('click', () => {
        state.lh = DEFAULT_CONFIG.lh;
        lhInput.value = state.lh;
        lhVal.textContent = state.lh;
        updatePresetHighlight();
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [
        lhLabel,
        createEl(doc, 'div', 'display:flex;align-items:center;gap:4px;', [lhVal, lhInput, lhReset])
    ]));

    // Font Size slider
    const fsLabel = createEl(doc, 'span', 'font-size:11px;opacity:0.85;');
    const fsVal = createEl(doc, 'span', 'font-size:10px;opacity:0.65;min-width:28px;text-align:right;', `${state.fs}px`);
    const fsInput = createEl(doc, 'input', null, null, { id: 'ag-rtl-fs-input', type: 'range', min: '11', max: '24', step: '1', value: state.fs, className: 'ag-rtl-range' });
    const fsReset = createEl(doc, 'button', 'background:none;border:none;color:inherit;opacity:0.6;cursor:pointer;font-size:11px;padding:0 2px;', '↺', { id: 'ag-rtl-fs-reset', type: 'button', title: 'Reset to 16px' });
    fsInput.addEventListener('input', (e) => {
        state.fs = sanitizeConfig({ fs: e.target.value }).fs;
        fsVal.textContent = `${state.fs}px`;
        updatePresetHighlight();
        save();
        applyAll();
    });
    fsReset.addEventListener('click', () => {
        state.fs = DEFAULT_CONFIG.fs;
        fsInput.value = state.fs;
        fsVal.textContent = `${state.fs}px`;
        updatePresetHighlight();
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [
        fsLabel,
        createEl(doc, 'div', 'display:flex;align-items:center;gap:4px;', [fsVal, fsInput, fsReset])
    ]));

    panel.appendChild(bodyBox);
    panel.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    function syncInputsFromState() {
        faInput.value = state.faFont;
        enInput.value = state.enFont;
        codeInput.value = state.codeFont;
        lhInput.value = state.lh;
        lhVal.textContent = state.lh;
        fsInput.value = state.fs;
        fsVal.textContent = `${state.fs}px`;
        mathScaleInput.value = state.mathScale;
        mathScaleVal.textContent = `${state.mathScale}x`;
    }

    function updatePresetHighlight() {
        const active = detectActivePreset(state);
        for (const pName of PRESET_NAMES) {
            presetButtons[pName].setAttribute('data-active', String(active === pName));
        }
    }

    // Footer Reset Defaults
    const resetAllBtn = createEl(
        doc,
        'button',
        'width:100%;padding:5px 8px;border-radius:7px;border:1px solid var(--border,rgba(148,163,184,0.22));background:transparent;color:inherit;font-size:11px;font-weight:500;cursor:pointer;opacity:0.86;',
        '',
        { id: 'ag-rtl-reset-all', type: 'button' }
    );
    resetAllBtn.addEventListener('click', () => {
        const keepLang = state.uiLang;
        Object.assign(state, DEFAULT_CONFIG, { uiLang: keepLang });
        syncInputsFromState();
        save();
        syncUI();
    });
    panel.appendChild(resetAllBtn);

    // Trigger elements (Topbar / Statusbar / Safe Draggable Floating Pill)
    let topbarBtn = null;
    let statusDot = null;
    let statusbarBtn = null;
    let draggedPos = null;
    let suppressNextClick = false;
    let dockRetryTimer = null;
    let dockRetryAttempts = 0;

    function positionPanel() {
        const vw = win.innerWidth || 1024;
        const vh = win.innerHeight || 768;
        if (mode === 'ide' && statusbarBtn && doc.body.contains(statusbarBtn)) {
            panel.style.top = 'auto';
            panel.style.bottom = '28px';
            panel.style.right = '12px';
            panel.style.left = 'auto';
            return;
        }
        if (topbarBtn && typeof topbarBtn.getBoundingClientRect === 'function' && doc.body.contains(topbarBtn)) {
            const rect = topbarBtn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const topPx = Math.min(Math.max(8, Math.round(rect.bottom + 8)), Math.max(8, vh - 160));
                const rightPx = Math.min(Math.max(8, Math.round(vw - rect.right)), Math.max(8, vw - 320));
                panel.style.top = `${topPx}px`;
                panel.style.right = `${rightPx}px`;
                panel.style.bottom = 'auto';
                panel.style.left = 'auto';
                return;
            }
        }
        panel.style.top = '82px';
        panel.style.right = '16px';
        panel.style.bottom = 'auto';
        panel.style.left = 'auto';
    }

    function togglePanel(show) {
        const isOpen = panel.style.display === 'block';
        const next = show !== undefined ? show : !isOpen;
        if (next) {
            positionPanel();
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    function stopDockRetry() {
        if (dockRetryTimer && _clearInterval) {
            _clearInterval(dockRetryTimer);
            dockRetryTimer = null;
        }
    }

    function ensureTriggerMounted() {
        ensureStylesMounted();
        if (!doc.body) return;
        if (!hideTrigger && !doc.body.contains(panel)) {
            doc.body.appendChild(panel);
        }
        if (hideTrigger) return;

        if (mode === 'ide') {
            const statusTarget =
                doc.querySelector('.part.statusbar .right-items') ||
                doc.querySelector('.part.statusbar .items-container.right-items') ||
                doc.querySelector('[id="workbench.parts.statusbar"] .right-items') ||
                doc.querySelector('.part.statusbar') ||
                doc.querySelector('[id="workbench.parts.statusbar"]');

            if (statusTarget) {
                if (!statusbarBtn) {
                    statusbarBtn = createEl(
                        doc,
                        'a',
                        'cursor:pointer;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;height:100%;line-height:22px;user-select:none;text-decoration:none;white-space:nowrap;',
                        '',
                        { id: 'ag-rtl-statusbar-btn', className: 'statusbar-item right', href: '#', title: 'Antigravity RTL + Math (Alt+R)' }
                    );
                    statusbarBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePanel();
                    });
                }
                if (statusTarget.firstChild !== statusbarBtn) {
                    statusTarget.prepend(statusbarBtn);
                }
                if (topbarBtn && topbarBtn.parentElement) topbarBtn.remove();
                stopDockRetry();
                return;
            }
        }

        const cluster = findVisibleCluster(doc, win);

        if (!topbarBtn) {
            const icon = createSvgIcon(doc, '0 0 24 24', 14, 14, [
                { circle: ['12', '12', '10'] },
                'M2 12h20',
                'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'
            ]);
            statusDot = createEl(
                doc,
                'span',
                `position:absolute;top:-2px;right:-2px;width:6px;height:6px;border-radius:9999px;background:#10b981;box-shadow:0 0 6px rgba(16,185,129,0.75);display:${state.isRTL ? 'block' : 'none'};`
            );
            const iconBox = createEl(doc, 'div', 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;', [icon, statusDot]);
            const labelEl = createEl(doc, 'span', 'font-size:12px;font-weight:600;', LABELS[state.uiLang].btnText, { id: 'ag-rtl-topbar-label' });
            topbarBtn = createEl(
                doc,
                'button',
                'display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;border:1px solid var(--border,rgba(148,163,184,0.22));background:transparent;color:inherit;cursor:pointer;white-space:nowrap;app-region:no-drag;',
                [iconBox, labelEl],
                { id: 'ag-rtl-topbar-btn', type: 'button', title: `Antigravity RTL + Math (${isMac ? '⌥R' : 'Alt+R'})` }
            );

            // Allow dragging when floating so users can place it anywhere convenient
            let dragStart = null;
            topbarBtn.addEventListener('mousedown', (e) => {
                if (!topbarBtn.classList.contains('ag-rtl-floating') || e.button !== 0) return;
                const rect = topbarBtn.getBoundingClientRect();
                dragStart = { x: e.clientX, y: e.clientY, startRight: (win.innerWidth || 1024) - rect.right, startTop: rect.top, moved: false };
            });
            doc.addEventListener('mousemove', (e) => {
                if (!dragStart) return;
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                if (!dragStart.moved && Math.hypot(dx, dy) < 4) return;
                dragStart.moved = true;
                const vw = win.innerWidth || 1024;
                const vh = win.innerHeight || 768;
                const nextTop = Math.min(Math.max(42, Math.round(dragStart.startTop + dy)), Math.max(42, vh - 40));
                const nextRight = Math.min(Math.max(8, Math.round(dragStart.startRight - dx)), Math.max(8, vw - 120));
                draggedPos = { top: nextTop, right: nextRight };
                topbarBtn.style.top = `${nextTop}px`;
                topbarBtn.style.right = `${nextRight}px`;
            });
            doc.addEventListener('mouseup', () => {
                if (dragStart && dragStart.moved) {
                    suppressNextClick = true;
                    if (_setTimeout) _setTimeout(() => { suppressNextClick = false; }, 50);
                    else suppressNextClick = false;
                }
                dragStart = null;
            });

            topbarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (suppressNextClick) return;
                togglePanel();
            });
        }

        if (cluster) {
            topbarBtn.classList.remove('ag-rtl-floating');
            topbarBtn.style.position = 'relative';
            topbarBtn.style.top = '';
            topbarBtn.style.right = '';
            topbarBtn.style.zIndex = '';
            topbarBtn.style.background = 'transparent';
            if (topbarBtn.parentElement !== cluster) {
                cluster.appendChild(topbarBtn);
            }
            stopDockRetry();
        } else {
            // Safe zone below Windows/macOS titleBarOverlay (~30px caption height)
            topbarBtn.classList.add('ag-rtl-floating');
            topbarBtn.style.position = 'fixed';
            topbarBtn.style.top = draggedPos ? `${draggedPos.top}px` : '46px';
            topbarBtn.style.right = draggedPos ? `${draggedPos.right}px` : '16px';
            topbarBtn.style.zIndex = '2147483644';
            if (topbarBtn.parentElement !== doc.body) {
                doc.body.appendChild(topbarBtn);
            }
            if (!dockRetryTimer && dockRetryAttempts < 14 && _setInterval) {
                dockRetryTimer = _setInterval(() => {
                    dockRetryAttempts++;
                    const lateCluster = findVisibleCluster(doc, win);
                    if (lateCluster || dockRetryAttempts >= 14) {
                        if (lateCluster) ensureTriggerMounted();
                        stopDockRetry();
                    }
                }, 600);
            }
        }
    }

    function syncUI() {
        const L = LABELS[state.uiLang] || LABELS.en;
        panel.style.direction = state.uiLang === 'fa' ? 'rtl' : 'ltr';
        panel.style.textAlign = state.uiLang === 'fa' ? 'right' : 'left';
        titleSpan.textContent = L.title;
        langBtn.textContent = state.uiLang === 'fa' ? 'EN' : 'فا';
        masterLabel.textContent = state.isRTL ? L.enabled : L.disabled;
        statusBadge.textContent = state.isRTL ? L.badgeOn : L.badgeOff;
        statusBadge.setAttribute('data-active', String(state.isRTL));
        masterSwitch.setChecked(state.isRTL);

        presetLabel.textContent = L.presets;
        presetButtons.default.textContent = L.presetDefault;
        presetButtons.reading.textContent = L.presetReading;
        presetButtons.compact.textContent = L.presetCompact;
        updatePresetHighlight();

        dirLabel.textContent = L.dirMode;
        for (const m of ['smart', 'auto', 'force']) {
            dirButtons[m].textContent = L[m];
            dirButtons[m].setAttribute('data-active', String(state.directionMode === m));
        }

        mathShieldLabel.textContent = L.mathShield;
        mathShieldSwitch.setChecked(state.mathIsolation);
        mathPersianLabel.textContent = L.mathPersian;
        mathPersianSwitch.setChecked(state.mathPersianText);
        mathPersianRow.style.opacity = state.mathIsolation ? '1' : '0.45';
        mathPersianRow.style.pointerEvents = state.mathIsolation ? 'auto' : 'none';

        eqAlignLabel.textContent = L.eqAlign;
        for (const a of ['left', 'center', 'right']) {
            alignButtons[a].textContent = L[a];
            alignButtons[a].setAttribute('data-active', String(state.mathDisplayAlign === a));
        }
        eqAlignRow.style.opacity = state.mathIsolation ? '1' : '0.45';
        eqAlignRow.style.pointerEvents = state.mathIsolation ? 'auto' : 'none';

        mathScaleLabel.textContent = L.mathScale;
        mathScaleRow.style.opacity = state.mathIsolation ? '1' : '0.45';
        mathScaleRow.style.pointerEvents = state.mathIsolation ? 'auto' : 'none';

        faLabel.textContent = L.faFont;
        faInput.placeholder = L.phFa;
        enLabel.textContent = L.enFont;
        enInput.placeholder = L.phEn;
        codeLabel.textContent = L.codeFont;
        codeInput.placeholder = L.phCode;
        lhLabel.textContent = L.lineHeight;
        fsLabel.textContent = L.fontSize;
        resetAllBtn.textContent = L.resetAll;

        bodyBox.style.opacity = state.isRTL ? '1' : '0.45';
        bodyBox.style.pointerEvents = state.isRTL ? 'auto' : 'none';

        if (statusDot) statusDot.style.display = state.isRTL ? 'block' : 'none';
        if (statusbarBtn) {
            statusbarBtn.textContent = state.isRTL ? L.statusOn : L.statusOff;
            statusbarBtn.style.color = state.isRTL ? '#38bdf8' : 'inherit';
        }

        applyAll();
    }

    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.uiLang = state.uiLang === 'fa' ? 'en' : 'fa';
        save();
        syncUI();
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel(false);
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    const onDocClick = (e) => {
        if (panel.style.display === 'block') {
            if (panel.contains(e.target)) return;
            if (topbarBtn && topbarBtn.contains(e.target)) return;
            if (statusbarBtn && statusbarBtn.contains(e.target)) return;
            togglePanel(false);
        }
    };
    const onDocKeydown = (e) => {
        if (e.key === 'Escape' && panel.style.display === 'block') {
            togglePanel(false);
        }
    };
    const onWinResize = () => {
        if (panel.style.display === 'block') positionPanel();
    };

    doc.addEventListener('click', onDocClick);
    doc.addEventListener('keydown', onDocKeydown);
    if (typeof win.addEventListener === 'function') {
        win.addEventListener('resize', onWinResize);
    }

    bindToggleShortcut(doc, () => {
        state.isRTL = !state.isRTL;
        save();
        syncUI();
    });

    const stopWatch = watchDom(doc, () => state, () => {
        applyAll();
        ensureTriggerMounted();
    });

    ensureTriggerMounted();
    syncUI();

    return {
        getState: () => ({ ...state }),
        setRTL(active) {
            state.isRTL = Boolean(active);
            save();
            syncUI();
        },
        updateConfig(partial) {
            Object.assign(state, sanitizeConfig({ ...state, ...partial }));
            syncInputsFromState();
            save();
            syncUI();
        },
        ensureMounted() {
            ensureTriggerMounted();
            applyAll();
        },
        refresh: () => applyAll(),
        destroy: () => {
            stopDockRetry();
            stopWatch();
            doc.removeEventListener('click', onDocClick);
            doc.removeEventListener('keydown', onDocKeydown);
            if (typeof win.removeEventListener === 'function') {
                win.removeEventListener('resize', onWinResize);
            }
            panel.remove();
            if (topbarBtn) topbarBtn.remove();
            if (statusbarBtn) statusbarBtn.remove();
        }
    };
}
