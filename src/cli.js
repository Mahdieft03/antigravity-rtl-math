#!/usr/bin/env node
/**
 * Antigravity RTL + Math CLI
 * Patches Antigravity Standalone App, Antigravity IDE, and Remote Control extension
 * with smart RTL layout + strict KaTeX / MathJax / MathML formula isolation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import picocolors from 'picocolors';
import prompts from 'prompts';

import { CONFIG_FILENAME } from './core/config.js';
import { writeDemoFile } from './core/build-demo.js';
import {
    detectAppAsarPath,
    getAppAsarPath,
    getAppStatus,
    hasAppBackup,
    patchApp,
    restoreApp
} from './patchers/patch-app.js';
import {
    detectIdeAppPath,
    getIdeAppPath,
    getIdeStatus,
    hasIdeBackup,
    patchIde,
    resolveIdeAppDir,
    restoreIde
} from './patchers/patch-ide.js';
import {
    getBrowserStatus,
    installBrowserExtension,
    removeBrowserExtension
} from './patchers/patch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const { blue, bold, cyan, gray, green, yellow } = picocolors;

function printHeader() {
    console.log('');
    console.log(bold(cyan('  Antigravity RTL + Math')) + gray(` v${pkg.version}`));
    console.log(gray('  Smart Persian/Arabic RTL + KaTeX / MathJax / MathML Isolation\n'));
}

function printHelp() {
    console.log(`Usage:
  node src/cli.js [options] [path]
  npx antigravity-rtl-math [options] [path]

Options:
  --app                Patch or restore Antigravity Standalone App only
  --ide                Patch or restore Antigravity IDE only
  --browser            Install (or remove with --restore) Remote Control Chrome/Arc extension
  -r, --restore        Revert changes and restore original backup files
  --status             Inspect detected apps, patch state, backups, and config
  --demo               Generate and open the offline Math + RTL verification playground
  --path <dir/file>    Specify custom path to IDE directory or app.asar
  --no-process-check   Skip checking if Antigravity is running
  -h, --help           Show this help message
`);
}

function formatPatchBadge(state) {
    if (state === 'rtl-math') return green('Patched (RTL + Math v2)');
    if (state === 'legacy-rtl') return yellow('Patched (legacy antigravity-rtl — upgradeable)');
    if (state === 'clean') return cyan('Clean (unpatched)');
    return gray('Not found');
}

function printStatus() {
    const appStatus = getAppStatus();
    const ideStatus = getIdeStatus();
    const browserStatus = getBrowserStatus();
    const configPath = path.join(os.homedir(), CONFIG_FILENAME);

    console.log(bold('Detected Targets:'));
    console.log(`  1. Standalone App : ${formatPatchBadge(appStatus.patchState)}`);
    if (appStatus.found) {
        console.log(gray(`     Path           : ${appStatus.path}`));
        console.log(gray(`     Backup (.bak)  : ${appStatus.hasBackup ? (appStatus.backupClean ? 'Present (clean)' : 'Present (needs rebuild)') : 'None'}`));
    }

    console.log(`  2. Antigravity IDE: ${formatPatchBadge(ideStatus.patchState)}`);
    if (ideStatus.found) {
        console.log(gray(`     Path           : ${ideStatus.path}`));
        console.log(gray(`     Backup         : ${ideStatus.hasBackup ? 'Present' : 'None'}`));
    }

    console.log(`  3. Browser Ext    : ${browserStatus.installed ? formatPatchBadge(browserStatus.patchState) : gray('Not installed')}`);
    console.log(gray(`     Folder         : ${browserStatus.dir}`));

    console.log(`\n${bold('User Config:')} ${fs.existsSync(configPath) ? green(configPath) : gray(`${configPath} (not created yet — defaults active)`)}`);
    console.log('');
}

async function main() {
    const args = process.argv.slice(2);
    printHeader();

    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    if (args.includes('--status')) {
        printStatus();
        return;
    }

    if (args.includes('--demo')) {
        const demoPath = writeDemoFile();
        console.log(green(`Generated interactive playground:\n  ${demoPath}\n`));
        const openCmd = process.platform === 'darwin'
            ? `open "${demoPath}"`
            : process.platform === 'win32'
                ? `start "" "${demoPath}"`
                : `xdg-open "${demoPath}"`;
        exec(openCmd, () => {});
        return;
    }

    const isRestore = args.includes('--restore') || args.includes('-r');
    const forceIde = args.includes('--ide');
    const forceApp = args.includes('--app');
    const forceBrowser = args.includes('--browser');
    const checkProcess = !args.includes('--no-process-check');

    if (forceBrowser) {
        if (isRestore) {
            removeBrowserExtension();
        } else {
            installBrowserExtension();
        }
        return;
    }

    let customPath = null;
    const pathArgIdx = args.indexOf('--path');
    if (pathArgIdx !== -1 && args[pathArgIdx + 1]) {
        customPath = args[pathArgIdx + 1];
    } else {
        const nonFlags = args.filter(a => !a.startsWith('-'));
        if (nonFlags.length > 0) customPath = nonFlags[0];
    }

    const [runApp, runIde, verb] = isRestore
        ? [(p, o) => restoreApp(p, { ...o, checkProcess }), (p, o) => restoreIde(p, { ...o, checkProcess }), 'restore']
        : [(p, o) => patchApp(p, { ...o, checkProcess }), (p, o) => patchIde(p, { ...o, checkProcess }), 'patch'];

    let ok = false;

    if (customPath) {
        const ideDir = resolveIdeAppDir(customPath);
        ok = (forceIde || ideDir) ? await runIde(ideDir || customPath) : await runApp(customPath);
    } else if (forceApp && !forceIde) {
        ok = await runApp(await getAppAsarPath());
    } else if (forceIde && !forceApp) {
        ok = await runIde(await getIdeAppPath());
    } else {
        const appPath = detectAppAsarPath();
        const ideDir = detectIdeAppPath();

        if (!appPath && !ideDir) {
            console.log(yellow('⚠ Could not automatically locate Antigravity or Antigravity IDE.'));
            const { target } = await prompts({
                type: 'select',
                name: 'target',
                message: `Which application would you like to ${verb}?`,
                choices: [
                    { title: 'Antigravity (Standalone App)', value: 'app' },
                    { title: 'Antigravity IDE (VS Code Edition)', value: 'ide' }
                ],
                initial: 0
            });
            if (!target) return;
            ok = target === 'ide' ? await runIde(await getIdeAppPath()) : await runApp(await getAppAsarPath());
        } else {
            const targets = [
                appPath && { name: 'Antigravity (Standalone App)', run: o => runApp(appPath, o), hasBackup: hasAppBackup(appPath) },
                ideDir && { name: 'Antigravity IDE', run: o => runIde(ideDir, o), hasBackup: hasIdeBackup(ideDir) }
            ].filter(t => t && (!isRestore || t.hasBackup));

            if (targets.length === 0) {
                console.log(yellow('⚠ No backup files found to restore for detected application(s).\n'));
                return;
            }

            const multi = targets.length > 1;
            if (multi && !isRestore) {
                console.log(bold(cyan('ℹ Found both Antigravity (Standalone App) and Antigravity IDE!')));
                console.log(bold(cyan('  Patching both applications...\n')));
            }

            for (const [i, t] of targets.entries()) {
                if (isRestore) console.log(blue(`ℹ Found backup for ${t.name}. Restoring...`));
                else if (multi) console.log(bold(`${i ? '\n' : ''}--- ${i + 1}/2: ${t.name} ---`));
                else console.log(blue(`ℹ Found ${t.name}. Patching...\n`));
                if (await t.run({ exitOnError: !multi })) ok = true;
            }
        }
    }

    if (ok && !isRestore) {
        console.log(cyan('Tip: Test formulas offline anytime with: node src/cli.js --demo'));
        console.log(cyan('Tip: Remote Control browser extension: node src/cli.js --browser\n'));
    }
}

main().catch((e) => {
    console.error('\n✖ An unexpected error occurred:', e.message);
    process.exit(1);
});
