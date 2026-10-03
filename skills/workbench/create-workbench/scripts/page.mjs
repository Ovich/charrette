// Writes a new workbench page: Basecoat inlined, the bench bar opening on the label, an
// empty data block for the feed, and the bridge from aiview's theme switch to Basecoat's
// `.dark`. The bench's own code goes in the last script, under its marker.
//   node page.mjs <YYYY-MM-DD-<bench>.workbench.html> --label "<label>"
// Refuses to overwrite: a bench that exists is changed, never regenerated.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--label");
const label = args[args.indexOf("--label") + 1];
if (!out || !args.includes("--label") || !label) {
  console.error('usage: node page.mjs <file.workbench.html> --label "<label>"');
  process.exit(2);
}
if (!out.endsWith(".workbench.html")) {
  console.error(`page.mjs: ${out} must end in .workbench.html, so aiview files it as kind workbench`);
  process.exit(2);
}
if (existsSync(out)) {
  console.error(`page.mjs: ${out} exists; change the bench, do not regenerate it`);
  process.exit(1);
}

const assets = join(dirname(fileURLToPath(import.meta.url)), "../assets/basecoat");
// `<` escaped wherever text lands inside an element that a stray `</style>` or `</script>` would close.
const css = readFileSync(join(assets, "basecoat.min.css"), "utf8").replace(/<\/style/gi, "<\\/style");
const js = readFileSync(join(assets, "basecoat.min.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const text = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text(label)}</title>
<style data-basecoat>${css}</style>
<style>
  body { margin: 0; background: var(--background); color: var(--foreground); }
  .bench-bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--background); }
  .bench-label { font-weight: 600; font-size: 15px; white-space: nowrap; }
  .bench-tools { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: 8px; }
  .bench { padding: 16px; }
</style>
</head>
<body>
<header class="bench-bar" data-component="BenchBar">
  <span class="bench-label">${text(label)}</span>
  <div class="bench-tools" id="bench-tools"></div>
</header>
<main class="bench" id="bench"></main>
<script id="data" type="application/json">null</script>
<script data-basecoat>${js}</script>
<script>
  // aiview forces its theme by rewriting the media query text, this one included, so the
  // page follows the viewer's switch as well as the machine's.
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const applyScheme = () => document.documentElement.classList.toggle("dark", scheme.matches);
  applyScheme();
  scheme.addEventListener("change", applyScheme);
  const DATA = JSON.parse(document.getElementById("data").textContent);
  // ---- the bench: renders DATA as the project produced it ----
</script>
</body>
</html>
`;
writeFileSync(out, page);
console.log(`wrote ${out} (${Math.round(page.length / 1024)} KB)`);
