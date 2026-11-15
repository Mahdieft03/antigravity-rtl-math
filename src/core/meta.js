/**
 * Tracks installation/patch metadata separately from ~/.antigravity-rtl.json
 * so `--status`, `--doctor`, and `--ensure` can detect when an Antigravity auto-update overwrites app.asar.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_FILENAME, sanitizeConfig } from './config.js';

export const META_FILENAME = '.antigravity-rtl-meta.json';

export function getConfigFilePath(homeDir = os.homedir()) {
    return path.join(homeDir, CONFIG_FILENAME);
}

export function getMetaFilePath(homeDir = os.homedir()) {
    return path.join(homeDir, META_FILENAME);
}

export function readUserConfig(homeDir = os.homedir()) {
    const p = getConfigFilePath(homeDir);
    try {
        if (fs.existsSync(p)) {
            return sanitizeConfig(JSON.parse(fs.readFileSync(p, 'utf8')));
        }
    } catch (_) {}
    return sanitizeConfig({});
}

export function writeUserConfig(partial, homeDir = os.homedir()) {
    const p = getConfigFilePath(homeDir);
    let existing = {};
    try {
        if (fs.existsSync(p)) {
            existing = JSON.parse(fs.readFileSync(p, 'utf8'));
        }
    } catch (_) {}
    const sanitized = sanitizeConfig({ ...existing, ...partial });
    const merged = { ...existing, ...sanitized };
    fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf8');
    return sanitized;
}

export function readPatchMeta(homeDir = os.homedir()) {
    const p = getMetaFilePath(homeDir);
    try {
        if (fs.existsSync(p)) {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
    } catch (_) {}
    return {};
}

export function isTempPath(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath);
    const tmpRoot = path.resolve(os.tmpdir());
    const norm = s => (process.platform === 'win32' ? s.toLowerCase() : s);
    return norm(resolved) === norm(tmpRoot) || norm(resolved).startsWith(norm(tmpRoot) + path.sep);
}

export function updatePatchMeta(targetKey, info, homeDir = os.homedir()) {
    const p = getMetaFilePath(homeDir);
    const meta = readPatchMeta(homeDir);
    if (homeDir === os.homedir() && info && info.path && isTempPath(info.path)) {
        return meta;
    }
    if (info === null) {
        delete meta[targetKey];
    } else {
        meta[targetKey] = {
            ...(meta[targetKey] || {}),
            ...info,
            updatedAt: new Date().toISOString()
        };
    }
    fs.writeFileSync(p, JSON.stringify(meta, null, 2), 'utf8');
    return meta;
}
