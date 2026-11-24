import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import * as asar from '@electron/asar';
import katex from 'katex';
import { JSDOM } from 'jsdom';

import { patchApp, restoreApp, getAppStatus } from '../src/patchers/patch-app.js';
import { patchIde, restoreIde, getIdeStatus, HOOK_IMPORT } from '../src/patchers/patch-ide.js';
import { installBrowserExtension, removeBrowserExtension, getBrowserStatus } from '../src/patchers/patch-browser.js';
import { buildDemoHtml } from '../src/core/build-demo.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ag-rtl-math-test-'));
const readUtils = (file) => {
    asar.uncache(file);
    return asar.extractFile(file, 'dist/utils.js').toString('utf8');
};

test('patchApp: fresh patch, legacy antigravity-rtl migration, status, and clean restore', async () => {
    const root = tmp();
    const src = path.join(root, 'src');
    fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
    const original = 'module.exports = (win, url) => {\n    void win.loadURL(url);\n};\n';
    fs.writeFileSync(path.join(src, 'dist', 'utils.js'), original);
    const asarPath = path.join(root, 'app.asar');
    await asar.createPackage(src, asarPath);

    assert.equal(getAppStatus(asarPath).patchState, 'clean');

    // Fresh patch
    assert.equal(await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true }), true);
    assert.equal(getAppStatus(asarPath).patchState, 'rtl-math');
    assert.equal(getAppStatus(asarPath).backupClean, true);

    // Idempotent re-patch
    assert.equal(await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true }), true);
    assert.equal(readUtils(asarPath).split('/* ANTIGRAVITY RTL MATH PATCH */').length - 1, 1);

    // Restore brings back byte-identical original
    assert.equal(await restoreApp(asarPath, { exitOnError: false, checkProcess: false }), true);
    assert.equal(readUtils(asarPath), original);

    // Simulate legacy mmnaderi/antigravity-rtl patch with missing backup
    const legacyPatched = original.replace(
        'void win.loadURL(url);',
        '/* ANTIGRAVITY RTL PATCH */\nconsole.log("old");\nvoid win.loadURL(url);\n/* END ANTIGRAVITY RTL PATCH */'
    );
    fs.writeFileSync(path.join(src, 'dist', 'utils.js'), legacyPatched);
    await asar.createPackage(src, asarPath);
    assert.equal(getAppStatus(asarPath).patchState, 'legacy-rtl');

    assert.equal(await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true }), true);
    assert.equal(getAppStatus(asarPath).patchState, 'rtl-math');
    assert.equal(readUtils(asarPath + '.bak'), original);
});

test('patchApp: injected utils.js executes valid JS in renderer and sanitizes config', async () => {
    const root = tmp();
    const src = path.join(root, 'src');
    fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(src, 'dist', 'utils.js'), 'module.exports = (win, url) => {\n    void win.loadURL(url);\n};\n');
    const asarPath = path.join(root, 'app.asar');
    await asar.createPackage(src, asarPath);
    await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true });

    const prevHome = process.env.HOME;
    const prevProfile = process.env.USERPROFILE;
    process.env.HOME = process.env.USERPROFILE = root;

    try {
        const configPath = path.join(root, '.antigravity-rtl.json');
        fs.writeFileSync(configPath, JSON.stringify({ faFont: '"><script>alert(1)</script>', enFont: 'Vazirmatn', mathScale: '1.15' }));

        const handlers = {};
        let injectedScript = '';
        const win = {
            loadURL() {},
            webContents: {
                on: (ev, fn) => { handlers[ev] = fn; },
                getURL: () => 'http://127.0.0.1:4321/',
                mainFrame: { framesInSubtree: [] },
                executeJavaScript: (code) => {
                    injectedScript = code;
                    return Promise.resolve();
                }
            }
        };

        const mod = { exports: {} };
        const fakeRequire = createRequire(import.meta.url);
        // Extract dist/ to temp so __dirname finds Vazirmatn-Variable.woff2
        const distExtract = path.join(root, 'extracted');
        asar.extractAll(asarPath, distExtract);
        new Function('module', 'require', '__dirname', readUtils(asarPath))(mod, fakeRequire, path.join(distExtract, 'dist'));
        mod.exports(win, 'http://127.0.0.1:4321/');

        handlers['dom-ready']();
        assert.doesNotThrow(() => new vm.Script(injectedScript), 'App renderer bundle must be valid JavaScript');
        assert.ok(injectedScript.includes('__agRtlMathLib'));
        assert.ok(injectedScript.includes('"enFont":"Vazirmatn"'));
        assert.equal(injectedScript.includes('<script>alert(1)</script>'), false);

        handlers['console-message']({}, 0, 'SAVE_RTL_CONFIG|{"fs":"20","faFont":"bad;css{}","mathDisplayAlign":"left"}');
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.equal(saved.fs, '20');
        assert.equal(saved.faFont, '');
        assert.equal(saved.mathDisplayAlign, 'left');
    } finally {
        process.env.HOME = prevHome;
        process.env.USERPROFILE = prevProfile;
    }
});

test('patchIde: patches multiple workbench HTMLs, validates client bundle, and restores cleanly', async () => {
    const appDir = tmp();
    const wbDir = path.join(appDir, 'out', 'vs', 'code', 'electron-browser', 'workbench');
    fs.mkdirSync(wbDir, { recursive: true });
    const mainJs = path.join(appDir, 'out', 'main.js');
    const wbHtml = path.join(wbDir, 'workbench.html');
    const jetskiHtml = path.join(wbDir, 'workbench-jetski-agent.html');
    fs.writeFileSync(mainJs, "console.log('ide-main');\n");
    fs.writeFileSync(wbHtml, `<meta content="font-src 'self';">`);
    fs.writeFileSync(jetskiHtml, `<meta content="font-src 'self';">`);

    assert.equal(getIdeStatus(appDir).patchState, 'clean');
    assert.equal(await patchIde(appDir, { exitOnError: false, checkProcess: false, silent: true }), true);
    assert.equal(getIdeStatus(appDir).patchState, 'rtl-math');

    assert.ok(fs.readFileSync(mainJs, 'utf8').startsWith(HOOK_IMPORT));
    assert.match(fs.readFileSync(wbHtml, 'utf8'), /font-src[\s\S]*data:/);
    assert.match(fs.readFileSync(jetskiHtml, 'utf8'), /font-src[\s\S]*data:/);

    const client = fs.readFileSync(path.join(appDir, 'out', 'antigravity-rtl-client.js'), 'utf8');
    const executableClient = client
        .replaceAll('__FONT_BASE64__', '')
        .replaceAll('__RTL_CONFIG__', '{}')
        .replaceAll('"__HIDE_TRIGGER__"', 'false');
    assert.doesNotThrow(() => new vm.Script(executableClient), 'IDE client bundle must be valid JavaScript');

    assert.equal(await restoreIde(appDir, { exitOnError: false, checkProcess: false }), true);
    assert.equal(fs.readFileSync(mainJs, 'utf8'), "console.log('ide-main');\n");
    assert.equal(fs.readFileSync(wbHtml, 'utf8'), `<meta content="font-src 'self';">`);
});

test('patchBrowser: installs MV3 extension, executes on JSDOM + KaTeX, and removes cleanly', () => {
    const extDir = path.join(tmp(), 'ext');
    installBrowserExtension({ openFolder: false, destDir: extDir });

    assert.ok(fs.existsSync(path.join(extDir, 'manifest.json')));
    assert.ok(fs.existsSync(path.join(extDir, 'content.js')));
    assert.ok(fs.existsSync(path.join(extDir, 'Vazirmatn-Variable.woff2')));

    const katexHtml = katex.renderToString(String.raw`\tilde{L} = L\gamma^{-1} \quad \text{انقباض طول}`, { displayMode: true });
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"><div class="prose leading-relaxed"><p id="p1">متن فارسی</p>${katexHtml}</div></div></body></html>`);

    const stored = {};
    const context = {
        window: dom.window,
        document: dom.window.document,
        navigator: dom.window.navigator,
        console,
        setTimeout,
        clearTimeout,
        MutationObserver: dom.window.MutationObserver,
        Event: dom.window.Event,
        chrome: {
            runtime: { getURL: (p) => `chrome-extension://test/${p}` },
            storage: {
                local: {
                    get: (_keys, cb) => cb(stored),
                    set: (obj) => Object.assign(stored, obj)
                }
            }
        }
    };
    context.globalThis = context;
    vm.runInNewContext(fs.readFileSync(path.join(extDir, 'content.js'), 'utf8'), context);

    assert.equal(dom.window.document.getElementById('p1').getAttribute('dir'), 'rtl');
    assert.equal(dom.window.document.querySelector('.katex-display').getAttribute('dir'), 'ltr');
    assert.ok(dom.window.document.getElementById('ag-rtl-topbar-btn'));

    assert.equal(removeBrowserExtension(extDir), true);
    assert.equal(getBrowserStatus().dir.length > 0, true);
});

test('buildDemoHtml produces valid offline playground with screenshot formulas', () => {
    const html = buildDemoHtml();
    assert.ok(html.includes('انقباض طول'));
    assert.ok(html.includes('اتساع (کش آمدن) زمان'));
    assert.ok(html.includes('__agRtlMathLib'));
});

test('patchApp supports Antigravity 2.35+ loadHubWindowUrl, lossless restore, and isolates browser localhost views', async () => {
    const root = tmp();
    try {
        const src = path.join(root, 'src');
        fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
        const original235 = [
            'function getHubWebContents(win) { return win && win._hubWc; }',
            'function getHubWindows() { return globalThis.__testHubWins || []; }',
            'function resolveActiveLsBaseUrl() { return "https://127.0.0.1:54321"; }',
            'function loadHubWindowUrl(win, url, opts) { return Promise.resolve([win, url, opts]); }',
            'function createWindow(win, url, options) {',
            '    const hubContents = getHubWebContents(win);',
            '    const skipBootstrapMint = Boolean(options?.partition);',
            '    void loadHubWindowUrl(win, url, { skipBootstrapMint });',
            '    return win;',
            '}',
            'module.exports = { createWindow, getHubWebContents };'
        ].join('\n');
        fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.35.0' }));
        fs.writeFileSync(path.join(src, 'dist', 'utils.js'), original235);
        const asarPath = path.join(root, 'app.asar');
        await asar.createPackage(src, asarPath);

        assert.equal(await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true }), true);
        const st = getAppStatus(asarPath);
        assert.equal(st.patchState, 'rtl-math');
        assert.equal(st.hookRevision, 4);
        assert.equal(st.backupClean, true);

        // Idempotent re-patch with missing .bak must still rebuild a byte-identical clean backup
        fs.unlinkSync(asarPath + '.bak');
        assert.equal(await patchApp(asarPath, { exitOnError: false, checkProcess: false, silent: true }), true);
        assert.equal(readUtils(asarPath).split('/* ANTIGRAVITY RTL MATH PATCH */').length - 1, 1);
        assert.equal(readUtils(asarPath + '.bak'), original235);

        // Execute patched utils.js in VM and verify Hub injection + built-in browser localhost isolation
        const distExtract = path.join(root, 'extracted');
        asar.extractAll(asarPath, distExtract);

        const appListeners = {};
        const fakeElectron = {
            app: {
                on: (ev, fn) => { appListeners[ev] = fn; }
            }
        };
        const nodeReq = createRequire(import.meta.url);
        const fakeRequire = id => (id === 'electron' ? fakeElectron : nodeReq(id));

        const hubHandlers = {};
        const hubExecs = [];
        const subframeExecs = [];
        const hubWc = {
            on: (ev, fn) => { hubHandlers[ev] = fn; },
            getURL: () => 'https://127.0.0.1:54321/#t=tok',
            getType: () => 'window',
            isDestroyed: () => false,
            mainFrame: null,
            executeJavaScript: (code) => {
                hubExecs.push(code);
                return Promise.resolve();
            }
        };
        const hubSubframe = {
            url: 'https://127.0.0.1:54321/worker-frame.html',
            executeJavaScript: (code) => {
                subframeExecs.push(code);
                return Promise.resolve();
            }
        };
        const devServerSubframe = {
            url: 'http://localhost:3000/preview',
            executeJavaScript: (code) => {
                subframeExecs.push(code);
                return Promise.resolve();
            }
        };
        hubWc.mainFrame = {
            url: 'https://127.0.0.1:54321/',
            framesInSubtree: []
        };
        hubWc.mainFrame.framesInSubtree = [hubWc.mainFrame, hubSubframe, devServerSubframe];

        const win = { _hubWc: hubWc };
        globalThis.__testHubWins = [win];
        delete globalThis.__agRtlAppHooked;
        delete globalThis.__agRtlHubOrigins;

        const mod = { exports: {} };
        new Function('module', 'require', '__dirname', readUtils(asarPath))(mod, fakeRequire, path.join(distExtract, 'dist'));
        mod.exports.createWindow(win, 'https://127.0.0.1:54321/', {});

        assert.ok(hubHandlers['dom-ready'], 'primary Hub WebContents must receive dom-ready hook');
        hubHandlers['dom-ready']();
        hubHandlers['did-frame-finish-load']();

        assert.equal(hubExecs.length, 1);
        assert.doesNotThrow(() => new vm.Script(hubExecs[0]));
        assert.equal(subframeExecs.length, 1, 'only Hub-origin subframe should be injected, not localhost:3000');

        // Simulate built-in browser WebContentsView navigating to user's dev server at localhost:3000
        const browserTabHandlers = {};
        const browserTabExecs = [];
        const browserTabWc = {
            on: (ev, fn) => { browserTabHandlers[ev] = fn; },
            getURL: () => 'http://localhost:3000/',
            getType: () => 'window',
            isDestroyed: () => false,
            mainFrame: { framesInSubtree: [] },
            executeJavaScript: (code) => {
                browserTabExecs.push(code);
                return Promise.resolve();
            }
        };
        appListeners['web-contents-created']({}, browserTabWc);
        browserTabHandlers['dom-ready']();
        browserTabHandlers['did-finish-load']();
        assert.equal(browserTabExecs.length, 0, 'built-in browser tab on localhost:3000 must NOT be injected');

        // Clean restore returns byte-identical original 2.35+ dist/utils.js
        assert.equal(await restoreApp(asarPath, { exitOnError: false, checkProcess: false }), true);
        assert.equal(readUtils(asarPath), original235);
    } finally {
        delete globalThis.__testHubWins;
        delete globalThis.__agRtlAppHooked;
        delete globalThis.__agRtlHubOrigins;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
