/**
 * GitHub self-updater (`--update`) that works WITHOUT needing `git` installed.
 * Downloads official release or main tarball via HTTPS and verifies contents before updating.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export const GITHUB_OWNER = 'Mahdieft03';
export const GITHUB_REPO = 'antigravity-rtl-math';
const RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const MAIN_PKG_RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/package.json`;
const MAIN_TARBALL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/main.tar.gz`;

export function compareSemver(a, b) {
    const parse = v => String(v || '0.0.0').replace(/^v/, '').split('-')[0].split('.').map(n => Number(n) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] > pb[i]) return 1;
        if (pa[i] < pb[i]) return -1;
    }
    return 0;
}

export async function checkRemoteVersion({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch API not available in this Node.js runtime.');
    }
    const headers = { 'User-Agent': 'antigravity-rtl-math-updater', Accept: 'application/vnd.github+json' };

    try {
        const res = await fetchImpl(RELEASE_API, { headers, signal: AbortSignal.timeout(8000) });
        if (res.ok) {
            const rel = await res.json();
            if (rel && rel.tag_name) {
                return {
                    source: 'release',
                    version: String(rel.tag_name).replace(/^v/, ''),
                    tarballUrl: rel.tarball_url || MAIN_TARBALL,
                    htmlUrl: rel.html_url
                };
            }
        }
    } catch (_) {}

    const rawRes = await fetchImpl(MAIN_PKG_RAW, { headers, signal: AbortSignal.timeout(8000) });
    if (!rawRes.ok) {
        throw new Error(`Unable to check GitHub version (HTTP ${rawRes.status}).`);
    }
    const pkg = await rawRes.json();
    return {
        source: 'main',
        version: String(pkg.version || '0.0.0'),
        tarballUrl: MAIN_TARBALL,
        htmlUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
    };
}

function copyTreeFiltered(srcDir, dstDir) {
    const preserve = new Set(['node_modules', '.git']);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    fs.mkdirSync(dstDir, { recursive: true });
    for (const entry of entries) {
        if (preserve.has(entry.name)) continue;
        const src = path.join(srcDir, entry.name);
        const dst = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
            copyTreeFiltered(src, dst);
        } else if (entry.isFile()) {
            fs.copyFileSync(src, dst);
        }
    }
}

export async function selfUpdateFromGitHub({
    targetRoot = REPO_ROOT,
    force = false,
    fetchImpl = globalThis.fetch
} = {}) {
    const currentPkg = JSON.parse(fs.readFileSync(path.join(targetRoot, 'package.json'), 'utf8'));
    const currentVersion = currentPkg.version || '0.0.0';
    const remote = await checkRemoteVersion({ fetchImpl });

    if (!force && compareSemver(remote.version, currentVersion) <= 0) {
        return { updated: false, currentVersion, remoteVersion: remote.version, source: remote.source };
    }

    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-rtl-update-'));
    try {
        const archivePath = path.join(tmpBase, 'bundle.tar.gz');
        const extractDir = path.join(tmpBase, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });

        const res = await fetchImpl(remote.tarballUrl, {
            headers: { 'User-Agent': 'antigravity-rtl-math-updater' },
            redirect: 'follow',
            signal: AbortSignal.timeout(25000)
        });
        if (!res.ok) {
            throw new Error(`Failed to download update archive (HTTP ${res.status}).`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(archivePath, buf);

        execFileSync('tar', ['-xzf', archivePath, '-C', extractDir, '--strip-components=1'], {
            stdio: 'ignore',
            timeout: 15000
        });

        const nextPkgPath = path.join(extractDir, 'package.json');
        if (!fs.existsSync(nextPkgPath)) {
            throw new Error('Downloaded archive is missing package.json.');
        }

        const oldDeps = JSON.stringify(currentPkg.dependencies || {});
        const newPkg = JSON.parse(fs.readFileSync(nextPkgPath, 'utf8'));
        const depsChanged = oldDeps !== JSON.stringify(newPkg.dependencies || {});

        copyTreeFiltered(extractDir, targetRoot);

        if (depsChanged) {
            const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            execFileSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
                cwd: targetRoot,
                stdio: 'inherit',
                shell: process.platform === 'win32',
                timeout: 60000
            });
        }

        return {
            updated: true,
            currentVersion,
            remoteVersion: newPkg.version || remote.version,
            source: remote.source,
            depsChanged
        };
    } finally {
        try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_) {}
    }
}
