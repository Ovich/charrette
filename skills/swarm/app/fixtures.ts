// The mockup's "live" variant (2026-10-07-swarm-board.mockup.html) as the Board would return
// it: two plans on one repository, a second repository running, a third with a closed run.
import type { BoardSnapshot, RepoSummary, SnapshotEvent, SnapshotRunner } from "../src/board/board.ts";
import type { BoardState, RepoView } from "./hooks/useBoard.ts";

const at = (hm: string): string => {
  const [h, m] = hm.split(":").map(Number);
  return new Date(2026, 9, 7, h, m).toISOString();
};

export const APP = "/repos/charrette-app/.git";
const RT = "refresh-tokens";
const AL = "audit-log";

/** The runners' funny names (D43), fixed here; the Board picks them at random. */
export const NICKS: Record<string, string> = {
  [`${RT}/S2`]: "Lucky Moose",
  [`${RT}/S3`]: "Sleepy Otter",
  [`${RT}/S4`]: "Brave Badger",
  [`${RT}/S5`]: "Dizzy Puffin",
  [`${AL}/S1`]: "Jolly Walrus",
  [`${AL}/S2`]: "Quiet Llama",
};
const nickOf = (name: string): string => NICKS[name] ?? "orchestrator";

const runner = (
  name: string,
  title: string,
  doing: string,
  state: SnapshotRunner["state"],
  files: [string, boolean?][],
  joined: string,
  calls: number,
  ended: string | null = null,
): SnapshotRunner => {
  const i = name.lastIndexOf("/");
  return {
    runner: name,
    nick: nickOf(name),
    plan: name.slice(0, i),
    slice: name.slice(i + 1),
    title,
    doing,
    state,
    stale: false,
    files: files.map(([path, iface]) => ({ path, interface: !!iface, shared: false })),
    joined: at(joined),
    ended: ended === null ? null : at(ended),
    calls,
    listening: false,
  };
};

let seq = 0;
const ev = (hm: string, kind: SnapshotEvent["kind"], from: string, body: string, about: string | null = null): SnapshotEvent => ({
  seq: ++seq,
  at: at(hm),
  kind,
  from,
  body,
  about,
});

const RT_SLICES: [string, string, string, string[]][] = [
  ["S1", "Sessions table gains a token column", "done", []],
  ["S2", "The token store", "done", []],
  ["S3", "The Session interface carries the refresh token", "running", []],
  ["S4", "The refresh endpoint", "running", []],
  ["S5", "The client retries once on 401", "running", []],
  ["S6", "Settings lists signed-in devices", "blocked", ["S3", "S5"]],
  ["S7", "A session survives expiry, end to end", "blocked", ["S4", "S5"]],
];
const AL_SLICES: [string, string, string, string[]][] = [
  ["S1", "The audit table and its writer", "running", []],
  ["S2", "Every auth route writes an audit entry", "running", []],
  ["S3", "The audit page", "blocked", ["S1"]],
];
/** The audit-log plan and its first slice carry their documents' links (D44); the rest none. */
export const AL_LINK = "http://localhost:4321/d/41";
export const AL_S1_LINK = "http://localhost:4321/d/42";
const queue = (plan: string, slices: [string, string, string, string[]][]) =>
  slices.map(([slice, title, state, blockers]) => ({
    slice,
    title,
    link: plan === AL && slice === "S1" ? AL_S1_LINK : null,
    state,
    blockers,
    runner: state === "running" ? `${plan}/${slice}` : null,
  }));

export const RUNS = [
  { run: 1, plan: RT, code: "RT", title: "Sessions with refresh tokens", link: null, open: true, runners: 4, done: 2, of: 7 },
  { run: 2, plan: AL, code: "AL", title: "Audit log", link: AL_LINK, open: true, runners: 2, done: 0, of: 3 },
];

/** A run of charrette-app closed earlier: the Board lists it with the open ones (D34). */
const CLOSED_HERE = { run: 0, plan: "login-page", code: "LP", title: "The login page", link: null, open: false, runners: 0, done: 4, of: 4 };

export const LIVE: BoardSnapshot = {
  repo: APP,
  name: "charrette-app",
  runs: [CLOSED_HERE, ...RUNS],
  lock: null,
  roster: [
    runner(`${RT}/S3`, "The Session interface carries the refresh token", "Adding refreshToken to Session, then its two readers", "working", [["src/auth/session.ts", true], ["src/auth/session.test.ts"]], "14:02", 31),
    runner(`${RT}/orchestrator`, "", "7 slices prepared, 5 dispatched; S6 and S7 wait for their blockers", "watching", [], "14:00", 0),
    runner(`${AL}/orchestrator`, "", "3 slices prepared, 2 dispatched; S3 waits for S1", "watching", [], "14:05", 0),
    runner(`${RT}/S4`, "The refresh endpoint", "Writing POST /auth/refresh against the token store", "working", [["src/routes/auth.ts"], ["src/routes/refresh.test.ts"]], "14:02", 24),
    runner(`${RT}/S5`, "The client retries once on 401", "Running the client tests", "working", [["web/http/client.ts"], ["web/http/client.test.ts"]], "14:10", 12),
    runner(`${AL}/S1`, "The audit table and its writer", "Writing the migration for audit_entries", "working", [["src/audit/audit.ts", true], ["migrations/0042_audit.sql"]], "14:06", 15),
    runner(`${AL}/S2`, "Every auth route writes an audit entry", "Adding audit() to the login and logout handlers", "working", [["src/routes/login.ts"]], "14:06", 11),
    runner(`${RT}/S2`, "The token store", "merged and ended", "ended", [], "14:01", 9, "14:09"),
  ],
  events: [
    ev("14:02", "event", `${RT}/S3`, "joined: the Session interface"),
    ev("14:03", "msg", `${RT}/S3`, "@all I'm adding `refreshToken: string | null` to `Session`. Readers I know of: `web/http/client.ts`.", "src/auth/session.ts"),
    ev("14:05", "msg", `${RT}/S4`, "@S2 does `store.rotate()` return the new token or only write it?", "src/tokens/store.ts"),
    ev("14:06", "msg", `${RT}/S2`, "@S4 it returns it. Signature at `src/tokens/store.ts:12`.", "src/tokens/store.ts"),
    ev("14:09", "event", `${RT}/S2`, "merged a41c9e2: rebase onto a41c9e2.\nfiles: src/tokens/store.ts"),
    ev("14:12", "msg", `${AL}/S2`, "@RT·S4 I need one call at the top of every handler in `src/routes/auth.ts`. You hold it.", "src/routes/auth.ts"),
    ev("14:12", "msg", `${RT}/S4`, "@AL·S2 yes, I add it.", "src/routes/auth.ts"),
    ev("14:12", "agreement", `${RT}/S4`, "RT·S4 adds `audit(req, 'refresh')` in `src/routes/auth.ts`; AL·S2 does not touch the file.", "src/routes/auth.ts"),
    ev("14:13", "msg", `${RT}/S5`, "@S3 I read `Session` in the client. Is `expiresAt` staying a number?", "src/auth/session.ts"),
    ev("14:13", "msg", `${RT}/S3`, "@S5 yes, unchanged. Only the new field.", "src/auth/session.ts"),
  ],
  queues: { [RT]: queue(RT, RT_SLICES), [AL]: queue(AL, AL_SLICES) },
  files: [],
  flags: [],
};
// the FileMap's rows, as the Board derives them from the claims: one holder each here
LIVE.files = LIVE.roster.flatMap((r) => r.files.map((f) => ({ path: f.path, holders: [r.runner], interface: f.interface })));


const REPOS: RepoSummary[] = [
  { repo: APP, name: "charrette-app", runs: LIVE.runs },
  { repo: "/repos/billing-service/.git", name: "billing-service", runs: [{ run: 3, plan: "invoice-pdfs", code: "IP", title: "Invoice PDFs", link: null, open: true, runners: 3, done: 4, of: 6 }] },
  { repo: "/repos/docs-site/.git", name: "docs-site", runs: [{ run: 4, plan: "search-rewrite", code: "SR", title: "Search rewrite", link: null, open: false, runners: 0, done: 5, of: 5 }] },
];

export const liveState = (over: Partial<BoardSnapshot> = {}): BoardState => ({
  repos: REPOS.map((r): RepoView => ({ ...r, unread: 0 })),
  snapshot: { ...LIVE, ...over },
  connection: "live",
});

/** No run open anywhere: only the closed run of docs-site is listed. */
export const emptyState = (): BoardState => ({
  repos: [{ ...REPOS[2], unread: 0 }],
  snapshot: null,
  connection: "live",
});

export const at1414 = at("14:14");
