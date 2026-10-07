import { build } from "esbuild";

// CLI bundle. No runtime TS loader and no node_modules at runtime: swarm.mjs execs this output.
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
