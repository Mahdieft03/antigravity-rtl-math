<div align="center">

# Antigravity RTL + Math

**Seamless Right-to-Left (RTL) typography for Persian, Arabic, and Hebrew in Antigravity — with zero-glitch KaTeX, MathJax, and MathML formula isolation.**

[![CI](https://github.com/mahdieft03/antigravity-rtl-math/actions/workflows/ci.yml/badge.svg)](https://github.com/mahdieft03/antigravity-rtl-math/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)

[Why Math Breaks in RTL](#why-math-formulas-break-in-rtl-and-how-this-project-fixes-it) · [Features](#key-features) · [Quick Start](#quick-start) · [CLI Options](#cli-options) · [Credits & Inspiration](#credits--inspiration) · [فارسی](#راهنمای-فارسی)

</div>

---

## Credits & Inspiration

This project was **inspired by [mmnaderi/antigravity-rtl](https://github.com/mmnaderi/antigravity-rtl)** and builds upon its core RTL patching architecture for Antigravity, expanding it with a unified math-isolation engine, smart math-aware direction detection, `\text{...}` Persian-in-math support, IDE webview coverage, and a Pure-DOM (Trusted Types safe) settings drawer.

---

## Why Math Formulas Break in RTL (and How This Project Fixes It)

When RTL alignment is applied to Persian/Arabic chat messages using generic `.prose *` or `[dir="rtl"] *` CSS rules, mathematical formulas break in several ways:

1. **Reversed tokens, subscripts & mirrored symbols**: KaTeX (`katex.css`) does not enforce `direction: ltr`, so inheriting `direction: rtl` or `unicode-bidi: plaintext` flows `x_2 - x_1 = 0` right-to-left (`0 = 1x - 2x`) and mirrors parentheses `(` `)` and inequalities `≥` → `≤`.
2. **Broken math fonts & missing-glyph boxes (`□`)**: Overriding `font-family` on `*` clobbers `KaTeX_Main`, `KaTeX_Math`, `KaTeX_Size1..4`, and `KaTeX_AMS`, replacing italicized variables and large delimiters (`{`, `}`, `\sqrt`) with system UI fonts or tofu boxes (`□`).
3. **Shifted fractions & accents**: Overriding `line-height` and `text-align` on internal `.vlist` / `.mfrac` / `.mtable` spans misaligns `\tilde{L}`, superscripts, and aligned equations.
4. **Misaligned paragraphs starting with math or English terms**: Sentences like `$S'$ دستگاه متحرک است` or `Time Dilation در فیزیک...` were detected as LTR because the first strong character was Latin.
5. **Persian inside `\text{...}`**: Equations like `$$ \tilde{L} = L\gamma^{-1} \quad \text{انقباض طول} $$` need the outer formula locked LTR while the Persian `\text{...}` span inside renders RTL with Vazirmatn.

### Key Features

- **Bulletproof Math Isolation Shield**: Locks `.katex`, `.katex-display`, `.katex-html`, `.katex-mathml`, `mjx-container`, `.MathJax`, `<math>`, `.math-inline`, and `.math-display` to `direction: ltr; unicode-bidi: isolate;` at 0ms via CSS + runtime DOM enforcement.
- **Preserves All Math Fonts & Layout**: Prose typography (`Vazirmatn`, custom FA/EN/Code fonts, `line-height`, `font-size`) never leaks into KaTeX, MathJax, MathML, Mermaid diagrams, SVGs, Monaco editor, or terminals.
- **Persian `\text{...}` Inside Formulas**: Automatically detects Persian/Arabic inside `\text{...}` / `<mtext>` and isolates it as RTL with Vazirmatn font without disturbing surrounding math.
- **Math-Aware Smart Direction Modes**:
  - **Smart** *(default)*: Ignores inline math/code tokens and detects Persian prose even when a sentence starts with `$S'$`, `` `code` ``, or an English term (`Time Dilation در فیزیک...`).
  - **Auto**: Math-aware first prose character.
  - **Force**: Forces all prose RTL while keeping math, diagrams, and code strictly LTR.
- **Equation Alignment & Math Scale**: Align display math (`$$...$$`) Left / Center / Right and scale formulas (`0.85x`–`1.30x`) live.
- **All 3 Targets + Webviews**: Supports **Antigravity (Standalone App)**, **Antigravity IDE** (including Markdown preview / artifact webviews), and **Remote Control Browser Extension** (`--browser`).
- **Seamless Migration from `antigravity-rtl`**: Safely detects existing `mmnaderi/antigravity-rtl` patches and upgrades them while keeping clean original backups intact.
- **Pure-DOM UI (Trusted Types & CSP Safe)** + **EN / فارسی** panel toggle + **`Alt+R`** (`⌥R` on macOS) shortcut + **100% offline, zero telemetry**.

---

## Quick Start

> **Important:** Close Antigravity / Antigravity IDE completely before patching or restoring.

```bash
git clone https://github.com/mahdieft03/antigravity-rtl-math.git
cd antigravity-rtl-math
npm install
node src/cli.js --status    # Inspect detected apps & current patch state
node src/cli.js             # Auto-detect and patch Standalone App / IDE
```

*(In Windows PowerShell, if `npm` script execution is restricted, use `npm.cmd install` / `npm.cmd test`, or run `node src/cli.js` directly.)*

### CLI Options

| Command | Description |
| :--- | :--- |
| `node src/cli.js` | Auto-detect and patch Antigravity and/or Antigravity IDE |
| `node src/cli.js --app` | Patch Antigravity Standalone App only (`app.asar`) |
| `node src/cli.js --ide` | Patch Antigravity IDE only (`resources/app`) |
| `node src/cli.js --browser` | Build unpacked Chrome / Edge / Arc Remote Control extension (`~/.antigravity-rtl-extension`) |
| `node src/cli.js --status` | Show installation paths, patch state, backup health, and config path |
| `node src/cli.js --demo` | Generate and open the offline Math + RTL verification playground |
| `node src/cli.js --restore` | Revert patches and restore original backups (`--app`, `--ide`, or `--browser`) |
| `node src/cli.js --path "<path>"` | Specify custom path to `app.asar` or IDE folder |

### Testing

```bash
npm test
# or on Windows PowerShell:
npm.cmd test
```

The test suite verifies real KaTeX DOM rendering (`katex` + `jsdom`), MathJax v3, MathML, smart/auto/force direction detection, CSS selector isolation, Trusted Types (`innerHTML`-free) UI, ASAR/IDE patching, legacy `antigravity-rtl` migration, config XSS sanitization, and the Remote Control extension.

---

<div dir="rtl">

## راهنمای فارسی

این پروژه با الهام از پروژه [mmnaderi/antigravity-rtl](https://github.com/mmnaderi/antigravity-rtl) ساخته شده و برای حل کامل مشکل به‌هم‌ریختگی فرمول‌های ریاضی (KaTeX، MathJax و MathML) در کنار متن‌های فارسی و راست‌چین در **Antigravity**، **Antigravity IDE** و **افزونه Remote Control** توسعه یافته است.

### چرا فرمول‌ها در حالت RTL به‌هم می‌ریختند؟

۱. اعمال `direction: rtl` یا `unicode-bidi: plaintext` روی تگ‌های والد باعث می‌شد اجزای فرمول از راست به چپ چیده شوند (`x_2 - x_1` تبدیل به `1x - 2x` شود) و پرانتزها و علامت‌هایی مثل `≥` برعکس (`≤`) شوند.
۲. اعمال `font-family ... !important` روی `.prose *` یا `[dir="rtl"] *` فونت‌های تخصصی ریاضی (`KaTeX_Main`, `KaTeX_Math`, `KaTeX_Size1..4`) را خراب می‌کرد و باعث نمایش باکس‌های مربع (`□`) و آکولادهای شکسته می‌شد.
۳. اعمال `line-height` و `text-align` روی فرمول‌ها چیدمان کسرها، زیرنویس‌ها و نمادهایی مثل `\tilde{L}` را به‌هم می‌ریخت.
۴. جملاتی که با فرمول (`$S'$ دستگاه متحرک است`) یا اصطلاح انگلیسی (`Time Dilation در فیزیک...`) شروع می‌شدند اشتباهاً چپ‌چین می‌شدند.

### قابلیت‌های کلیدی

- **محافظ ایزوله‌سازی فرمول‌های ریاضی**: تمام فرمول‌های inline و display در KaTeX، MathJax و MathML همیشه چپ‌به‌راست (`LTR`) و ایزوله باقی می‌مانند و فونت و چیدمان اصلی خود را حفظ می‌کنند.
- **پشتیبانی از متن فارسی داخل `\text{...}`**: عبارات فارسی داخل فرمول (مانند `\text{انقباض طول}` یا `\text{اتساع (کش آمدن) زمان}`) به‌صورت خودکار راست‌چین و با فونت وزیرمتن نمایش داده می‌شوند بدون اینکه بقیه فرمول به‌هم بریزد.
- **تشخیص هوشمند جهت پاراگراف (Smart Mode)**: با نادیده گرفتن کدها و فرمول‌ها، حتی اگر پاراگراف فارسی با `$S'$` یا کلمه‌ای مثل `Time Dilation` شروع شود، جهت پاراگراف را درست تشخیص می‌دهد.
- **پنل تنظیمات دوزبانه (فارسی / انگلیسی)** با میانبر `Alt+R` (`⌥R` در مک): تنظیم حالت جهت‌دهی (`Smart` / `Auto` / `Force`)، تراز فرمول بلوکی (`چپ / وسط / راست`)، مقیاس اندازه فرمول، فونت فارسی/انگلیسی/کد، فاصله خطوط و اندازه فونت.
- **ارتقای امن از `antigravity-rtl`**: در صورت وجود پچ قبلی `antigravity-rtl`، بدون نیاز به نصب مجدد برنامه، آن را به نسخه جدید ارتقا می‌دهد و بکاپ اصلی را حفظ می‌کند.

### اجرای سریع در ویندوز

۱. برنامه Antigravity را کاملاً ببندید.
۲. در پوشه پروژه دستورات زیر را اجرا کنید:

```powershell
npm.cmd install
node src/cli.js --status
node src/cli.js
```

برای تست آفلاین فرمول‌ها قبل یا بعد از پچ می‌توانید دستور زیر را بزنید تا صفحه تست تعاملی باز شود:

```powershell
node src/cli.js --demo
```

برای بازگردانی به حالت اولیه:

```powershell
node src/cli.js --restore
```

</div>
