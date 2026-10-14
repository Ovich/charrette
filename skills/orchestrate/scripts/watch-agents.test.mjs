#!/usr/bin/env node
/**
 * Tests for watch-agents.mjs. `node watch-agents.test.mjs`, no framework.
 *
 * The cases that matter are the three this script got wrong when it was written by hand
 * during a live slice: a boundary check that fired on file content, a finished subagent
 * counted as live, and a non-ASCII console kill.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./watch-agents.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "watch-agents-"));
let failures = 0;

const check = (name, condition) => {
  console.log(`${condition ? "ok  " : "FAIL"} ${name}`);
  if (!condition) failures += 1;
};

/** A transcript of one assistant turn per entry. */
const write = (id, blocks, ageSeconds = 0) => {
  const path = join(dir, `agent-${id}.jsonl`);
  writeFileSync(
    path,
    blocks.map((b) => JSON.stringify({ message: { role: "assistant", content: [b] } })).join("\n"),
  );
  const when = new Date(Date.now() - ageSeconds * 1000);
  utimesSync(path, when, when);
  return path;
};

const run = (path, ...extra) =>
  execFileSync("node", [script, path, ...extra], { encoding: "utf8" }).trim();

const tool = (name, input) => ({ type: "tool_use", name, input });
const text = (t) => ({ type: "text", text: t });

// Counting and the last-said line.
{
  const p = write("aaaaaaaa11", [tool("Bash", { command: "ls" }), text("done with step one")]);
  const out = run(p);
  check("counts tool calls", out.includes("calls=1"));
  check("reports what it last said", out.includes("done with step one"));
  check("tags by agent id", out.startsWith("aaaaaaaa"));
}

// A finished subagent is not a live one.
{
  const p = write("bbbbbbbb22", [tool("Bash", { command: "ls" })], 9999);
  check("skips a subagent past the idle limit", run(p) === "");
  check("--idle raises the limit", run(p, "--idle", "99999").includes("calls=1"));
}

// The boundary check, and the false positive that started it.
{
  const p = write("cccccccc33", [tool("Bash", { command: "aws cloudformation deploy --stack x" })]);
  check("flags a forbidden command", run(p, "--forbidden", "cloudformation\\s+deploy").includes("BREACH x1"));

  const heredoc = write("dddddddd44", [
    tool("Bash", { command: "cat > runbook.md <<'EOF'\nrun: aws cloudformation deploy\nEOF" }),
  ]);
  check(
    "does NOT flag a forbidden command inside a heredoc body",
    !run(heredoc, "--forbidden", "cloudformation\\s+deploy").includes("BREACH"),
  );

  check("no --forbidden means no breaches", !run(p).includes("BREACH"));
}

// A console on a legacy code page must not kill the watch.
{
  const p = write("eeeeeeee55", [text("criteria met ✅ and the run is green")]);
  const out = run(p);
  check("folds non-ASCII rather than throwing", out.includes("criteria met . and"));
}

// A directory stands for the transcripts in it.
{
  const out = execFileSync("node", [script, dir, "--idle", "99999"], { encoding: "utf8" });
  check("a directory expands to its transcripts", out.trim().split("\n").length >= 4);
}

// Several subagents at once: naming them, and the structured form.
{
  const p1 = write("11111111aa", [tool("Bash", { command: "ls" }), text("slice one")]);
  const p2 = write("22222222bb", [tool("Bash", { command: "ls" }), text("slice two")]);
  const both = execFileSync(
    "node",
    [script, p1, p2, "--label", "11111111=SL5", "--label", "22222222=SL6"],
    { encoding: "utf8" },
  );
  check("reports every live subagent", both.trim().split("\n").length === 2);
  check("names them from --label", both.includes("SL5 calls=1") && both.includes("SL6 calls=1"));

  const asJson = JSON.parse(run(p1, "--json", "--label", "11111111=SL5"));
  check("--json carries the label", asJson.name === "SL5" && asJson.id === "11111111");
  check("--json signals WORKING when fresh", asJson.signal === "WORKING");

  const stale = write("33333333cc", [tool("Bash", { command: "ls" })], 200);
  check("--json signals STALLED past two minutes", JSON.parse(run(stale, "--json")).signal === "STALLED");
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
