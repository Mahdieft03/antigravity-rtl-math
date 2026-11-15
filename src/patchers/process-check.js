/**
 * Cross-platform running process check for Antigravity and Antigravity IDE.
 * Prevents half-written ASAR files when Windows holds a file lock on app.asar.
 */
import { execSync } from 'child_process';
import os from 'os';

export function checkRunningAntigravity(target = 'all') {
    const platform = os.platform();
    try {
        if (platform === 'win32') {
            const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
            const running = [];
            const lines = output.split(/\r?\n/);
            for (const line of lines) {
                const match = line.match(/^"([^"]+)"/);
                if (!match) continue;
                const proc = match[1].toLowerCase();
                if ((target === 'all' || target === 'app') && proc === 'antigravity.exe') {
                    if (!running.includes(match[1])) running.push(match[1]);
                }
                if ((target === 'all' || target === 'ide') && (proc === 'antigravity ide.exe' || proc === 'antigravity-ide.exe')) {
                    if (!running.includes(match[1])) running.push(match[1]);
                }
            }
            return { running: running.length > 0, processes: running };
        }

        const output = execSync('ps -eo comm', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
        const running = [];
        for (const line of output.split(/\r?\n/)) {
            const name = line.trim();
            if (!name) continue;
            const low = name.toLowerCase();
            if ((target === 'all' || target === 'app') && low === 'antigravity') {
                if (!running.includes(name)) running.push(name);
            }
            if ((target === 'all' || target === 'ide') && (low.includes('antigravity ide') || low === 'antigravity-ide')) {
                if (!running.includes(name)) running.push(name);
            }
        }
        return { running: running.length > 0, processes: running };
    } catch (_) {
        return { running: false, processes: [] };
    }
}
