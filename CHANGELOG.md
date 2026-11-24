# Changelog

All notable changes to **Antigravity RTL + Math** are documented here.
Inspired by [mmnaderi/antigravity-rtl](https://github.com/mmnaderi/antigravity-rtl).

## [3.1.0] - 2026-11-24

### Fixed
- **Antigravity 2.35+ Hub Loader & `BaseWindow`/`WebContentsView` Support (`v4` Hook)**: Added multi-pattern anchor detection supporting `void loadHubWindowUrl(win, url, { skipBootstrapMint });` alongside legacy `void win.loadURL(url);`, and resolved the primary Hub `WebContents` via `getHubWebContents(win)` / `hubContents` / `win.webContents`.
- **Lossless Anchor Preservation & Clean Restore**: Wrapped the original load call in `AG_RTL_ORIG_ANCHOR_START` / `AG_RTL_ORIG_ANCHOR_END` markers so idempotent re-patching, v3.0.0 → v3.1.0 upgrades, and `--restore` preserve the exact original statement.
- **Built-in Browser `localhost` Isolation**: Restricted secondary `web-contents-created` and subframe injections to remembered Hub/Language Server origins so user dev servers (e.g., `http://localhost:3000`) opened inside Antigravity's built-in browser tabs are not injected with the RTL panel or direction overrides.
- **Accurate Error & Exit-Code Reporting**: Separated missing `dist/utils.js` errors from missing injection-anchor errors in `patch-app.js`, reported `failed` vs `skipped (app running)` accurately in `--ensure`, returned non-zero exit codes on `--ensure` failure, and gated success output in `install.ps1` / `install.sh` on `$LASTEXITCODE` / exit status.

### Changed
- Centralized `PKG_VERSION` and `CURRENT_HOOK_REVISION` (`4`) in `src/core/meta.js` across CLI, `doctor`, `guard`, `patch-app`, `patch-ide`, and `patch-browser`.

## [3.0.0] - 2026-11-15

### Fixed
- **Zero Race-Condition Persistence on Restart & Auto-Reload**: Moved Electron `webContents` listener registration *before* `win.loadURL(url)`, added `did-finish-load`, `did-navigate-in-page`, and `did-frame-finish-load` hooks alongside `dom-ready`, cached the Vazirmatn font buffer in memory, and added process-wide `app.on('web-contents-created')` coverage with `WeakSet` deduplication.
- **Floating Safe-Zone Trigger on Windows**: When Antigravity's toolbar cluster is not mounted yet, positioned `#ag-rtl-topbar-btn` at `top: 46px; right: 16px` instead of `top: 12px` so it no longer renders underneath Windows' native `titleBarOverlay` caption controls.
- **SPA / React Unmount Recovery**: Updated `watchDom` to observe `removedNodes` matching `[id^="ag-rtl-"]`, listen on `visibilitychange` & window `focus`, and expose re-entrant `window.__agRtlController.ensureMounted()`.
- **Temp Extraction Safety**: Extracted `app.asar` inside `os.tmpdir()` with guaranteed cleanup in `finally` instead of writing temporary folders inside protected application directories.
- **Sandboxed Timer Safety**: Guarded `setTimeout`, `setInterval`, and `clearInterval` access inside `settings-panel.js` and `rtl-math-engine.js` for isolated `vm` / extension contexts.

### Added
- **Auto-Heal Startup Guard (`--install-guard`, `--remove-guard`, `--ensure`)**: Detects when Antigravity auto-updates overwrite `app.asar` or IDE bundles and cleanly restores v3 hooks (`Startup` `.vbs` on Windows, `launchd` `.plist` on macOS, XDG `.desktop` on Linux).
- **Deep Diagnostics (`--doctor`, `--status --json`)**: Verifies Node version, bundled assets, user config validity, App/IDE hook revision (`v3`), backup cleanliness, and Guard status.
- **GitHub Self-Updater (`--update`, `--force`)**: Downloads and applies releases directly from GitHub without requiring `git` installed.
- **One-Line GitHub Installers (`install.ps1` & `install.sh`)**: Installs source files, runtime dependencies, and global `antigravity-rtl-math` CLI shim with a single command.
- **Visual Polish & Presets**: Frosted glassmorphic panel with dark/light theme support, Quick Presets (`Balanced`, `Reading`, `Compact`) via UI & `--preset`, draggable floating pill, live `Shield ON` pill, `.katex-error` LTR isolation, inline math horizontal breathing space (`0.14em`), thin display-math scrollbars, interactive TTY dashboard, and bundled PNG icons (`48px`, `128px`) for the Chrome/Edge extension.

## [2.0.0] - 2026-11-15

### Added
- Shared ESM core (`config.js`, `rtl-math-css.js`, `rtl-math-engine.js`, `settings-panel.js`, `client-bundle.js`).
- Pure-DOM (`innerHTML`-free) Trusted Types safe bilingual EN/FA settings drawer + `Alt+R` shortcut.
- Math-aware Smart direction mode, `\text{...}` Persian-in-math isolation, KaTeX/MathJax/MathML isolation.
- Standalone App, Antigravity IDE, Chrome/Edge Remote Control Extension, interactive playground, CI matrix & test suite.

## [1.0.0]

- Initial prototype based on `mmnaderi/antigravity-rtl` concepts with strict KaTeX LTR isolation.
