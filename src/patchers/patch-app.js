/**
 * Antigravity Standalone App (Electron app.asar) patcher, migrator, restorer, and status inspector.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import picocolors from 'picocolors';
import ora from 'ora';
import prompts from 'prompts';
import * as asar from '@electron/asar';
import { buildElectronClientScript } from '../core/client-bundle.js';
import { CURRENT_HOOK_REVISION, PKG_VERSION, isTempPath, updatePatchMeta } from '../core/meta.js';
import { renderAppHookSnippet } from '../targets/app-hook.js';
import { checkRunningAntigravity } from './process-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');
const FONT_SOURCE = path.join(ASSETS_DIR, 'Vazirmatn-Variable.woff2');
const { blue, green, red, yellow } = picocolors;

export const PATCH_START = '/* ANTIGRAVITY RTL MATH PATCH */';
export const PATCH_END = '/* END ANTIGRAVITY RTL MATH PATCH */';
export const LEGACY_PATCH_START = '/* ANTIGRAVITY RTL PATCH */';
const LEGACY_ANCHOR = 'void win.loadURL(url);';

export const ANCHOR_PATTERNS = [
    /(?:void|await)\s+loadHubWindowUrl\(\s*win\s*,\s*url\b[^;\r\n]*\);/,
    /(?:void|await)\s+win\.loadURL\(\s*url\b[^;\r\n]*\);/,
    /(?:void|await)\s+hubContents\.loadURL\(\s*url\b[^;\r\n]*\);/
];

const NEW_PATCH_BLOCK = /\/\* ANTIGRAVITY RTL MATH PATCH \*\/[\s\S]*?\/\* END ANTIGRAVITY RTL MATH PATCH \*\//;
const LEGACY_PATCH_BLOCK = /\/\* ANTIGRAVITY RTL PATCH \*\/[\s\S]*?\/\* END ANTIGRAVITY RTL PATCH \*\//;
const ORIG_ANCHOR_MARKER_RE = /\/\* AG_RTL_ORIG_ANCHOR_START \*\/([\s\S]*?)\/\* AG_RTL_ORIG_ANCHOR_END \*\//;

export function findInjectionAnchor(code) {
    for (const re of ANCHOR_PATTERNS) {
        const m = code.match(re);
        if (m) return m[0];
    }
    return null;
}

function readUtils(asarFile) {
    asar.uncache(asarFile);
    try {
        return asar.extractFile(asarFile, 'dist/utils.js').toString('utf8');
    } catch (err) {
        throw Object.assign(
            new Error('dist/utils.js not found in ASAR. Unsupported Antigravity version.'),
            { code: 'ERR_UTILS_MISSING', cause: err }
        );
    }
}

function hasAnyPatch(code) {
    return code.includes(PATCH_START) || code.includes(LEGACY_PATCH_START);
}

function stripAnyPatch(code) {
    if (NEW_PATCH_BLOCK.test(code)) {
        const block = code.match(NEW_PATCH_BLOCK)[0];
        const origMatch = block.match(ORIG_ANCHOR_MARKER_RE);
        const restored = origMatch ? origMatch[1] : LEGACY_ANCHOR;
        return code.replace(NEW_PATCH_BLOCK, () => restored);
    }
    if (LEGACY_PATCH_BLOCK.test(code)) {
        return code.replace(LEGACY_PATCH_BLOCK, () => LEGACY_ANCHOR);
    }
    return null;
}

export function getAppCandidatePaths() {
    const candidates = [];
    const platform = os.platform();

    if (platform === 'darwin') {
        candidates.push('/Applications/Antigravity.app/Contents/Resources/app.asar');
        candidates.push(path.join(os.homedir(), 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar'));
    } else if (platform === 'win32') {
        if (process.env.LOCALAPPDATA) {
            candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'resources', 'app.asar'));
            candidates.push(path.join(process.env.LOCALAPPDATA, 'Antigravity', 'resources', 'app.asar'));
        }
        if (process.env.PROGRAMFILES) {
            candidates.push(path.join(process.env.PROGRAMFILES, 'Antigravity', 'resources', 'app.asar'));
        }
        if (process.env['PROGRAMFILES(X86)']) {
            candidates.push(path.join(process.env['PROGRAMFILES(X86)'], 'Antigravity', 'resources', 'app.asar'));
        }
    } else {
        candidates.push('/opt/Antigravity/resources/app.asar');
        candidates.push('/opt/antigravity/resources/app.asar');
        candidates.push('/usr/share/antigravity/resources/app.asar');
        candidates.push(path.join(os.homedir(), '.local', 'share', 'antigravity', 'resources', 'app.asar'));
    }
    return candidates;
}

export function detectAppAsarPath() {
    return getAppCandidatePaths().find(c => fs.existsSync(c)) || null;
}

export function hasAppBackup(asarPath) {
    return asarPath ? fs.existsSync(asarPath + '.bak') : false;
}

export function readInstalledAppVersion(asarPath) {
    try {
        const versionFile = path.resolve(path.dirname(asarPath), '..', 'version');
        if (fs.existsSync(versionFile)) {
            const v = fs.readFileSync(versionFile, 'utf8').trim();
            if (v) return v;
        }
    } catch (_) {}
    try {
        asar.uncache(asarPath);
        const pkg = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'));
        if (pkg && pkg.version) return String(pkg.version);
    } catch (_) {}
    return null;
}

export function getAppStatus(asarPath = detectAppAsarPath()) {
    if (!asarPath || !fs.existsSync(asarPath)) {
        return { found: false, path: null, patchState: 'not-found', hookRevision: 0, appVersion: null, hasBackup: false, backupClean: false };
    }
    const backupPath = asarPath + '.bak';
    const hasBackup = fs.existsSync(backupPath);
    let patchState = 'unknown';
    let hookRevision = 0;
    let backupClean = false;

    try {
        const utils = readUtils(asarPath);
        if (utils.includes(PATCH_START)) {
            patchState = 'rtl-math';
            hookRevision = utils.includes('__agRtlHookRev = 4')
                ? 4
                : (utils.includes('__agRtlAppHooked') ? 3 : 2);
        } else if (utils.includes(LEGACY_PATCH_START)) {
            patchState = 'legacy-rtl';
            hookRevision = 1;
        } else {
            patchState = 'clean';
        }
    } catch (_) {}

    if (hasBackup) {
        try {
            const bakUtils = readUtils(backupPath);
            backupClean = !hasAnyPatch(bakUtils);
        } catch (_) {}
    }

    return {
        found: true,
        path: asarPath,
        patchState,
        hookRevision,
        appVersion: readInstalledAppVersion(asarPath),
        hasBackup,
        backupClean
    };
}

export async function getAppAsarPath() {
    const detected = detectAppAsarPath();
    if (detected) {
        console.log(blue('ℹ Found Antigravity (Standalone App) at:'));
        console.log(`  ${detected}\n`);
        return detected;
    }

    console.log(yellow('⚠ Could not find Antigravity (Standalone App) at default location.'));
    const response = await prompts({
        type: 'text',
        name: 'customPath',
        message: 'Please enter the full path to app.asar:'
    });

    if (!response.customPath || !fs.existsSync(response.customPath)) {
        console.error(red('\n✖ Invalid path. Aborting.\n'));
        process.exit(1);
    }
    return response.customPath;
}

export async function restoreApp(asarPath, { exitOnError = true, checkProcess = true } = {}) {
    const backupPath = asarPath + '.bak';
    if (!fs.existsSync(backupPath)) {
        console.error(red('✖ No backup found for Antigravity (Standalone App) to restore.\n'));
        if (exitOnError) process.exit(1);
        return false;
    }

    if (checkProcess) {
        const proc = checkRunningAntigravity('app');
        if (proc.running) {
            console.error(yellow(`⚠ Antigravity appears to be running (${proc.processes.join(', ')}). Please close it completely before restoring.\n`));
            if (exitOnError) process.exit(1);
            return false;
        }
    }

    const spinner = ora('Restoring original Antigravity app.asar...').start();
    try {
        if (hasAnyPatch(readUtils(backupPath))) {
            spinner.fail('The backup is itself patched. Run the patcher once to rebuild a clean backup, or reinstall Antigravity.\n');
            if (exitOnError) process.exit(1);
            return false;
        }
        fs.copyFileSync(backupPath, asarPath);
        asar.uncache(asarPath);
        fs.unlinkSync(backupPath);
        try { if (!isTempPath(asarPath)) updatePatchMeta('app', null); } catch (_) {}
        spinner.succeed('Successfully restored original Antigravity (Standalone App)!\n');
        return true;
    } catch (e) {
        spinner.fail('Failed to restore Antigravity.');
        console.error(red(e.message));
        if (exitOnError) process.exit(1);
        return false;
    }
}

export async function patchApp(asarPath, { exitOnError = true, checkProcess = true, silent = false } = {}) {
    const backupPath = asarPath + '.bak';
    let extractDir = null;

    if (checkProcess) {
        const proc = checkRunningAntigravity('app');
        if (proc.running) {
            if (!silent) {
                console.error(yellow(`⚠ Antigravity is currently running (${proc.processes.join(', ')}).`));
                console.error(yellow('  Please close Antigravity completely first so app.asar is not locked, then run again.\n'));
            }
            if (exitOnError) process.exit(1);
            return false;
        }
    }

    const spinner = silent ? { text: '', start: () => spinner, succeed: () => {}, fail: () => {} } : ora('Checking permissions and backing up Antigravity App...').start();
    let failLabel = 'Permission Denied.';

    try {
        fs.accessSync(path.dirname(asarPath), fs.constants.W_OK);
        extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-rtl-asar-'));

        failLabel = 'Failed to read app.asar.';
        const currentUtils = readUtils(asarPath);
        const backupUtils = fs.existsSync(backupPath) ? readUtils(backupPath) : null;
        let cleanUtils;
        let repairBackup = false;

        if (!hasAnyPatch(currentUtils)) {
            failLabel = 'Permission Denied.';
            fs.copyFileSync(asarPath, backupPath);
            asar.uncache(backupPath);
            cleanUtils = currentUtils;
        } else {
            const backupIsClean = backupUtils !== null && !hasAnyPatch(backupUtils);
            // Prefer stripping currentUtils so app updates aren't overwritten by an older .bak,
            // fall back to clean backup only if regex didn't match.
            cleanUtils = stripAnyPatch(currentUtils) ?? (backupIsClean ? backupUtils : null);
            if (cleanUtils === null) {
                throw new Error('This Antigravity install has an unrecognized RTL patch and no clean backup exists. Please reinstall Antigravity and retry.');
            }
            repairBackup = !backupIsClean;
            spinner.text = currentUtils.includes(LEGACY_PATCH_START)
                ? 'Migrating from antigravity-rtl to Antigravity RTL + Math...'
                : 'Updating existing Antigravity RTL + Math patch...';
        }

        failLabel = 'Failed to extract ASAR.';
        spinner.text = 'Extracting app.asar...';
        fs.rmSync(extractDir, { recursive: true, force: true });
        asar.extractAll(asarPath, extractDir);

        const utilsPath = path.join(extractDir, 'dist', 'utils.js');
        const fontDest = path.join(extractDir, 'dist', 'Vazirmatn-Variable.woff2');

        if (repairBackup) {
            failLabel = 'Failed to rebuild clean backup.';
            spinner.text = 'Rebuilding clean backup...';
            fs.writeFileSync(utilsPath, cleanUtils, 'utf8');
            fs.rmSync(fontDest, { force: true });
            await asar.createPackage(extractDir, backupPath);
            asar.uncache(backupPath);
        }

        failLabel = 'Injection failed.';
        spinner.text = 'Injecting RTL + Math Isolation engine...';
        const anchorStmt = findInjectionAnchor(cleanUtils);
        if (!anchorStmt) {
            const appVer = readInstalledAppVersion(asarPath);
            throw new Error(`Supported window load anchor not found in dist/utils.js${appVer ? ` (Antigravity v${appVer})` : ''}. Please update antigravity-rtl-math.`);
        }

        const clientTemplate = buildElectronClientScript({
            mode: 'app',
            hideTrigger: '__HIDE_TRIGGER__',
            fontBase64: '__FONT_BASE64__',
            initialConfig: '__RTL_CONFIG__'
        });
        const hookSnippet = renderAppHookSnippet(clientTemplate, anchorStmt);
        const patchedUtils = cleanUtils.replace(anchorStmt, () => hookSnippet);

        fs.writeFileSync(utilsPath, patchedUtils, 'utf8');
        fs.copyFileSync(FONT_SOURCE, fontDest);

        failLabel = 'Failed to repack ASAR.';
        spinner.text = 'Repacking app.asar...';
        await asar.createPackage(extractDir, asarPath);
        asar.uncache(asarPath);

        try {
            const st = fs.statSync(asarPath);
            updatePatchMeta('app', {
                path: asarPath,
                patchVersion: PKG_VERSION,
                hookRevision: CURRENT_HOOK_REVISION,
                appVersion: readInstalledAppVersion(asarPath),
                asarSize: st.size,
                asarMtimeMs: st.mtimeMs
            });
        } catch (_) {}

        spinner.succeed('Successfully patched Antigravity (Standalone App) with RTL + Math Isolation!');
        if (!silent) {
            console.log(green('\n✨ RTL + Math Isolation enabled for Antigravity (Standalone App).'));
            console.log(green('✨ Please restart Antigravity to see the changes.\n'));
        }
        return true;
    } catch (e) {
        spinner.fail(failLabel);
        if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') {
            console.error(red('\nSystem Error: ' + e.message));
            if (os.platform() === 'win32') {
                console.error(yellow('\nClose Antigravity completely (check system tray) or run PowerShell as Administrator, then try again.\n'));
            } else {
                console.error(yellow('\nClose Antigravity and run with sudo (on macOS also allow App Management for Terminal).\n'));
            }
        } else {
            console.error(red(e.message));
        }
        if (exitOnError) process.exit(1);
        return false;
    } finally {
        if (extractDir) {
            try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (_) {}
        }
    }
}
