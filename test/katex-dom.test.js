import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { JSDOM } from 'jsdom';

import { buildDynamicCSS } from '../src/core/rtl-math-css.js';
import { applyRtlMathPass, detectTextDirection, extractProseText } from '../src/core/rtl-math-engine.js';

function renderFormula(tex, displayMode = false) {
    return katex.renderToString(tex, { displayMode, throwOnError: false, strict: false });
}

test('KaTeX real DOM: isolates formulas LTR while keeping Persian prose RTL', () => {
    const f1 = renderFormula(String.raw`\tilde{L} = L\gamma^{-1} \quad (\gamma \ge 1) \qquad \text{انقباض طول}`, true);
    const f2 = renderFormula(
        String.raw`\left. \begin{aligned} x'_2 - x'_1 &= \gamma(-v)(t_2 - t_1) \\ t'_2 - t'_1 &= \gamma(t_2 - t_1) \end{aligned} \right\} \implies x_1 = x_2 \qquad \text{اتساع (کش آمدن) زمان}`,
        true
    );
    const sPrime = renderFormula(String.raw`S'`, false);
    const tEq = renderFormula(String.raw`T = t_2 - t_1`, false);
    const mixedTextFormula = renderFormula(String.raw`\text{مرحله 1: سرعت } v \text{ with } \text{if } x > 0`, false);

    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div data-testid="conversation-view">
                <div class="prose leading-relaxed" data-testid="chat-message">
                    <p id="p-inline">چون ساعت در ${renderFormula('S')} ساکن است، بازه زمانی ${tEq} زمان ویژه است.</p>
                    <p id="p-starts-with-math">${sPrime} دستگاه متحرک است و زمان در آن کندتر می‌گذرد.</p>
                    <p id="p-starts-with-en">Time Dilation در فیزیک نسبیت به معنای کند شدن زمان است.</p>
                    <p id="p-pure-en">Time Dilation is a fundamental effect in special relativity with ${tEq}.</p>
                    <p id="p-math-only">${f1}</p>
                    <div id="div-display">${f2}</div>
                    <p id="p-mixed-text">بررسی رابطه ${mixedTextFormula} در دستگاه مختصات.</p>
                </div>
            </div>
        </body>
        </html>
    `);

    const doc = dom.window.document;
    applyRtlMathPass(doc, { isRTL: true, directionMode: 'smart', mathIsolation: true, mathPersianText: true });

    // Prose paragraphs
    assert.equal(doc.getElementById('p-inline').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('p-starts-with-math').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('p-starts-with-en').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('p-pure-en').getAttribute('dir'), 'ltr');

    // Display-math-only wrappers remain LTR and marked math-only
    assert.equal(doc.getElementById('p-math-only').getAttribute('dir'), 'ltr');
    assert.equal(doc.getElementById('p-math-only').getAttribute('data-rtl-math-only'), 'true');
    assert.equal(doc.getElementById('div-display').getAttribute('dir'), 'ltr');
    assert.equal(doc.getElementById('div-display').getAttribute('data-rtl-math-only'), 'true');

    // Every single .katex and .katex-display root is strictly locked to dir="ltr"
    const katexRoots = [...doc.querySelectorAll('.katex, .katex-display')];
    assert.ok(katexRoots.length >= 6);
    for (const kr of katexRoots) {
        assert.equal(kr.getAttribute('dir'), 'ltr');
    }

    // Persian \text{...} segments inside KaTeX get RTL isolation while English \text{if } stays clean
    const rtlMathTexts = [...doc.querySelectorAll('.katex .mord.text[data-rtl-math-text="rtl"]')];
    assert.ok(rtlMathTexts.some(el => el.textContent.includes('انقباض')));
    assert.ok(rtlMathTexts.some(el => el.textContent.includes('اتساع')));
    assert.ok(rtlMathTexts.some(el => el.textContent.includes('مرحله')));
    for (const rt of rtlMathTexts) {
        assert.equal(rt.getAttribute('dir'), 'rtl');
    }

    const englishMathText = [...doc.querySelectorAll('#p-mixed-text .katex .mord.text')].find(el => el.textContent.includes('if'));
    assert.ok(englishMathText);
    assert.equal(englishMathText.getAttribute('data-rtl-math-text'), null);
    assert.equal(englishMathText.getAttribute('dir'), null);
});

test('CSS font-family and prose selectors NEVER match inside .katex or math trees', () => {
    const f2 = renderFormula(String.raw`\left. \begin{aligned} x'_2 &= t_2 \end{aligned} \right\} \quad \text{اتساع زمان}`, true);
    const dom = new JSDOM(`
        <div class="prose leading-relaxed" dir="rtl">
            <p id="prose-p" dir="rtl">متن فارسی <span id="inline-wrap">${renderFormula('x_2 - x_1')}</span></p>
            ${f2}
        </div>
    `);
    const doc = dom.window.document;

    // Simulate extracting the exact font-family selector block from buildDynamicCSS
    const css = buildDynamicCSS({ isRTL: true, directionMode: 'force', mathIsolation: true, mathPersianText: true }, '');

    // Must contain strict LTR shield and never apply ui-sans-serif to .katex *
    assert.match(css, /\.katex,\s*\.katex-display[\s\S]*direction:\s*ltr\s*!important/);
    assert.match(css, /\.katex[\s\S]*unicode-bidi:\s*isolate\s*!important/);
    assert.match(css, /\.katex \*[\s\S]*direction:\s*ltr\s*!important;\s*unicode-bidi:\s*normal\s*!important/);

    // Verify complex :not() prose selector does NOT match any KaTeX internal span
    const proseSelectorMatch = css.match(/\/\* Apply typography to prose[\s\S]*?\*\/\s*([\s\S]*?)\{\s*font-family:/);
    assert.ok(proseSelectorMatch);
    const matchedNodes = [...doc.querySelectorAll(proseSelectorMatch[1].trim())];
    const leakedIntoMath = matchedNodes.filter(el => el.closest('.katex, .katex-display'));
    assert.equal(leakedIntoMath.length, 0, 'Prose font-family selector must never match inside .katex');

    // Verify Force RTL selector also NEVER matches inside .katex or [data-rtl-math-only="true"]
    applyRtlMathPass(doc, { isRTL: true, directionMode: 'force', mathIsolation: true, mathPersianText: true });
    const forceMatch = css.match(/\.prose > :is[\s\S]*?label\[for\^="ask-opt-"\]/);
    assert.ok(forceMatch);
    const forcedNodes = [...doc.querySelectorAll(forceMatch[0])];
    assert.equal(forcedNodes.filter(el => el.closest('.katex, .katex-display')).length, 0);
    assert.equal(doc.querySelector('.katex-display').getAttribute('dir'), 'ltr');
});

test('extractProseText skips math and code cleanly', () => {
    const dom = new JSDOM(`
        <p id="sample">${renderFormula("x'_2 - x'_1 = 0")} <code>const a = 1;</code> یعنی دو رویداد هم‌مکان هستند.</p>
    `);
    const text = extractProseText(dom.window.document.getElementById('sample'));
    assert.equal(text.includes('const'), false);
    assert.equal(text.includes("x'"), false);
    assert.ok(text.includes('یعنی دو رویداد'));
    assert.equal(detectTextDirection(text, 'auto'), 'rtl');
});
