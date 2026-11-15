/**
 * Shared DOM direction & Math Isolation runtime engine for Antigravity RTL Math.
 * Works across Standalone App, Antigravity IDE, Remote Control Extension, and JSDOM tests.
 */

import { sanitizeConfig } from './config.js';

const ZERO_WIDTH_RE = /[\u200B-\u200F\uFEFF]/g;
const RTL_CHAR_RE = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const RTL_CHAR_GLOBAL_RE = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g;
const LTR_CHAR_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
const LTR_CHAR_GLOBAL_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g;
const STRONG_CHAR_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

export const MATH_ROOT_SELECTOR = [
    '.katex',
    '.katex-display',
    '.katex-error',
    '.math',
    '.math-inline',
    '.math-display',
    'mjx-container',
    '.MathJax',
    '.MathJax_Display',
    '.MathJax_SVG',
    '.MathJax_SVG_Display',
    '.MJXp-math',
    'math',
    '[data-math]',
    '[data-latex]',
    '[data-katex]'
].join(', ');

export const SKIP_SUBTREE_SELECTOR = [
    'pre',
    'code',
    'kbd',
    'samp',
    'svg',
    'canvas',
    '.mermaid',
    '.monaco-editor',
    '.monaco-diff-editor',
    '.terminal',
    '.xterm',
    '.katex-html',
    '.katex-mathml',
    MATH_ROOT_SELECTOR
].join(', ');

export const DISPLAY_MATH_SELECTOR = [
    '.katex-display',
    '.math-display',
    'mjx-container[display="true"]',
    '.MathJax_Display',
    '.MathJax_SVG_Display'
].join(', ');

export const MATH_TEXT_SELECTOR = [
    '.katex .mord.text',
    '.katex .text',
    'mjx-mtext',
    'math mtext'
].join(', ');

const PROSE_ROOTS = [
    '.prose',
    '.markdown-body',
    '.rendered-markdown',
    '.leading-relaxed',
    '[data-testid="chat-message"]',
    '[data-testid="conversation-view"]'
];

export const BLOCK_SELECTOR = [
    ...PROSE_ROOTS.map(r => `${r} > *`),
    ...PROSE_ROOTS.map(r => `${r} p`),
    ...PROSE_ROOTS.map(r => `${r} li`),
    ...PROSE_ROOTS.map(r => `${r} ul`),
    ...PROSE_ROOTS.map(r => `${r} ol`),
    ...PROSE_ROOTS.map(r => `${r} h1`),
    ...PROSE_ROOTS.map(r => `${r} h2`),
    ...PROSE_ROOTS.map(r => `${r} h3`),
    ...PROSE_ROOTS.map(r => `${r} h4`),
    ...PROSE_ROOTS.map(r => `${r} h5`),
    ...PROSE_ROOTS.map(r => `${r} h6`),
    ...PROSE_ROOTS.map(r => `${r} blockquote`),
    ...PROSE_ROOTS.map(r => `${r} table`),
    ...PROSE_ROOTS.map(r => `${r} th`),
    ...PROSE_ROOTS.map(r => `${r} td`),
    ...PROSE_ROOTS.map(r => `${r} dt`),
    ...PROSE_ROOTS.map(r => `${r} dd`),
    ...PROSE_ROOTS.map(r => `${r} summary`),
    ...PROSE_ROOTS.map(r => `${r} figcaption`),
    '[data-testid="user-input-step"]',
    '[data-testid="user-input-step"] > *',
    'div:has(> [role="radiogroup"])',
    'label[for^="ask-opt-"]'
].join(', ');

export const INPUT_SELECTOR = [
    '[contenteditable="true"] p',
    '[contenteditable="true"]',
    'textarea[data-testid="ask-question-writein"]'
].join(', ');

function setAttr(el, name, value) {
    if (value == null) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
        el.setAttribute(name, value);
    }
}

/**
 * Extracts readable prose text from an element while skipping math formulas,
 * code blocks/inline code, SVGs, diagrams, and editors.
 */
export function extractProseText(root) {
    const chunks = [];
    function walk(node) {
        if (!node) return;
        if (node.nodeType === 3) {
            chunks.push(node.nodeValue || '');
            return;
        }
        if (node.nodeType !== 1) return;
        if (node !== root && typeof node.matches === 'function' && node.matches(SKIP_SUBTREE_SELECTOR)) {
            return;
        }
        const children = node.childNodes;
        if (!children) return;
        for (let i = 0; i < children.length; i++) {
            walk(children[i]);
        }
    }
    walk(root);
    return chunks.join(' ').replace(ZERO_WIDTH_RE, '').trim();
}

/**
 * Detects 'rtl', 'ltr', or 'auto' from prose text under the selected mode.
 */
export function detectTextDirection(proseText, mode = 'smart') {
    const clean = (proseText || '').replace(ZERO_WIDTH_RE, '').trim();
    if (mode === 'force') return 'rtl';
    if (!clean) return 'auto';

    const first = clean.match(STRONG_CHAR_RE);
    if (!first) return 'auto';

    if (RTL_CHAR_RE.test(first[0])) {
        return 'rtl';
    }

    if (mode === 'smart') {
        const rtlCount = (clean.match(RTL_CHAR_GLOBAL_RE) || []).length;
        const ltrCount = (clean.match(LTR_CHAR_GLOBAL_RE) || []).length;
        if (rtlCount >= 2 && rtlCount >= ltrCount * 0.35) {
            return 'rtl';
        }
    }

    return 'ltr';
}

function isProtectedSkipElement(el) {
    if (!el || typeof el.matches !== 'function') return false;
    if (el.matches(SKIP_SUBTREE_SELECTOR)) return true;
    if (typeof el.closest === 'function') {
        if (el.closest('.monaco-editor, .monaco-diff-editor, .terminal, .xterm, pre, code, .mermaid, .katex, mjx-container, .MathJax, math')) {
            return true;
        }
    }
    return false;
}

function isOurOwnNode(node) {
    if (!node) return false;
    let cur = node.nodeType === 1 ? node : node.parentElement;
    while (cur) {
        if (cur.id && cur.id.startsWith('ag-rtl-')) {
            return true;
        }
        cur = cur.parentElement;
    }
    return false;
}

/**
 * Applies direction attributes to inputs, chat/artifact prose blocks, and math text spans.
 */
export function applyRtlMathPass(doc, rawConfig) {
    if (!doc) return;
    const cfg = sanitizeConfig(rawConfig);

    // 1. Always protect math roots when mathIsolation is enabled (even if RTL is toggled off)
    if (cfg.mathIsolation) {
        doc.querySelectorAll(MATH_ROOT_SELECTOR).forEach(el => {
            setAttr(el, 'dir', 'ltr');
        });

        doc.querySelectorAll(MATH_TEXT_SELECTOR).forEach(el => {
            if (!cfg.mathPersianText) {
                setAttr(el, 'data-rtl-math-text', null);
                setAttr(el, 'dir', null);
                return;
            }
            const text = (el.textContent || '').replace(ZERO_WIDTH_RE, '').trim();
            if (text && RTL_CHAR_RE.test(text) && detectTextDirection(text, 'smart') === 'rtl') {
                setAttr(el, 'data-rtl-math-text', 'rtl');
                setAttr(el, 'dir', 'rtl');
            } else {
                setAttr(el, 'data-rtl-math-text', null);
                setAttr(el, 'dir', null);
            }
        });
    } else {
        doc.querySelectorAll('[data-rtl-math-text]').forEach(el => {
            setAttr(el, 'data-rtl-math-text', null);
            setAttr(el, 'dir', null);
        });
    }

    // 2. If RTL is disabled, revert prose blocks cleanly to LTR/neutral
    if (!cfg.isRTL) {
        doc.querySelectorAll('[data-rtl-math-only]').forEach(el => setAttr(el, 'data-rtl-math-only', null));
        doc.querySelectorAll(INPUT_SELECTOR).forEach(el => setAttr(el, 'dir', null));
        doc.querySelectorAll(BLOCK_SELECTOR).forEach(el => {
            if (isProtectedSkipElement(el)) return;
            setAttr(el, 'dir', 'ltr');
        });
        return;
    }

    // 3. Inputs (prompt editor & ask-question textarea)
    doc.querySelectorAll(INPUT_SELECTOR).forEach(el => {
        if (isOurOwnNode(el)) return;
        const raw = el.tagName === 'TEXTAREA' ? el.value : el.textContent;
        const clean = (raw || '').replace(ZERO_WIDTH_RE, '').trim();
        if (!clean) {
            setAttr(el, 'dir', null);
            return;
        }
        const dir = detectTextDirection(clean, cfg.directionMode === 'force' ? 'force' : cfg.directionMode);
        setAttr(el, 'dir', dir === 'auto' ? null : dir);
    });

    // 4. Prose blocks (math-aware!)
    doc.querySelectorAll(BLOCK_SELECTOR).forEach(el => {
        if (isOurOwnNode(el) || isProtectedSkipElement(el)) return;

        const proseText = extractProseText(el);
        const hasProseStrong = STRONG_CHAR_RE.test(proseText);
        const hasDisplayMath = Boolean(el.querySelector && el.querySelector(DISPLAY_MATH_SELECTOR));

        // Standalone display math wrapper (e.g. <p><span class="katex-display">...</span></p>)
        if (hasDisplayMath && !hasProseStrong) {
            setAttr(el, 'data-rtl-math-only', 'true');
            setAttr(el, 'dir', 'ltr');
            return;
        }
        setAttr(el, 'data-rtl-math-only', null);

        // Inline-only math or code block with zero surrounding strong prose text (e.g. <p>$x = 1$</p>)
        if (!hasProseStrong && el.querySelector && (el.querySelector(MATH_ROOT_SELECTOR) || el.querySelector('pre, code'))) {
            setAttr(el, 'dir', 'ltr');
            return;
        }

        const dir = detectTextDirection(proseText, cfg.directionMode);
        setAttr(el, 'dir', dir);
    });
}

/**
 * Watches DOM mutations (including characterData during AI streaming), inputs, and focus
 * with a snappy 120ms debounce.
 */
export function watchDom(doc, getConfig, onTick) {
    const view = doc.defaultView;
    const _setTimeout = (view && typeof view.setTimeout === 'function')
        ? view.setTimeout.bind(view)
        : (typeof setTimeout === 'function' ? setTimeout : null);
    const _clearTimeout = (view && typeof view.clearTimeout === 'function')
        ? view.clearTimeout.bind(view)
        : (typeof clearTimeout === 'function' ? clearTimeout : null);

    let timer = null;
    const schedule = () => {
        if (timer) return;
        if (_setTimeout) {
            timer = _setTimeout(() => {
                timer = null;
                onTick();
            }, 120);
        } else {
            onTick();
        }
    };

    const observeTarget = doc.documentElement || doc.body;
    const eventRoot = doc.body || doc.documentElement;
    const cleanups = [];

    if (eventRoot) {
        eventRoot.addEventListener('input', schedule, { capture: true });
        eventRoot.addEventListener('focusin', schedule, { capture: true });
        cleanups.push(() => {
            eventRoot.removeEventListener('input', schedule, { capture: true });
            eventRoot.removeEventListener('focusin', schedule, { capture: true });
        });
    }

    if (typeof doc.addEventListener === 'function') {
        const onVis = () => {
            if (doc.visibilityState !== 'hidden') schedule();
        };
        doc.addEventListener('visibilitychange', onVis);
        cleanups.push(() => doc.removeEventListener('visibilitychange', onVis));
    }
    if (doc.defaultView && typeof doc.defaultView.addEventListener === 'function') {
        const win = doc.defaultView;
        win.addEventListener('focus', schedule);
        cleanups.push(() => win.removeEventListener('focus', schedule));
    }

    if (observeTarget) {
        const ObserverCtor = (doc.defaultView && doc.defaultView.MutationObserver)
            || (typeof MutationObserver === 'function' ? MutationObserver : null);
        if (ObserverCtor) {
            const observer = new ObserverCtor((mutations) => {
                const needsPass = mutations.some((m) => {
                    if (m.type === 'characterData') {
                        return !isOurOwnNode(m.target);
                    }
                    for (const node of m.removedNodes || []) {
                        if (isOurOwnNode(node) || (node && node.nodeType === 1 && node.querySelector && node.querySelector('[id^="ag-rtl-"]'))) {
                            return true;
                        }
                    }
                    for (const node of m.addedNodes || []) {
                        if (!isOurOwnNode(node)) return true;
                    }
                    return false;
                });
                if (needsPass) schedule();
            });
            observer.observe(observeTarget, { childList: true, subtree: true, characterData: true });
            cleanups.push(() => observer.disconnect());
        }
    }

    return () => {
        if (timer && _clearTimeout) {
            _clearTimeout(timer);
            timer = null;
        }
        for (const fn of cleanups) {
            try { fn(); } catch (_) {}
        }
    };
}

/**
 * Alt+R (⌥R on macOS). Excludes Cmd/Ctrl so VS Code regex toggle (⌥⌘R) and AltGr work normally.
 */
export function bindToggleShortcut(doc, onToggle) {
    doc.addEventListener('keydown', (e) => {
        if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyR') {
            e.preventDefault();
            onToggle();
        }
    });
}
