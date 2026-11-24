/**
 * Remote Control Chrome/Arc/Edge unpacked MV3 browser extension installer & status checker.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import picocolors from 'picocolors';
import { buildRemoteExtensionScript } from '../core/client-bundle.js';
import { PKG_VERSION, isTempPath, updatePatchMeta } from '../core/meta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(SRC_ROOT, '..', 'assets');
const { green, yellow } = picocolors;

export function getBrowserExtensionDir(homeDir = os.homedir()) {
    return path.join(homeDir, '.antigravity-rtl-extension');
}

export function getBrowserStatus(destDir = getBrowserExtensionDir()) {
    const manifestPath = path.join(destDir, 'manifest.json');
    const contentPath = path.join(destDir, 'content.js');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(contentPath)) {
        return { installed: false, dir: destDir, patchState: 'not-installed', version: null };
    }
    const content = fs.readFileSync(contentPath, 'utf8');
    let version = null;
    try {
        version = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version || null;
    } catch (_) {}
    return {
        installed: true,
        dir: destDir,
        version,
        patchState: content.includes('__agRtlMathLib') ? 'rtl-math' : 'legacy-rtl'
    };
}

export function installBrowserExtension({ openFolder = true, destDir = getBrowserExtensionDir(), silent = false } = {}) {
    const manifestSrc = path.join(SRC_ROOT, 'extension', 'manifest.json');
    const fontSrc = path.join(ASSETS_DIR, 'Vazirmatn-Variable.woff2');
    const iconsDir = path.join(destDir, 'icons');

    fs.mkdirSync(iconsDir, { recursive: true });
    fs.copyFileSync(manifestSrc, path.join(destDir, 'manifest.json'));
    fs.writeFileSync(path.join(destDir, 'content.js'), buildRemoteExtensionScript(), 'utf8');
    fs.copyFileSync(fontSrc, path.join(destDir, 'Vazirmatn-Variable.woff2'));
    for (const iconName of ['icon-48.png', 'icon-128.png']) {
        const iconSrc = path.join(ASSETS_DIR, iconName);
        if (fs.existsSync(iconSrc)) {
            fs.copyFileSync(iconSrc, path.join(iconsDir, iconName));
        }
    }

    try {
        updatePatchMeta('browser', { path: destDir, patchVersion: PKG_VERSION });
    } catch (_) {}

    if (!silent) {
        console.log(green(`\nRemote Control extension (RTL + Math) ready:\n  ${destDir}\n`));
        console.log('In Chrome / Arc / Edge: open chrome://extensions, enable Developer Mode,');
        console.log('click "Load unpacked", and select the folder above. Reload the Remote tab.');
        console.log(yellow('Browser settings are stored in extension storage, separate from ~/.antigravity-rtl.json.\n'));
    }

    if (openFolder) {
        const openCmd = process.platform === 'darwin' ? `open "${destDir}"` : process.platform === 'win32' ? `explorer "${destDir}"` : `xdg-open "${destDir}"`;
        exec(openCmd, () => {});
    }
    return destDir;
}

export function removeBrowserExtension(destDir = getBrowserExtensionDir(), { silent = false } = {}) {
    if (!fs.existsSync(destDir)) return false;
    fs.rmSync(destDir, { recursive: true, force: true });
    try {
        if (!isTempPath(destDir)) updatePatchMeta('browser', null);
    } catch (_) {}
    if (!silent) {
        console.log(green(`Removed Remote Control extension folder: ${destDir}\n`));
    }
    return true;
}
