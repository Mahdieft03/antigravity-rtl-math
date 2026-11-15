/**
 * Pure-DOM (Trusted Types & CSP safe) Settings Panel & Trigger Controller.
 * Zero innerHTML usage — works seamlessly in Antigravity Standalone, Antigravity IDE,
 * Remote Control Browser Extension, and the local Playground.
 */

import { DEFAULT_CONFIG, sanitizeConfig } from '../core/config.js';
import { buildDynamicCSS, buildWidgetCSS } from '../core/rtl-math-css.js';
import { applyRtlMathPass, bindToggleShortcut, watchDom } from '../core/rtl-math-engine.js';

const LABELS = {
    en: {
        title: 'Antigravity RTL + Math',
        enabled: 'Enabled',
        disabled: 'Disabled',
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
    const state = sanitizeConfig(initialConfig);
    const resolvedFontSource = fontSource || fontBase64;

    // 1. Inject permanent widget stylesheet
    if (!doc.getElementById('ag-rtl-widget-style')) {
        const wStyle = doc.createElement('style');
        wStyle.id = 'ag-rtl-widget-style';
        wStyle.textContent = buildWidgetCSS();
        (doc.head || doc.documentElement).appendChild(wStyle);
    }

    // 2. Dynamic RTL + Math stylesheet
    let dynStyle = doc.getElementById('ag-rtl-dynamic-style');
    if (!dynStyle) {
        dynStyle = doc.createElement('style');
        dynStyle.id = 'ag-rtl-dynamic-style';
        (doc.head || doc.documentElement).appendChild(dynStyle);
    }

    function save() {
        if (typeof onSaveConfig === 'function') {
            try {
                onSaveConfig({ ...state });
            } catch (_) {}
        }
    }

    function applyAll() {
        dynStyle.textContent = buildDynamicCSS(state, resolvedFontSource);
        applyRtlMathPass(doc, state);
        if (typeof win.dispatchEvent === 'function' && typeof win.Event === 'function') {
            try {
                win.dispatchEvent(new win.Event('resize'));
            } catch (_) {}
        }
    }

    // 3. Build Pure-DOM Settings Panel
    const existingPanel = doc.getElementById('ag-rtl-panel');
    if (existingPanel) existingPanel.remove();

    const panel = createEl(
        doc,
        'div',
        'position:fixed;z-index:2147483645;width:296px;padding:13px;display:none;direction:ltr;text-align:left;font-size:12px;user-select:none;',
        null,
        { id: 'ag-rtl-panel', className: 'ag-rtl-theme-panel' }
    );

    const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || navigator.platform || '');

    // Header
    const titleSpan = createEl(doc, 'span', 'font-weight:700;font-size:12px;letter-spacing:0.2px;');
    const langBtn = createEl(
        doc,
        'button',
        'border:1px solid var(--border,rgba(255,255,255,0.16));background:transparent;color:inherit;border-radius:4px;font-size:10px;font-weight:600;padding:2px 6px;cursor:pointer;opacity:0.85;',
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
    const headerRight = createEl(doc, 'div', 'display:flex;align-items:center;gap:6px;', [langBtn, kbdWrap, closeBtn]);
    panel.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [titleSpan, headerRight]));
    panel.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    // Master toggle row
    const masterLabel = createEl(doc, 'span', 'font-weight:600;font-size:12px;');
    const masterSwitch = createSwitch(doc, 'ag-rtl-master-btn', state.isRTL, () => {
        state.isRTL = !state.isRTL;
        save();
        syncUI();
    });
    panel.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;', [masterLabel, masterSwitch.btn]));

    // Body container (dimmed when RTL disabled, except math shield info)
    const bodyBox = createEl(doc, 'div', 'display:flex;flex-direction:column;gap:8px;transition:opacity 0.15s ease;', null, { id: 'ag-rtl-body' });

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
    const mathScaleVal = createEl(doc, 'span', 'font-size:10px;opacity:0.65;min-width:28px;text-align:right;', `${state.mathScale}x`);
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
        state.mathScale = e.target.value;
        mathScaleVal.textContent = `${state.mathScale}x`;
        save();
        applyAll();
    });
    mathScaleReset.addEventListener('click', () => {
        state.mathScale = DEFAULT_CONFIG.mathScale;
        mathScaleInput.value = state.mathScale;
        mathScaleVal.textContent = `${state.mathScale}x`;
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
        state.lh = e.target.value;
        lhVal.textContent = state.lh;
        save();
        applyAll();
    });
    lhReset.addEventListener('click', () => {
        state.lh = DEFAULT_CONFIG.lh;
        lhInput.value = state.lh;
        lhVal.textContent = state.lh;
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
        state.fs = e.target.value;
        fsVal.textContent = `${state.fs}px`;
        save();
        applyAll();
    });
    fsReset.addEventListener('click', () => {
        state.fs = DEFAULT_CONFIG.fs;
        fsInput.value = state.fs;
        fsVal.textContent = `${state.fs}px`;
        save();
        applyAll();
    });
    bodyBox.appendChild(createEl(doc, 'div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;', [
        fsLabel,
        createEl(doc, 'div', 'display:flex;align-items:center;gap:4px;', [fsVal, fsInput, fsReset])
    ]));

    panel.appendChild(bodyBox);
    panel.appendChild(createEl(doc, 'div', null, null, { className: 'ag-rtl-sep' }));

    // Footer Reset Defaults
    const resetAllBtn = createEl(
        doc,
        'button',
        'width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border,rgba(255,255,255,0.12));background:transparent;color:inherit;font-size:11px;cursor:pointer;opacity:0.8;',
        '',
        { id: 'ag-rtl-reset-all', type: 'button' }
    );
    resetAllBtn.addEventListener('click', () => {
        const keepLang = state.uiLang;
        Object.assign(state, DEFAULT_CONFIG, { uiLang: keepLang });
        faInput.value = state.faFont;
        enInput.value = state.enFont;
        codeInput.value = state.codeFont;
        lhInput.value = state.lh;
        lhVal.textContent = state.lh;
        fsInput.value = state.fs;
        fsVal.textContent = `${state.fs}px`;
        mathScaleInput.value = state.mathScale;
        mathScaleVal.textContent = `${state.mathScale}x`;
        save();
        syncUI();
    });
    panel.appendChild(resetAllBtn);

    // Trigger elements (Topbar / Statusbar / Floating)
    let topbarBtn = null;
    let statusDot = null;
    let statusbarBtn = null;

    function positionPanel() {
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
                panel.style.top = `${Math.round(rect.bottom + 6)}px`;
                panel.style.right = `${Math.max(8, Math.round((win.innerWidth || 1024) - rect.right))}px`;
                panel.style.bottom = 'auto';
                panel.style.left = 'auto';
                return;
            }
        }
        panel.style.top = '48px';
        panel.style.right = '14px';
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

    function ensureTriggerMounted() {
        if (!doc.body || hideTrigger) return;
        if (!doc.body.contains(panel)) doc.body.appendChild(panel);

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
                return;
            }
        }

        // App / Remote / IDE-without-statusbar fallback: mount in topbar cluster or floating pill
        const cluster =
            doc.querySelector('[data-testid="titlebar-more-actions"]')?.parentElement ||
            doc.querySelector('[data-testid="install-editor"]')?.parentElement;

        if (!topbarBtn) {
            const icon = createSvgIcon(doc, '0 0 24 24', 14, 14, [
                { circle: ['12', '12', '10'] },
                'M2 12h20',
                'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'
            ]);
            statusDot = createEl(
                doc,
                'span',
                `position:absolute;top:-2px;right:-2px;width:6px;height:6px;border-radius:9999px;background:#10b981;display:${state.isRTL ? 'block' : 'none'};`
            );
            const iconBox = createEl(doc, 'div', 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;', [icon, statusDot]);
            const labelEl = createEl(doc, 'span', 'font-size:12px;font-weight:600;', LABELS[state.uiLang].btnText, { id: 'ag-rtl-topbar-label' });
            topbarBtn = createEl(
                doc,
                'button',
                'display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--border,rgba(255,255,255,0.16));background:transparent;color:inherit;cursor:pointer;white-space:nowrap;app-region:no-drag;',
                [iconBox, labelEl],
                { id: 'ag-rtl-topbar-btn', type: 'button', title: `Antigravity RTL + Math (${isMac ? '⌥R' : 'Alt+R'})` }
            );
            topbarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            });
        }

        if (cluster) {
            topbarBtn.style.position = 'relative';
            topbarBtn.style.top = '';
            topbarBtn.style.right = '';
            topbarBtn.style.zIndex = '';
            if (topbarBtn.parentElement !== cluster) {
                cluster.appendChild(topbarBtn);
            }
        } else if (topbarBtn.parentElement !== doc.body) {
            topbarBtn.style.position = 'fixed';
            topbarBtn.style.top = '12px';
            topbarBtn.style.right = '12px';
            topbarBtn.style.zIndex = '2147483644';
            topbarBtn.style.background = 'var(--card, #18181b)';
            doc.body.appendChild(topbarBtn);
        }
    }

    function syncUI() {
        const L = LABELS[state.uiLang] || LABELS.en;
        panel.style.direction = state.uiLang === 'fa' ? 'rtl' : 'ltr';
        panel.style.textAlign = state.uiLang === 'fa' ? 'right' : 'left';
        titleSpan.textContent = L.title;
        langBtn.textContent = state.uiLang === 'fa' ? 'EN' : 'فا';
        masterLabel.textContent = state.isRTL ? L.enabled : L.disabled;
        masterSwitch.setChecked(state.isRTL);

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

    doc.addEventListener('click', (e) => {
        if (panel.style.display === 'block') {
            if (panel.contains(e.target)) return;
            if (topbarBtn && topbarBtn.contains(e.target)) return;
            if (statusbarBtn && statusbarBtn.contains(e.target)) return;
            togglePanel(false);
        }
    });

    doc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.style.display === 'block') {
            togglePanel(false);
        }
    });

    if (typeof win.addEventListener === 'function') {
        win.addEventListener('resize', () => {
            if (panel.style.display === 'block') positionPanel();
        });
    }

    bindToggleShortcut(doc, () => {
        state.isRTL = !state.isRTL;
        save();
        syncUI();
    });

    const stopWatch = watchDom(doc, () => state, () => {
        applyRtlMathPass(doc, state);
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
            save();
            syncUI();
        },
        refresh: () => applyRtlMathPass(doc, state),
        destroy: () => {
            stopWatch();
            panel.remove();
            if (topbarBtn) topbarBtn.remove();
            if (statusbarBtn) statusbarBtn.remove();
        }
    };
}
