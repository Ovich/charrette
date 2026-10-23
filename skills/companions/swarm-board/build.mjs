import { build } from "esbuild";

// CLI bundle. No runtime TS loader and no node_modules at runtime: swarm.mjs execs this output.
// `--outfile <path>` writes it elsewhere (the test that runs the bundle alone).
const at = process.argv.indexOf("--outfile");
await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: at > 0 ? process.argv[at + 1] : "dist-cli/cli.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // ws is CommonJS: its require() of node builtins needs a real require in the ESM bundle (D18)
  banner: { js: 'import { createRequire as __swarmRequire } from "node:module"; const require = __swarmRequire(import.meta.url);' },
  sourcemap: false,
  logLevel: "info",
});

// The delivery hook (swarm-relay D43): its own small bundle, run at every tool call of every session; it loads the CLI only for a member.
if (at < 0) {
  await build({ entryPoints: ["src/hook/hook.ts"], outfile: "dist-cli/hook.mjs", bundle: true, platform: "node", format: "esm", target: "node22", sourcemap: false, logLevel: "info" });
}
