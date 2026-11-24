/**
 * Cross-platform Auto-Heal Guard & `--ensure` runner.
 * Detects when an Antigravity auto-update overwrites app.asar or IDE files and cleanly re-applies the patch.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { CURRENT_HOOK_REVISION, PKG_VERSION, readPatchMeta, updatePatchMeta } from '../core/meta.js';
import { detectAppAsarPath, getAppStatus, patchApp } from './patch-app.js';
import { detectIdeAppPath, getIdeStatus, patchIde } from './patch-ide.js';
import { getBrowserStatus, installBrowserExtension } from './patch-browser.js';
import { checkRunningAntigravity } from './process-check.js';
import { compareSemver } from './self-update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CLI_PATH = path.resolve(__dirname, '..', 'cli.js');

export function getGuardTarget(platform = os.platform(), { homeDir = os.homedir(), appData = process.env.APPDATA, xdgConfig = process.env.XDG_CONFIG_HOME, customDir = null } = {}) {
    if (platform === 'win32') {
        const dir = customDir || path.join(appData || path.join(homeDir, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        return { platform, kind: 'vbs-startup', dir, filePath: path.join(dir, 'AntigravityRtlMathGuard.vbs') };
    }
    if (platform === 'darwin') {
        const dir = customDir || path.join(homeDir, 'Library', 'LaunchAgents');
        return { platform, kind: 'launchd', dir, filePath: path.join(dir, 'io.github.mahdieft03.antigravity-rtl-math.plist') };
    }
    const dir = customDir || path.join(xdgConfig || path.join(homeDir, '.config'), 'autostart');
    return { platform, kind: 'xdg-autostart', dir, filePath: path.join(dir, 'antigravity-rtl-math.desktop') };
}

function escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildGuardPayload(kind, nodePath, cliPath) {
    if (kind === 'vbs-startup') {
        const safeNode = String(nodePath).replace(/"/g, '""');
        const safeCli = String(cliPath).replace(/"/g, '""');
        return [
            "' Antigravity RTL + Math Auto-Heal Guard (hidden startup check)",
            'Set WshShell = CreateObject("WScript.Shell")',
            `cmd = """${safeNode}"" ""${safeCli}"" --ensure --silent"`,
            'WshShell.Run cmd, 0, False',
            ''
        ].join('\r\n');
    }
    if (kind === 'launchd') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.github.mahdieft03.antigravity-rtl-math</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(cliPath)}</string>
    <string>--ensure</string>
    <string>--silent</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
    }
    return [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Antigravity RTL + Math Guard',
        `Exec="${nodePath}" "${cliPath}" --ensure --silent`,
        'Hidden=false',
        'NoDisplay=true',
        'X-GNOME-Autostart-enabled=true',
        ''
    ].join('\n');
}

export function getGuardStatus(options = {}) {
    const target = getGuardTarget(options.platform, options);
    return {
        installed: fs.existsSync(target.filePath),
        filePath: target.filePath,
        kind: target.kind
    };
}

export function installGuard({ nodePath = process.execPath, cliPath = DEFAULT_CLI_PATH, homeDir = os.homedir(), ...targetOpts } = {}) {
    const target = getGuardTarget(targetOpts.platform, { homeDir, ...targetOpts });
    fs.mkdirSync(target.dir, { recursive: true });
    fs.writeFileSync(target.filePath, buildGuardPayload(target.kind, nodePath, cliPath), 'utf8');
    try {
        updatePatchMeta('guard', { installed: true, filePath: target.filePath, cliPath }, homeDir);
    } catch (_) {}
    return target;
}

export function removeGuard({ homeDir = os.homedir(), ...targetOpts } = {}) {
    const target = getGuardTarget(targetOpts.platform, { homeDir, ...targetOpts });
    const existed = fs.existsSync(target.filePath);
    if (existed) {
        fs.rmSync(target.filePath, { force: true });
    }
    try {
        updatePatchMeta('guard', null, homeDir);
    } catch (_) {}
    return { removed: existed, filePath: target.filePath };
}

/**
 * Checks all detected targets and heals any target that was wiped by an app update or uses an older hook revision.
 */
export async function ensurePatched({
    appPath = detectAppAsarPath(),
    ideDir = detectIdeAppPath(),
    includeBrowser = false,
    checkProcess = true,
    silent = true,
    minHookRevision = CURRENT_HOOK_REVISION
} = {}) {
    const actions = [];

    if (appPath) {
        const st = getAppStatus(appPath);
        if (st.found && (st.patchState !== 'rtl-math' || st.hookRevision < minHookRevision)) {
            if (checkProcess && checkRunningAntigravity('app').running) {
                actions.push({ target: 'app', path: appPath, previousState: st.patchState, hookRevision: st.hookRevision, healed: false, skippedRunning: true });
            } else {
                const ok = await patchApp(appPath, { exitOnError: false, checkProcess: false, silent });
                actions.push({ target: 'app', path: appPath, previousState: st.patchState, hookRevision: st.hookRevision, healed: ok, failed: !ok });
            }
        } else if (st.found) {
            actions.push({ target: 'app', path: appPath, previousState: st.patchState, hookRevision: st.hookRevision, healed: false, upToDate: true });
        }
    }

    if (ideDir) {
        const st = getIdeStatus(ideDir);
        if (st.found && (st.patchState !== 'rtl-math' || st.hookRevision < minHookRevision)) {
            if (checkProcess && checkRunningAntigravity('ide').running) {
                actions.push({ target: 'ide', path: ideDir, previousState: st.patchState, hookRevision: st.hookRevision, healed: false, skippedRunning: true });
            } else {
                const ok = await patchIde(ideDir, { exitOnError: false, checkProcess: false, silent });
                actions.push({ target: 'ide', path: ideDir, previousState: st.patchState, hookRevision: st.hookRevision, healed: ok, failed: !ok });
            }
        } else if (st.found) {
            actions.push({ target: 'ide', path: ideDir, previousState: st.patchState, hookRevision: st.hookRevision, healed: false, upToDate: true });
        }
    }

    if (includeBrowser || getBrowserStatus().installed) {
        const bst = getBrowserStatus();
        if (!bst.installed || bst.patchState !== 'rtl-math' || compareSemver(bst.version, PKG_VERSION) < 0) {
            installBrowserExtension({ openFolder: false, silent });
            actions.push({ target: 'browser', path: bst.dir, previousState: bst.patchState, healed: true });
        } else {
            actions.push({ target: 'browser', path: bst.dir, previousState: bst.patchState, healed: false, upToDate: true });
        }
    }

    return {
        ok: !actions.some(a => a.failed),
        checkedAt: new Date().toISOString(),
        meta: readPatchMeta(),
        actions
    };
}
