import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { DEFAULT_CONFIG, sanitizeConfig } from '../src/core/config.js';
import { buildDynamicCSS } from '../src/core/rtl-math-css.js';
import { applyRtlMathPass, detectTextDirection } from '../src/core/rtl-math-engine.js';
import { mountRtlMathController } from '../src/ui/settings-panel.js';

test('sanitizeConfig neutralizes XSS / CSS injection and clamps numeric bounds', () => {
    const dirty = {
        faFont: '"><img src=x onerror=alert(1)>',
        enFont: 'Inter; } body { display: none',
        codeFont: 'Fira Code',
        lh: '99',
        fs: '3',
        mathScale: '0.1',
        directionMode: 'unknown',
        mathDisplayAlign: 'justify',
        isRTL: 'yes'
    };

    const clean = sanitizeConfig(dirty);
    assert.equal(clean.faFont, '');
    assert.equal(clean.enFont, '');
    assert.equal(clean.codeFont, 'Fira Code');
    assert.equal(clean.lh, '3.0');
    assert.equal(clean.fs, '10');
    assert.equal(clean.mathScale, '0.75');
    assert.equal(clean.directionMode, DEFAULT_CONFIG.directionMode);
    assert.equal(clean.mathDisplayAlign, DEFAULT_CONFIG.mathDisplayAlign);
    assert.equal(clean.isRTL, DEFAULT_CONFIG.isRTL);

    const css = buildDynamicCSS(clean, '');
    assert.equal(css.includes('onerror'), false);
    assert.equal(css.includes('display: none'), false);
    assert.ok(css.includes('Fira Code'));
});

test('supports MathJax v3, MathML, lists, blockquotes, tables, and prompt inputs', () => {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div class="prose" data-testid="conversation-view">
                <ul id="rtl-list">
                    <li id="li-fa">نکته اول با <mjx-container><mjx-math><mjx-mtext>متن</mjx-mtext></mjx-math></mjx-container></li>
                </ul>
                <ol id="ltr-list">
                    <li id="li-en">First English step</li>
                </ol>
                <blockquote id="bq-fa">نقل قول فارسی</blockquote>
                <table id="tbl-fa">
                    <tr><th>نام</th><th>مقدار</th></tr>
                    <tr><td>سرعت</td><td><math><mi>v</mi></math></td></tr>
                </table>
                <mjx-container id="mjx-disp" display="true"><mjx-math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mjx-math></mjx-container>
            </div>
            <div contenteditable="true" id="prompt-box"><p id="prompt-p">سلام فرمول $x^2$</p></div>
            <textarea data-testid="ask-question-writein" id="ask-ta"></textarea>
        </body>
        </html>
    `);

    const doc = dom.window.document;
    const askTa = doc.getElementById('ask-ta');
    askTa.value = 'پاسخ فارسی';

    applyRtlMathPass(doc, { isRTL: true, directionMode: 'smart', mathIsolation: true, mathPersianText: true });

    assert.equal(doc.getElementById('rtl-list').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('li-fa').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('ltr-list').getAttribute('dir'), 'ltr');
    assert.equal(doc.getElementById('li-en').getAttribute('dir'), 'ltr');
    assert.equal(doc.getElementById('bq-fa').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('tbl-fa').getAttribute('dir'), 'rtl');
    assert.equal(doc.getElementById('mjx-disp').getAttribute('dir'), 'ltr');
    assert.equal(doc.querySelector('mjx-mtext').getAttribute('dir'), 'rtl');
    assert.equal(doc.querySelector('math').getAttribute('dir'), 'ltr');
    assert.equal(doc.getElementById('prompt-p').getAttribute('dir'), 'rtl');
    assert.equal(askTa.getAttribute('dir'), 'rtl');
});

test('detectTextDirection handles smart vs auto vs force modes accurately', () => {
    assert.equal(detectTextDirection('Time Dilation در فیزیک نسبیت است', 'smart'), 'rtl');
    assert.equal(detectTextDirection('Time Dilation در فیزیک نسبیت است', 'auto'), 'ltr');
    assert.equal(detectTextDirection('The word سلام means hello', 'smart'), 'ltr');
    assert.equal(detectTextDirection('English text', 'force'), 'rtl');
});

test('mountRtlMathController builds Pure-DOM UI without innerHTML and reacts to Alt+R & streaming mutations', async () => {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div class="topbar"><button data-testid="titlebar-more-actions"></button></div>
            <div class="prose"><p id="stream-p">Hello</p></div>
        </body>
        </html>
    `, { url: 'http://127.0.0.1:4500/' });

    const { window } = dom;
    const { document } = window;
    const savedConfigs = [];

    // Guard against any innerHTML assignments (Trusted Types compliance check)
    const origSet = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML').set;
    let innerHtmlCalls = 0;
    Object.defineProperty(window.Element.prototype, 'innerHTML', {
        set(val) {
            innerHtmlCalls++;
            return origSet.call(this, val);
        }
    });

    const controller = mountRtlMathController({
        doc: document,
        win: window,
        mode: 'app',
        initialConfig: { isRTL: true },
        onSaveConfig: (cfg) => savedConfigs.push(cfg)
    });

    assert.equal(innerHtmlCalls, 0, 'Settings panel must never assign innerHTML (Trusted Types safety)');
    assert.ok(document.getElementById('ag-rtl-topbar-btn'));
    assert.ok(document.getElementById('ag-rtl-panel'));
    assert.equal(document.getElementById('stream-p').getAttribute('dir'), 'ltr');

    // Simulate streaming update replacing content with Persian
    document.getElementById('stream-p').textContent = 'این متن در حال استریم است';
    await new Promise(r => setTimeout(r, 200));
    assert.equal(document.getElementById('stream-p').getAttribute('dir'), 'rtl');

    // Ctrl+Alt+R must NOT toggle (preserves VS Code AltGr / regex shortcut)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { altKey: true, ctrlKey: true, code: 'KeyR' }));
    assert.equal(controller.getState().isRTL, true);

    // Alt+R toggles RTL off and saves config
    document.dispatchEvent(new window.KeyboardEvent('keydown', { altKey: true, code: 'KeyR' }));
    assert.equal(controller.getState().isRTL, false);
    assert.equal(savedConfigs.at(-1).isRTL, false);

    // Language switch EN -> FA inside panel
    document.getElementById('ag-rtl-lang-btn').click();
    assert.equal(controller.getState().uiLang, 'fa');
    assert.equal(document.getElementById('ag-rtl-panel').style.direction, 'rtl');

    controller.destroy();
});
