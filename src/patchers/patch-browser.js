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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(SRC_ROOT, '..', 'assets');
const { green, yellow } = picocolors;

export function getBrowserExtensionDir() {
    return path.join(os.homedir(), '.antigravity-rtl-extension');
}

export function getBrowserStatus() {
    const dir = getBrowserExtensionDir();
    const manifestPath = path.join(dir, 'manifest.json');
    const contentPath = path.join(dir, 'content.js');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(contentPath)) {
        return { installed: false, dir, patchState: 'not-installed' };
    }
    const content = fs.readFileSync(contentPath, 'utf8');
    return {
        installed: true,
        dir,
        patchState: content.includes('__agRtlMathLib') ? 'rtl-math' : 'legacy-rtl'
    };
}

export function installBrowserExtension({ openFolder = true, destDir = getBrowserExtensionDir() } = {}) {
    const manifestSrc = path.join(SRC_ROOT, 'extension', 'manifest.json');
    const fontSrc = path.join(ASSETS_DIR, 'Vazirmatn-Variable.woff2');

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(manifestSrc, path.join(destDir, 'manifest.json'));
    fs.writeFileSync(path.join(destDir, 'content.js'), buildRemoteExtensionScript(), 'utf8');
    fs.copyFileSync(fontSrc, path.join(destDir, 'Vazirmatn-Variable.woff2'));

    console.log(green(`\nRemote Control extension (RTL + Math) ready:\n  ${destDir}\n`));
    console.log('In Chrome / Arc / Edge: open chrome://extensions, enable Developer Mode,');
    console.log('click "Load unpacked", and select the folder above. Reload the Remote tab.');
    console.log(yellow('Browser settings are stored in extension storage, separate from ~/.antigravity-rtl.json.\n'));

    if (openFolder) {
        const openCmd = process.platform === 'darwin' ? `open "${destDir}"` : process.platform === 'win32' ? `explorer "${destDir}"` : `xdg-open "${destDir}"`;
        exec(openCmd, () => {});
    }
    return destDir;
}

export function removeBrowserExtension(destDir = getBrowserExtensionDir()) {
    if (!fs.existsSync(destDir)) return false;
    fs.rmSync(destDir, { recursive: true, force: true });
    console.log(green(`Removed Remote Control extension folder: ${destDir}\n`));
    return true;
}
