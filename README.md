<div align="center">

# Antigravity RTL + Math

**Production-grade Right-to-Left (RTL) typography for Persian, Arabic, and Hebrew in Antigravity — with zero-glitch KaTeX, MathJax, and MathML formula isolation and post-update Auto-Heal.**

[![CI](https://github.com/Mahdieft03/antigravity-rtl-math/actions/workflows/ci.yml/badge.svg)](https://github.com/Mahdieft03/antigravity-rtl-math/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/Version-3.0.0-0ea5e9.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)

[One-Line Install](#quick-install-1-command-from-github) · [What's New in v3](#whats-new-in-v300) · [Why Math Breaks](#why-math-formulas-break-in-rtl-and-how-this-project-fixes-it) · [CLI & Guard](#cli-commands) · [Credits](#credits--inspiration) · [فارسی](#راهنمای-فارسی)

</div>

---

## Credits & Inspiration

This project was **inspired by [mmnaderi/antigravity-rtl](https://github.com/mmnaderi/antigravity-rtl)** and builds upon its core RTL patching architecture for Antigravity, expanding it into a production tool with a unified math-isolation engine, smart math-aware direction detection, `\text{...}` Persian-in-math support, multi-window pre-`loadURL` Electron injection, Safe-Zone glassmorphic UI, Startup Auto-Heal Guard, and one-line GitHub installers.

---

## Quick Install (1 Command from GitHub)

> No `git` installation required. Just **Node.js 20+**. Close Antigravity Desktop before running so it patches immediately (or run `antigravity-rtl-math --ensure` after closing it).

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/Mahdieft03/antigravity-rtl-math/main/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/Mahdieft03/antigravity-rtl-math/main/install.sh | bash
```

Once installed, `antigravity-rtl-math` is available globally in your terminal:

```bash
antigravity-rtl-math --doctor   # Check patch, hook revision, config & Auto-Heal Guard
antigravity-rtl-math --update   # Self-update directly from GitHub
```

---

## What's New in v3.0.0

- **Zero Race-Condition Persistence Across Restarts**: Registers Electron hooks (`dom-ready`, `did-finish-load`, `did-navigate-in-page`, `did-frame-finish-load`, plus process-wide `web-contents-created`) **before** `win.loadURL(url)` — eliminating misses on port auto-restarts and secondary windows.
- **Auto-Heal Startup Guard (`--install-guard` / `--ensure`)**: Optional lightweight logon check (`Startup` `.vbs` on Windows, `launchd` on macOS, XDG `.desktop` on Linux) that automatically detects when Antigravity auto-updates overwrite `app.asar` and silently re-applies the v3 hook.
- **Windows Caption Safe-Zone + Draggable Floating Trigger**: Never gets hidden behind Windows' top-right 30px `titleBarOverlay` (`— ☐ ✕`). Automatically docks into Antigravity's toolbar when ready or rests safely at `top: 46px` as a draggable pill.
- **Self-Healing DOM Recovery**: Automatically restores `#ag-rtl-topbar-btn` and `#ag-rtl-dynamic-style` if React/SPA hydration strips them during route changes or focus switches.
- **Glassmorphic UI & Dark/Light Theme Adaptation**: Backdrop-filter frosted panel with automatic `@media (prefers-color-scheme: light)` support, live `Shield ON` pill, **Quick Presets** (`Balanced`, `Reading`, `Compact`), inline formula margins (`0.14em`), `.katex-error` protection, custom thin display-math scrollbars, and bundled PNG icons (`48px` / `128px`) for the Chrome/Edge extension.
- **Built-In Diagnostics & GitHub Self-Updater**: `--doctor`, `--status --json`, `--update`, and interactive TTY dashboard.

---

## Why Math Formulas Break in RTL (and How This Project Fixes It)

1. **Reversed tokens, subscripts & mirrored symbols**: KaTeX (`katex.css`) does not enforce `direction: ltr`, so inheriting `direction: rtl` or `unicode-bidi: plaintext` flows `x_2 - x_1 = 0` right-to-left (`0 = 1x - 2x`) and mirrors parentheses `(` `)` and inequalities `≥` → `≤`.
2. **Broken math fonts & missing-glyph boxes (`□`)**: Overriding `font-family` on `*` clobbers `KaTeX_Main`, `KaTeX_Math`, `KaTeX_Size1..4`, and `KaTeX_AMS`.
3. **Shifted fractions & accents**: Overriding `line-height` and `text-align` on internal `.vlist` / `.mfrac` / `.mtable` spans misaligns `\tilde{L}`, superscripts, and aligned equations.
4. **Misaligned paragraphs starting with math or English terms**: Sentences like `$S'$ دستگاه متحرک است` or `Time Dilation در فیزیک...` were detected as LTR because the first strong character was Latin.
5. **Persian inside `\text{...}`**: Equations like `$$ \tilde{L} = L\gamma^{-1} \quad \text{انقباض طول} $$` need the outer formula locked LTR while `\text{...}` inside renders RTL with Vazirmatn.

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `antigravity-rtl-math` | Launch interactive TTY dashboard |
| `antigravity-rtl-math --app` | Patch Antigravity Standalone Desktop (`app.asar`) |
| `antigravity-rtl-math --ide` | Patch Antigravity IDE (`resources/app`) |
| `antigravity-rtl-math --browser` | Generate/update Chrome & Edge extension (`~/.antigravity-rtl-extension`) |
| `antigravity-rtl-math --all` | Patch Standalone App, IDE, and Browser extension |
| `antigravity-rtl-math --doctor` | Inspect Node, assets, config, hook revision (`v3`), and guard health |
| `antigravity-rtl-math --ensure` | Verify and auto-heal any wiped or pre-v3 targets |
| `antigravity-rtl-math --install-guard` | Enable lightweight startup Auto-Heal Guard |
| `antigravity-rtl-math --remove-guard` | Disable startup Auto-Heal Guard |
| `antigravity-rtl-math --preset <name>` | Apply visual preset (`default`, `reading`, `compact`) |
| `antigravity-rtl-math --lang <en\|fa>` | Switch panel UI language |
| `antigravity-rtl-math --status --json` | Machine-readable JSON status report |
| `antigravity-rtl-math --update` | Self-update from GitHub releases (no `git` needed) |
| `antigravity-rtl-math --demo` | Build & open the offline RTL + Math interactive playground |
| `antigravity-rtl-math --restore` | Restore clean original backups (`--remove-guard` supported) |

**Shortcut inside Antigravity:** Press **`Alt + R`** (`⌥ + R` on macOS) to toggle RTL+Math or click the `RTL+Math` pill to open the glassmorphic settings panel.

---

## Development & Testing

```bash
git clone https://github.com/Mahdieft03/antigravity-rtl-math.git
cd antigravity-rtl-math
npm install
npm test
```

*(In Windows PowerShell, use `npm.cmd install` / `npm.cmd test`.)*

---

<div dir="rtl">

## راهنمای فارسی

این پروژه با الهام از پروژه ارزشمند [mmnaderi/antigravity-rtl](https://github.com/mmnaderi/antigravity-rtl) ساخته شده و در **نسخه ۳.۰** از مرحله تست خارج شده و به یک ابزار پایدار و کامل برای **Antigravity Desktop**، **Antigravity IDE** و **افزونه کروم/اج (Remote Control)** تبدیل شده است.

### نصب تک‌دستوری مستقیم از گیتهاب (بدون نیاز به Git)

کافی است **Node.js 20 یا جدیدتر** نصب باشد. برنامه Antigravity را ببندید و این یک خط را در **PowerShell** اجرا کنید:

```powershell
irm https://raw.githubusercontent.com/Mahdieft03/antigravity-rtl-math/main/install.ps1 | iex
```

اگر هنگام اجرا برنامه Antigravity باز بود، اسکریپت محافظ را نصب می‌کند و کافی است بعد از بستن برنامه بزنید:

```powershell
antigravity-rtl-math --ensure
```

### قابلیت‌های نسخه ۳.۰ (v3.0.0)

- **رفع کامل مشکل پریدن پچ بعد از بستن یا آپدیت برنامه**:
  - هوک تزریق قبل از `win.loadURL` و برای تمام پنجره‌های Electron و رفرش‌های پورت داخلی رجیستر می‌شود.
  - دکمه `RTL+Math` در ویندوز دیگر زیر دکمه‌های بستن و کمینه پنجره (۳۰ پیکسل بالا) پنهان نمی‌شود، قابلیت **جابه‌جایی با موس (Drag)** دارد و با **Auto-Recovery** پس از رندر مجدد صفحه بلافاصله برمی‌گردد.
  - با قابلیت **Auto-Heal Guard (`--install-guard`)** حتی اگر خود Antigravity آپدیت خودکار بزند و فایل `app.asar` را جایگزین کند، به‌صورت خودکار ترمیم می‌شود.
- **طراحی شیشه‌ای (Glassmorphism) + حالت شب و روز + حالت‌های آماده (Presets)**:
  - انتخاب سریع حالت‌های **Balanced (متعادل)**، **Reading (مطالعه)** و **Compact (فشرده)** از داخل پنل (`Alt + R`) یا با `--preset`.
  - فاصله‌گذاری تمیز کنار فرمول‌های خطی، محافظت از `.katex-error`، اسکرول‌بار باریک برای فرمول‌های بلند و آیکون‌های PNG اختصاصی برای افزونه مرورگر.
- **عیب‌یابی و آپدیت مستقیم از گیتهاب**:
  - دستور `antigravity-rtl-math --doctor` برای بررسی سلامت کامل پچ و سیستم.
  - دستور `antigravity-rtl-math --update` برای دریافت مستقیم جدیدترین نسخه از گیتهاب بدون نیاز به `git`.

### دستورات پرکاربرد فارسی

- بررسی وضعیت و عیب‌یابی: `antigravity-rtl-math --doctor`
- باز کردن صفحه تست فرمول‌ها (با حالت شب/روز و شبیه‌ساز رفرش): `antigravity-rtl-math --demo`
- تنظیم حالت مطالعه با زبان فارسی: `antigravity-rtl-math --preset reading --lang fa`
- بازگردانی به حالت اولیه و حذف محافظ: `antigravity-rtl-math --restore --remove-guard`

</div>
