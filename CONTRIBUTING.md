# Contributing to Antigravity RTL + Math

Thank you for helping improve Persian, Arabic, and Hebrew RTL + mathematical formula rendering in Antigravity!

## Development Setup

```bash
git clone https://github.com/mahdieft03/antigravity-rtl-math.git
cd antigravity-rtl-math
npm install
npm test
```

*(On Windows PowerShell if script execution is restricted, use `npm.cmd install` and `npm.cmd test`.)*

## Guidelines

1. **Keep math strictly isolated**: Never apply prose `font-family`, `line-height`, `direction: rtl`, or `unicode-bidi: plaintext` inside `.katex`, `mjx-container`, `.MathJax`, `<math>`, `.mermaid`, `pre`, or `code`.
2. **Keep Pure-DOM UI (no `innerHTML`)**: All UI code in `src/ui/settings-panel.js` must remain immune to Trusted Types and CSP restrictions in Electron and VS Code webviews.
3. **Always run tests before opening a PR**:
   ```bash
   npm test
   ```
   When fixing a formula rendering issue, add a reproduction case in `test/katex-dom.test.js` or `test/engine.test.js`.
4. **Offline Playground Check**: Run `node src/cli.js --demo` to verify visual rendering in `demo/math-rtl-playground.html`.
