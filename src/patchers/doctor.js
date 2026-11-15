/**
 * Deep diagnostic checks (`--doctor`) across Node.js, assets, Standalone App ASAR, Antigravity IDE,
 * Remote Control extension, user config, and startup auto-heal guard.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfigFilePath, readPatchMeta, readUserConfig } from '../core/meta.js';
import { detectAppAsarPath, getAppStatus } from './patch-app.js';
import { detectIdeAppPath, getIdeStatus } from './patch-ide.js';
import { getBrowserExtensionDir, getBrowserStatus } from './patch-browser.js';
import { getGuardStatus } from './guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');

export function runDoctor({
    appPath = detectAppAsarPath(),
    ideDir = detectIdeAppPath(),
    homeDir = os.homedir(),
    browserDir = getBrowserExtensionDir(homeDir),
    guardOptions = {}
} = {}) {
    const checks = [];
    const add = (id, status, title, detail, fix = null) => checks.push({ id, status, title, detail, fix });

    // 1. Node.js runtime
    const major = Number(process.versions.node.split('.')[0]);
    if (major >= 20) {
        add('node', 'pass', 'Node.js runtime', `v${process.versions.node}`);
    } else {
        add('node', 'fail', 'Node.js runtime', `v${process.versions.node} (< 20.0.0)`, 'Install Node.js 20 LTS or newer.');
    }

    // 2. Bundled assets
    const requiredAssets = ['Vazirmatn-Variable.woff2', 'icon-48.png', 'icon-128.png'];
    const missingAssets = requiredAssets.filter(f => !fs.existsSync(path.join(ASSETS_DIR, f)));
    if (missingAssets.length === 0) {
        add('assets', 'pass', 'Bundled font & extension icons', 'All assets present');
    } else {
        add('assets', 'fail', 'Bundled font & extension icons', `Missing: ${missingAssets.join(', ')}`, 'Reinstall package from GitHub.');
    }

    // 3. Metadata & user config
    const cfgPath = getConfigFilePath(homeDir);
    if (fs.existsSync(cfgPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            const sanitized = readUserConfig(homeDir);
            add('config', 'pass', 'User config (~/.antigravity-rtl.json)', `Valid JSON (mode=${sanitized.directionMode}, fs=${sanitized.fs}px, lh=${sanitized.lh}, isRTL=${raw.isRTL ?? sanitized.isRTL})`);
        } catch (err) {
            add('config', 'warn', 'User config (~/.antigravity-rtl.json)', `Malformed JSON: ${err.message}`, 'Open panel or run --preset default to regenerate clean config.');
        }
    } else {
        add('config', 'pass', 'User config (~/.antigravity-rtl.json)', 'Using built-in defaults (created on first change)');
    }

    const meta = readPatchMeta(homeDir);

    // 4. Antigravity Standalone App
    const appSt = getAppStatus(appPath);
    if (!appSt.found) {
        add('app', 'warn', 'Antigravity Standalone App', 'Not detected on default paths', 'Pass --path <path/to/app.asar> if installed in a custom directory.');
    } else {
        const writeOk = (() => {
            try { fs.accessSync(path.dirname(appSt.path), fs.constants.W_OK); return true; } catch (_) { return false; }
        })();
        if (appSt.patchState === 'rtl-math' && appSt.hookRevision >= 3 && appSt.backupClean) {
            add('app', writeOk ? 'pass' : 'warn', 'Antigravity Standalone App', `Patched v3 (app v${appSt.appVersion || '?'}) + clean backup` + (writeOk ? '' : ' — folder requires elevation'));
        } else if (appSt.patchState === 'rtl-math' && appSt.hookRevision < 3) {
            add('app', 'warn', 'Antigravity Standalone App', `Older v${appSt.hookRevision} hook detected (missing multi-window & safe-zone upgrades)`, 'Close Antigravity and run with --app to upgrade to v3.');
        } else if (appSt.patchState === 'legacy-rtl') {
            add('app', 'warn', 'Antigravity Standalone App', 'Legacy antigravity-rtl patch detected (lacks Math Isolation)', 'Close Antigravity and run patcher to migrate.');
        } else if (appSt.patchState === 'clean') {
            const wipedByUpdate = Boolean(meta.app);
            add('app', 'warn', 'Antigravity Standalone App', wipedByUpdate ? `Unpatched (looks overwritten by app update to v${appSt.appVersion || '?'})` : `Unpatched (app v${appSt.appVersion || '?'})`, 'Close Antigravity and run patcher (or enable --install-guard).');
        } else {
            add('app', 'fail', 'Antigravity Standalone App', `Unexpected state: ${appSt.patchState}`, 'Re-run --app patch or --restore.');
        }
    }

    // 5. Antigravity IDE
    const ideSt = getIdeStatus(ideDir);
    if (!ideSt.found) {
        add('ide', 'pass', 'Antigravity IDE', 'Not installed (skipped)');
    } else if (ideSt.patchState === 'rtl-math' && ideSt.hookRevision >= 3) {
        add('ide', 'pass', 'Antigravity IDE', 'Patched v3 + clean backup');
    } else {
        add('ide', 'warn', 'Antigravity IDE', `State: ${ideSt.patchState} (rev ${ideSt.hookRevision})`, 'Close Antigravity IDE and run with --ide.');
    }

    // 6. Browser Extension
    const brSt = getBrowserStatus(browserDir);
    if (!brSt.installed) {
        add('browser', 'pass', 'Remote Control Extension', 'Not installed (optional — run --browser to generate)');
    } else if (brSt.patchState === 'rtl-math' && brSt.version === '3.0.0') {
        add('browser', 'pass', 'Remote Control Extension', `Ready v${brSt.version} at ${brSt.dir}`);
    } else {
        add('browser', 'warn', 'Remote Control Extension', `Older version (${brSt.version || 'legacy'})`, 'Run --browser to refresh extension files.');
    }

    // 7. Auto-Heal Guard
    const gSt = getGuardStatus({ homeDir, ...guardOptions });
    if (gSt.installed) {
        add('guard', 'pass', 'Auto-Heal Startup Guard', `Enabled (${gSt.kind})`);
    } else {
        add('guard', 'warn', 'Auto-Heal Startup Guard', 'Disabled (app updates will reset patch until re-run)', 'Run with --install-guard to enable automatic post-update healing.');
    }

    const summary = {
        pass: checks.filter(c => c.status === 'pass').length,
        warn: checks.filter(c => c.status === 'warn').length,
        fail: checks.filter(c => c.status === 'fail').length
    };

    return { ok: summary.fail === 0, summary, checks };
}
