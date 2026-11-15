/**
 * Antigravity IDE (VS Code Edition) patcher, migrator, restorer, and status inspector.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import picocolors from 'picocolors';
import ora from 'ora';
import prompts from 'prompts';
import { buildElectronClientScript } from '../core/client-bundle.js';
import { isTempPath, updatePatchMeta } from '../core/meta.js';
import { checkRunningAntigravity } from './process-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(SRC_ROOT, '..', 'assets');
const FONT_SOURCE = path.join(ASSETS_DIR, 'Vazirmatn-Variable.woff2');
const IDE_MAIN_SOURCE = path.join(SRC_ROOT, 'targets', 'ide-main.js');
const { blue, green, red, yellow } = picocolors;

export const HOOK_IMPORT = "import './antigravity-rtl-main.js';";
const FONT_SRC_DATA = /font-src[^;]*\bdata:/;

function idePaths(appDir) {
    const outDir = path.join(appDir, 'out');
    const wbDir = path.join(outDir, 'vs', 'code', 'electron-browser', 'workbench');
    const mainJsPath = path.join(outDir, 'main.js');
    const htmlFiles = [];
    if (fs.existsSync(wbDir)) {
        for (const name of fs.readdirSync(wbDir)) {
            if (name.endsWith('.html')) {
                htmlFiles.push(path.join(wbDir, name));
            }
        }
    }
    return {
        outDir,
        wbDir,
        mainJsPath,
        mainJsBak: mainJsPath + '.rtl-bak',
        htmlFiles
    };
}

function getIdeCandidatePaths() {
    const candidates = [];
    const platform = os.platform();

    if (platform === 'darwin') {
        candidates.push('/Applications/Antigravity IDE.app');
        candidates.push(path.join(os.homedir(), 'Applications', 'Antigravity IDE.app'));
    } else if (platform === 'win32') {
        if (process.env.LOCALAPPDATA) {
            candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity IDE'));
            candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity-ide'));
            candidates.push(path.join(process.env.LOCALAPPDATA, 'Antigravity IDE'));
        }
        if (process.env.PROGRAMFILES) {
            candidates.push(path.join(process.env.PROGRAMFILES, 'Antigravity IDE'));
            candidates.push(path.join(process.env.PROGRAMFILES, 'antigravity-ide'));
        }
        if (process.env['PROGRAMFILES(X86)']) {
            candidates.push(path.join(process.env['PROGRAMFILES(X86)'], 'Antigravity IDE'));
        }
    } else {
        candidates.push(path.join(os.homedir(), 'Downloads', 'Antigravity IDE'));
        candidates.push('/opt/Antigravity IDE');
        candidates.push('/opt/antigravity-ide');
        candidates.push('/usr/share/antigravity');
        candidates.push('/usr/share/antigravity-ide');
        candidates.push(path.join(os.homedir(), '.local', 'share', 'antigravity-ide'));
    }
    return candidates;
}

export function resolveIdeAppDir(inputPath) {
    if (!inputPath || !fs.existsSync(inputPath)) return null;
    if (fs.existsSync(path.join(inputPath, 'out', 'main.js'))) return inputPath;
    const macAppDir = path.join(inputPath, 'Contents', 'Resources', 'app');
    if (fs.existsSync(path.join(macAppDir, 'out', 'main.js'))) return macAppDir;
    const standardAppDir = path.join(inputPath, 'resources', 'app');
    if (fs.existsSync(path.join(standardAppDir, 'out', 'main.js'))) return standardAppDir;
    return null;
}

export function detectIdeAppPath() {
    for (const c of getIdeCandidatePaths()) {
        const resolved = resolveIdeAppDir(c);
        if (resolved) return resolved;
    }
    return null;
}

export function hasIdeBackup(appDir) {
    if (!appDir) return false;
    const { mainJsPath, mainJsBak, htmlFiles } = idePaths(appDir);
    let hasImport = false;
    if (fs.existsSync(mainJsPath)) {
        try {
            hasImport = fs.readFileSync(mainJsPath, 'utf8').includes(HOOK_IMPORT);
        } catch (_) {}
    }
    const hasHtmlBak = htmlFiles.some(h => fs.existsSync(h + '.rtl-bak'));
    return fs.existsSync(mainJsBak) || hasHtmlBak || hasImport;
}

export function getIdeStatus(appDir = detectIdeAppPath()) {
    if (!appDir || !fs.existsSync(path.join(appDir, 'out', 'main.js'))) {
        return { found: false, path: null, patchState: 'not-found', hasBackup: false };
    }
    const { outDir, mainJsPath, mainJsBak } = idePaths(appDir);
    let patchState = 'clean';
    let hookRevision = 0;
    try {
        const mainCode = fs.readFileSync(mainJsPath, 'utf8');
        if (mainCode.includes(HOOK_IMPORT)) {
            const clientPath = path.join(outDir, 'antigravity-rtl-client.js');
            const hookPath = path.join(outDir, 'antigravity-rtl-main.js');
            if (fs.existsSync(clientPath) && fs.readFileSync(clientPath, 'utf8').includes('__agRtlMathLib')) {
                patchState = 'rtl-math';
                hookRevision = fs.existsSync(hookPath) && fs.readFileSync(hookPath, 'utf8').includes('attachedWc') ? 3 : 2;
            } else {
                patchState = 'legacy-rtl';
                hookRevision = 1;
            }
        }
    } catch (_) {}
    return { found: true, path: appDir, patchState, hookRevision, hasBackup: fs.existsSync(mainJsBak) };
}

export async function getIdeAppPath() {
    const detected = detectIdeAppPath();
    if (detected) {
        console.log(blue('ℹ Found Antigravity IDE at:'));
        console.log(`  ${detected}\n`);
        return detected;
    }

    console.log(yellow('⚠ Could not automatically find Antigravity IDE.'));
    const response = await prompts({
        type: 'text',
        name: 'customPath',
        message: 'Please enter the path to your Antigravity IDE directory:'
    });

    if (!response.customPath) {
        console.error(red('\n✖ No path entered. Aborting.\n'));
        process.exit(1);
    }

    const resolved = resolveIdeAppDir(response.customPath);
    if (!resolved) {
        console.error(red(`\n✖ Could not find valid IDE resources in "${response.customPath}". Aborting.\n`));
        process.exit(1);
    }
    return resolved;
}

export async function restoreIde(appDir, { exitOnError = true, checkProcess = true } = {}) {
    const { outDir, wbDir, mainJsPath, mainJsBak, htmlFiles } = idePaths(appDir);

    if (!hasIdeBackup(appDir)) {
        console.error(red('✖ No backup found to restore for Antigravity IDE.\n'));
        if (exitOnError) process.exit(1);
        return false;
    }

    if (checkProcess) {
        const proc = checkRunningAntigravity('ide');
        if (proc.running) {
            console.error(yellow(`⚠ Antigravity IDE appears to be running (${proc.processes.join(', ')}). Please close it before restoring.\n`));
            if (exitOnError) process.exit(1);
            return false;
        }
    }

    const spinner = ora('Restoring original Antigravity IDE files...').start();
    try {
        if (fs.existsSync(mainJsBak)) {
            fs.copyFileSync(mainJsBak, mainJsPath);
            fs.unlinkSync(mainJsBak);
        } else if (fs.existsSync(mainJsPath)) {
            let code = fs.readFileSync(mainJsPath, 'utf8');
            if (code.includes(HOOK_IMPORT)) {
                code = code.replace(HOOK_IMPORT + '\n', '').replace(HOOK_IMPORT, '');
                fs.writeFileSync(mainJsPath, code, 'utf8');
            }
        }

        for (const html of htmlFiles) {
            const bak = html + '.rtl-bak';
            if (fs.existsSync(bak)) {
                fs.copyFileSync(bak, html);
                fs.unlinkSync(bak);
            }
        }

        for (const f of [
            path.join(outDir, 'antigravity-rtl-main.js'),
            path.join(outDir, 'antigravity-rtl-client.js'),
            path.join(outDir, 'Vazirmatn-Variable.woff2'),
            path.join(wbDir, 'Vazirmatn-Variable.woff2')
        ]) {
            fs.rmSync(f, { force: true });
        }

        try { if (!isTempPath(appDir)) updatePatchMeta('ide', null); } catch (_) {}
        spinner.succeed('Successfully restored original Antigravity IDE!\n');
        return true;
    } catch (e) {
        spinner.fail('Failed to restore Antigravity IDE.');
        console.error(red(e.message));
        if (exitOnError) process.exit(1);
        return false;
    }
}

export async function patchIde(appDir, { exitOnError = true, checkProcess = true, silent = false } = {}) {
    const { outDir, mainJsPath, mainJsBak, htmlFiles } = idePaths(appDir);

    if (checkProcess) {
        const proc = checkRunningAntigravity('ide');
        if (proc.running) {
            console.error(yellow(`⚠ Antigravity IDE is currently running (${proc.processes.join(', ')}). Please close it first.\n`));
            if (exitOnError) process.exit(1);
            return false;
        }
    }

    const spinner = silent ? { text: '', start: () => spinner, succeed: () => {}, fail: () => {} } : ora('Checking permissions and backing up Antigravity IDE files...').start();
    let failLabel = 'Permission Denied.';
    try {
        fs.accessSync(outDir, fs.constants.W_OK);
        fs.accessSync(mainJsPath, fs.constants.W_OK);

        failLabel = 'Failed to create backup.';
        const mainCode = fs.readFileSync(mainJsPath, 'utf8');
        if (!mainCode.includes(HOOK_IMPORT)) {
            fs.copyFileSync(mainJsPath, mainJsBak);
        }
        for (const file of htmlFiles) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('font-src') && !FONT_SRC_DATA.test(content)) {
                fs.copyFileSync(file, file + '.rtl-bak');
            }
        }

        failLabel = 'Failed to copy RTL + Math assets.';
        spinner.text = 'Writing RTL + Math engine and assets...';
        fs.copyFileSync(FONT_SOURCE, path.join(outDir, 'Vazirmatn-Variable.woff2'));
        fs.copyFileSync(IDE_MAIN_SOURCE, path.join(outDir, 'antigravity-rtl-main.js'));

        const clientBundle = buildElectronClientScript({
            mode: 'ide',
            hideTrigger: '__HIDE_TRIGGER__',
            fontBase64: '__FONT_BASE64__',
            initialConfig: '__RTL_CONFIG__'
        });
        fs.writeFileSync(path.join(outDir, 'antigravity-rtl-client.js'), clientBundle, 'utf8');

        failLabel = 'Injection into Antigravity IDE failed.';
        spinner.text = 'Injecting RTL + Math hook into main.js...';
        if (!mainCode.includes(HOOK_IMPORT)) {
            fs.writeFileSync(mainJsPath, HOOK_IMPORT + '\n' + mainCode, 'utf8');
        }

        for (const file of htmlFiles) {
            let content = fs.readFileSync(file, 'utf8');
            if (content.includes('font-src') && !FONT_SRC_DATA.test(content)) {
                content = content.replace(/(font-src[\s\S]*?'self')/i, "$1\n\t\t\t\t\tdata:");
                fs.writeFileSync(file, content, 'utf8');
            }
        }

        try {
            updatePatchMeta('ide', { path: appDir, patchVersion: '3.0.0', hookRevision: 3 });
        } catch (_) {}

        spinner.succeed('Successfully patched Antigravity IDE with RTL + Math Isolation!');
        if (!silent) {
            console.log(green('\n✨ RTL + Math Isolation enabled for Antigravity IDE.'));
            console.log(green('✨ Please restart Antigravity IDE to see the changes.\n'));
        }
        return true;
    } catch (e) {
        spinner.fail(failLabel);
        if (failLabel === 'Permission Denied.') {
            console.error(red('\nSystem Error: ' + e.message));
            console.error(yellow(os.platform() === 'win32'
                ? '\nPlease run your terminal as Administrator and try again.\n'
                : '\nPlease run this command with sudo.\n'));
        } else {
            console.error(red(e.message));
        }
        if (exitOnError) process.exit(1);
        return false;
    }
}
