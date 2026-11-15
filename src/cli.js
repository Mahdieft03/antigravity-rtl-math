#!/usr/bin/env node

import fs from 'fs';
import { pathToFileURL } from 'url';
import pc from 'picocolors';
import ora from 'ora';
import prompts from 'prompts';
import { execFile } from 'child_process';
import {
    PRESET_NAMES,
    UI_LANGS,
    applyPreset
} from './core/config.js';
import {
    readPatchMeta,
    readUserConfig,
    writeUserConfig
} from './core/meta.js';
import { writeDemoFile } from './core/build-demo.js';
import {
    detectAppAsarPath,
    getAppStatus,
    patchApp,
    restoreApp
} from './patchers/patch-app.js';
import {
    detectIdeAppPath,
    getIdeStatus,
    patchIde,
    restoreIde
} from './patchers/patch-ide.js';
import {
    getBrowserStatus,
    installBrowserExtension,
    removeBrowserExtension
} from './patchers/patch-browser.js';
import {
    ensurePatched,
    getGuardStatus,
    installGuard,
    removeGuard
} from './patchers/guard.js';
import { runDoctor } from './patchers/doctor.js';
import { selfUpdateFromGitHub } from './patchers/self-update.js';

const PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VERSION = PKG.version || '3.0.0';

function parseArgs(argv) {
    const flags = {
        help: false,
        version: false,
        status: false,
        json: false,
        doctor: false,
        ensure: false,
        installGuard: false,
        removeGuard: false,
        update: false,
        force: false,
        browser: false,
        app: false,
        ide: false,
        all: false,
        restore: false,
        demo: false,
        noProcessCheck: false,
        silent: false,
        yes: false,
        preset: null,
        lang: null,
        customPath: null,
        unknown: []
    };

    const valueFlags = {
        '--preset': 'preset',
        '--lang': 'lang',
        '--path': 'customPath'
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
            const k = arg.slice(0, eqIdx);
            const v = arg.slice(eqIdx + 1);
            if (valueFlags[k]) {
                flags[valueFlags[k]] = v;
                continue;
            }
        }
        if (valueFlags[arg]) {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                flags.unknown.push(`${arg} (missing value)`);
            } else {
                flags[valueFlags[arg]] = next;
                i++;
            }
            continue;
        }
        switch (arg) {
            case '-h': case '--help': flags.help = true; break;
            case '-v': case '--version': flags.version = true; break;
            case '-s': case '--status': flags.status = true; break;
            case '--json': flags.json = true; break;
            case '--doctor': flags.doctor = true; break;
            case '--ensure': flags.ensure = true; break;
            case '--install-guard': flags.installGuard = true; break;
            case '--remove-guard': flags.removeGuard = true; break;
            case '--update': flags.update = true; break;
            case '--force': flags.force = true; break;
            case '--browser': flags.browser = true; break;
            case '--app': flags.app = true; break;
            case '--ide': flags.ide = true; break;
            case '--all': flags.all = true; break;
            case '-r': case '--restore': flags.restore = true; break;
            case '--demo': flags.demo = true; break;
            case '--no-process-check': flags.noProcessCheck = true; break;
            case '--silent': flags.silent = true; break;
            case '-y': case '--yes': flags.yes = true; break;
            default:
                flags.unknown.push(arg);
                break;
        }
    }
    return flags;
}

function showBanner() {
    console.log('');
    console.log(pc.bold(pc.cyan('  ╔══════════════════════════════════════════════════════╗')));
    console.log(pc.bold(pc.cyan(`  ║     Antigravity RTL + Math Engine  v${VERSION.padEnd(17)}║`)));
    console.log(pc.bold(pc.cyan('  ║     Persian/Arabic RTL + Strict LTR KaTeX Shield     ║')));
    console.log(pc.bold(pc.cyan('  ╚══════════════════════════════════════════════════════╝')));
    console.log(pc.dim('  Inspired by https://github.com/mmnaderi/antigravity-rtl'));
    console.log('');
}

function showHelp() {
    showBanner();
    console.log(`Usage: ${pc.bold('antigravity-rtl-math')} [options]

${pc.bold('Patch Targets:')}
  --app                    Patch Antigravity Standalone Desktop App (app.asar)
  --ide                    Patch Antigravity IDE (Electron desktop)
  --browser                Generate / update unpacked Chrome/Edge extension
  --all                    Apply to App, IDE, and Browser Extension
  -r, --restore            Restore clean backups / remove extension

${pc.bold('Stability & Maintenance (v3):')}
  --doctor                 Run deep health diagnostics across targets, config & guard
  --ensure                 Verify targets and auto-heal wiped/outdated hooks
  --install-guard          Enable lightweight logon Auto-Heal Guard (runs --ensure)
  --remove-guard           Disable Auto-Heal Startup Guard
  --update                 Download and install latest release from GitHub (no git needed)
  --force                  Force reinstall during --update even if versions match

${pc.bold('Visual Presets & Output:')}
  --preset <name>          Apply visual preset: ${PRESET_NAMES.join(' | ')}
  --lang <code>            Set panel language: ${UI_LANGS.join(' | ')}
  -s, --status             Inspect current patch, hook revision, and guard status
  --json                   Machine-readable JSON output (with --status, --doctor, --ensure, -v)
  --demo                   Generate & open offline RTL+Math interactive playground
  --path <path>            Override target app.asar or IDE directory path
  --no-process-check       Skip running-process guard (use with care)
  --silent                 Suppress non-error console output
  -y, --yes                Non-interactive confirmation
  -v, --version            Show version
  -h, --help               Show this help

${pc.bold('Keyboard Shortcut inside Antigravity:')}  ${pc.green('Alt + R')} opens/closes the RTL+Math glass panel.
`);
}

function formatPatchBadge(st) {
    if (!st.found && st.installed === undefined) return pc.dim('not detected');
    if (st.installed === false) return pc.dim('not generated');
    if (st.patchState === 'rtl-math') {
        const rev = st.hookRevision ?? 3;
        const ver = st.appVersion || st.version || '';
        const verTxt = ver ? ` (v${ver})` : '';
        if (rev < 3) return pc.yellow(`patched v${rev}${verTxt} — upgrade recommended`);
        return pc.green(`patched v${rev}${verTxt}`);
    }
    if (st.patchState === 'legacy-rtl') return pc.yellow('legacy antigravity-rtl (run patch to upgrade)');
    if (st.patchState === 'clean') return pc.red('unpatched (clean)');
    return pc.red(st.patchState || 'unknown');
}

function collectStatusPayload() {
    const app = getAppStatus(detectAppAsarPath());
    const ide = getIdeStatus(detectIdeAppPath());
    const browser = getBrowserStatus();
    const guard = getGuardStatus();
    const config = readUserConfig();
    const meta = readPatchMeta();
    return {
        version: VERSION,
        targets: { app, ide, browser },
        guard,
        config,
        meta
    };
}

function printStatus(payload) {
    console.log(pc.bold('System & Patch Status:'));
    console.log(`  Standalone App : ${formatPatchBadge(payload.targets.app)}`);
    if (payload.targets.app.path) console.log(pc.dim(`                   ${payload.targets.app.path}`));
    console.log(`  Antigravity IDE: ${formatPatchBadge(payload.targets.ide)}`);
    if (payload.targets.ide.path) console.log(pc.dim(`                   ${payload.targets.ide.path}`));
    console.log(`  Browser Ext    : ${formatPatchBadge(payload.targets.browser)}`);
    console.log(pc.dim(`                   ${payload.targets.browser.dir}`));
    console.log(`  Auto-Heal Guard: ${payload.guard.installed ? pc.green(`enabled (${payload.guard.kind})`) : pc.yellow('disabled')}`);
    if (payload.guard.installed) console.log(pc.dim(`                   ${payload.guard.filePath}`));
    console.log(`  Config         : ${pc.cyan(`mode=${payload.config.directionMode}, align=${payload.config.mathDisplayAlign}, fs=${payload.config.fs}px, lh=${payload.config.lh}, lang=${payload.config.uiLang}`)}`);
    console.log('');
}

function printDoctor(report) {
    console.log(pc.bold('Antigravity RTL + Math Diagnostics (--doctor):'));
    console.log('');
    for (const c of report.checks) {
        const icon = c.status === 'pass'
            ? pc.green('PASS')
            : c.status === 'warn'
                ? pc.yellow('WARN')
                : pc.red('FAIL');
        console.log(`  [${icon}] ${pc.bold(c.title)}: ${c.detail}`);
        if (c.fix) {
            console.log(pc.dim(`         Fix: ${c.fix}`));
        }
    }
    console.log('');
    console.log(`  Summary: ${pc.green(`${report.summary.pass} passed`)}, ${pc.yellow(`${report.summary.warn} warnings`)}, ${pc.red(`${report.summary.fail} failed`)}`);
    console.log('');
}

function openFileInBrowser(targetPath) {
    if (process.platform === 'win32') {
        execFile('cmd.exe', ['/c', 'start', '', targetPath], () => {});
    } else if (process.platform === 'darwin') {
        execFile('open', [targetPath], () => {});
    } else {
        execFile('xdg-open', [targetPath], () => {});
    }
}

function applyConfigFlags(flags) {
    let changed = false;
    let cfg = readUserConfig();
    if (flags.preset) {
        if (!PRESET_NAMES.includes(flags.preset)) {
            throw new Error(`Invalid preset "${flags.preset}". Choose one of: ${PRESET_NAMES.join(', ')}`);
        }
        cfg = applyPreset(cfg, flags.preset);
        changed = true;
    }
    if (flags.lang) {
        if (!UI_LANGS.includes(flags.lang)) {
            throw new Error(`Invalid language "${flags.lang}". Choose one of: ${UI_LANGS.join(', ')}`);
        }
        cfg = { ...cfg, uiLang: flags.lang };
        changed = true;
    }
    if (changed) {
        writeUserConfig(cfg);
    }
    return { changed, config: cfg };
}

async function runPatchTargets(flags) {
    const appTarget = flags.app ? (flags.customPath || detectAppAsarPath()) : (flags.all ? detectAppAsarPath() : null);
    const ideTarget = flags.ide ? (flags.customPath || detectIdeAppPath()) : (flags.all ? detectIdeAppPath() : null);
    const results = [];

    if (flags.app || flags.all) {
        if (!appTarget) {
            if (!flags.silent) console.log(pc.yellow('⚠ Antigravity Standalone App not detected on default paths. Use --path <app.asar>.'));
            results.push({ target: 'app', ok: false, skipped: true });
        } else {
            const ok = await patchApp(appTarget, {
                exitOnError: false,
                checkProcess: !flags.noProcessCheck,
                silent: flags.silent
            });
            results.push({ target: 'app', ok });
        }
    }

    if (flags.ide || flags.all) {
        if (!ideTarget) {
            if (flags.ide && !flags.silent) console.log(pc.yellow('⚠ Antigravity IDE not detected. Use --path <resources/app>.'));
            results.push({ target: 'ide', ok: false, skipped: true });
        } else {
            const ok = await patchIde(ideTarget, {
                exitOnError: false,
                checkProcess: !flags.noProcessCheck,
                silent: flags.silent
            });
            results.push({ target: 'ide', ok });
        }
    }

    if (flags.browser || flags.all) {
        installBrowserExtension({ openFolder: false, silent: flags.silent });
        results.push({ target: 'browser', ok: true });
    }

    return results;
}

async function runRestoreTargets(flags) {
    const appTarget = (flags.app || flags.all) ? (flags.customPath || detectAppAsarPath()) : null;
    const ideTarget = (flags.ide || flags.all) ? (flags.customPath || detectIdeAppPath()) : null;
    const targetsExplicit = flags.app || flags.ide || flags.browser || flags.all;

    if (!targetsExplicit) {
        flags = { ...flags, all: true };
    }
    if (appTarget || flags.all) {
        const p = appTarget || detectAppAsarPath();
        if (p) await restoreApp(p, { checkProcess: !flags.noProcessCheck, silent: flags.silent });
    }
    if (ideTarget || flags.all) {
        const p = ideTarget || detectIdeAppPath();
        if (p) await restoreIde(p, { checkProcess: !flags.noProcessCheck, silent: flags.silent });
    }
    if (flags.browser || flags.all) {
        removeBrowserExtension({ silent: flags.silent });
    }
}

async function runInteractiveMenu() {
    showBanner();
    const initial = collectStatusPayload();
    printStatus(initial);

    const appNeedsUpgrade = initial.targets.app.found &&
        (initial.targets.app.patchState !== 'rtl-math' || (initial.targets.app.hookRevision ?? 0) < 3);

    const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'Choose an action:',
        choices: [
            {
                title: appNeedsUpgrade
                    ? 'Upgrade / Patch Standalone App + Enable Auto-Heal Guard (Recommended)'
                    : 'Re-verify Standalone App + Enable Auto-Heal Guard',
                value: 'app_guard'
            },
            { title: 'Patch Standalone App Only', value: 'app' },
            { title: 'Patch All Detected Targets (App + IDE + Browser) + Guard', value: 'all_guard' },
            { title: 'Install / Refresh Chrome & Edge Extension Only', value: 'browser' },
            { title: 'Run Health Diagnostics (--doctor)', value: 'doctor' },
            { title: 'Configure Visual Preset & Language', value: 'preset' },
            { title: 'Update from GitHub (--update)', value: 'update' },
            { title: 'Open Interactive RTL + Math Playground (--demo)', value: 'demo' },
            { title: 'Restore Clean Backups & Remove Guard', value: 'restore' },
            { title: 'Exit', value: 'exit' }
        ]
    });

    if (!action || action === 'exit') return 0;

    switch (action) {
        case 'app_guard': {
            const p = detectAppAsarPath();
            if (!p) {
                console.log(pc.yellow('⚠ Antigravity Standalone App not found automatically. Run with --app --path <path/to/app.asar>.'));
                return 1;
            }
            const ok = await patchApp(p, { exitOnError: false });
            const guard = installGuard();
            console.log(pc.green(`✔ Auto-Heal Startup Guard enabled: ${guard.filePath}`));
            return ok ? 0 : 1;
        }
        case 'app': {
            const p = detectAppAsarPath();
            if (!p) {
                console.log(pc.yellow('⚠ Antigravity Standalone App not found. Run with --app --path <path/to/app.asar>.'));
                return 1;
            }
            return (await patchApp(p, { exitOnError: false })) ? 0 : 1;
        }
        case 'all_guard': {
            const res = await runPatchTargets({ all: true, noProcessCheck: false, silent: false });
            const guard = installGuard();
            console.log(pc.green(`✔ Auto-Heal Startup Guard enabled: ${guard.filePath}`));
            return res.some(r => !r.skipped && !r.ok) ? 1 : 0;
        }
        case 'browser': {
            installBrowserExtension({ openFolder: true, silent: false });
            return 0;
        }
        case 'doctor': {
            const report = runDoctor();
            printDoctor(report);
            return report.ok ? 0 : 1;
        }
        case 'preset': {
            const answers = await prompts([
                {
                    type: 'select',
                    name: 'preset',
                    message: 'Select visual preset:',
                    choices: [
                        { title: 'Balanced (Default — Vazirmatn 16px, line-height 1.6)', value: 'default' },
                        { title: 'Reading (17px, line-height 1.9 — ideal for physics/math notes)', value: 'reading' },
                        { title: 'Compact (14px, line-height 1.4 — dense technical layout)', value: 'compact' }
                    ]
                },
                {
                    type: 'select',
                    name: 'lang',
                    message: 'Settings panel UI language:',
                    choices: [
                        { title: 'English (EN)', value: 'en' },
                        { title: 'فارسی (FA)', value: 'fa' }
                    ]
                }
            ]);
            if (answers.preset) {
                const updated = applyPreset({ ...readUserConfig(), uiLang: answers.lang || 'en' }, answers.preset);
                writeUserConfig(updated);
                console.log(pc.green(`✔ Saved preset "${answers.preset}" (lang=${updated.uiLang}).`));
            }
            return 0;
        }
        case 'update': {
            const spinner = ora('Checking GitHub for updates...').start();
            try {
                const res = await selfUpdateFromGitHub();
                spinner.succeed(res.updated
                    ? pc.green(`Updated v${res.currentVersion} -> v${res.remoteVersion} (${res.source}).`)
                    : pc.cyan(`Already on latest version v${res.currentVersion}.`));
                return 0;
            } catch (err) {
                spinner.fail(err.message);
                return 1;
            }
        }
        case 'demo': {
            const demoPath = writeDemoFile();
            console.log(pc.green(`✔ Demo generated at ${demoPath}`));
            openFileInBrowser(demoPath);
            return 0;
        }
        case 'restore': {
            await runRestoreTargets({ all: true, noProcessCheck: false, silent: false });
            const removed = removeGuard();
            if (removed.removed) console.log(pc.green(`✔ Removed Auto-Heal Startup Guard: ${removed.filePath}`));
            return 0;
        }
        default:
            return 0;
    }
}

export async function main(argv = process.argv.slice(2)) {
    const flags = parseArgs(argv);

    if (flags.unknown.length > 0) {
        console.error(pc.red(`Unknown or incomplete option(s): ${flags.unknown.join(', ')}`));
        console.error('Run with --help to see supported options.');
        return 1;
    }

    if (flags.help) {
        showHelp();
        return 0;
    }

    if (flags.version) {
        if (flags.json) {
            console.log(JSON.stringify({ version: VERSION }));
        } else {
            console.log(`antigravity-rtl-math v${VERSION}`);
        }
        return 0;
    }

    let cfgRes;
    try {
        cfgRes = applyConfigFlags(flags);
    } catch (err) {
        if (flags.json) console.log(JSON.stringify({ error: err.message }));
        else console.error(pc.red(err.message));
        return 1;
    }
    const hasActionFlag = flags.status || flags.doctor || flags.ensure || flags.installGuard ||
        flags.removeGuard || flags.update || flags.browser || flags.app || flags.ide ||
        flags.all || flags.restore || flags.demo;

    if (cfgRes.changed && !hasActionFlag) {
        if (flags.json) {
            console.log(JSON.stringify({ updated: true, config: cfgRes.config }, null, 2));
        } else if (!flags.silent) {
            console.log(pc.green(`✔ Updated ~/.antigravity-rtl.json (preset=${flags.preset || 'custom'}, lang=${cfgRes.config.uiLang})`));
        }
        return 0;
    }

    if (flags.update) {
        const spinner = (!flags.silent && !flags.json) ? ora('Checking GitHub for updates...').start() : null;
        try {
            const res = await selfUpdateFromGitHub({ force: flags.force });
            if (spinner) {
                spinner.succeed(res.updated
                    ? `Updated v${res.currentVersion} -> v${res.remoteVersion}`
                    : `Already up to date (v${res.currentVersion})`);
            } else if (flags.json) {
                console.log(JSON.stringify(res, null, 2));
            }
            if (res.updated && !flags.silent && !flags.json) {
                console.log(pc.cyan('Tip: Run "antigravity-rtl-math --ensure" if Antigravity is closed to refresh hooks.'));
            }
        } catch (err) {
            if (spinner) spinner.fail(err.message);
            else if (flags.json) console.log(JSON.stringify({ error: err.message }));
            else console.error(pc.red(err.message));
            return 1;
        }
        if (!flags.ensure && !flags.app && !flags.ide && !flags.browser && !flags.all && !flags.doctor) {
            return 0;
        }
    }

    if (flags.status) {
        const payload = collectStatusPayload();
        if (flags.json) {
            console.log(JSON.stringify(payload, null, 2));
        } else {
            showBanner();
            printStatus(payload);
        }
        return 0;
    }

    if (flags.doctor) {
        const report = runDoctor();
        if (flags.json) {
            console.log(JSON.stringify({ version: VERSION, ...report }, null, 2));
        } else {
            showBanner();
            printDoctor(report);
        }
        return report.ok ? 0 : 1;
    }

    if (flags.ensure) {
        const res = await ensurePatched({
            appPath: flags.customPath && flags.app ? flags.customPath : detectAppAsarPath(),
            ideDir: flags.customPath && flags.ide ? flags.customPath : detectIdeAppPath(),
            includeBrowser: flags.browser || flags.all,
            checkProcess: !flags.noProcessCheck,
            silent: flags.silent || flags.json
        });
        if (flags.json) {
            console.log(JSON.stringify(res, null, 2));
        } else if (!flags.silent) {
            for (const act of res.actions) {
                const state = act.healed ? pc.green('healed -> v3') : act.upToDate ? pc.cyan('up-to-date') : pc.yellow('skipped (app running or locked)');
                console.log(`  [${act.target}] ${state}`);
            }
        }
        if (flags.installGuard) {
            const g = installGuard();
            if (!flags.silent && !flags.json) console.log(pc.green(`✔ Auto-Heal Guard enabled: ${g.filePath}`));
        }
        return 0;
    }

    if (flags.demo) {
        const demoPath = writeDemoFile();
        if (!flags.silent) {
            console.log(pc.green(`✔ Playground built: ${demoPath}`));
        }
        openFileInBrowser(demoPath);
        return 0;
    }

    if (flags.restore) {
        await runRestoreTargets(flags);
        if (flags.removeGuard) {
            const g = removeGuard();
            if (!flags.silent && g.removed) console.log(pc.green(`✔ Removed Auto-Heal Guard: ${g.filePath}`));
        }
        return 0;
    }

    let exitCode = 0;

    if (flags.app || flags.ide || flags.browser || flags.all) {
        if (!flags.silent && !flags.json) showBanner();
        const results = await runPatchTargets(flags);
        if (results.some(r => !r.skipped && !r.ok)) exitCode = 1;
    }

    if (flags.installGuard) {
        const g = installGuard();
        if (flags.json) {
            console.log(JSON.stringify({ guardInstalled: true, ...g }, null, 2));
        } else if (!flags.silent) {
            console.log(pc.green(`✔ Auto-Heal Startup Guard enabled: ${g.filePath}`));
        }
        return exitCode;
    }

    if (flags.removeGuard) {
        const g = removeGuard();
        if (flags.json) {
            console.log(JSON.stringify({ guardRemoved: g.removed, ...g }, null, 2));
        } else if (!flags.silent) {
            console.log(g.removed ? pc.green(`✔ Removed Auto-Heal Startup Guard: ${g.filePath}`) : pc.dim('Auto-Heal Startup Guard was not installed.'));
        }
        return exitCode;
    }

    if (hasActionFlag) {
        return exitCode;
    }

    // No action flags passed: interactive menu if TTY, otherwise run --all --yes only when explicit -y
    if (process.stdin.isTTY && !flags.yes) {
        return runInteractiveMenu();
    }

    if (flags.yes) {
        if (!flags.silent) showBanner();
        const res = await runPatchTargets({ ...flags, all: true });
        return res.some(r => !r.skipped && !r.ok) ? 1 : 0;
    }

    showHelp();
    return 0;
}

function checkEntrypoint() {
    if (!process.argv[1]) return false;
    try {
        return pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
    } catch (_) {
        return false;
    }
}

if (checkEntrypoint()) {
    main().then(code => {
        if (typeof code === 'number' && code !== 0) process.exit(code);
    }).catch(err => {
        console.error(pc.red(err.stack || err.message));
        process.exit(1);
    });
}
