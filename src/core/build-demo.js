/**
 * Generates the interactive offline verification playground at `demo/math-rtl-playground.html`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSharedClientLib } from './client-bundle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export function buildDemoHtml() {
    const sharedLib = buildSharedClientLib().replace(/<\/script>/gi, '<\\/script>');

    return `<!DOCTYPE html>
<html lang="fa" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Antigravity RTL + Math Playground</title>
<link rel="stylesheet" href="../node_modules/katex/dist/katex.min.css" />
<script src="../node_modules/katex/dist/katex.min.js"></script>
<style>
  :root {
    --background: #0d1117;
    --foreground: #e6edf3;
    --card: #161b22;
    --popover: #161b22;
    --popover-foreground: #e6edf3;
    --secondary: #21262d;
    --secondary-foreground: #e6edf3;
    --muted: #21262d;
    --muted-foreground: #8b949e;
    --border: rgba(255, 255, 255, 0.14);
    --color-primary: #3b82f6;
  }
  body {
    margin: 0;
    background: var(--background);
    color: var(--foreground);
    padding: 24px 16px 64px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .shell {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    direction: ltr;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 24px;
  }
  .pill {
    display: inline-block;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 1px 7px;
    font-size: 0.9em;
  }
  pre {
    background: #0b0f14;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    overflow-x: auto;
  }
  code {
    background: rgba(110, 118, 129, 0.25);
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  pre code {
    background: transparent;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 8px 10px;
  }
  blockquote {
    margin: 12px 0;
    padding: 6px 14px;
    opacity: 0.9;
    background: rgba(255, 255, 255, 0.03);
  }
  .live-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    direction: ltr;
  }
  @media (max-width: 760px) {
    .live-grid { grid-template-columns: 1fr; }
  }
  textarea.latex-input {
    width: 100%;
    min-height: 150px;
    background: #0b0f14;
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 13px;
    resize: vertical;
  }
</style>
</head>
<body>
<div class="shell">
  <div class="topbar">
    <div>
      <strong>Antigravity RTL + Math Playground</strong>
      <span style="opacity:0.65;font-size:12px;margin-left:8px;">Press Alt+R or click RTL+Math button</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span data-testid="titlebar-more-actions"></span>
    </div>
  </div>

  <div class="card">
    <div id="conversation" data-testid="conversation-view">
      <div class="prose leading-relaxed" data-testid="chat-message">
        <ul>
          <li>
            <span class="pill">[جزوه — ص ۲ بالا]</span> : روی نمودار بالای صفحه ۲، جزوه طول ویژه را <span class="math-inline" data-tex="L"></span> و طول اندازه‌گیری‌شده در حرکت را <span class="math-inline" data-tex="\\tilde{L}"></span> می‌نامد و رابطه درست زیر را می‌نویسد:
            <div class="math-display" data-tex="\\tilde{L} = L\\gamma^{-1} \\quad (\\gamma \\ge 1) \\qquad \\text{انقباض طول}"></div>
          </li>
        </ul>

        <h3>۲.۳ حالت ۲: اتساع زمان (Time Dilation) و اصلاح دو نکته مهم جزوه</h3>

        <ul>
          <li>
            <span class="pill">[جزوه — ص ۱ پایین]</span> : در جزوه دو سطر برای زمان نوشته شده است:
            <ol>
              <li>
                ابتدا شرط سکون ساعت در <span class="math-inline" data-tex="S'"></span> را می‌گذارد: <span class="math-inline" data-tex="x'_2 = x'_1 \\implies x_2 - x_1 = v(t_2 - t_1)"></span> (یعنی همان‌طور که استاد در کلاس اشاره می‌کند، ساعتی که در <span class="math-inline" data-tex="S'"></span> ساکن است در دستگاه <span class="math-inline" data-tex="S"></span> با سرعت <span class="math-inline" data-tex="v"></span> به اندازه <span class="math-inline" data-tex="\\Delta x = v\\Delta t"></span> جابه‌جا می‌شود).
              </li>
              <li>
                سپس در پایین‌ترین سطر صفحه ۱، ساعت را در دستگاه <span class="math-inline" data-tex="S"></span> ساکن می‌گیرد (<span class="math-inline" data-tex="x_2 = x_1"></span>) و دو رویداد تیک‌های ساعت را به <span class="math-inline" data-tex="S'"></span> می‌برد:
              </li>
            </ol>
            <div class="math-display" data-tex="\\left. \\begin{aligned} x'_2 - x'_1 &= \\gamma(-v)(t_2 - t_1) \\\\ t'_2 - t'_1 &= \\gamma(t_2 - t_1) \\end{aligned} \\right\\} \\implies x_1 = x_2 \\qquad \\text{اتساع (کش آمدن) زمان}"></div>
          </li>

          <li>
            <span class="pill">[وویس کلاس — چانک ۱، ۱۷:۳۰ تا ۲۴:۰۰]</span> :
            <ul>
              <li>
                چون ساعت در <span class="math-inline" data-tex="S"></span> ساکن است (<span class="math-inline" data-tex="x_2 = x_1"></span>)، بازه زمانی <span class="math-inline" data-tex="T = t_2 - t_1"></span> زمان ویژه (proper time) است (کمترین بازه زمانی ممکن میان آن دو رویداد). اما در دستگاه <span class="math-inline" data-tex="S'"></span>، آن دو تیک در دو مکان متفاوت (<span class="math-inline" data-tex="x'_2 \\neq x'_1"></span>) رخ می‌دهند و بازه زمانی برابر <span class="math-inline" data-tex="\\tilde{T} = t'_2 - t'_1 = \\gamma T > T"></span> می‌شود؛ یعنی ساعت متحرک در دستگاه <span class="math-inline" data-tex="S'"></span> کندتر کار می‌کند.
              </li>
              <li>
                <span class="math-inline" data-tex="S'"></span> دستگاه متحرک است و پاراگرافی که با فرمول یا <code>Time Dilation</code> شروع شود هم همچنان باید راست‌چین بماند!
              </li>
            </ul>
          </li>
        </ul>

        <p>Time Dilation در فیزیک نسبیت به معنای کند شدن زمان در دستگاه متحرک است و با رابطه <span class="math-inline" data-tex="\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}"></span> محاسبه می‌شود.</p>

        <blockquote class="border-l-4">
          نکته تکمیلی: درون فرمول‌هایی مثل <span class="math-inline" data-tex="\\text{مرحله 1: سرعت } v \\text{ در دستگاه } S'"></span>، متن فارسی درون <code>\\text{...}</code> هم راست‌به‌چپ باقی می‌ماند!
        </blockquote>

        <table>
          <thead>
            <tr><th>کمیت</th><th>نماد</th><th>فرمول</th></tr>
          </thead>
          <tbody>
            <tr><td>ضریب لورنتس</td><td><span class="math-inline" data-tex="\\gamma"></span></td><td><span class="math-inline" data-tex="\\frac{1}{\\sqrt{1 - \\beta^2}}"></span></td></tr>
            <tr><td>طول منقبض‌شده</td><td><span class="math-inline" data-tex="\\tilde{L}"></span></td><td><span class="math-inline" data-tex="L / \\gamma"></span></td></tr>
          </tbody>
        </table>

        <pre><code>// Code blocks always stay strict LTR
const gamma = (v, c = 299792458) => 1 / Math.sqrt(1 - (v * v) / (c * c));
console.log('Lorentz factor:', gamma(0.8 * 299792458));</code></pre>
      </div>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0;direction:ltr;">Interactive Formula + RTL Tester</h3>
    <div class="live-grid">
      <div>
        <textarea id="live-input" class="latex-input" dir="auto">در معادله شرودینگر $i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi$ داریم:
$$\\int_{-\\infty}^{\\infty} |\\psi(x)|^2 \\, dx = 1 \\qquad \\text{شرط بهنجارش (نرمال‌سازی)}$$</textarea>
      </div>
      <div id="live-preview" class="prose leading-relaxed" style="padding:10px;border:1px solid var(--border);border-radius:8px;"></div>
    </div>
  </div>
</div>

<script>
${sharedLib}
</script>
<script>
(function() {
  function renderKaTeXIn(root) {
    if (!window.katex) return;
    root.querySelectorAll('.math-inline').forEach(function(el) {
      el.innerHTML = window.katex.renderToString(el.getAttribute('data-tex') || '', { displayMode: false, throwOnError: false });
    });
    root.querySelectorAll('.math-display').forEach(function(el) {
      el.innerHTML = window.katex.renderToString(el.getAttribute('data-tex') || '', { displayMode: true, throwOnError: false });
    });
  }

  renderKaTeXIn(document);

  var controller = window.__agRtlMathLib.mountRtlMathController({
    doc: document,
    win: window,
    mode: 'app',
    initialConfig: {},
    fontSource: '../assets/Vazirmatn-Variable.woff2'
  });

  var liveInput = document.getElementById('live-input');
  var livePreview = document.getElementById('live-preview');

  function renderLive() {
    if (!window.katex) return;
    var text = liveInput.value;
    livePreview.innerHTML = '';
    var lines = text.split(/\\n/);
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement('p');
      var line = lines[i];
      var parts = line.split(/(\\$\\$[\\s\\S]+?\\$\\$|\\$[^$]+?\\$)/g);
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (!part) continue;
        if (part.startsWith('$$') && part.endsWith('$$')) {
          var spanD = document.createElement('span');
          spanD.innerHTML = window.katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false });
          p.appendChild(spanD);
        } else if (part.startsWith('$') && part.endsWith('$')) {
          var spanI = document.createElement('span');
          spanI.innerHTML = window.katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false });
          p.appendChild(spanI);
        } else {
          p.appendChild(document.createTextNode(part));
        }
      }
      livePreview.appendChild(p);
    }
    controller.refresh();
  }

  liveInput.addEventListener('input', renderLive);
  renderLive();
})();
</script>
</body>
</html>
`;
}

export function writeDemoFile() {
    const outPath = path.join(PROJECT_ROOT, 'demo', 'math-rtl-playground.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buildDemoHtml(), 'utf8');
    return outPath;
}
