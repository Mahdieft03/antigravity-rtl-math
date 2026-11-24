import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as asar from '@electron/asar';
import { JSDOM } from 'jsdom';

import { PRESETS, applyPreset } from '../src/core/config.js';
import { applyRtlMathPass } from '../src/core/rtl-math-engine.js';
import { mountRtlMathController } from '../src/ui/settings-panel.js';
import { patchApp, getAppStatus } from '../src/patchers/patch-app.js';
import { getIdeStatus } from '../src/patchers/patch-ide.js';
import { installBrowserExtension, getBrowserStatus } from '../src/patchers/patch-browser.js';
import {
    buildGuardPayload,
    ensurePatched,
    getGuardStatus,
    getGuardTarget,
    installGuard,
    removeGuard
} from '../src/patchers/guard.js';
import { runDoctor } from '../src/patchers/doctor.js';
import { compareSemver, selfUpdateFromGitHub } from '../src/patchers/self-update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function mkTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('PRESETS & applyPreset produce clean sanitized configs', () => {
    const base = { uiLang: 'fa', directionMode: 'smart', fs: '16', lh: '1.6' };
    const reading = applyPreset(base, 'reading');
    assert.equal(reading.fs, PRESETS.reading.fs);
    assert.equal(reading.lh, PRESETS.reading.lh);
    assert.equal(reading.mathScale, PRESETS.reading.mathScale);
    assert.equal(reading.uiLang, 'fa');

    const compact = applyPreset(reading, 'compact');
    assert.equal(compact.fs, '14');
    assert.equal(compact.lh, '1.4');

    const fallback = applyPreset(base, 'nonexistent');
    assert.equal(fallback.fs, '16');
});

test('Settings panel mounts in floating safe zone, handles presets, and self-heals when removed', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="prose">
            <p>در محاسبه خطای فرمول <span class="katex-error">\\invalid_{x</span> متن فارسی همچنان راست‌چین است.</p>
        </div>
    </body></html>`, { url: 'http://127.0.0.1:4444/' });

    const { window: win } = dom;
    const doc = win.document;

    const controller = mountRtlMathController({
        doc,
        win,
        mode: 'app',
        initialConfig: {}
    });

    try {
        const trigger = doc.getElementById('ag-rtl-topbar-btn');
        assert.ok(trigger, 'floating trigger must mount even without titlebar cluster');
        assert.equal(trigger.classList.contains('ag-rtl-floating'), true);
        assert.equal(Number.parseInt(trigger.style.top, 10) >= 42, true, 'must stay clear of Windows 30px titleBarOverlay');
        assert.ok(doc.getElementById('ag-rtl-dynamic-style'), 'dynamic style sheet must mount');

        // Verify .katex-error shield
        applyRtlMathPass(doc, controller.getState());
        const kerr = doc.querySelector('.katex-error');
        assert.equal(kerr.getAttribute('dir'), 'ltr');

        // Preset switching via Pure-DOM panel button
        const readingBtn = doc.getElementById('ag-rtl-preset-reading');
        assert.ok(readingBtn);
        readingBtn.click();
        assert.equal(controller.getState().fs, '17');
        assert.equal(controller.getState().lh, '1.9');

        // Simulate React stripping injected UI nodes during navigation/hydration
        trigger.remove();
        doc.getElementById('ag-rtl-dynamic-style').remove();
        assert.equal(doc.getElementById('ag-rtl-topbar-btn'), null);

        // MutationObserver microtask/debounced auto-recovery
        await new Promise(resolve => setTimeout(resolve, 200));
        assert.ok(doc.getElementById('ag-rtl-topbar-btn'), 'watchDom must automatically recover removed trigger');
        assert.ok(doc.getElementById('ag-rtl-dynamic-style'), 'watchDom must automatically recover removed dynamic style');

        // Re-entrant manual ensureMounted also keeps singleton cleanly alive
        controller.ensureMounted();
        assert.equal(doc.querySelectorAll('#ag-rtl-topbar-btn').length, 1);
    } finally {
        controller.destroy();
        dom.window.close();
    }
});

test('app-hook registers listeners BEFORE loadURL and sets hookRevision >= 3', async () => {
    const tmp = mkTempDir('ag-rtl-apphook-');
    try {
        const extractSrc = path.join(tmp, 'src');
        const distDir = path.join(extractSrc, 'dist');
        fs.mkdirSync(distDir, { recursive: true });
        fs.writeFileSync(path.join(extractSrc, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.99.0' }));
        fs.writeFileSync(path.join(distDir, 'utils.js'), 'function boot(win, url) {\n    void win.loadURL(url);\n}\n');
        const asarPath = path.join(tmp, 'app.asar');
        await asar.createPackage(extractSrc, asarPath);

        const ok = await patchApp(asarPath, { checkProcess: false, silent: true });
        assert.equal(ok, true);

        const st = getAppStatus(asarPath);
        assert.equal(st.patchState, 'rtl-math');
        assert.equal(st.hookRevision, 4);
        assert.equal(st.appVersion, '2.99.0');

        const verifyDir = path.join(tmp, 'verify');
        asar.extractAll(asarPath, verifyDir);
        const patchedUtils = fs.readFileSync(path.join(verifyDir, 'dist', 'utils.js'), 'utf8');

        const eventOrder = [];
        const wcListeners = {};
        const appListeners = {};
        const executedScripts = [];

        const mockWin = {
            loadURL(u) {
                eventOrder.push('loadURL:' + u);
                // Even if loadURL fires dom-ready/did-finish-load synchronously right after,
                // listeners MUST already be registered!
                if (wcListeners['dom-ready']) wcListeners['dom-ready']();
                if (wcListeners['did-finish-load']) wcListeners['did-finish-load']();
            },
            webContents: {
                on(ev, fn) {
                    eventOrder.push('on:' + ev);
                    wcListeners[ev] = fn;
                },
                getURL: () => 'http://127.0.0.1:4567/',
                getType: () => 'window',
                isDestroyed: () => false,
                mainFrame: { framesInSubtree: [] },
                executeJavaScript(code) {
                    executedScripts.push(code);
                    return Promise.resolve();
                }
            }
        };

        const fakeElectron = {
            app: {
                on(ev, fn) { appListeners[ev] = fn; }
            }
        };
        const nodeReq = createRequire(import.meta.url);
        const fakeRequire = id => (id === 'electron' ? fakeElectron : nodeReq(id));

        delete globalThis.__agRtlAppHooked;
        const fn = new Function('win', 'url', 'require', '__dirname', `${patchedUtils}\nboot(win, url);`);
        fn(mockWin, 'http://127.0.0.1:4567/', fakeRequire, distDir);

        const loadIdx = eventOrder.findIndex(e => e.startsWith('loadURL:'));
        assert.ok(loadIdx > 0, 'listeners must be attached BEFORE win.loadURL');
        assert.ok(wcListeners['dom-ready']);
        assert.ok(wcListeners['did-finish-load']);
        assert.ok(wcListeners['did-navigate-in-page']);
        assert.ok(wcListeners['did-frame-finish-load']);
        assert.ok(typeof appListeners['web-contents-created'] === 'function');
        assert.ok(executedScripts.length >= 2, 'must inject across both dom-ready and did-finish-load');
        delete globalThis.__agRtlAppHooked;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('Auto-Heal Startup Guard works cross-platform in temp dirs and ensurePatched heals targets', async () => {
    const tmp = mkTempDir('ag-rtl-guard-');
    try {
        const homeDir = path.join(tmp, 'home');
        fs.mkdirSync(homeDir, { recursive: true });

        // Guard install / status / remove across win32, darwin, linux
        for (const plat of ['win32', 'darwin', 'linux']) {
            const subDir = path.join(tmp, `guard-${plat}`);
            const target = getGuardTarget(plat, { customDir: subDir });
            const installed = installGuard({ platform: plat, customDir: subDir, homeDir });
            assert.equal(installed.filePath, target.filePath);
            assert.equal(fs.existsSync(target.filePath), true);

            const st = getGuardStatus({ platform: plat, customDir: subDir });
            assert.equal(st.installed, true);
            assert.equal(st.kind, target.kind);

            const rem = removeGuard({ platform: plat, customDir: subDir, homeDir });
            assert.equal(rem.removed, true);
            assert.equal(fs.existsSync(target.filePath), false);
        }

        const plist = buildGuardPayload('launchd', '/usr/bin/node', '/app/src/cli.js');
        assert.match(plist, /--ensure/);
        const vbs = buildGuardPayload('vbs-startup', 'C:\\node.exe', 'C:\\cli.js');
        assert.match(vbs, /--ensure --silent/);

        // ensurePatched heals temp App & temp IDE cleanly, then reports upToDate on 2nd run
        const appSrc = path.join(tmp, 'app-src');
        fs.mkdirSync(path.join(appSrc, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(appSrc, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.32.1' }));
        fs.writeFileSync(path.join(appSrc, 'dist', 'utils.js'), 'void win.loadURL(url);\n');
        const asarPath = path.join(tmp, 'app.asar');
        await asar.createPackage(appSrc, asarPath);

        const ideDir = path.join(tmp, 'ide-app');
        fs.mkdirSync(path.join(ideDir, 'out'), { recursive: true });
        fs.writeFileSync(path.join(ideDir, 'package.json'), JSON.stringify({ main: './out/main.js' }));
        fs.writeFileSync(path.join(ideDir, 'out', 'main.js'), 'console.log("ide");\n');

        const first = await ensurePatched({ appPath: asarPath, ideDir, checkProcess: false, silent: true });
        assert.equal(first.ok, true);
        assert.equal(first.actions.length, 2);
        assert.equal(first.actions.every(a => a.healed === true), true);
        assert.equal(getAppStatus(asarPath).hookRevision, 4);
        assert.equal(getIdeStatus(ideDir).hookRevision, 4);

        const second = await ensurePatched({ appPath: asarPath, ideDir, checkProcess: false, silent: true });
        assert.equal(second.ok, true);
        assert.equal(second.actions.every(a => a.healed === false && a.upToDate === true), true);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('runDoctor and installBrowserExtension v3 (including PNG icons) report healthy state', async () => {
    const tmp = mkTempDir('ag-rtl-doc-');
    try {
        const homeDir = path.join(tmp, 'home');
        fs.mkdirSync(homeDir, { recursive: true });

        const appSrc = path.join(tmp, 'app-src');
        fs.mkdirSync(path.join(appSrc, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(appSrc, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.32.1' }));
        fs.writeFileSync(path.join(appSrc, 'dist', 'utils.js'), 'void win.loadURL(url);\n');
        const asarPath = path.join(tmp, 'app.asar');
        await asar.createPackage(appSrc, asarPath);
        await patchApp(asarPath, { checkProcess: false, silent: true });

        const browserDir = path.join(tmp, 'ext');
        installBrowserExtension({ destDir: browserDir, openFolder: false, silent: true });
        assert.equal(fs.existsSync(path.join(browserDir, 'icons', 'icon-48.png')), true);
        assert.equal(fs.existsSync(path.join(browserDir, 'icons', 'icon-128.png')), true);
        assert.equal(getBrowserStatus(browserDir).version, '3.1.0');

        const customGuardDir = path.join(tmp, 'guard');
        installGuard({ customDir: customGuardDir, homeDir });

        const report = runDoctor({
            appPath: asarPath,
            ideDir: null,
            homeDir,
            browserDir,
            guardOptions: { customDir: customGuardDir }
        });

        assert.equal(report.ok, true);
        assert.equal(report.summary.fail, 0);
        assert.equal(report.summary.warn, 0);
        assert.ok(report.checks.every(c => c.status === 'pass'));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('compareSemver & selfUpdateFromGitHub extract release tarball cleanly preserving node_modules', async () => {
    assert.equal(compareSemver('3.0.0', '2.0.0'), 1);
    assert.equal(compareSemver('3.0.0', '3.0.0'), 0);
    assert.equal(compareSemver('2.9.9', '3.0.0'), -1);

    const tmp = mkTempDir('ag-rtl-selfupd-');
    try {
        const targetRoot = path.join(tmp, 'target');
        const keepNm = path.join(targetRoot, 'node_modules', 'sentinel');
        fs.mkdirSync(keepNm, { recursive: true });
        fs.writeFileSync(path.join(keepNm, 'index.js'), '// keep');
        fs.writeFileSync(path.join(targetRoot, 'package.json'), JSON.stringify({
            name: 'antigravity-rtl-math',
            version: '3.0.0',
            dependencies: { picocolors: '^1.1.1' }
        }));

        const srcBundle = path.join(tmp, 'bundle-src', 'antigravity-rtl-math-3.1.0');
        fs.mkdirSync(path.join(srcBundle, 'src'), { recursive: true });
        fs.writeFileSync(path.join(srcBundle, 'package.json'), JSON.stringify({
            name: 'antigravity-rtl-math',
            version: '3.1.0',
            dependencies: { picocolors: '^1.1.1' }
        }));
        fs.writeFileSync(path.join(srcBundle, 'src', 'marker.txt'), 'updated-3.1.0');

        const tgzPath = path.join(tmp, 'release.tar.gz');
        execFileSync('tar', ['-czf', tgzPath, '-C', path.join(tmp, 'bundle-src'), 'antigravity-rtl-math-3.1.0']);
        const tgzBuf = fs.readFileSync(tgzPath);

        const mockFetch = async url => {
            if (url.includes('/releases/latest')) {
                return {
                    ok: true,
                    json: async () => ({
                        tag_name: 'v3.1.0',
                        tarball_url: 'https://example.test/release.tar.gz',
                        html_url: 'https://github.com/Mahdieft03/antigravity-rtl-math/releases/tag/v3.1.0'
                    })
                };
            }
            return {
                ok: true,
                arrayBuffer: async () => tgzBuf.buffer.slice(tgzBuf.byteOffset, tgzBuf.byteOffset + tgzBuf.byteLength)
            };
        };

        const res = await selfUpdateFromGitHub({ targetRoot, fetchImpl: mockFetch });
        assert.equal(res.updated, true);
        assert.equal(res.currentVersion, '3.0.0');
        assert.equal(res.remoteVersion, '3.1.0');
        assert.equal(fs.readFileSync(path.join(targetRoot, 'src', 'marker.txt'), 'utf8'), 'updated-3.1.0');
        assert.equal(fs.existsSync(path.join(keepNm, 'index.js')), true);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('CLI supports --version --json, --status --json, and --doctor --json cleanly', () => {
    const tmpHome = mkTempDir('ag-rtl-clihome-');
    try {
        const env = { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome };
        const verOut = execFileSync(process.execPath, [path.join(REPO_ROOT, 'src', 'cli.js'), '--version', '--json'], { encoding: 'utf8', env });
        const verJson = JSON.parse(verOut);
        assert.equal(verJson.version, '3.1.0');

        const statusOut = execFileSync(process.execPath, [path.join(REPO_ROOT, 'src', 'cli.js'), '--status', '--json'], { encoding: 'utf8', env });
        const statusJson = JSON.parse(statusOut);
        assert.equal(statusJson.version, '3.1.0');
        assert.ok(statusJson.targets && statusJson.guard && statusJson.config);

        const docOut = execFileSync(process.execPath, [path.join(REPO_ROOT, 'src', 'cli.js'), '--doctor', '--json'], { encoding: 'utf8', env });
        const docJson = JSON.parse(docOut);
        assert.equal(docJson.ok, true);
        assert.ok(Array.isArray(docJson.checks) && docJson.checks.length >= 6);
    } finally {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    }
});

test('ensurePatched upgrades v3.0.0 hook to v4 and reports accurate error/failure on missing utils or anchor', async () => {
    const tmp = mkTempDir('ag-rtl-upgrade-err-');
    try {
        // 1. Upgrade a simulated v3.0.0-patched ASAR to hookRevision 4
        const v3Src = path.join(tmp, 'v3-src');
        fs.mkdirSync(path.join(v3Src, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(v3Src, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.30.0' }));
        fs.writeFileSync(
            path.join(v3Src, 'dist', 'utils.js'),
            '/* ANTIGRAVITY RTL MATH PATCH */\nconst __agRtlAppHooked = true;\nvoid win.loadURL(url);\n/* END ANTIGRAVITY RTL MATH PATCH */\n'
        );
        const v3Asar = path.join(tmp, 'v3.asar');
        await asar.createPackage(v3Src, v3Asar);
        assert.equal(getAppStatus(v3Asar).hookRevision, 3);

        const upgraded = await ensurePatched({ appPath: v3Asar, ideDir: null, checkProcess: false, silent: true });
        assert.equal(upgraded.ok, true);
        assert.equal(upgraded.actions[0].healed, true);
        assert.equal(getAppStatus(v3Asar).hookRevision, 4);

        // 2. Missing dist/utils.js vs missing anchor produce distinct errors and ok: false
        const noUtilsSrc = path.join(tmp, 'no-utils');
        fs.mkdirSync(noUtilsSrc, { recursive: true });
        fs.writeFileSync(path.join(noUtilsSrc, 'package.json'), JSON.stringify({ name: 'antigravity', version: '9.9.9' }));
        const noUtilsAsar = path.join(tmp, 'no-utils.asar');
        await asar.createPackage(noUtilsSrc, noUtilsAsar);

        const noAnchorSrc = path.join(tmp, 'no-anchor');
        fs.mkdirSync(path.join(noAnchorSrc, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(noAnchorSrc, 'package.json'), JSON.stringify({ name: 'antigravity', version: '9.9.9' }));
        fs.writeFileSync(path.join(noAnchorSrc, 'dist', 'utils.js'), 'function other() {}\n');
        const noAnchorAsar = path.join(tmp, 'no-anchor.asar');
        await asar.createPackage(noAnchorSrc, noAnchorAsar);

        const origErr = console.error;
        const captured = [];
        console.error = (...args) => captured.push(args.join(' '));
        try {
            const failMissingUtils = await ensurePatched({ appPath: noUtilsAsar, ideDir: null, checkProcess: false, silent: true });
            assert.equal(failMissingUtils.ok, false);
            assert.equal(failMissingUtils.actions[0].failed, true);

            const failMissingAnchor = await ensurePatched({ appPath: noAnchorAsar, ideDir: null, checkProcess: false, silent: true });
            assert.equal(failMissingAnchor.ok, false);
            assert.equal(failMissingAnchor.actions[0].failed, true);
        } finally {
            console.error = origErr;
        }

        const errText = captured.join('\n');
        assert.match(errText, /dist\/utils\.js not found in ASAR/);
        assert.match(errText, /Supported window load anchor not found in dist\/utils\.js \(Antigravity v9\.9\.9\)/);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
