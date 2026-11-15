/**
 * Stylesheet generator for Antigravity RTL Math.
 * Pure, dependency-free, safe to bundle into Electron renderer & Chrome extension.
 */

import { sanitizeConfig } from './config.js';

const ARABIC_UNICODE_RANGE = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF';

// Exclusions so prose font/direction/line-height rules NEVER leak into math, code, icons, or diagrams.
const NON_PROSE_NOT = [
    ':not(pre)',
    ':not(pre *)',
    ':not(code)',
    ':not(code *)',
    ':not(kbd)',
    ':not(kbd *)',
    ':not(samp)',
    ':not(samp *)',
    ':not(.katex)',
    ':not(.katex *)',
    ':not(.katex-display)',
    ':not(.katex-display *)',
    ':not(.katex-html)',
    ':not(.katex-html *)',
    ':not(.katex-mathml)',
    ':not(.katex-mathml *)',
    ':not(.math)',
    ':not(.math *)',
    ':not(.math-inline)',
    ':not(.math-inline *)',
    ':not(.math-display)',
    ':not(.math-display *)',
    ':not(mjx-container)',
    ':not(mjx-container *)',
    ':not(.MathJax)',
    ':not(.MathJax *)',
    ':not(.MathJax_Display)',
    ':not(.MathJax_Display *)',
    ':not(.MJXp-math)',
    ':not(.MJXp-math *)',
    ':not(math)',
    ':not(math *)',
    ':not(.mermaid)',
    ':not(.mermaid *)',
    ':not(svg)',
    ':not(svg *)',
    ':not(.monaco-editor)',
    ':not(.monaco-editor *)',
    ':not(.monaco-diff-editor)',
    ':not(.monaco-diff-editor *)',
    ':not(.xterm)',
    ':not(.xterm *)',
    ':not(.terminal)',
    ':not(.terminal *)',
    ':not(.codicon)',
    ':not([class*="codicon-"])',
    ':not(.google-symbols)'
].join('');

const PROSE_CONTAINERS = [
    '.prose',
    '.markdown-body',
    '.rendered-markdown',
    '.leading-relaxed',
    '[data-testid="chat-message"]',
    '[data-testid="conversation-view"]',
    '[data-testid="user-input-step"]'
];

const PROSE_DESCENDANTS = PROSE_CONTAINERS
    .map(c => `${c} :is(p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, table, th, td, dt, dd, strong, b, em, i, a, label, summary, figcaption, span, div)${NON_PROSE_NOT}`)
    .join(',\n');

const FORCE_RTL_SELECTORS = [
    ...PROSE_CONTAINERS.map(c => `${c} > :is(p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, table, div)${NON_PROSE_NOT}:not([data-rtl-math-only="true"])`),
    ...PROSE_CONTAINERS.map(c => `${c} :is(p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th)${NON_PROSE_NOT}:not([data-rtl-math-only="true"])`),
    'div:has(> [role="radiogroup"])',
    'label[for^="ask-opt-"]'
].join(',\n');

/**
 * Permanent CSS for the floating / topbar settings widget.
 */
export function buildWidgetCSS() {
    return `
        #ag-rtl-panel {
            transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.16s ease;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        #ag-rtl-panel * {
            box-sizing: border-box;
        }
        #ag-rtl-topbar-btn {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            line-height: 1 !important;
        }
        .ag-rtl-theme-panel {
            background-color: var(--popover, var(--vscode-editorWidget-background, var(--card, #18181b))) !important;
            color: var(--popover-foreground, var(--vscode-editorWidget-foreground, var(--foreground, #f4f4f5))) !important;
            border: 1px solid var(--border, var(--vscode-widget-border, rgba(255, 255, 255, 0.14))) !important;
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25) !important;
            border-radius: 12px !important;
        }
        .ag-rtl-sep {
            height: 1px;
            background: var(--border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)));
            margin: 8px 0;
            width: 100%;
        }
        .ag-rtl-input {
            font-size: 11px !important;
            border-radius: 5px !important;
            padding: 4px 8px !important;
            height: 25px !important;
            width: 126px !important;
            direction: ltr !important;
            text-align: left !important;
            background-color: var(--muted, var(--vscode-input-background, #27272a)) !important;
            color: var(--foreground, var(--vscode-input-foreground, #f4f4f5)) !important;
            border: 1px solid var(--border, var(--vscode-input-border, rgba(255, 255, 255, 0.16))) !important;
            outline: none !important;
        }
        .ag-rtl-input:focus {
            border-color: var(--color-primary, var(--vscode-focusBorder, #3b82f6)) !important;
        }
        .ag-rtl-seg {
            display: inline-flex;
            align-items: center;
            background: var(--muted, rgba(255, 255, 255, 0.08));
            border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
            border-radius: 6px;
            padding: 2px;
            gap: 2px;
        }
        .ag-rtl-seg-btn {
            border: none;
            background: transparent;
            color: inherit;
            opacity: 0.72;
            font-size: 10px;
            font-weight: 600;
            padding: 3px 7px;
            border-radius: 4px;
            cursor: pointer;
            line-height: 1.2;
            transition: background-color 0.12s ease, opacity 0.12s ease;
        }
        .ag-rtl-seg-btn:hover {
            opacity: 1;
        }
        .ag-rtl-seg-btn[data-active="true"] {
            background: var(--color-primary, var(--vscode-button-background, #2563eb));
            color: #ffffff;
            opacity: 1;
        }
        .ag-rtl-range {
            width: 82px;
            accent-color: var(--color-primary, var(--vscode-button-background, #3b82f6));
            cursor: pointer;
        }
        .ag-rtl-kbd {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            font-size: 10px;
            font-weight: 600;
            line-height: 1;
            color: var(--muted-foreground, #a1a1aa);
            background-color: var(--muted, rgba(255, 255, 255, 0.08));
            border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
            border-radius: 4px;
        }
    `;
}

/**
 * Generates the active RTL + Math Isolation + Typography CSS for a sanitized config.
 * `fontSource` may be a base64-encoded woff2 string or a font URL/path.
 */
export function buildDynamicCSS(rawConfig, fontSource = '') {
    const cfg = sanitizeConfig(rawConfig);

    if (!cfg.isRTL) {
        // When RTL is disabled, keep LTR prose clean while STILL preserving math isolation if enabled.
        return buildDisabledCSS(cfg);
    }

    let faFontRule = '';
    let faFontName = "'PersianOnlyFont'";

    if (cfg.faFont) {
        faFontName = "'UserPersianFont', 'PersianOnlyFont'";
        const baseFaFont = cfg.faFont.replace(/[-\s]?Regular$/i, '');
        faFontRule = `
            @font-face {
                font-family: 'UserPersianFont';
                src: local('${cfg.faFont}'), local('${baseFaFont}');
                font-weight: 400;
                unicode-range: ${ARABIC_UNICODE_RANGE};
            }
            @font-face {
                font-family: 'UserPersianFont';
                src: local('${baseFaFont} Bold'), local('${baseFaFont}-Bold'), local('${baseFaFont}Bold');
                font-weight: 700;
                unicode-range: ${ARABIC_UNICODE_RANGE};
            }
        `;
    }

    const isUrlFont = /^(?:https?:|chrome-extension:|moz-extension:|file:|\/|\.\.?\/|assets\/)/i.test(fontSource || '');
    const offlineFontSrc = fontSource
        ? isUrlFont
            ? `local('Vazirmatn'), local('Vazirmatn Variable'), local('Vazir'), url('${fontSource}') format('woff2')`
            : `local('Vazirmatn'), local('Vazirmatn Variable'), local('Vazir'), url('data:font/woff2;base64,${fontSource}') format('woff2')`
        : `local('Vazirmatn'), local('Vazirmatn Variable'), local('Vazir')`;

    const enFontStr = cfg.enFont
        ? `'${cfg.enFont}', ui-sans-serif, system-ui, -apple-system, sans-serif`
        : 'ui-sans-serif, system-ui, -apple-system, sans-serif';

    const fontStack = `${faFontName}, ${enFontStr}, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;

    const codeFontStr = cfg.codeFont
        ? `'${cfg.codeFont}', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
        : 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

    const forceRtlBlock = cfg.directionMode === 'force' ? `
        ${FORCE_RTL_SELECTORS} {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: isolate !important;
        }
    ` : '';

    const mathScaleRule = cfg.mathScale !== '1.0' ? `
        .katex {
            font-size: calc(1.21em * ${cfg.mathScale}) !important;
        }
        mjx-container, .MathJax {
            font-size: calc(100% * ${cfg.mathScale}) !important;
        }
    ` : '';

    const mathPersianTextRule = cfg.mathPersianText ? `
        /* Persian/Arabic inside LaTeX \\text{...} or MathML <mtext> renders in Vazirmatn + RTL without flipping math */
        .katex [data-rtl-math-text="rtl"],
        .katex [data-rtl-math-text="rtl"] *,
        mjx-container [data-rtl-math-text="rtl"],
        mjx-container [data-rtl-math-text="rtl"] *,
        math [data-rtl-math-text="rtl"],
        math [data-rtl-math-text="rtl"] * {
            direction: rtl !important;
            unicode-bidi: isolate !important;
        }
        .katex [data-rtl-math-text="rtl"],
        .katex [data-rtl-math-text="rtl"] *,
        .katex .mord.text:not(.textsf):not(.texttt):not(.textbb):not(.textfrak):not(.textscr),
        .katex .mord.text:not(.textsf):not(.texttt):not(.textbb):not(.textfrak):not(.textscr) > .mord,
        mjx-mtext,
        mtext {
            font-family: ${faFontName}, KaTeX_Main, "Times New Roman", serif !important;
        }
    ` : '';

    const mathIsolationCSS = cfg.mathIsolation ? `
        /* ================================================================
         * MATH ISOLATION SHIELD (KaTeX, MathJax v2/v3/v4, MathML, Remark)
         * Ensures mathematical notation is ALWAYS LTR and keeps math fonts.
         * ================================================================ */
        .katex,
        .katex-display,
        .katex-html,
        .katex-mathml,
        .katex-error,
        .math,
        .math-inline,
        .math-display,
        mjx-container,
        .MathJax,
        .MathJax_Display,
        .MathJax_SVG,
        .MathJax_SVG_Display,
        .MJXp-math,
        math,
        [data-math],
        [data-latex],
        [data-katex] {
            direction: ltr !important;
            unicode-bidi: isolate !important;
        }

        /* Neutralize any inherited unicode-bidi: plaintext or direction: rtl on internal math spans */
        .katex *,
        .katex-html *,
        .katex-mathml *,
        mjx-container *,
        .MathJax *,
        .MJXp-math *,
        math * {
            direction: ltr !important;
            unicode-bidi: normal !important;
        }

        /* Protect KaTeX vertical spacing, flex direction, and internal alignments */
        .katex {
            line-height: 1.2 !important;
            text-indent: 0 !important;
            text-rendering: auto;
        }
        .katex .smash {
            line-height: 0 !important;
        }
        .katex .hbox,
        .katex .thinbox {
            flex-direction: row !important;
        }
        .katex .vbox {
            flex-direction: column !important;
        }
        .katex .msupsub,
        .katex .svg-align,
        .katex .cd-label-left,
        .katex .mtable .col-align-l > .vlist-t {
            text-align: left !important;
        }
        .katex .cd-label-right,
        .katex .mtable .col-align-r > .vlist-t {
            text-align: right !important;
        }
        .katex .mfrac > span > span,
        .katex .op-limits > .vlist-t,
        .katex .accent > .vlist-t,
        .katex .mover,
        .katex .munder,
        .katex .mtable .col-align-c > .vlist-t {
            text-align: center !important;
        }

        /* Display math containers ($$...$$): keep block alignment clean & scrollable on narrow panes */
        .katex-display,
        .math-display,
        mjx-container[display="true"],
        .MathJax_Display,
        .MathJax_SVG_Display,
        [data-rtl-math-only="true"] {
            display: block !important;
            direction: ltr !important;
            unicode-bidi: isolate !important;
            text-align: ${cfg.mathDisplayAlign} !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            max-width: 100% !important;
            padding-block: 0.25em !important;
        }
        .katex-display > .katex {
            display: block !important;
            text-align: ${cfg.mathDisplayAlign} !important;
            white-space: nowrap !important;
        }

        ${mathScaleRule}
        ${mathPersianTextRule}
    ` : '';

    return `
        ${faFontRule}
        @font-face {
            font-family: 'PersianOnlyFont';
            src: ${offlineFontSrc};
            font-weight: 100 900;
            unicode-range: ${ARABIC_UNICODE_RANGE};
        }

        :root {
            --vscode-chat-font-family: ${fontStack} !important;
        }
        :root, :host, html, body {
            font-family: ${fontStack} !important;
        }

        /* Apply typography to prose WITHOUT clobbering math fonts, code fonts, SVGs, or icon fonts */
        [dir="rtl"]${NON_PROSE_NOT},
        ${PROSE_CONTAINERS.join(',\n')},
        ${PROSE_DESCENDANTS},
        [contenteditable="true"],
        [contenteditable="true"] p,
        [data-lexical-text="true"],
        label[for^="ask-opt-"],
        textarea[data-testid="ask-question-writein"] {
            font-family: ${fontStack} !important;
        }

        .prose,
        .markdown-body,
        .rendered-markdown,
        .leading-relaxed,
        [data-testid="chat-message"],
        [data-testid="conversation-view"],
        [contenteditable="true"],
        [contenteditable="true"] p {
            font-size: ${cfg.fs}px !important;
        }

        /* Base plaintext BiDi on prose blocks (never on * inside math/code!) */
        :is(.prose, .markdown-body, .rendered-markdown, .leading-relaxed, [data-testid="chat-message"], [data-testid="conversation-view"])
            :is(p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, li, td, th, dt, dd, summary, figcaption)${NON_PROSE_NOT} {
            unicode-bidi: plaintext;
            text-align: start;
        }

        label[for^="ask-opt-"],
        textarea[data-testid="ask-question-writein"] {
            unicode-bidi: plaintext;
            text-align: start;
        }
        label[for^="ask-opt-"][dir="rtl"] {
            direction: rtl;
            text-align: right;
        }

        ${forceRtlBlock}

        /* Explicit dir="rtl" / dir="ltr" support on paragraphs, headings, lists, blockquotes, tables */
        :is(p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, dt, dd)[dir="rtl"]${NON_PROSE_NOT} {
            direction: rtl;
            text-align: right;
            unicode-bidi: isolate;
        }
        :is(p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, dt, dd)[dir="ltr"]${NON_PROSE_NOT} {
            direction: ltr;
            text-align: left;
            unicode-bidi: isolate;
        }

        /* RTL List Padding Fix (top-level and nested) */
        ul[dir="rtl"], ol[dir="rtl"],
        [dir="rtl"] > ul, [dir="rtl"] > ol,
        .prose[dir="rtl"] ul:not([dir="ltr"]), .prose[dir="rtl"] ol:not([dir="ltr"]) {
            direction: rtl;
            padding-left: 0 !important;
            padding-right: 1.5rem !important;
        }
        ul[dir="ltr"], ol[dir="ltr"] {
            direction: ltr;
            padding-right: 0 !important;
            padding-left: 1.5rem !important;
        }
        [dir="rtl"] ul[dir="rtl"] ul:not([dir="ltr"]),
        [dir="rtl"] ul[dir="rtl"] ol:not([dir="ltr"]),
        [dir="rtl"] ol[dir="rtl"] ul:not([dir="ltr"]),
        [dir="rtl"] ol[dir="rtl"] ol:not([dir="ltr"]) {
            padding-left: 0 !important;
            padding-right: 2rem !important;
        }

        /* RTL Blockquote Border Flip */
        blockquote[dir="rtl"],
        [dir="rtl"] > blockquote:not([dir="ltr"]) {
            direction: rtl;
            text-align: right;
            border-left-width: 0 !important;
            border-right-width: 3px !important;
            border-right-style: solid;
            border-right-color: var(--border, rgba(148, 163, 184, 0.45));
            padding-left: 0 !important;
            padding-right: 1rem !important;
        }

        /* RTL Tables */
        table[dir="rtl"] {
            direction: rtl;
        }
        table[dir="rtl"] th,
        table[dir="rtl"] td {
            text-align: start;
        }

        /* Line height on prose text only (never inside math or code) */
        :is(.prose, .markdown-body, .rendered-markdown, .leading-relaxed, [data-testid="chat-message"], [data-testid="conversation-view"])
            :is(p, li, blockquote, td, th)${NON_PROSE_NOT},
        .leading-relaxed${NON_PROSE_NOT},
        [data-testid="user-input-step"] div${NON_PROSE_NOT},
        [data-lexical-text="true"],
        [contenteditable="true"],
        [contenteditable="true"] p,
        label[for^="ask-opt-"] {
            line-height: ${cfg.lh} !important;
        }

        /* Prompt composer isolation */
        [contenteditable="true"],
        [contenteditable="true"] * {
            unicode-bidi: isolate !important;
            text-align: start !important;
        }

        /* Sidebar & truncated items auto-direction */
        [role="navigation"][aria-label="Sidebar"] *,
        .truncate {
            unicode-bidi: plaintext !important;
            text-align: start !important;
        }

        /* Thinking Blocks (Keep LTR) */
        .cursor-edit.text-secondary-foreground,
        .cursor-edit.text-secondary-foreground * {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }

        /* Protect icon fonts */
        .codicon, [class*="codicon-"] {
            font-family: codicon !important;
        }
        .google-symbols {
            font-family: "Google Symbols" !important;
        }

        /* Protect Mermaid / Diagram containers from RTL reversal */
        .mermaid, .mermaid * {
            direction: ltr !important;
            unicode-bidi: isolate !important;
        }

        /* Strict Protection for Inline Code, Code Blocks, Monaco Editor, Diff Editor, and Terminal */
        code, code *,
        kbd, samp {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            font-family: ${codeFontStr} !important;
        }
        pre, pre * {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
            font-family: ${codeFontStr} !important;
        }
        .monaco-editor, .monaco-editor *,
        .monaco-diff-editor, .monaco-diff-editor *,
        .part.terminal, .part.terminal *,
        .terminal-wrapper, .terminal-wrapper *,
        .xterm, .xterm * {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: normal !important;
            ${cfg.codeFont ? `font-family: ${codeFontStr} !important;` : ''}
        }

        ${mathIsolationCSS}
    `;
}

/**
 * Generates CSS when RTL is toggled off (restores clean LTR while optionally keeping math shield).
 */
export function buildDisabledCSS(rawConfig) {
    const cfg = sanitizeConfig(rawConfig);
    return `
        [data-testid="conversation-view"] :is(p, li)${NON_PROSE_NOT},
        .prose :is(p, li)${NON_PROSE_NOT},
        .markdown-body :is(p, li)${NON_PROSE_NOT},
        .leading-relaxed${NON_PROSE_NOT},
        [contenteditable="true"],
        [contenteditable="true"] p {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: normal !important;
        }
        ${cfg.mathIsolation ? `
        .katex, .katex-display, .katex-html, mjx-container, .MathJax, math {
            direction: ltr !important;
            unicode-bidi: isolate !important;
        }
        ` : ''}
    `;
}
