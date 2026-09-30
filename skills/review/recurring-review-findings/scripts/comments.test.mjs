import { test } from "node:test";
import assert from "node:assert/strict";
import { openers } from "./comments.mjs";

const c = (over) => ({
  in_reply_to_id: null,
  user: { login: "ovich", type: "User" },
  created_at: "2026-09-01T10:00:00Z",
  pull_request_url: "https://api.github.com/repos/o/r/pulls/21",
  path: "apps/web/a.ts",
  body: "  one place for this  ",
  html_url: "https://github.com/o/r/pull/21#discussion_r1",
  ...over,
});

test("keeps only openers by people, trimmed and sorted by pull request then date", () => {
  const rows = openers([
    c({ pull_request_url: "https://api.github.com/repos/o/r/pulls/29", created_at: "2026-09-03T10:00:00Z", body: "later" }),
    c({ in_reply_to_id: 5, body: "Done (abc123)" }),
    c({ user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, body: "P2 badge" }),
    c({ user: { login: "some-bot[bot]", type: "User" }, body: "typed as user, named as bot" }),
    c(),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.pr, r.body]),
    [
      [21, "one place for this"],
      [29, "later"],
    ],
  );
  assert.equal(rows[0].date, "2026-09-01");
  assert.equal(rows[0].author, "ovich");
});

test("--since drops what came before it", () => {
  const rows = openers([c(), c({ created_at: "2026-09-10T00:00:00Z", body: "new" })], "2026-09-05");
  assert.deepEqual(rows.map((r) => r.body), ["new"]);
});
