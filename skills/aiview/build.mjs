import { build } from "esbuild";

// CLI + server bundle. No runtime TS loader: aiview.mjs execs this output.
await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: "dist-cli/cli.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "info",
});

// The mermaid checker, bundled apart (about 3.5 MB) and loaded by the CLI only when the
// mermaid-check verb runs. DOMPurify is stubbed: nothing is rendered, so nothing is
// sanitised, and the real one will not initialise without a genuine document.
await build({
  entryPoints: ["src/mermaid/check.ts"],
  outfile: "dist-cli/mermaid-check.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  sourcemap: false,
  logLevel: "info",
  alias: { dompurify: "./src/mermaid/dompurify-stub.ts" },
});
