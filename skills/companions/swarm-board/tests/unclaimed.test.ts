// The unclaimed writes `end` and `merge-lock` print (D72): a folder of more than 20 collapses to one line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unclaimedLines } from "../src/cli/unclaimed.ts";

const many = (folder: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${folder}/f${i}.js`);

test("a folder of more than 20 unclaimed writes prints as one line; the rest one line each, in order", () => {
  const paths = ["src/a.ts", ...many("dist/assets", 21), "dist/index.html", "README.md"];
  assert.deepEqual(unclaimedLines(paths), [
    "reconciled src/a.ts: written without a claim",
    "21 files under dist/assets/ written unclaimed",
    "reconciled dist/index.html: written without a claim",
    "reconciled README.md: written without a claim",
  ]);
});

test("exactly 20 in one folder still print one line each", () => {
  assert.equal(unclaimedLines(many("dist/assets", 20)).length, 20);
});
