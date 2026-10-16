// src/cli/index.ts
import { spawn, spawnSync as spawnSync3 } from "node:child_process";
import fs4 from "node:fs";
import path4 from "node:path";

// src/board/board.ts
import fs2 from "node:fs";
import path2 from "node:path";

// src/board/home.ts
import os from "node:os";
import path from "node:path";
var DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
var SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");

// src/board/mentions.ts
function planCode(plan) {
  const words = plan.split(/[-_\s.]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length === 0) return plan.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
var isCodeShaped = (token) => /^[A-Za-z]{2}$/.test(token);
var plansOfCode = (code, plans) => plans.filter((plan) => planCode(plan) === code.toUpperCase());
var MENTION = /(?<![\w@])@([A-Za-z0-9][\w.\-]*(?:[\/·][A-Za-z0-9][\w.\-]*)?)/g;
var nameHandle = (nick) => nick.replace(/\s+/g, "").toLowerCase();
function parseMentions(body, senderPlan, plans, names) {
  const out = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    const named = names?.get(token.toLowerCase());
    if (named) {
      out.add(named);
    } else if (token.includes("/")) {
      const [plan, slice] = token.split("/");
      out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token.includes("\xB7")) {
      const [code, slice] = token.split("\xB7");
      for (const plan of plans) if (planCode(plan) === code.toUpperCase()) out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token === "swarm") {
      out.add(`${senderPlan}/*`);
    } else if (token === "all") {
      continue;
    } else if (isCodeShaped(token) && plansOfCode(token, plans).length) {
      for (const plan of plansOfCode(token, plans)) out.add(`${plan}/*`);
    } else {
      out.add(`${senderPlan}/${token}`);
    }
  }
  return [...out];
}
var editDistance = (a, b) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
};
function unmatchedMentions(body, senderPlan, plans, names) {
  const handleOf = new Map([...names ?? /* @__PURE__ */ new Map()].map(([handle, runner]) => [runner, handle]));
  const members = /* @__PURE__ */ new Set([...handleOf.keys(), ...[senderPlan, ...plans].map((p) => `${p}/orchestrator`)]);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    if (seen.has(token)) continue;
    seen.add(token);
    if (names?.has(token.toLowerCase())) continue;
    if (token === "all") {
      out.push({ name: token, closest: ["swarm"] });
      continue;
    }
    const targets = parseMentions(`@${token}`, senderPlan, plans, names);
    if (targets.length && targets.every((t) => t.endsWith("/*") || members.has(t))) continue;
    if (isCodeShaped(token)) {
      const codes = [...new Set(plans.map(planCode))];
      out.push({ name: token, closest: codes.sort((a, b) => editDistance(token.toUpperCase(), a) - editDistance(token.toUpperCase(), b)).slice(0, 3) });
      continue;
    }
    const wanted = token.split(/[/·]/).pop().toLowerCase();
    const gap = (member) => Math.min(editDistance(wanted, member.slice(member.lastIndexOf("/") + 1).toLowerCase()), editDistance(wanted, handleOf.get(member) ?? member));
    out.push({ name: token, closest: [...members].sort((a, b) => gap(a) - gap(b)).slice(0, 3) });
  }
  return out;
}

// src/board/kinds.ts
var run = (...events) => events.map((event) => ({ event, scope: "run" }));
var PROFILES = {
  plan: { kind: "plan", claims: true, mergeLock: true, worktree: true, member: "runner", defaults: { member: [], orchestrator: run("merged", "ended", "stale") } },
  brainstorm: { kind: "brainstorm", claims: false, mergeLock: false, worktree: false, member: "seat", defaults: { member: [], orchestrator: run("agreement", "endorsement", "ended", "stale") } }
};
function profileOf(kind) {
  const profile = PROFILES[kind];
  if (!profile || !Object.hasOwn(PROFILES, kind)) throw new Error(`unknown kind ${kind}: the kinds are ${Object.keys(PROFILES).join(", ")}`);
  return profile;
}

// src/board/events.ts
var word = (w) => /^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`;
var EVENTS = {
  // a seat backs another member's agreement (D36)
  agreement: {
    name: "agreement",
    next: (m, me, cli) => profileOf(me.kind).member === "seat" && m.from !== me.name ? `back it: ${cli} endorse ${m.seq} --as ${word(me.name)}` : null
  },
  endorsement: { name: "endorsement" },
  merged: { name: "merged" },
  joined: { name: "joined" },
  ended: { name: "ended" },
  stale: { name: "stale" },
  // an orchestrator silent STALE_MS, posted once in its run (D15); "back" when it calls again
  quiet: { name: "quiet" },
  back: { name: "back" },
  // when a run opens: its kind, group and title (D69)
  opened: { name: "opened" },
  closed: { name: "closed" },
  urgent: { name: "urgent", always: true },
  // the orchestrator opens a phase (`phase <name> <text>`), the current one ending with it: a separator on the thread;
  // it mentions `<group>/*`, so its own run's members wake and no other's, whatever the run's kind; a member
  // runs `done <name>` when its part is in
  phase: {
    name: "phase",
    next: (m, me, cli) => {
      const name = m.meta && "phase" in m.meta ? m.meta.phase : null;
      if (!name || me.slice === "orchestrator" || m.from === me.name) return null;
      return `when your part of ${name} is posted: ${cli} done ${word(name)} --as ${word(me.name)}`;
    }
  },
  // a member finished the current phase (`done <name>`); mentions the orchestrator
  done: { name: "done" },
  // every member of the run is done with the current phase: one event to the orchestrator
  "all-done": {
    name: "all-done",
    next: (m, me, cli) => me.slice === "orchestrator" ? `open the next phase: ${cli} phase <name> "<text>" --as ${word(me.name)}; after the last, ${cli} close --run ${m.run}` : null
  },
  // no readable token counter of the run moved for the run's stall threshold, posted again at each
  // further threshold of silence; mentions the orchestrator alone: a seat woken by it would move its
  // counter and feed the next one; the members read it in a later deliver
  stalled: {
    name: "stalled",
    toAuthor: true,
    next: (_m, me, cli) => me.slice === "orchestrator" ? `read the thread, then open the next phase (${cli} phase <name> "<text>" --as ${word(me.name)}) or address the member who owes a move (${cli} post "@<member> <what you need>" --as ${word(me.name)})` : null
  },
  // a member's transcript cannot be read: the stall check is blind for it; mentions the orchestrator
  liveness: { name: "liveness", toAuthor: true },
  // a write outside the writer's claim on a path another holds (D10); mentions: the holder, then the writer
  flag: {
    name: "flag",
    next: (m, me, cli) => {
      const [holder, writer] = m.mentions;
      if (!m.about || !holder || !writer) return null;
      if (me.name === holder) return `settle it: ${cli} agree ${word(`@${writer} <who changes what>`)} --about ${word(m.about)}`;
      if (me.name === writer) return `settle it: ${cli} post ${word(`@${holder} <what you change>`)} --about ${word(m.about)}`;
      return null;
    }
  }
};
var NAMES = Object.keys(EVENTS);
var isEvent = (s) => Object.hasOwn(EVENTS, s);
function eventOf(m) {
  if (m.event && isEvent(m.event)) return m.event;
  return m.kind === "agreement" || m.kind === "endorsement" || m.kind === "urgent" ? m.kind : null;
}
function parseSubscriptions(spec) {
  const parts = (Array.isArray(spec) ? spec : [spec]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const prefix = /^(any|main):/.exec(p)?.[0];
    const name = prefix ? p.slice(prefix.length) : p;
    if (!isEvent(name)) throw new Error(`unknown event ${name}: the events are ${NAMES.join(", ")}`);
    const sub = { event: name, scope: prefix ? "any" : "run" };
    if (!out.some((o) => o.event === sub.event && o.scope === sub.scope)) out.push(sub);
  }
  return out;
}
function formatSubscriptions(subs) {
  return subs.map((s) => s.scope === "any" ? `any:${s.event}` : s.event).join(", ");
}
function mentions(m, me) {
  return m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
}
function wakes(m, me, subs) {
  if (m.from === me.name && !(m.event && isEvent(m.event) && EVENTS[m.event].toAuthor)) return false;
  if (mentions(m, me)) return true;
  const e = eventOf(m);
  if (!e) return false;
  if (EVENTS[e].always) return true;
  return subs.some((s) => s.event === e && (s.scope === "any" || m.run === me.run));
}

// src/board/claims.ts
function claimsOf(deps) {
  const { db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf } = deps;
  const clearFlags = () => {
    db.prepare("DELETE FROM flags WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = flags.repo AND c.path = flags.path)").run();
    db.prepare(
      `DELETE FROM notices WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.participant)
         OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.other)`
    ).run();
  };
  const holdersOf = (repo, rel) => db.prepare("SELECT participant, kind, since_seq FROM claims WHERE repo = ? AND path = ? ORDER BY rowid").all(repo, rel).map((r) => ({ participant: Number(r.participant), kind: String(r.kind), since: Number(r.since_seq) })).filter((c) => isLive(c.participant));
  const hold = (p, rel, kind) => transaction(() => {
    const r = db.prepare(
      `INSERT INTO claims (repo, path, participant, kind, since_seq) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (repo, path, participant) DO UPDATE SET kind = excluded.kind WHERE claims.kind = 'inside' AND excluded.kind = 'interface'`
    ).run(p.repo, rel, p.id, kind, lastSeq());
    db.prepare(
      `INSERT INTO claim_log (repo, path, participant, kind) VALUES (?, ?, ?, ?)
         ON CONFLICT (repo, path, participant) DO UPDATE SET kind = 'interface' WHERE excluded.kind = 'interface'`
    ).run(p.repo, rel, p.id, kind);
    if (Number(r.changes) === 0) return false;
    bump(p.repo);
    return true;
  });
  const take = (p, rel, kind) => transaction(() => {
    const held = holdersOf(p.repo, rel).filter((c) => c.participant !== p.id);
    if (held.length) return { held, taken: false };
    return { held, taken: hold(p, rel, kind) };
  });
  const hasPostedAbout = (p, rel, holders) => {
    const since = Math.min(...holders.map((h) => h.since));
    const rows = db.prepare("SELECT seq, body, about, mentions FROM messages WHERE repo = ? AND author = ? AND seq > ? AND kind != 'event' AND by_board = 0").all(p.repo, p.id, since);
    const base = rel.split("/").pop();
    const names = (r) => {
      const about = r.about == null ? "" : fold(slashes(String(r.about)));
      const f = fold(rel);
      if (about && (about === f || f.endsWith(`/${about}`))) return true;
      const body = fold(String(r.body));
      return body.includes(f) || body.includes(fold(base));
    };
    const told = rows.filter(names).map((r) => ({ seq: Number(r.seq), mentions: JSON.parse(String(r.mentions)) }));
    return holders.every((h) => {
      const o = participantById(h.participant);
      return told.some((r) => r.seq > h.since && (r.mentions.includes(o.name) || r.mentions.includes(`${o.plan}/*`)));
    });
  };
  const recordShares = (me, rel, people) => {
    const share = db.prepare("INSERT OR IGNORE INTO shares (repo, path, participant, other, seq) VALUES (?, ?, ?, ?, ?)");
    for (const o of people) share.run(me.repo, rel, me.id, o.id, lastSeq());
  };
  const noticeOf = (me, rel, people) => {
    const told = db.prepare("INSERT OR IGNORE INTO notices (repo, path, participant, other) VALUES (?, ?, ?, ?)");
    const fresh = people.filter((o) => Number(told.run(me.repo, rel, me.id, o.id).changes) > 0);
    return fresh.length ? fresh.map((o) => `${rel} is also held by ${o.name}: ${doingOf(o.id)}`).join("; ") : null;
  };
  const releaseAll = (id) => {
    const owner = db.prepare("SELECT r.repo FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ?").get(id);
    const claims = Number(db.prepare("DELETE FROM claims WHERE participant = ?").run(id).changes);
    const locks = Number(db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id).changes);
    db.prepare("DELETE FROM claim_requests WHERE participant = ?").run(id);
    clearFlags();
    if (owner && claims + locks > 0) bump(String(owner.repo));
  };
  const takeLockWaiters = (repo) => {
    const rows = db.prepare("SELECT participant FROM lock_waiters WHERE repo = ? ORDER BY rowid").all(repo);
    db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(repo);
    return rows.map((r) => Number(r.participant)).filter(isLive).map((id) => participantById(id).name);
  };
  const openTurn = (p) => db.prepare(
    `SELECT rowid AS id, granted_at FROM lock_requests t WHERE participant = ? AND merged_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM call_log c WHERE c.participant = t.participant AND c.verb = 'end' AND c.at >= t.asked_at)
         ORDER BY rowid DESC LIMIT 1`
  ).get(p.id);
  const grantTurn = (p, at, anew) => {
    const turn = openTurn(p);
    if (turn && turn.granted_at == null) db.prepare("UPDATE lock_requests SET granted_at = ? WHERE rowid = ?").run(at, Number(turn.id));
    else if (!turn || anew) db.prepare("INSERT INTO lock_requests (repo, participant, asked_at, granted_at) VALUES (?, ?, ?, ?)").run(p.repo, p.id, at, at);
  };
  const declared = (id) => JSON.parse(String(db.prepare("SELECT files FROM participants WHERE id = ?").get(id).files));
  return {
    clearFlags,
    releaseAll,
    lockWaitersFreedBy(p) {
      const held = db.prepare("SELECT 1 FROM merge_locks WHERE repo = ? AND participant = ?").get(p.repo, p.id) !== void 0;
      return held ? takeLockWaiters(p.repo).filter((n) => n !== p.name) : [];
    },
    claimByPost(me, m) {
      if (m.kind !== "msg" && m.kind !== "agreement" || !m.about) return null;
      const about = fold(relPath(me.repo, m.about) ?? slashes(m.about));
      return transaction(() => {
        const asked = db.prepare("SELECT path, kind FROM claim_requests WHERE repo = ? AND participant = ?").all(me.repo, me.id).find((r) => {
          const x = fold(String(r.path));
          return x === about || x.endsWith(`/${about}`);
        });
        if (!asked) return null;
        const rel = String(asked.path);
        const others = holdersOf(me.repo, rel).filter((c) => c.participant !== me.id);
        if (!others.length || !hasPostedAbout(me, rel, others)) return null;
        hold(me, rel, String(asked.kind) === "interface" ? "interface" : "inside");
        db.prepare("DELETE FROM claim_requests WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        const people = others.map((c) => participantById(c.participant));
        recordShares(me, rel, people);
        return { path: rel, sharedWith: people.map((o) => o.name) };
      });
    },
    claimDeclared(p, files) {
      transaction(() => {
        for (const f of files) {
          const rel = relPath(p.repo, f.path);
          if (rel) take(p, rel, f.interface ? "interface" : "inside");
        }
      });
    },
    askedAbout(me, author, m) {
      const about = fold(relPath(me.repo, m.about) ?? slashes(m.about));
      const mine = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ? AND since_seq < ?").all(me.repo, me.id, m.seq);
      const rel = mine.map((r) => String(r.path)).find((x) => fold(x) === about || fold(x).endsWith(`/${about}`));
      if (!rel) return null;
      const theirs = db.prepare("SELECT 1 FROM claims WHERE repo = ? AND path = ? AND participant = ? AND since_seq < ?").get(me.repo, rel, author, m.seq);
      return theirs ? null : rel;
    },
    heldInOtherRun(p, rel) {
      const f = fold(rel);
      const rows = db.prepare("SELECT l.path FROM claim_log l JOIN participants q ON q.id = l.participant WHERE l.repo = ? AND q.run != ?").all(p.repo, p.run);
      return rows.some((r) => {
        const x = fold(String(r.path));
        return x === f || x.endsWith(`/${f}`);
      });
    },
    holds(p, about) {
      const f = fold(relPath(p.repo, about) ?? slashes(about));
      if (!f) return false;
      const rows = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ?").all(p.repo, p.id);
      return rows.some((r) => {
        const x = fold(String(r.path));
        return x === f || x.endsWith(`/${f}`);
      });
    },
    checkEdit(me, file, opts = {}) {
      const kind = opts.interface ? "interface" : "inside";
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true, sharedWith: [], notice: null };
      return transaction(() => {
        const all = holdersOf(me.repo, rel);
        const others = all.filter((c) => c.participant !== me.id);
        if (!others.length) {
          hold(me, rel, kind);
          return { allowed: true, sharedWith: [], notice: null };
        }
        const people = others.map((c) => participantById(c.participant));
        if (!all.some((c) => c.participant === me.id)) {
          if (!hasPostedAbout(me, rel, others)) {
            db.prepare(
              `INSERT INTO claim_requests (repo, path, participant, kind) VALUES (?, ?, ?, ?)
               ON CONFLICT (repo, path, participant) DO UPDATE SET kind = CASE WHEN claim_requests.kind = 'interface' THEN 'interface' ELSE excluded.kind END`
            ).run(me.repo, rel, me.id, kind);
            const who = people.map((o) => `${o.name} (${o.nick}: ${doingOf(o.id)})`).join(", ");
            const at = people.map((o) => `@${o.name}`).join(" ");
            return {
              allowed: false,
              refusal: `${rel} is also held by ${who}. You may share it, but first tell ${people.length > 1 ? "them" : "its holder"} what you change in it: \`swarm post "${at} \u2026" --about ${rel}\`; ${people.length > 1 ? "they answer" : "its holder answers"} with an agreement on who changes what (\`swarm agree \u2026 --about ${rel}\`), and that agreement goes. Claim again once posted; do not wait for the agreement.`
            };
          }
        }
        hold(me, rel, kind);
        db.prepare("DELETE FROM claim_requests WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        recordShares(me, rel, people);
        const sharedWith = people.map((o) => ({ runner: o.name, doing: doingOf(o.id) }));
        return { allowed: true, sharedWith, notice: noticeOf(me, rel, people) };
      });
    },
    reconcileWrites(me, changed) {
      const flags = [];
      return transaction(() => {
        const flag = db.prepare("INSERT OR IGNORE INTO flags (repo, path, participant) VALUES (?, ?, ?)");
        const posted = db.prepare("INSERT OR IGNORE INTO flag_posts (repo, path, participant, holder) VALUES (?, ?, ?, ?)");
        for (const file of changed) {
          const rel = relPath(me.repo, file);
          if (!rel) continue;
          if (holdersOf(me.repo, rel).some((c) => c.participant === me.id)) {
            take(me, rel, "inside");
            continue;
          }
          const { held: others, taken } = take(me, rel, "inside");
          if (taken || others.length) flag.run(me.repo, rel, me.id);
          if (!others.length) continue;
          const holder = participantById(others[0].participant);
          if (Number(posted.run(me.repo, rel, me.id, holder.id).changes) === 0) continue;
          const m = insertMessage(
            me,
            `@${holder.name} @${me.name} flag: ${me.name} wrote ${rel} outside its claim; ${holder.name} holds it. Settle it here.`,
            rel,
            "event",
            [holder.name, me.name],
            { event: EVENTS.flag.name }
          );
          flags.push({ path: rel, holder: holder.name, seq: m.seq });
        }
        return flags;
      });
    },
    release(me, file) {
      const rel = relPath(me.repo, file);
      if (!rel) return;
      transaction(() => {
        const r = db.prepare("DELETE FROM claims WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        if (Number(r.changes) === 0) return;
        clearFlags();
        bump(me.repo);
      });
    },
    lockMerge(me, onto, reflogMark) {
      return transaction(() => {
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          db.prepare("INSERT OR IGNORE INTO lock_waiters (repo, participant) VALUES (?, ?)").run(me.repo, me.id);
          const turn = openTurn(me);
          if (turn && turn.granted_at == null) db.prepare("UPDATE lock_requests SET refused = refused + 1 WHERE rowid = ?").run(Number(turn.id));
          else db.prepare("INSERT INTO lock_requests (repo, participant, asked_at, refused) VALUES (?, ?, ?, 1)").run(me.repo, me.id, now());
          return { granted: false, holder: participantById(Number(r.participant)).name };
        }
        if (r && Number(r.participant) === me.id) {
          if (onto) db.prepare("UPDATE merge_locks SET onto = ? WHERE repo = ?").run(onto, me.repo);
          grantTurn(me, String(db.prepare("SELECT at FROM merge_locks WHERE repo = ?").get(me.repo).at), false);
          return { granted: true };
        }
        db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(me.repo);
        const at = now();
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at, onto, reflog_mark) VALUES (?, ?, ?, ?, ?)").run(me.repo, me.id, at, onto ?? null, reflogMark ?? null);
        grantTurn(me, at, true);
        bump(me.repo);
        return { granted: true };
      });
    },
    heldMergeLock(me) {
      const r = db.prepare("SELECT at, onto, reflog_mark FROM merge_locks WHERE repo = ? AND participant = ?").get(me.repo, me.id);
      return r ? { grantedAt: String(r.at), onto: r.onto == null ? null : String(r.onto), reflogMark: r.reflog_mark == null ? null : Number(r.reflog_mark) } : null;
    },
    merged(me, sha, files, conflicts) {
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x) => x !== null))];
      const conflicted = conflicts && "files" in conflicts ? new Set(conflicts.files.map((f) => fold(slashes(f)))) : null;
      const wanted = new Set(rels);
      const told = /* @__PURE__ */ new Set();
      const iface = /* @__PURE__ */ new Set();
      const sharers = [];
      let waiters = [];
      let onto = null;
      transaction(() => {
        transaction(() => {
          const lock = db.prepare("SELECT participant, onto FROM merge_locks WHERE repo = ?").get(me.repo);
          if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
            throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
          }
          if (lock && Number(lock.participant) === me.id && lock.onto != null) onto = String(lock.onto);
          db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
          db.prepare("UPDATE participants SET merged = 1 WHERE id = ?").run(me.id);
          const turn = openTurn(me);
          if (turn) db.prepare("UPDATE lock_requests SET merged_at = ? WHERE rowid = ?").run(now(), Number(turn.id));
          waiters = takeLockWaiters(me.repo).filter((n) => n !== me.name);
        });
        for (const rel of rels) {
          for (const c of holdersOf(me.repo, rel)) {
            if (c.kind === "interface") iface.add(rel);
            if (c.participant !== me.id) told.add(participantById(c.participant).name);
          }
        }
        const everyone = db.prepare("SELECT p.id, p.slice, r.plan FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL").all(me.repo);
        for (const o of everyone) {
          for (const f of declared(Number(o.id))) {
            const rel = relPath(me.repo, f.path);
            if (!rel || !wanted.has(rel)) continue;
            if (f.interface) iface.add(rel);
            if (Number(o.id) !== me.id) told.add(`${o.plan}/${o.slice}`);
          }
        }
        const openPlans = db.prepare("SELECT DISTINCT plan, kind FROM runs WHERE repo = ? AND state = 'open'").all(me.repo).filter((r) => profileOf(String(r.kind)).claims).map((r) => String(r.plan));
        const all = iface.size ? openPlans.map((plan) => `${plan}/*`) : [];
        const lines = [`merged ${sha}${onto ? ` into ${onto}` : ""}: rebase your branch onto it.`];
        if (told.size) lines.push(`${[...told].map((n) => `@${n}`).join(" ")}: you hold or declared a file it changed.`);
        if (iface.size) lines.push(`@swarm interface changed: ${[...iface].join(", ")}.`);
        if (waiters.length) lines.push(`the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`);
        lines.push(`files: ${rels.join(", ") || "-"}`);
        for (const rel of rels) {
          if (conflicted && !conflicted.has(fold(rel))) continue;
          const ids = new Set(holdersOf(me.repo, rel).map((c) => c.participant));
          const held = db.prepare("SELECT l.participant FROM claim_log l JOIN participants p ON p.id = l.participant WHERE l.repo = ? AND l.path = ? AND p.run = ? ORDER BY l.rowid").all(me.repo, rel, me.run);
          for (const r of held) ids.add(Number(r.participant));
          ids.delete(me.id);
          for (const id of ids) sharers.push({ path: rel, runner: participantById(id).name });
        }
        const meta = { rebase: [...told], tell: [...new Set(sharers.map((o) => o.runner))] };
        insertMessage(me, lines.join("\n"), null, "event", [.../* @__PURE__ */ new Set([...told, ...waiters, ...all])], { event: EVENTS.merged.name, meta });
        db.prepare("INSERT INTO merges (participant, run, sha, at, files, conflicts) VALUES (?, ?, ?, ?, ?, ?)").run(
          me.id,
          me.run,
          sha,
          now(),
          JSON.stringify(rels),
          conflicts && "files" in conflicts ? JSON.stringify(conflicts.files.map(slashes)) : null
        );
      });
      return sharers;
    }
  };
}

// src/board/stats.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var MINUTE_MS = 60 * 1e3;
var CASELESS = process.platform === "win32";
var foldPath = (p) => CASELESS ? p.toLowerCase() : p;
var RECORDS_SINCE = "records-since";
var SHARES_SINCE = "shares-since";
var ORCHESTRATOR = "orchestrator";
var SKEPTIC = "skeptic";
var QUESTION = /^D\d+$/;
var FLAG_BODY = /flag:\s*\S+\s+wrote\s+(\S+)\s+outside its claim(?:;\s*(\S+)\s+holds it)?/;
var isBoardFlag = (m) => Number(m.by_board ?? 0) === 1 && (m.event === "flag" || m.event == null && FLAG_BODY.test(String(m.body)));
function distinctFlags(messages) {
  const seen = /* @__PURE__ */ new Set();
  return messages.filter((m) => {
    if (!isBoardFlag(m)) return false;
    const [, path5 = m.about ?? "", holder = ""] = String(m.body).match(FLAG_BODY) ?? [];
    const key = JSON.stringify([Number(m.author), foldPath(String(path5)), holder]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
var SOURCE = /[\w./\\-]+\.\w+:\d+|#\d+|https?:\/\/\S+/;
var WAIT_BINS_MS = [1, 2, 5, 10].map((m) => m * MINUTE_MS);
function periodStart(since) {
  if (since === void 0) return null;
  const days = since.match(/^(\d+)d$/);
  const at = days ? Date.now() - Number(days[1]) * DAY_MS : Date.parse(since);
  if (Number.isNaN(at)) throw new Error(`since takes <n>d or an ISO time, got ${since}`);
  return new Date(at).toISOString();
}
var ms = (at) => Date.parse(String(at));
var iso = (t) => new Date(t).toISOString();
var firstLine = (body) => body.split(/\r?\n/)[0].slice(0, 120);
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
function sumKnown(values) {
  const known = values.filter((v) => typeof v === "number");
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}
var aboutNames = (about, path5) => {
  if (about == null) return false;
  const a = foldPath(String(about).replace(/\\/g, "/"));
  const f = foldPath(path5);
  return a === f || f.endsWith(`/${a}`);
};
function timeline(joined, over, calls, turns, silentAfterMs) {
  if (!(over > joined)) return [];
  const exact = [];
  for (const t of turns) {
    if (t.refused > 0) exact.push({ from: t.asked, to: t.granted ?? t.over, what: "waiting" });
    if (t.granted !== null) exact.push({ from: t.granted, to: t.merged ?? t.over, what: "merging" });
  }
  const points = [joined, ...calls.filter((c) => c > joined && c < over), over].sort((a, b) => a - b);
  const silent = [];
  for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > silentAfterMs) silent.push({ from: points[i - 1], to: points[i], what: "silent" });
  const clip = (t) => Math.min(over, Math.max(joined, t));
  const bounds = [.../* @__PURE__ */ new Set([joined, over, ...[...exact, ...silent].flatMap((s) => [clip(s.from), clip(s.to)])])].sort((a, b) => a - b);
  const inside = (spans, what, at) => spans.some((s) => s.what === what && s.from <= at && at < s.to);
  const out = [];
  for (let i = 1; i < bounds.length; i++) {
    const from = bounds[i - 1];
    const to = bounds[i];
    const mid = (from + to) / 2;
    const what = inside(exact, "merging", mid) ? "merging" : inside(exact, "waiting", mid) ? "waiting" : inside(silent, "silent", mid) ? "silent" : "working";
    const last = out[out.length - 1];
    if (last && last.what === what && ms(last.to) === from) last.to = iso(to);
    else out.push({ from: iso(from), to: iso(to), what, inferred: what === "working" || what === "silent" });
  }
  return out;
}
function estimatedTimeline(joined, over, mergedAt) {
  if (!(over > joined)) return [];
  const merges = mergedAt.filter((t) => t > joined && t <= over).sort((a, b) => a - b);
  const working = { from: iso(joined), to: iso(merges[0] ?? over), what: "working", inferred: true };
  return [working, ...merges.map((t) => ({ from: iso(t), to: iso(t), what: "merging", inferred: true }))];
}
var MERGED_BODY = /^merged \S+/;
var FILES_LINE = /^files: (.*)$/m;
function mergesFromEvents(messages) {
  return messages.filter((m) => m.kind === "event" && (m.event === "merged" || m.event == null && MERGED_BODY.test(String(m.body)))).map((m) => {
    const line = String(m.body).match(FILES_LINE)?.[1].trim();
    const files = line === void 0 ? null : line === "-" ? [] : line.split(", ").map((f) => f.trim()).filter(Boolean);
    return { participant: Number(m.author), at: ms(m.at), files, conflicts: null };
  });
}
function computeRun(db, r, now, silentAfterMs) {
  const id = Number(r.id);
  const repo = String(r.repo);
  const kind = profileOf(String(r.kind ?? "plan")).kind;
  const openedAt = String(r.opened_at);
  const closedAt = r.closed_at == null ? null : String(r.closed_at);
  const runOver = closedAt ? ms(closedAt) : now;
  const since = db.prepare("SELECT value FROM settings WHERE name = ?").get(RECORDS_SINCE);
  const recorded = since !== void 0 && ms(openedAt) >= ms(since.value);
  const sharesSince = db.prepare("SELECT value FROM settings WHERE name = ?").get(SHARES_SINCE);
  const sharesRecorded = sharesSince !== void 0 && ms(openedAt) >= ms(sharesSince.value);
  const people = db.prepare("SELECT * FROM participants WHERE run = ? ORDER BY id").all(id);
  const ids = people.map((p) => Number(p.id));
  const marks = ids.map(() => "?").join(", ") || "NULL";
  const nameOf = (p) => `${r.plan}/${p.slice}`;
  const messages = db.prepare(`SELECT * FROM messages WHERE run = ? OR (run IS NULL AND author IN (${marks})) ORDER BY seq`).all(id, ...ids);
  const merges = recorded ? db.prepare("SELECT * FROM merges WHERE run = ? ORDER BY rowid").all(id) : [];
  const claimLog = db.prepare(`SELECT path, participant, kind FROM claim_log WHERE participant IN (${marks}) ORDER BY rowid`).all(...ids);
  const shares = db.prepare(`SELECT path, participant, other FROM shares WHERE participant IN (${marks}) AND other IN (${marks})`).all(...ids, ...ids);
  const orchestrators = new Set(people.filter((p) => String(p.slice) === ORCHESTRATOR).map((p) => Number(p.id)));
  const conflictedOf = (m) => m.conflicts == null ? null : JSON.parse(String(m.conflicts));
  const mergesRead = recorded ? merges.map((m) => ({ participant: Number(m.participant), at: ms(m.at), files: JSON.parse(String(m.files)), conflicts: conflictedOf(m) })) : mergesFromEvents(messages);
  const mergeTimesOf = (pid) => mergesRead.filter((m) => m.participant === pid).map((m) => m.at);
  const grants = recorded ? db.prepare(
    `SELECT t.participant, t.asked_at, t.granted_at, p.slice, r.plan FROM lock_requests t
             LEFT JOIN participants p ON p.id = t.participant LEFT JOIN runs r ON r.id = p.run
           WHERE t.repo = ? AND t.granted_at IS NOT NULL ORDER BY t.granted_at`
  ).all(repo) : [];
  const lockWaitsMs = [];
  const boardFlags = distinctFlags(messages);
  const racesLost = [];
  const members = people.map((p) => {
    const pid = Number(p.id);
    const joined = ms(p.joined_at);
    const over = Math.min(p.ended_at == null ? runOver : ms(p.ended_at), Math.max(now, joined));
    const calls = recorded ? db.prepare("SELECT at, verb FROM call_log WHERE participant = ? ORDER BY at").all(pid) : [];
    const endCalls = calls.filter((c) => c.verb === "end").map((c) => ms(c.at));
    const turns = recorded ? db.prepare("SELECT * FROM lock_requests WHERE participant = ? ORDER BY rowid").all(pid).map((t) => {
      const asked = ms(t.asked_at);
      const merged = t.merged_at == null ? null : ms(t.merged_at);
      return {
        asked,
        granted: t.granted_at == null ? null : ms(t.granted_at),
        merged,
        refused: Number(t.refused),
        // a turn without a merge is closed by the member's next end call (D25), else by its end
        over: merged ?? endCalls.find((e) => e >= asked) ?? over
      };
    }) : [];
    const memberMarks = [];
    let lost = 0;
    let waitedMs = null;
    for (const t of turns) {
      if (t.granted !== null) lockWaitsMs.push(t.granted - t.asked);
      if (t.refused === 0) continue;
      const until = t.granted ?? t.over;
      for (const g of grants) {
        const at = ms(g.granted_at);
        if (Number(g.participant) === pid || !(ms(g.asked_at) > t.asked) || !(at > t.asked && at < until)) continue;
        lost++;
        waitedMs = Math.max(waitedMs ?? 0, at - t.asked);
        const winner = g.slice == null ? "a member" : `${g.plan}/${g.slice}`;
        memberMarks.push({ at: iso(at), what: "race", note: `the merge lock went to ${winner}, who asked later` });
      }
    }
    if (lost) racesLost.push({ member: nameOf(p), lost, waitedMs });
    const own = messages.filter((m) => Number(m.author) === pid);
    const posts = own.filter((m) => m.kind !== "event" && Number(m.by_board ?? 0) === 0);
    const flagged = boardFlags.filter((m) => Number(m.author) === pid);
    for (const m of [...own.filter((x) => x.kind === "agreement"), ...flagged]) {
      memberMarks.push({
        at: String(m.at),
        what: m.kind === "agreement" ? "agreement" : "flag",
        seq: Number(m.seq),
        ...m.about != null ? { path: String(m.about) } : {},
        note: firstLine(String(m.body))
      });
    }
    for (const m of mergesRead.filter((x) => x.participant === pid)) {
      for (const f of m.conflicts ?? []) memberMarks.push({ at: iso(m.at), what: "conflict", path: f, note: `the rebase met a conflict in ${f}` });
    }
    memberMarks.sort((a, b) => ms(a.at) - ms(b.at));
    return {
      member: nameOf(p),
      nick: p.nick == null ? String(p.slice) : String(p.nick),
      slice: String(p.slice),
      joined: String(p.joined_at),
      ended: p.ended_at == null ? null : String(p.ended_at),
      intervals: recorded ? timeline(joined, over, calls.map((c) => ms(c.at)), turns, silentAfterMs) : estimatedTimeline(joined, over, mergeTimesOf(pid)),
      marks: memberMarks,
      posts: posts.length,
      postTimes: posts.map((m) => String(m.at)),
      claims: claimLog.filter((c) => Number(c.participant) === pid).length,
      flags: flagged.length,
      unsourced: posts.filter((m) => !SOURCE.test(String(m.body))).length,
      // read from its spans and marks once they are whole, below (D40)
      waitingMs: null,
      agreementsMade: null,
      endorsed: null,
      objections: null,
      estimated: !recorded
    };
  });
  const firstMerge = mergesRead.length ? Math.min(...mergesRead.map((m) => m.at)) : null;
  const length = runOver - ms(openedAt);
  const base = {
    run: id,
    kind,
    code: planCode(String(r.plan)),
    title: String(r.title),
    openedAt,
    closedAt,
    lengthMs: Number.isNaN(length) ? null : length,
    recorded,
    firstMergeAtMs: firstMerge === null ? null : firstMerge - ms(openedAt),
    racesLost: recorded ? racesLost.reduce((n, x) => n + (x.lost ?? 0), 0) : null,
    members
  };
  if (kind === "brainstorm") {
    const { brainstorm, marksOf, unsourcedOf } = debateOf(db, id, people.filter((p) => !orchestrators.has(Number(p.id))), messages);
    members.forEach((m, i) => {
      const pid = Number(people[i].id);
      m.marks = [...m.marks, ...marksOf.get(pid) ?? []].sort((a, b) => ms(a.at) - ms(b.at));
      m.unsourced = unsourcedOf.get(pid) ?? 0;
    });
    return { ...base, brainstorm };
  }
  if (kind !== "plan") return base;
  const sliceMembers = people.filter((p) => !orchestrators.has(Number(p.id)));
  const timesMs = sliceMembers.flatMap((p) => {
    const mergedAt = mergeTimesOf(Number(p.id));
    const end = mergedAt.length ? Math.min(...mergedAt) : p.ended_at == null ? null : ms(p.ended_at);
    return end === null ? [] : [end - ms(p.joined_at)];
  });
  const sliceCount = Number(db.prepare("SELECT COUNT(*) AS n FROM slices WHERE run = ?").get(id).n);
  const addedMidRun = messages.filter((m) => m.kind === "event" && orchestrators.has(Number(m.author)) && /^added \S+: /.test(String(m.body))).length;
  const holdersByPath = /* @__PURE__ */ new Map();
  for (const c of claimLog) {
    const key = foldPath(String(c.path));
    const entry = holdersByPath.get(key) ?? { path: String(c.path), holders: [] };
    if (!entry.holders.includes(Number(c.participant))) entry.holders.push(Number(c.participant));
    holdersByPath.set(key, entry);
  }
  const sharersOf = (path5) => new Set(shares.filter((sh) => foldPath(String(sh.path)) === foldPath(path5)).flatMap((sh) => [Number(sh.participant), Number(sh.other)]));
  const byId = new Map(people.map((p) => [Number(p.id), p]));
  const membershipOf = (pid) => {
    const p = byId.get(pid);
    return { from: ms(p.joined_at), to: p.ended_at == null ? runOver : ms(p.ended_at) };
  };
  const membersTogether = (a, b) => {
    const x = membershipOf(a);
    const y = membershipOf(b);
    return x.from < y.to && y.from < x.to;
  };
  const claimersTogether = (claimers) => claimers.filter((h) => claimers.some((o) => o !== h && membersTogether(h, o)));
  const namesPath = (m, path5) => {
    if (aboutNames(m.about, path5)) return true;
    const body = foldPath(String(m.body));
    return body.includes(foldPath(path5)) || body.includes(foldPath(path5.split("/").pop()));
  };
  const said = messages.filter((m) => m.kind !== "event" && Number(m.by_board ?? 0) === 0);
  const interfaceClaims = claimLog.filter((c) => c.kind === "interface");
  const perFile = [];
  let everyHolderTold = 0;
  let agreed = 0;
  let agreedBeforeMerge = 0;
  for (const { path: path5, holders: everyHolder } of holdersByPath.values()) {
    const sharers = sharersOf(path5);
    const holders = sharesRecorded ? everyHolder.filter((h) => sharers.has(h)) : claimersTogether(everyHolder);
    if (holders.length < 2) continue;
    const tellTimes = [];
    let told = true;
    for (let i = 1; i < holders.length; i++) {
      const tells = said.filter((m) => Number(m.author) === holders[i] && namesPath(m, path5));
      tellTimes.push(...tells.map((m) => ms(m.at)));
      const mentioned = (e) => tells.some((m) => {
        const named = JSON.parse(String(m.mentions));
        return named.includes(nameOf(byId.get(e))) || named.includes(`${r.plan}/*`);
      });
      if (!holders.slice(0, i).every(mentioned)) told = false;
    }
    const sharedAt = tellTimes.length ? Math.min(...tellTimes) : null;
    const agreement = messages.find((m) => m.kind === "agreement" && aboutNames(m.about, path5));
    const mergedWith = mergesRead.filter((m) => m.files ? m.files.some((f) => foldPath(f) === foldPath(path5)) : holders.includes(m.participant));
    const firstMergeOfPath = mergedWith.length ? Math.min(...mergedWith.map((m) => m.at)) : null;
    if (told) {
      everyHolderTold++;
      if (agreement) {
        agreed++;
        if (firstMergeOfPath === null || ms(agreement.at) < firstMergeOfPath) agreedBeforeMerge++;
      }
    }
    const met = mergedWith.map((m) => m.conflicts);
    const conflict = !recorded ? null : met.some((c) => c?.some((f) => foldPath(f) === foldPath(path5))) ? true : met.some((c) => c === null) ? null : false;
    const declaredInterface = holders.some(
      (h) => JSON.parse(String(byId.get(h).files ?? "[]")).some((d) => d.interface === true && aboutNames(d.path, path5))
    );
    const claimedInterface = interfaceClaims.some((c) => holders.includes(Number(c.participant)) && foldPath(String(c.path)) === foldPath(path5));
    perFile.push({
      path: path5,
      holders: holders.map((h) => nameOf(byId.get(h))),
      interface: declaredInterface || claimedInterface,
      told,
      agreement: agreement ? Number(agreement.seq) : null,
      // below 0: agreed before the tell (D46)
      agreedAfterMs: agreement && sharedAt !== null ? ms(agreement.at) - sharedAt : null,
      conflict
    });
  }
  let known = 0;
  let inShared = 0;
  let unknownMerges = 0;
  for (const m of merges) {
    const files = conflictedOf(m);
    if (files === null) {
      unknownMerges++;
      continue;
    }
    known += files.length;
    inShared += files.filter((f) => claimLog.some((c) => Number(c.participant) !== Number(m.participant) && foldPath(String(c.path)) === foldPath(f))).length;
  }
  const mergedSlices = recorded ? new Set(merges.map((m) => Number(m.participant)).filter((pid) => !orchestrators.has(pid))).size : sliceMembers.filter((p) => Number(p.merged ?? 0) === 1).length;
  return {
    ...base,
    plan: {
      slices: { merged: mergedSlices, of: sliceCount, addedMidRun, timesMs, timesEstimated: !recorded },
      lock: { waitsMs: lockWaitsMs, racesLost },
      shared: { files: perFile.length, everyHolderTold, agreed, agreedBeforeMerge, perFile, estimated: !sharesRecorded },
      flags: boardFlags.length,
      conflicts: recorded ? { known, inShared, unknownMerges } : { known: null, inShared: null, unknownMerges: null }
    }
  };
}
function skepticOf(db, run2, seats) {
  const seated = (slice) => new Set(seats.filter((p) => String(p.slice) === slice).map((p) => Number(p.id)));
  const named = seated(SKEPTIC);
  if (named.size) return named;
  const rows = db.prepare("SELECT id, on_events FROM slices WHERE run = ? AND on_events IS NOT NULL ORDER BY ord").all(run2);
  const subscribesToAgreement = (row) => JSON.parse(String(row.on_events)).flatMap((e) => e.split(",")).some((e) => e.trim().replace(/^(any|main):/, "") === "agreement");
  const subscribed = rows.find(subscribesToAgreement);
  return subscribed ? seated(String(subscribed.id)) : /* @__PURE__ */ new Set();
}
function debateOf(db, run2, seats, messages) {
  const skeptic = skepticOf(db, run2, seats);
  const seatIds = new Set(seats.map((p) => Number(p.id)));
  const questionOf = (m) => {
    const about = m.about == null ? "" : String(m.about).trim();
    return QUESTION.test(about) ? about : null;
  };
  const spoken = (m) => Number(m.by_board ?? 0) === 0 && (m.kind === "msg" || m.kind === "urgent" || m.kind === "agreement");
  const bySeq = new Map(messages.map((m) => [Number(m.seq), m]));
  const endorsements = [];
  const skepticEndorsedAt = /* @__PURE__ */ new Map();
  for (const m of messages) {
    if (m.kind !== "endorsement" || m.endorses == null) continue;
    const agreement = bySeq.get(Number(m.endorses));
    const question = agreement && agreement.kind === "agreement" ? questionOf(agreement) : null;
    if (question === null) continue;
    endorsements.push({ endorsement: m, question });
    if (skeptic.has(Number(m.author)) && !skepticEndorsedAt.has(Number(m.endorses))) skepticEndorsedAt.set(Number(m.endorses), Number(m.seq));
  }
  const endorsedSeqs = new Set(skepticEndorsedAt.keys());
  const skepticEndorsements = endorsements.filter(({ endorsement }) => skeptic.has(Number(endorsement.author)));
  const endorsedBefore = (agreementSeq, seq) => (skepticEndorsedAt.get(agreementSeq) ?? Infinity) < seq;
  const outcomeOf = /* @__PURE__ */ new Map();
  for (const m of messages) {
    const q = questionOf(m);
    if (q !== null && m.kind === "agreement" && endorsedSeqs.has(Number(m.seq)) && !outcomeOf.has(q)) outcomeOf.set(q, m);
  }
  const questions = /* @__PURE__ */ new Map();
  const marksOf = /* @__PURE__ */ new Map();
  const unsourcedOf = /* @__PURE__ */ new Map();
  const mark = (pid, x) => void marksOf.set(pid, [...marksOf.get(pid) ?? [], x]);
  const lastAgreementOn = /* @__PURE__ */ new Map();
  let agreements = 0;
  let sourced = 0;
  let claims = 0;
  for (const m of messages) {
    const q = questionOf(m);
    if (q === null || !spoken(m)) continue;
    const author = Number(m.author);
    const question = questions.get(q) ?? { id: q, firstPost: String(m.at), outcome: null, exchanges: 0 };
    questions.set(q, question);
    const outcome = outcomeOf.get(q);
    const beforeOutcome = !outcome || Number(m.seq) < Number(outcome.seq);
    if (beforeOutcome && seatIds.has(author)) question.exchanges = (question.exchanges ?? 0) + 1;
    if (m.kind === "agreement") {
      agreements++;
      lastAgreementOn.set(q, m);
      continue;
    }
    if (beforeOutcome) {
      claims++;
      if (SOURCE.test(String(m.body))) sourced++;
      else unsourcedOf.set(author, (unsourcedOf.get(author) ?? 0) + 1);
    }
    const last = lastAgreementOn.get(q);
    if (skeptic.has(author) && last && Number(last.author) !== author && !endorsedBefore(Number(last.seq), Number(m.seq))) {
      mark(author, { at: String(m.at), what: "objected", seq: Number(m.seq), path: q, note: `objects to #${last.seq}: ${firstLine(String(m.body))}` });
    }
  }
  for (const { endorsement, question } of endorsements) {
    mark(Number(endorsement.author), { at: String(endorsement.at), what: "endorsed", seq: Number(endorsement.seq), path: question, note: `endorses #${endorsement.endorses}` });
  }
  for (const [q, outcome] of outcomeOf) {
    const question = questions.get(q);
    if (question) question.outcome = { at: String(outcome.at), seq: Number(outcome.seq), kind: "agreed" };
  }
  return {
    brainstorm: {
      questions: [...questions.values()].sort((a, b) => ms(a.firstPost) - ms(b.firstPost)),
      agreements,
      endorsed: skepticEndorsements.length,
      claimsWithSource: { n: sourced, of: claims, inferred: true }
    },
    marksOf,
    unsourcedOf
  };
}
function withMemberFigures(run2) {
  const debated = run2.brainstorm !== void 0;
  const marked = (m, what) => m.marks.filter((x) => x.what === what).length;
  const lengthOf = (i) => ms(i.to) - ms(i.from);
  const members = run2.members.map((m) => ({
    ...m,
    waitingMs: m.waitingMs ?? (run2.recorded ? m.intervals.filter((i) => i.what === "waiting").reduce((n, i) => n + lengthOf(i), 0) : null),
    agreementsMade: m.agreementsMade ?? marked(m, "agreement"),
    endorsed: m.endorsed ?? (debated ? marked(m, "endorsed") : null),
    objections: m.objections ?? (debated ? marked(m, "objected") : null),
    // a summary from before the events were read (D45) reads its member as not estimated
    estimated: m.estimated ?? false
  }));
  const plan = run2.plan && {
    ...run2.plan,
    slices: slicesOfSummary(run2.plan.slices),
    shared: {
      ...run2.plan.shared,
      estimated: run2.plan.shared.estimated ?? false,
      // a summary from before `told` (D46) reads each file told, as its list read it
      perFile: run2.plan.shared.perFile.map((f) => ({ ...f, told: f.told ?? true }))
    }
  };
  return { ...run2, members, ...plan ? { plan } : {} };
}
function slicesOfSummary(slices) {
  const { estimated, ...rest } = slices;
  return { ...rest, timesEstimated: slices.timesEstimated ?? estimated ?? false };
}
var KEPT = "(pruned_at IS NULL OR id IN (SELECT run FROM run_stats))";
function summarize(db, run2, silentAfterMs) {
  const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(run2);
  if (!r) throw new Error(`no run ${run2}`);
  return withMemberFigures(computeRun(db, r, Date.now(), silentAfterMs));
}
function totalsOf(runs) {
  const plans = runs.flatMap((r) => r.plan ? [r.plan] : []);
  const recorded = runs.filter((r) => r.recorded);
  const recordedPlans = recorded.flatMap((r) => r.plan ? [r.plan] : []);
  const silentOf = (r) => r.members.filter((m) => m.intervals.some((i) => i.what === "silent")).length;
  const times = plans.flatMap((p) => p.slices.timesMs);
  const waits = recordedPlans.flatMap((p) => p.lock.waitsMs);
  const bins = [...WAIT_BINS_MS, Infinity].map((upper, i) => waits.filter((w) => w >= (WAIT_BINS_MS[i - 1] ?? 0) && w < upper).length);
  const shared = (pick) => sumKnown(plans.map((p) => pick(p.shared)));
  const files = shared((s) => s.files);
  const agreed = shared((s) => s.agreed);
  const series = (figure) => runs.map((r) => r.recorded ? figure(r) : null);
  const everyRun = (figure) => runs.map(figure);
  return {
    runs: runs.length,
    byKind: { plan: runs.filter((r) => r.kind === "plan").length, brainstorm: runs.filter((r) => r.kind === "brainstorm").length },
    notRecorded: runs.length - recorded.length,
    members: runs.length ? runs.reduce((n, r) => n + r.members.length, 0) : null,
    silentMembers: sumKnown(recorded.map(silentOf)),
    slices: {
      merged: sumKnown(plans.map((p) => p.slices.merged)),
      of: sumKnown(plans.map((p) => p.slices.of)),
      p50Ms: percentile(times, 0.5),
      p90Ms: percentile(times, 0.9),
      timesEstimatedRuns: plans.filter((p) => p.slices.timesEstimated).length
    },
    // merges: the lock turns granted, each one merge's wait
    lockWait: { merges: recordedPlans.length ? waits.length : null, p50Ms: percentile(waits, 0.5), p90Ms: percentile(waits, 0.9), bins: recordedPlans.length ? bins : [] },
    shared: {
      files,
      everyHolderTold: shared((s) => s.everyHolderTold),
      agreed,
      agreedBeforeMerge: shared((s) => s.agreedBeforeMerge),
      withoutAgreement: files === null || agreed === null ? null : files - agreed,
      estimatedRuns: plans.filter((p) => p.shared.estimated).length
    },
    flags: sumKnown(plans.map((p) => p.flags)),
    runsWithoutFlag: plans.length ? plans.filter((p) => p.flags === 0).length : null,
    conflicts: {
      known: sumKnown(plans.map((p) => p.conflicts.known)),
      inShared: sumKnown(plans.map((p) => p.conflicts.inShared)),
      unknownMerges: sumKnown(plans.map((p) => p.conflicts.unknownMerges))
    },
    brainstorm: brainstormTotalsOf(runs),
    series: {
      slicesMerged: everyRun((r) => r.plan?.slices.merged ?? null),
      sliceTimeP50: everyRun((r) => r.plan ? percentile(r.plan.slices.timesMs, 0.5) : null),
      lockWaitP50: series((r) => r.plan ? percentile(r.plan.lock.waitsMs, 0.5) : null),
      sharedAgreed: everyRun((r) => r.plan?.shared.agreed ?? null),
      // flags come from the board's messages, kept for a run before the records too (D43)
      flags: everyRun((r) => r.plan?.flags ?? null),
      conflicts: series((r) => r.plan?.conflicts.known ?? null),
      silentMembers: series(silentOf)
    }
  };
}
function brainstormTotalsOf(runs) {
  const debated = runs.flatMap((r) => r.brainstorm ? [{ run: r, debate: r.brainstorm }] : []);
  const questions = debated.flatMap((d) => d.debate.questions);
  const settled = questions.filter((q) => q.outcome !== null);
  const objectedOf = (r, q) => q.outcome !== null && r.members.some((m) => m.marks.some((x) => x.what === "objected" && x.path === q.id && x.seq !== void 0 && x.seq < q.outcome.seq));
  const n = sumKnown(debated.map((d) => d.debate.claimsWithSource.n));
  const of = sumKnown(debated.map((d) => d.debate.claimsWithSource.of));
  const silentSeatsOf = (r) => r.members.filter((m) => m.slice !== ORCHESTRATOR && m.intervals.some((i) => i.what === "silent")).length;
  const brainstorms = runs.filter((r) => r.kind === "brainstorm");
  return {
    notRecorded: brainstorms.length ? brainstorms.filter((r) => !r.recorded).length : null,
    questionsSettled: debated.length ? settled.length : null,
    questions: debated.length ? questions.length : null,
    exchangesMedian: percentile(settled.flatMap((q) => q.exchanges === null ? [] : [q.exchanges]), 0.5),
    objectedThenAgreed: debated.length ? debated.reduce((k, d) => k + d.debate.questions.filter((q) => objectedOf(d.run, q)).length, 0) : null,
    sourcedShare: n === null || !of ? null : n / of,
    claimsWithSource: { n, of },
    silentSeats: sumKnown(debated.filter((d) => d.run.recorded).map((d) => silentSeatsOf(d.run)))
  };
}
function filesAcross(runs) {
  const byPath = /* @__PURE__ */ new Map();
  for (const r of runs) {
    for (const f of r.plan?.shared.perFile ?? []) {
      const key = foldPath(f.path);
      const entry = byPath.get(key) ?? { path: f.path, perRun: [] };
      entry.perRun.push({ run: r.run, holders: f.holders, agreed: f.agreement !== null, conflict: f.conflict, interface: f.interface ?? null });
      byPath.set(key, entry);
    }
  }
  return [...byPath.values()].map(({ path: path5, perRun }) => ({
    path: path5,
    runs: perRun.map((x) => x.run),
    holders: new Set(perRun.flatMap((x) => x.holders)).size,
    agreements: perRun.filter((x) => x.agreed).length,
    conflicts: perRun.every((x) => x.conflict === null) ? null : perRun.filter((x) => x.conflict === true).length,
    // the runs in which a holder declared or claimed it an interface; null when none knows (summaries from before D37)
    declaredInterface: perRun.every((x) => x.interface === null) ? null : perRun.filter((x) => x.interface === true).length,
    perRun: perRun.map((x) => ({ run: x.run, holders: x.holders.length, conflict: x.conflict }))
  })).sort((a, b) => b.runs.length - a.runs.length || a.path.localeCompare(b.path));
}
function statsOf(db, scope, silentAfterMs) {
  for (const k of scope.kinds ?? []) profileOf(k);
  const start = periodStart(scope.since);
  const where = ["repo = ?", KEPT];
  const params = [scope.repo];
  if (scope.run !== void 0) {
    where.push("id = ?");
    params.push(scope.run);
  }
  if (scope.kinds?.length) {
    where.push(`kind IN (${scope.kinds.map(() => "?").join(", ")})`);
    params.push(...scope.kinds);
  }
  if (scope.closedOnly) where.push("state = 'closed'");
  if (start) {
    where.push("(state = 'open' OR closed_at >= ?)");
    params.push(start);
  }
  db.exec("BEGIN");
  try {
    if (scope.run !== void 0 && !db.prepare(`SELECT 1 FROM runs WHERE id = ? AND repo = ? AND ${KEPT}`).get(scope.run, scope.repo)) {
      throw new Error(`no run ${scope.run}`);
    }
    const rows = db.prepare(`SELECT * FROM runs WHERE ${where.join(" AND ")} ORDER BY opened_at, id`).all(...params);
    const stored = db.prepare("SELECT body FROM run_stats WHERE run = ?");
    const now = Date.now();
    const runs = rows.map((r) => {
      const row = stored.get(Number(r.id));
      return withMemberFigures(row ? JSON.parse(String(row.body)) : computeRun(db, r, now, silentAfterMs));
    });
    return { scope, runs, totals: totalsOf(runs), files: filesAcross(runs), silentAfterMs };
  } finally {
    db.exec("COMMIT");
  }
}

// src/board/names.ts
var ADJECTIVES = [
  "Sleepy",
  "Grumpy",
  "Brave",
  "Clumsy",
  "Dizzy",
  "Fuzzy",
  "Gentle",
  "Hasty",
  "Jolly",
  "Lucky",
  "Mighty",
  "Nimble",
  "Plucky",
  "Quiet",
  "Rusty",
  "Sneaky",
  "Tidy",
  "Witty",
  "Zesty",
  "Bouncy",
  "Cheeky",
  "Dapper",
  "Eager",
  "Fancy",
  "Giddy",
  "Humble",
  "Lofty",
  "Merry",
  "Peppy",
  "Snappy"
];
var ANIMALS = [
  "Otter",
  "Badger",
  "Walrus",
  "Penguin",
  "Llama",
  "Ferret",
  "Puffin",
  "Wombat",
  "Gecko",
  "Moose",
  "Panda",
  "Lemur",
  "Narwhal",
  "Hedgehog",
  "Koala",
  "Yak",
  "Toucan",
  "Beaver",
  "Platypus",
  "Raccoon",
  "Alpaca",
  "Bison",
  "Capybara",
  "Dingo",
  "Emu",
  "Flamingo",
  "Gibbon",
  "Heron",
  "Ibis",
  "Jackal"
];
function funnyName(taken, random = Math.random) {
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  const pick = (xs) => xs[Math.floor(random() * xs.length) % xs.length];
  const free = ADJECTIVES.flatMap((a) => ANIMALS.map((b) => `${a} ${b}`)).filter((n) => !used.has(n.toLowerCase()));
  if (free.length) return pick(free);
  for (let i = 2; ; i++) {
    const n = `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${i}`;
    if (!used.has(n.toLowerCase())) return n;
  }
}

// src/board/liveness.ts
import fs from "node:fs";
var claudeCodeJsonl = {
  name: "claude-code-jsonl",
  read(chunk, from) {
    const end = chunk.lastIndexOf(10);
    if (end < 0) return from;
    let tokens = from.tokens;
    let parsed = 0;
    for (const line of chunk.subarray(0, end).toString("utf8").split("\n")) {
      const text = line.trim();
      if (!text) continue;
      let obj;
      try {
        obj = JSON.parse(text);
      } catch {
        if (parsed === 0 && from.offset === 0) return null;
        continue;
      }
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        if (parsed === 0 && from.offset === 0) return null;
        continue;
      }
      parsed++;
      const usage = obj.message?.usage;
      if (!usage) continue;
      for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) {
        const n = usage[k];
        if (typeof n === "number" && Number.isFinite(n)) tokens += n;
      }
    }
    return { offset: from.offset + end + 1, tokens };
  }
};
var ADAPTERS = [claudeCodeJsonl];
var readTranscript = (file, from) => {
  let chunk;
  const offset = from?.cursor.offset ?? 0;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      if (size < offset) return null;
      chunk = Buffer.alloc(size - offset);
      fs.readSync(fd, chunk, 0, chunk.length, offset);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  const cursor = from?.cursor ?? { offset: 0, tokens: 0 };
  const tried = from ? ADAPTERS.filter((a) => a.name === from.adapter) : ADAPTERS;
  for (const a of tried) {
    const next = a.read(chunk, cursor);
    if (next) return { adapter: a.name, cursor: next };
  }
  return null;
};
var stallDue = (silenceMs, posted, thresholdMs) => silenceMs >= (posted + 1) * thresholdMs;
var STALL_MS_DEFAULT = 5e3;
var READINGS_KEPT_MS = 10 * 60 * 1e3;

// src/board/board.ts
var PHASE_NAME = /^[\w.-]+$/;
var SLICE_STATES = /* @__PURE__ */ new Set(["ready", "running", "done", "blocked"]);
var TO_AUTHOR = Object.values(EVENTS).filter((e) => e.toAuthor).map((e) => `'${e.name}'`).join(", ");
var ORCHESTRATOR2 = "orchestrator";
var WAIT_POLL_MS = 1e3;
var LINE_WIDTH = 100;
var STALE_MS = 10 * 60 * 1e3;
var WAIT_LOG_EVERY_MS = 60 * 1e3;
var UPKEEP_EVERY_MS = 5 * 60 * 1e3;
var LAST_UPKEEP = "last-upkeep";
var RECORDS_SINCE2 = "records-since";
var SHARES_SINCE2 = "shares-since";
var RETENTION_DEFAULT_DAYS = 30;
var DAY_MS2 = 24 * 60 * 60 * 1e3;
var EVENTS_SHOWN = 500;
var CASELESS2 = process.platform === "win32";
function messageLine(m) {
  const first = m.body.split(/\r?\n/)[0];
  const text = first.length > LINE_WIDTH ? `${first.slice(0, LINE_WIDTH - 1)}\u2026` : first;
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}: ${text}`;
}
async function openBoard(dbPath = SQLITE_PATH, opts = {}) {
  const readCounter = opts.readTranscript ?? readTranscript;
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    if (w.name !== "ExperimentalWarning") console.warn(w);
  });
  const { DatabaseSync } = await import("node:sqlite");
  fs2.mkdirSync(path2.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  const recordsAreNew = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'call_log'").get() === void 0;
  const sharesAreNew = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shares'").get() === void 0;
  db.exec(`
    PRAGMA journal_mode = DELETE;
    -- Several CLI processes write, and aiview reads, concurrently; without a busy timeout a
    -- concurrent verb fails outright with SQLITE_BUSY.
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      repo TEXT NOT NULL,
      plan TEXT NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS slices (
      run INTEGER NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      blockers TEXT NOT NULL DEFAULT '[]',
      state TEXT NOT NULL DEFAULT 'ready',
      ord INTEGER NOT NULL,
      PRIMARY KEY (run, id)
    );
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY,
      run INTEGER NOT NULL,
      slice TEXT NOT NULL,
      worktree TEXT,
      doing TEXT NOT NULL DEFAULT '',
      files TEXT NOT NULL DEFAULT '[]',
      since_seq INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      ended_at TEXT,
      last_call TEXT,
      UNIQUE (run, slice)
    );
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      author INTEGER NOT NULL,
      body TEXT NOT NULL,
      about TEXT,
      kind TEXT NOT NULL DEFAULT 'msg',
      mentions TEXT NOT NULL DEFAULT '[]',
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_repo ON messages (repo, seq);
    CREATE TABLE IF NOT EXISTS deliveries (
      participant INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (participant, seq)
    );
    -- claims are global by repository-relative path, across every run on a repository (D12, D20);
    -- a path may have several holders (D40). since_seq: the thread's last seq when it was claimed
    CREATE TABLE IF NOT EXISTS claims (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'inside',
      since_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (repo, path, participant)
    );
    -- every claim made, kept past its release: who held a path during a run (D63), and whether as an
    -- interface: widened to 'interface' when the claim is made or widened so, never narrowed (D42)
    CREATE TABLE IF NOT EXISTS claim_log (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'inside',
      PRIMARY KEY (repo, path, participant)
    );
    -- a claim granted beside a live holder of the path, kept past both claims' release: who held a path
    -- at the same time as whom during a run, from the seq it began (D39); append-only, deleted with its run
    CREATE TABLE IF NOT EXISTS shares (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      other INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant, other)
    );
    -- a holder of a shared path already told of another holder (D41): once per runner and path
    CREATE TABLE IF NOT EXISTS notices (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      other INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant, other)
    );
    CREATE TABLE IF NOT EXISTS merge_locks (
      repo TEXT PRIMARY KEY,
      participant INTEGER NOT NULL,
      at TEXT NOT NULL
    );
    -- a runner refused the merge lock since its holder took it: mentioned when it is released (D65)
    CREATE TABLE IF NOT EXISTS lock_waiters (
      repo TEXT NOT NULL,
      participant INTEGER NOT NULL,
      PRIMARY KEY (repo, participant)
    );
    -- a path written outside its writer's claim, by reconcileWrites; lives while a claim on it does (D39)
    CREATE TABLE IF NOT EXISTS flags (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant)
    );
    -- a claim refused as held: the post that settles it claims it (D7)
    CREATE TABLE IF NOT EXISTS claim_requests (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL,
      PRIMARY KEY (repo, path, participant)
    );
    -- a flag posted, once per writer, path and holder (D8)
    CREATE TABLE IF NOT EXISTS flag_posts (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      holder INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant, holder)
    );
    -- a version per repository, moved by every write: what onChange compares (D39)
    CREATE TABLE IF NOT EXISTS changes (
      repo TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    );
    -- one row per merge, written by merged, deleted with its run by prune (D25): files and conflicts JSON, conflicts NULL for unknown
    CREATE TABLE IF NOT EXISTS merges (
      participant INTEGER NOT NULL,
      run INTEGER NOT NULL,
      sha TEXT NOT NULL,
      at TEXT NOT NULL,
      files TEXT NOT NULL,
      conflicts TEXT
    );
    CREATE INDEX IF NOT EXISTS merges_run ON merges (run);
    -- one row per counted call, written by countCall in the verb's transaction (D25); deleted with its run
    CREATE TABLE IF NOT EXISTS call_log (participant INTEGER NOT NULL, at TEXT NOT NULL, verb TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS call_log_by_participant ON call_log (participant, at);
    -- one row per merge-lock turn: asked, granted, merged; refused counts the refusals (D25); deleted with its run
    CREATE TABLE IF NOT EXISTS lock_requests (repo TEXT NOT NULL, participant INTEGER NOT NULL, asked_at TEXT NOT NULL,
      granted_at TEXT, merged_at TEXT, refused INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS lock_requests_by_participant ON lock_requests (participant, asked_at);
    -- a closed run's figures, RunStats JSON, written once at close or by prune first; never pruned (D20, D21)
    CREATE TABLE IF NOT EXISTS run_stats (run INTEGER PRIMARY KEY, repo TEXT NOT NULL, kind TEXT NOT NULL,
      closed_at TEXT NOT NULL, body TEXT NOT NULL);
    -- board settings (D32): retention-days; the board's own last-upkeep (D16)
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    -- the identities and hook_seen tables, left in stores from before D58, are no longer read or written
    -- a member done with a phase, once per run, member and phase; a phase opened again clears its rows
    CREATE TABLE IF NOT EXISTS phase_done (run INTEGER NOT NULL, participant INTEGER NOT NULL, phase TEXT NOT NULL, at TEXT NOT NULL,
      PRIMARY KEY (run, participant, phase));
    -- a member's transcript (member: its seat id, or orchestrator) and where its token counter stands
    CREATE TABLE IF NOT EXISTS transcripts (run INTEGER NOT NULL, member TEXT NOT NULL, path TEXT NOT NULL, adapter TEXT,
      offset INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, readable INTEGER NOT NULL DEFAULT 0,
      read_at TEXT, moved_at TEXT, PRIMARY KEY (run, member));
    -- the poller's readings, pruned past READINGS_KEPT_MS
    CREATE TABLE IF NOT EXISTS token_readings (run INTEGER NOT NULL, member TEXT NOT NULL, t TEXT NOT NULL, tokens INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS token_readings_by_run ON token_readings (run, t);
    -- a liveness warning posted, once per member and condition (none, unreadable); a good read clears unreadable
    CREATE TABLE IF NOT EXISTS liveness_warned (run INTEGER NOT NULL, member TEXT NOT NULL, cond TEXT NOT NULL, PRIMARY KEY (run, member, cond));
  `);
  if (recordsAreNew) db.prepare("INSERT OR IGNORE INTO settings (name, value) VALUES (?, ?)").run(RECORDS_SINCE2, (/* @__PURE__ */ new Date()).toISOString());
  if (sharesAreNew) db.prepare("INSERT OR IGNORE INTO settings (name, value) VALUES (?, ?)").run(SHARES_SINCE2, (/* @__PURE__ */ new Date()).toISOString());
  const upkeep = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  upkeep("claim_log", "kind", "kind TEXT NOT NULL DEFAULT 'inside'");
  upkeep("participants", "last_call", "last_call TEXT");
  upkeep("participants", "calls", "calls INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "waiting", "waiting INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "listening", "listening INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "nick", "nick TEXT");
  upkeep("participants", "wait_gen", "wait_gen INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "merged", "merged INTEGER NOT NULL DEFAULT 0");
  upkeep("messages", "by_board", "by_board INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "link", "link TEXT");
  upkeep("messages", "meta", "meta TEXT");
  upkeep("merge_locks", "onto", "onto TEXT");
  upkeep("merge_locks", "reflog_mark", "reflog_mark INTEGER");
  upkeep("slices", "link", "link TEXT");
  upkeep("runs", "kind", "kind TEXT NOT NULL DEFAULT 'plan'");
  upkeep("messages", "run", "run INTEGER");
  upkeep("messages", "endorses", "endorses INTEGER");
  upkeep("runs", "stale_flagged", "stale_flagged INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "quiet_flagged", "quiet_flagged INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "pruned_at", "pruned_at TEXT");
  upkeep("messages", "event", "event TEXT");
  upkeep("participants", "subs", "subs TEXT NOT NULL DEFAULT '[]'");
  upkeep("slices", "on_events", "on_events TEXT");
  upkeep("runs", "phase", "phase TEXT");
  upkeep("runs", "phase_text", "phase_text TEXT");
  upkeep("runs", "stall_ms", `stall_ms INTEGER NOT NULL DEFAULT ${STALL_MS_DEFAULT}`);
  upkeep("runs", "stall_posts", "stall_posts INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE INDEX IF NOT EXISTS messages_channel ON messages (repo, run, seq)");
  const claimKey = db.prepare("PRAGMA table_info(claims)").all().find((c) => c.name === "participant");
  if (claimKey && claimKey.pk === 0) {
    db.exec(`
      BEGIN;
      ALTER TABLE claims RENAME TO claims_before_d40;
      CREATE TABLE claims (
        repo TEXT NOT NULL,
        path TEXT NOT NULL,
        participant INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'inside',
        since_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (repo, path, participant)
      );
      INSERT INTO claims (repo, path, participant, kind) SELECT repo, path, participant, kind FROM claims_before_d40;
      DROP TABLE claims_before_d40;
      COMMIT;
    `);
  }
  const signal = `${dbPath}.signal`;
  if (!fs2.existsSync(signal)) fs2.writeFileSync(signal, "0");
  let touches = 0;
  const touch = () => fs2.writeFileSync(signal, `${process.pid}:${++touches}`);
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  let depth = 0;
  let dirty = false;
  const transaction = (fn) => {
    if (depth > 0) return fn();
    db.exec("BEGIN IMMEDIATE");
    depth++;
    let ok = false;
    try {
      const out = fn();
      db.exec("COMMIT");
      ok = true;
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      depth--;
      if (dirty) {
        dirty = false;
        if (ok) touch();
      }
    }
  };
  const bump = (repo) => {
    db.prepare("INSERT INTO changes (repo, version) VALUES (?, 1) ON CONFLICT (repo) DO UPDATE SET version = version + 1").run(repo);
    if (depth > 0) dirty = true;
    else touch();
  };
  const runRow = (id) => {
    const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
    if (!r) throw new Error(`unknown run ${id}`);
    return r;
  };
  const phaseOf = (r) => r.phase == null ? null : { name: String(r.phase), text: String(r.phase_text ?? "") };
  const toRun = (r) => ({
    phase: phaseOf(r),
    id: Number(r.id),
    repo: String(r.repo),
    kind: profileOf(String(r.kind ?? "plan")).kind,
    plan: String(r.plan),
    group: String(r.plan),
    title: String(r.title),
    link: r.link == null ? null : String(r.link),
    state: r.state === "closed" ? "closed" : "open",
    slices: db.prepare("SELECT * FROM slices WHERE run = ? ORDER BY ord").all(Number(r.id)).map((s) => ({
      id: String(s.id),
      title: String(s.title),
      link: s.link == null ? null : String(s.link),
      blockers: JSON.parse(String(s.blockers)),
      state: String(s.state)
    }))
  });
  const nickOf = (r) => r.nick == null ? String(r.slice) : String(r.nick);
  const unusedNick = (repo) => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(repo);
    return funnyName(rows.map(nickOf));
  };
  const subsOf = (r) => JSON.parse(String(r.subs ?? "[]")).map((x) => ({ event: x.event, scope: x.scope === "run" ? "run" : "any" }));
  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan, r.kind FROM participants p JOIN runs r ON r.id = p.run`;
  const toParticipant = (r) => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    kind: profileOf(String(r.kind ?? "plan")).kind,
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    nick: nickOf(r),
    ended: r.ended_at != null,
    worktree: r.worktree == null ? null : String(r.worktree),
    listening: Number(r.listening) === 1,
    subscriptions: subsOf(r)
  });
  const participantById = (id) => toParticipant(db.prepare(`${PARTICIPANT_SQL} WHERE p.id = ?`).get(id));
  const toMessage = (r) => {
    const author = participantById(Number(r.author));
    return {
      seq: Number(r.seq),
      repo: String(r.repo),
      from: author.name,
      body: String(r.body),
      about: r.about == null ? null : String(r.about),
      kind: String(r.kind),
      mentions: JSON.parse(String(r.mentions)),
      at: String(r.at),
      // an old main row (null) is labelled with its author's run (plan D13)
      run: r.run == null ? author.run : Number(r.run),
      endorses: r.endorses == null ? null : Number(r.endorses),
      event: r.event == null || !Object.hasOwn(EVENTS, String(r.event)) ? null : String(r.event),
      meta: r.meta == null ? null : JSON.parse(String(r.meta))
    };
  };
  const lastSeq = () => Number(db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM messages").get().s);
  const openPlans = (repo) => db.prepare("SELECT DISTINCT plan FROM runs WHERE repo = ? AND state = 'open'").all(repo).map((r) => String(r.plan));
  const activeNames = (repo) => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL AND p.slice != '${ORCHESTRATOR2}'`).all(repo);
    return new Map(rows.map((r) => [nameHandle(nickOf(r)), `${r.plan}/${r.slice}`]));
  };
  const insertMessage = (p, body, about, kind, named, extra = {}) => {
    const mentions2 = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo), activeNames(p.repo)));
    const run2 = p.run;
    if (runRow(run2).state === "closed") throw new Error(`run ${run2} is closed`);
    const r = db.prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at, by_board, run, endorses, event, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(p.repo, p.id, body, about, kind, JSON.stringify(mentions2), now(), named ? 1 : 0, run2, extra.endorses ?? null, extra.event ?? null, extra.meta ? JSON.stringify(extra.meta) : null);
    const seq = Number(r.lastInsertRowid);
    bump(p.repo);
    return board.read(seq);
  };
  const gated = (p, verb) => {
    if (!profileOf(p.kind).claims) throw new Error(`${verb}: a ${p.kind} run has no claims`);
    return p;
  };
  const live = (p) => {
    const fresh = participantById(p.id);
    if (fresh.ended) throw new Error(`runner ${p.name} has ended`);
    return fresh;
  };
  const isLive = (id) => db.prepare("SELECT 1 FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ? AND p.ended_at IS NULL AND r.state = 'open'").get(id) !== void 0;
  const fold = (s) => CASELESS2 ? s.toLowerCase() : s;
  const slashes = (rel) => rel.split(/[\\/]+/).filter((x) => x && x !== ".").join("/");
  const roots = (repo) => {
    const out = /* @__PURE__ */ new Set();
    if (path2.basename(repo).toLowerCase() === ".git") out.add(path2.resolve(path2.dirname(repo)));
    const rows = db.prepare("SELECT DISTINCT p.worktree FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND p.worktree IS NOT NULL").all(repo);
    for (const r of rows) out.add(path2.resolve(String(r.worktree)));
    return [...out].sort((a, b) => b.length - a.length);
  };
  const relPath = (repo, file) => {
    if (!path2.isAbsolute(file) && !file.startsWith("/")) return slashes(file) || null;
    const abs = fold(path2.resolve(file));
    for (const root of roots(repo)) {
      const r = fold(root);
      if (abs.startsWith(r.endsWith(path2.sep) ? r : r + path2.sep)) return slashes(path2.resolve(file).slice(root.length)) || null;
    }
    return null;
  };
  const doingOf = (id) => String(db.prepare("SELECT doing FROM participants WHERE id = ?").get(id).doing) || "no note";
  const claims = claimsOf({ db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf });
  const deliverTo = (p, fromWait, mentionsOnly = false) => {
    const me = participantById(p.id);
    const named = (m) => mentions(m, me) || (m.kind === "agreement" || m.kind === "endorsement") && m.about != null && claims.holds(me, m.about);
    const messages = transaction(() => {
      const unseen = db.prepare(
        `SELECT m.* FROM messages m
           WHERE m.repo = ? AND m.seq > ? AND (m.author != ? OR m.event IN (${TO_AUTHOR}))
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
           ORDER BY m.seq`
      ).all(me.repo, Number(db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id).since_seq), me.id, me.id);
      const woken = (r) => named(toMessage(r)) || wakes(toMessage(r), me, me.subscriptions);
      const heard = unseen.filter((r) => toMessage(r).run === me.run || woken(r));
      const rows = mentionsOnly ? heard.filter(woken) : heard;
      const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
      for (const r of rows) mark.run(me.id, Number(r.seq));
      const at = now();
      db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(at, me.id);
      if (fromWait) {
        const last = db.prepare("SELECT MAX(at) AS at FROM call_log WHERE participant = ?").get(me.id);
        if (last.at == null || Date.parse(at) - Date.parse(String(last.at)) >= WAIT_LOG_EVERY_MS) {
          db.prepare("INSERT INTO call_log (participant, at, verb) VALUES (?, ?, 'deliver')").run(me.id, at);
        }
      }
      if (!fromWait) {
        const r = db.prepare("UPDATE participants SET waiting = 0 WHERE id = ? AND waiting = 1").run(me.id);
        if (Number(r.changes) > 0) bump(me.repo);
      }
      return rows.map((r) => {
        const m = toMessage(r);
        const rel = r.by_board || m.kind !== "msg" || !m.about || !named(m) ? null : claims.askedAbout(me, Number(r.author), m);
        return rel ? { ...m, answer: `answer with an agreement on who changes what: swarm agree "<who changes what in ${rel}>" --about ${rel}` } : m;
      });
    });
    const full = (m) => named(m) || mentionsOnly && wakes(m, me, me.subscriptions);
    return {
      full: messages.filter(full),
      lines: messages.filter((m) => !full(m)).map(messageLine)
    };
  };
  const retentionDays = () => {
    const r = db.prepare("SELECT value FROM settings WHERE name = 'retention-days'").get();
    return r ? Number(r.value) : RETENTION_DEFAULT_DAYS;
  };
  const retentionCutoff = (at) => new Date(at.getTime() - retentionDays() * DAY_MS2).toISOString();
  const listedRuns = () => db.prepare("SELECT * FROM runs WHERE pruned_at IS NULL AND (state = 'open' OR (state = 'closed' AND closed_at >= ?)) ORDER BY id").all(retentionCutoff(/* @__PURE__ */ new Date()));
  const runSummary = (r) => {
    const id = Number(r.id);
    const count = (sql) => Number(db.prepare(sql).get(id).n);
    const open = r.state === "open";
    return {
      run: id,
      kind: profileOf(String(r.kind ?? "plan")).kind,
      plan: String(r.plan),
      group: String(r.plan),
      code: planCode(String(r.plan)),
      title: String(r.title),
      link: r.link == null ? null : String(r.link),
      open,
      runners: open ? count(`SELECT COUNT(*) AS n FROM participants WHERE run = ? AND slice != '${ORCHESTRATOR2}' AND ended_at IS NULL`) : 0,
      done: count("SELECT COUNT(*) AS n FROM slices WHERE run = ? AND state = 'done'"),
      of: count("SELECT COUNT(*) AS n FROM slices WHERE run = ?"),
      phase: phaseOf(r),
      progress: progressOf(id, r.phase == null ? null : String(r.phase)),
      stallMs: Number(r.stall_ms ?? STALL_MS_DEFAULT)
    };
  };
  const repoName = (repo) => {
    const base = path2.basename(repo);
    return base.toLowerCase() === ".git" ? path2.basename(path2.dirname(repo)) : base.replace(/\.git$/i, "");
  };
  const listeners = /* @__PURE__ */ new Set();
  let watching = null;
  let versions = /* @__PURE__ */ new Map();
  const readVersions = () => new Map(db.prepare("SELECT repo, version FROM changes").all().map((r) => [String(r.repo), Number(r.version)]));
  const insertSlice = (run2, s, ord) => {
    if (s.on) parseSubscriptions(s.on);
    if (s.transcript) db.prepare("INSERT OR REPLACE INTO transcripts (run, member, path) VALUES (?, ?, ?)").run(run2, s.id, path2.resolve(s.transcript));
    db.prepare("INSERT INTO slices (run, id, title, blockers, link, ord, on_events) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      run2,
      s.id,
      s.title,
      JSON.stringify(s.blockers ?? []),
      s.link ?? null,
      ord,
      s.on ? JSON.stringify(s.on) : null
    );
  };
  const setSubs = (p, subs) => {
    db.prepare("UPDATE participants SET subs = ? WHERE id = ?").run(JSON.stringify(subs), p.id);
    bump(p.repo);
    return subs;
  };
  const sameSub = (a, b) => a.event === b.event && a.scope === b.scope;
  const orchestratorIn = (run2) => participantById(Number(db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, ORCHESTRATOR2).id));
  const warnBlind = (run2, member, cond) => {
    if (Number(db.prepare("INSERT OR IGNORE INTO liveness_warned (run, member, cond) VALUES (?, ?, ?)").run(run2, member, cond).changes) === 0) return;
    const orch = orchestratorIn(run2);
    insertMessage(orch, `liveness: no readable transcript for ${orch.plan}/${member}, stall check blind for it`, null, "event", [orch.name], { event: EVENTS.liveness.name });
  };
  const livenessOf = (r) => !r ? { state: "none", tokens: null, movedAt: null } : Number(r.readable) !== 1 ? { state: "unreadable", tokens: null, movedAt: null } : { state: "ok", tokens: Number(r.tokens), movedAt: r.moved_at == null ? null : String(r.moved_at) };
  const transcriptOf = (run2, member) => db.prepare("SELECT * FROM transcripts WHERE run = ? AND member = ?").get(run2, member);
  const readCounterOnce = (run2, member, at, read2) => {
    const row = transcriptOf(run2, member);
    if (!row) return warnBlind(run2, member, "none");
    const from = row.adapter == null ? null : { adapter: String(row.adapter), cursor: { offset: Number(row.offset), tokens: Number(row.tokens) } };
    const got = read2(String(row.path), from);
    const iso2 = at.toISOString();
    if (!got) {
      if (Number(row.readable) === 1 || row.read_at == null) {
        db.prepare("UPDATE transcripts SET readable = 0, read_at = ? WHERE run = ? AND member = ?").run(iso2, run2, member);
        bump(String(runRow(run2).repo));
      }
      return warnBlind(run2, member, "unreadable");
    }
    const moved = row.moved_at == null || Number(row.readable) !== 1 || got.cursor.tokens !== Number(row.tokens);
    db.prepare("UPDATE transcripts SET adapter = ?, offset = ?, tokens = ?, readable = 1, read_at = ?, moved_at = CASE WHEN ? THEN ? ELSE moved_at END WHERE run = ? AND member = ?").run(
      got.adapter,
      got.cursor.offset,
      got.cursor.tokens,
      iso2,
      moved ? 1 : 0,
      iso2,
      run2,
      member
    );
    db.prepare("INSERT INTO token_readings (run, member, t, tokens) VALUES (?, ?, ?, ?)").run(run2, member, iso2, got.cursor.tokens);
    db.prepare("DELETE FROM liveness_warned WHERE run = ? AND member = ? AND cond = 'unreadable'").run(run2, member);
    if (moved) bump(String(runRow(run2).repo));
  };
  const progressOf = (run2, phase) => {
    if (phase == null) return null;
    const rows = db.prepare(
      `SELECT p.ended_at, EXISTS (SELECT 1 FROM phase_done d WHERE d.run = p.run AND d.participant = p.id AND d.phase = ?) AS done
         FROM participants p WHERE p.run = ? AND p.slice != '${ORCHESTRATOR2}'`
    ).all(phase, run2);
    const counted2 = rows.filter((r) => Number(r.done) === 1 || r.ended_at == null);
    return { phase, done: counted2.filter((r) => Number(r.done) === 1).length, of: counted2.length };
  };
  const storeRunStats = (run2) => {
    const body = summarize(db, run2, STALE_MS);
    const r = runRow(run2);
    db.prepare("INSERT OR REPLACE INTO run_stats (run, repo, kind, closed_at, body) VALUES (?, ?, ?, ?, ?)").run(run2, String(r.repo), body.kind, String(r.closed_at), JSON.stringify(body));
  };
  const board = {
    openRun({ repo, kind = "plan", group, title, link, seats, transcript, stallMs }) {
      const profile = profileOf(kind);
      if (stallMs !== void 0 && !(Number.isInteger(stallMs) && stallMs > 0)) throw new Error(`the stall threshold takes a positive whole number of ms, got ${stallMs}`);
      const id = transaction(() => {
        const r = db.prepare("INSERT INTO runs (repo, kind, plan, title, link, opened_at, stall_ms) VALUES (?, ?, ?, ?, ?, ?, ?)").run(repo, profile.kind, group, title, link ?? null, now(), stallMs ?? STALL_MS_DEFAULT);
        const run2 = Number(r.lastInsertRowid);
        seats.forEach((s, i) => insertSlice(run2, s, i));
        const orchestrator = db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at, subs, nick) VALUES (?, ?, ?, ?, ?, ?)").run(
          run2,
          ORCHESTRATOR2,
          lastSeq(),
          now(),
          JSON.stringify(profile.defaults.orchestrator),
          unusedNick(repo)
        );
        insertMessage(participantById(Number(orchestrator.lastInsertRowid)), `run ${run2} opened: ${profile.kind} ${group}, ${title}`, null, "event", void 0, {
          event: EVENTS.opened.name
        });
        if (transcript) db.prepare("INSERT OR REPLACE INTO transcripts (run, member, path) VALUES (?, ?, ?)").run(run2, ORCHESTRATOR2, path2.resolve(transcript));
        readCounterOnce(run2, ORCHESTRATOR2, /* @__PURE__ */ new Date(), readCounter);
        bump(repo);
        return run2;
      });
      return toRun(runRow(id));
    },
    setSliceState(run2, slice, state) {
      runRow(run2);
      if (!SLICE_STATES.has(state)) throw new Error(`unknown slice state ${state}`);
      transaction(() => {
        const r = db.prepare("UPDATE slices SET state = ? WHERE run = ? AND id = ?").run(state, run2, slice);
        if (Number(r.changes) === 0) throw new Error(`unknown slice ${slice} in run ${run2}`);
        bump(String(runRow(run2).repo));
        if (state !== "done") return;
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, slice);
        if (p) claims.releaseAll(Number(p.id));
      });
    },
    addSlice(run2, spec) {
      const r = runRow(run2);
      if (r.state !== "open") throw new Error(`run ${run2} is closed`);
      if (spec.id === ORCHESTRATOR2) throw new Error(`"${ORCHESTRATOR2}" is not a slice`);
      return transaction(() => {
        const ids = db.prepare("SELECT id FROM slices WHERE run = ?").all(run2).map((x) => String(x.id));
        if (ids.includes(spec.id)) throw new Error(`slice ${spec.id} is already in run ${run2}`);
        const unknown = (spec.blockers ?? []).filter((b) => !ids.includes(b));
        if (unknown.length) throw new Error(`unknown blocker ${unknown.join(", ")} in run ${run2}`);
        const ord = Number(db.prepare("SELECT COALESCE(MAX(ord), -1) AS o FROM slices WHERE run = ?").get(run2).o) + 1;
        insertSlice(run2, spec, ord);
        const orchestrator = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, ORCHESTRATOR2);
        insertMessage(participantById(Number(orchestrator.id)), `added ${spec.id}: ${spec.title}`, null, "event");
        return toRun(runRow(run2)).slices.find((x) => x.id === spec.id);
      });
    },
    closeRun(run2) {
      runRow(run2);
      transaction(() => {
        const author = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, ORCHESTRATOR2) ?? db.prepare("SELECT id FROM participants WHERE run = ? ORDER BY id LIMIT 1").get(run2);
        if (author) insertMessage(participantById(Number(author.id)), `run ${run2} closed`, null, "event", void 0, { event: EVENTS.closed.name });
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run2);
        bump(String(runRow(run2).repo));
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run2);
        try {
          storeRunStats(run2);
        } catch {
        }
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run2)) claims.releaseAll(Number(p.id));
      });
    },
    prune(at = /* @__PURE__ */ new Date()) {
      return transaction(() => {
        const cutoff = retentionCutoff(at);
        const expired = db.prepare("SELECT id, repo FROM runs WHERE state = 'closed' AND closed_at < ? AND pruned_at IS NULL").all(cutoff).filter((r) => {
          if (db.prepare("SELECT 1 FROM run_stats WHERE run = ?").get(Number(r.id))) return true;
          try {
            storeRunStats(Number(r.id));
            return true;
          } catch {
            return false;
          }
        });
        const touched = new Set(expired.map((r) => String(r.repo)));
        const runIds = expired.map((r) => Number(r.id));
        const inExpired = runIds.length ? `run IN (${runIds.join(", ")})` : "0";
        const doomed = db.prepare(
          `SELECT seq, repo FROM messages WHERE ${inExpired}
               OR (run IS NULL AND at < ? AND kind != 'agreement'
                   AND NOT (kind = 'endorsement' AND endorses IN (SELECT seq FROM messages WHERE run IS NULL AND kind = 'agreement')))`
        ).all(cutoff);
        const dropDeliveries = db.prepare("DELETE FROM deliveries WHERE seq = ?");
        const dropMessage = db.prepare("DELETE FROM messages WHERE seq = ?");
        for (const m of doomed) {
          dropDeliveries.run(Number(m.seq));
          dropMessage.run(Number(m.seq));
          touched.add(String(m.repo));
        }
        for (const run2 of runIds) {
          for (const r of db.prepare("SELECT id FROM participants WHERE run = ?").all(run2)) {
            const id = Number(r.id);
            for (const table of ["claim_log", "shares", "notices", "flags", "claims", "lock_waiters", "merge_locks", "deliveries", "claim_requests", "flag_posts", "call_log", "lock_requests"]) {
              db.prepare(`DELETE FROM ${table} WHERE participant = ?`).run(id);
            }
            db.prepare("DELETE FROM notices WHERE other = ?").run(id);
            db.prepare("DELETE FROM shares WHERE other = ?").run(id);
            if (!db.prepare("SELECT 1 FROM messages WHERE author = ? LIMIT 1").get(id)) db.prepare("DELETE FROM participants WHERE id = ?").run(id);
          }
          db.prepare("DELETE FROM slices WHERE run = ?").run(run2);
          db.prepare("DELETE FROM merges WHERE run = ?").run(run2);
          for (const table of ["phase_done", "transcripts", "token_readings", "liveness_warned"]) db.prepare(`DELETE FROM ${table} WHERE run = ?`).run(run2);
          db.prepare("UPDATE runs SET pruned_at = ? WHERE id = ?").run(at.toISOString(), run2);
        }
        for (const repo of touched) bump(repo);
        return { messages: doomed.length, runs: runIds.length };
      });
    },
    setting(name, value) {
      if (name !== "retention-days") throw new Error(`unknown setting ${name}`);
      if (value !== void 0) {
        if (!Number.isInteger(value) || value < 1) throw new Error(`${name} takes a positive whole number of days, got ${value}`);
        db.prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(name, String(value));
      }
      return retentionDays();
    },
    upkeepIfDue(at = /* @__PURE__ */ new Date()) {
      const due = () => {
        const r = db.prepare("SELECT value FROM settings WHERE name = ?").get(LAST_UPKEEP);
        return !(at.getTime() - Date.parse(String(r?.value)) < UPKEEP_EVERY_MS);
      };
      if (!due()) return false;
      const recorded = transaction(() => {
        if (!due()) return false;
        db.prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(LAST_UPKEEP, at.toISOString());
        return true;
      });
      if (!recorded) return false;
      board.prune(at);
      board.flagStale(at);
      return true;
    },
    flagStale(at = /* @__PURE__ */ new Date()) {
      const silentBefore = at.getTime() - STALE_MS;
      return transaction(() => {
        const quiet = db.prepare("SELECT p.id, p.last_call, p.joined_at FROM participants p JOIN runs r ON r.id = p.run WHERE r.state = 'open' AND p.slice = ? AND p.ended_at IS NULL AND p.quiet_flagged = 0").all(ORCHESTRATOR2);
        for (const o of quiet) {
          const silentSince = Date.parse(String(o.last_call ?? o.joined_at));
          if (silentSince >= silentBefore) continue;
          const minutes = Math.floor((at.getTime() - silentSince) / 6e4);
          insertMessage(participantById(Number(o.id)), `quiet ${minutes} min`, null, "event", [], { event: EVENTS.quiet.name });
          db.prepare("UPDATE participants SET quiet_flagged = 1 WHERE id = ?").run(Number(o.id));
        }
        const flagged = [];
        for (const r of db.prepare("SELECT id, plan FROM runs WHERE state = 'open' AND stale_flagged = 0 ORDER BY id").all()) {
          const id = Number(r.id);
          const members = db.prepare("SELECT id, slice, last_call, joined_at FROM participants WHERE run = ? AND ended_at IS NULL").all(id);
          if (!members.length || members.some((m) => Date.parse(String(m.last_call ?? m.joined_at)) >= silentBefore)) continue;
          const author = members.find((m) => String(m.slice) === ORCHESTRATOR2) ?? members[0];
          const group = String(r.plan);
          insertMessage(participantById(Number(author.id)), `run ${id} (${group}) is stale: every member silent; close it or dispatch again`, null, "event", [`${group}/${ORCHESTRATOR2}`], {
            event: EVENTS.stale.name
          });
          db.prepare("UPDATE runs SET stale_flagged = 1 WHERE id = ?").run(id);
          flagged.push(id);
        }
        return flagged;
      });
    },
    runs() {
      return db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all().map(toRun);
    },
    join({ run: run2, slice, doing, files, worktree, on }) {
      const r = runRow(run2);
      if (r.state !== "open") throw new Error(`run ${run2} is closed`);
      if (slice === ORCHESTRATOR2) throw new Error(`"${ORCHESTRATOR2}" is not a slice`);
      const profile = profileOf(String(r.kind ?? "plan"));
      if (files.length && !profile.claims) throw new Error(`join: a ${profile.kind} run has no claims`);
      const where = worktree && profile.worktree ? path2.resolve(worktree) : null;
      return transaction(() => {
        const id = transaction(() => {
          const existing = db.prepare("SELECT id, nick FROM participants WHERE run = ? AND slice = ?").get(run2, slice);
          const seatRow = db.prepare("SELECT on_events FROM slices WHERE run = ? AND id = ?").get(run2, slice);
          const seatOn = seatRow?.on_events != null ? parseSubscriptions(JSON.parse(String(seatRow.on_events))) : null;
          const subs = JSON.stringify(on ?? seatOn ?? profile.defaults.member);
          const fresh = () => unusedNick(String(r.repo));
          if (existing) {
            db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL, merged = 0, subs = ?, nick = COALESCE(nick, ?) WHERE id = ?").run(
              doing,
              JSON.stringify(files),
              where,
              subs,
              existing.nick == null ? fresh() : null,
              Number(existing.id)
            );
            return Number(existing.id);
          }
          const ins = db.prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at, nick, subs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(run2, slice, where, doing, JSON.stringify(files), lastSeq(), now(), fresh(), subs);
          return Number(ins.lastInsertRowid);
        });
        const runner = participantById(id);
        claims.claimDeclared(runner, files);
        insertMessage(runner, `joined: ${doing}`, null, "event", void 0, { event: EVENTS.joined.name });
        readCounterOnce(run2, slice, /* @__PURE__ */ new Date(), readCounter);
        return { runner, roster: board.roster(runner.repo) };
      });
    },
    participant(name) {
      const i = name.lastIndexOf("/");
      if (i <= 0) return null;
      const plan = name.slice(0, i);
      const slice = name.slice(i + 1);
      const r = db.prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`).get(plan, slice);
      return r ? toParticipant(r) : null;
    },
    identify({ worktree }) {
      if (!worktree) return null;
      const here = fold(path2.resolve(worktree));
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE p.worktree IS NOT NULL AND p.ended_at IS NULL AND r.state = 'open'`).all().filter(
        (r) => {
          const root = fold(String(r.worktree));
          return here === root || here.startsWith(root.endsWith(path2.sep) ? root : root + path2.sep);
        }
      );
      if (!rows.length) return null;
      const deepest = Math.max(...rows.map((r) => String(r.worktree).length));
      const best = rows.filter((r) => String(r.worktree).length === deepest);
      return best.length === 1 ? toParticipant(best[0]) : null;
    },
    setDoing(p, doing) {
      const fresh = live(p);
      db.prepare("UPDATE participants SET doing = ? WHERE id = ?").run(doing, fresh.id);
      insertMessage(fresh, `doing: ${doing}`, null, "event");
    },
    subscribe(p, subs) {
      const fresh = live(p);
      return setSubs(fresh, [...fresh.subscriptions, ...subs.filter((s) => !fresh.subscriptions.some((o) => sameSub(o, s)))]);
    },
    unsubscribe(p, subs) {
      const fresh = live(p);
      return setSubs(fresh, fresh.subscriptions.filter((o) => !subs.some((s) => sameSub(o, s))));
    },
    end(p) {
      const fresh = live(p);
      transaction(() => {
        const waiters = claims.lockWaitersFreedBy(fresh);
        const ended = { event: EVENTS.ended.name };
        if (waiters.length) insertMessage(fresh, `ended
the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`, null, "event", waiters, ended);
        else insertMessage(fresh, "ended", null, "event", void 0, ended);
        db.prepare("UPDATE participants SET ended_at = ?, doing = CASE merged WHEN 1 THEN 'merged and ended' ELSE 'ended' END WHERE id = ?").run(now(), fresh.id);
        claims.releaseAll(fresh.id);
      });
    },
    phase(p, name, text) {
      const fresh = live(p);
      if (fresh.slice !== ORCHESTRATOR2) throw new Error(`phase: only the orchestrator opens a phase; ${fresh.name} is not ${fresh.plan}/${ORCHESTRATOR2}`);
      if (!PHASE_NAME.test(name)) throw new Error(`phase: a phase name is one word, got ${JSON.stringify(name)}`);
      const said = text.trim();
      if (!said) throw new Error(`phase ${name}: what does it ask?`);
      if (runRow(fresh.run).state !== "open") throw new Error(`run ${fresh.run} is closed`);
      return transaction(() => {
        db.prepare("UPDATE runs SET phase = ?, phase_text = ? WHERE id = ?").run(name, said, fresh.run);
        db.prepare("DELETE FROM phase_done WHERE run = ? AND phase = ?").run(fresh.run, name);
        return insertMessage(fresh, `phase ${name}: ${said}`, null, "event", [`${fresh.plan}/*`], { event: EVENTS.phase.name, meta: { phase: name } });
      });
    },
    currentPhase(run2) {
      return phaseOf(runRow(run2));
    },
    done(p, name) {
      const fresh = live(p);
      if (fresh.slice === ORCHESTRATOR2) throw new Error("done: the orchestrator opens phases; a member runs done");
      const current = phaseOf(runRow(fresh.run));
      if (!current) throw new Error(`done ${name}: no phase is open in run ${fresh.run}`);
      if (current.name !== name) throw new Error(`done ${name}: the current phase is ${current.name}`);
      return transaction(() => {
        const added = Number(db.prepare("INSERT OR IGNORE INTO phase_done (run, participant, phase, at) VALUES (?, ?, ?, ?)").run(fresh.run, fresh.id, name, now()).changes) > 0;
        const progress = progressOf(fresh.run, name);
        const all = progress.of > 0 && progress.done === progress.of;
        if (!added) return { progress, all, already: true, message: null };
        const orch = `${fresh.plan}/${ORCHESTRATOR2}`;
        const message = insertMessage(fresh, `done ${name} (${progress.done}/${progress.of})`, null, "event", [orch], { event: EVENTS.done.name, meta: { phase: name } });
        if (all)
          insertMessage(fresh, `all done ${name}: every member is done (${progress.done}/${progress.of}); open the next phase`, null, "event", [orch], {
            event: EVENTS["all-done"].name,
            meta: { phase: name }
          });
        return { progress, all, already: false, message };
      });
    },
    phaseProgress(run2) {
      const r = runRow(run2);
      return progressOf(run2, r.phase == null ? null : String(r.phase));
    },
    owedPhase(p) {
      const row = db.prepare("SELECT id, run, slice, ended_at FROM participants WHERE id = ?").get(p.id);
      if (!row || row.ended_at != null || String(row.slice) === ORCHESTRATOR2) return null;
      const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(Number(row.run));
      const current = r && r.state === "open" ? phaseOf(r) : null;
      if (!current) return null;
      const done = db.prepare("SELECT 1 FROM phase_done WHERE run = ? AND participant = ? AND phase = ?").get(Number(row.run), Number(row.id), current.name);
      return done ? null : current;
    },
    registerTranscript(run2, member, file) {
      const r = runRow(run2);
      if (r.state !== "open") throw new Error(`run ${run2} is closed`);
      if (member !== ORCHESTRATOR2 && !db.prepare("SELECT 1 FROM slices WHERE run = ? AND id = ?").get(run2, member)) throw new Error(`unknown slice ${member} in run ${run2}`);
      return transaction(() => {
        db.prepare("INSERT OR REPLACE INTO transcripts (run, member, path) VALUES (?, ?, ?)").run(run2, member, path2.resolve(file));
        readCounterOnce(run2, member, /* @__PURE__ */ new Date(), readCounter);
        bump(String(r.repo));
        return livenessOf(transcriptOf(run2, member));
      });
    },
    livenessTick(run2, at = /* @__PURE__ */ new Date(), read2 = readCounter) {
      const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(run2);
      if (!r || r.state !== "open") return false;
      transaction(() => {
        const members = db.prepare("SELECT slice FROM participants WHERE run = ? AND ended_at IS NULL").all(run2).map((m) => String(m.slice));
        for (const m of members) if (transcriptOf(run2, m)) readCounterOnce(run2, m, at, read2);
        db.prepare("DELETE FROM token_readings WHERE run = ? AND t < ?").run(run2, new Date(at.getTime() - READINGS_KEPT_MS).toISOString());
        const readable = db.prepare("SELECT member, moved_at FROM transcripts WHERE run = ? AND readable = 1 AND moved_at IS NOT NULL").all(run2).filter(
          (t) => members.includes(String(t.member))
        );
        if (!readable.length) return;
        const last = readable.reduce((a, b) => String(b.moved_at) > String(a.moved_at) ? b : a);
        const silence = at.getTime() - Date.parse(String(last.moved_at));
        const threshold = Number(r.stall_ms ?? STALL_MS_DEFAULT);
        const posted = Number(r.stall_posts ?? 0);
        if (silence < threshold) {
          if (posted) db.prepare("UPDATE runs SET stall_posts = 0 WHERE id = ?").run(run2);
          return;
        }
        if (!stallDue(silence, posted, threshold)) return;
        const orch = orchestratorIn(run2);
        const secs = Math.floor(silence / 1e3);
        const progress = progressOf(run2, r.phase == null ? null : String(r.phase));
        const where = progress ? `phase ${progress.phase} ${progress.done}/${progress.of} done` : "no phase open";
        insertMessage(orch, `stalled ${secs}s: no token counter moved; last active ${orch.plan}/${last.member} ${secs}s ago; ${where}`, null, "event", [orch.name], {
          event: EVENTS.stalled.name
        });
        db.prepare("UPDATE runs SET stall_posts = ? WHERE id = ?").run(Math.floor(silence / threshold), run2);
      });
      return true;
    },
    roster(repo) {
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`).all(repo);
      const cutoff = Date.now() - STALE_MS;
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
        nick: nickOf(r),
        run: Number(r.run),
        plan: String(r.plan),
        slice: String(r.slice),
        doing: String(r.doing),
        files: JSON.parse(String(r.files)),
        stale: Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
        subscriptions: subsOf(r),
        worktree: r.worktree == null ? null : String(r.worktree)
      }));
    },
    post(p, body, opts2 = {}) {
      const fresh = live(p);
      const m = insertMessage(fresh, body, opts2.about ?? null, opts2.kind ?? "msg");
      const claimed = profileOf(fresh.kind).claims ? claims.claimByPost(fresh, m) : null;
      return claimed ? { ...m, claimed } : m;
    },
    endorse(p, seq) {
      const fresh = live(p);
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq);
      if (!r) throw new Error(`unknown message #${seq}`);
      if (r.kind !== "agreement") throw new Error(`#${seq} is not an agreement`);
      if (Number(r.author) === fresh.id) throw new Error(`#${seq} is your own agreement`);
      const author = participantById(Number(r.author));
      const about = r.about == null ? null : String(r.about);
      return insertMessage(fresh, `endorses #${seq}`, about, "endorsement", [author.name], { endorses: seq });
    },
    read(seq) {
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq);
      if (!r) throw new Error(`unknown message #${seq}`);
      return toMessage(r);
    },
    deliver(p) {
      return deliverTo(p, false);
    },
    wait(p, opts2 = {}) {
      const { timeoutMs, mentionsOnly = false } = opts2;
      const column = mentionsOnly ? "listening" : "waiting";
      const gen = transaction(() => {
        const me = participantById(p.id);
        db.prepare("UPDATE participants SET wait_gen = wait_gen + 1, waiting = ?, listening = ? WHERE id = ?").run(mentionsOnly ? 0 : 1, mentionsOnly ? 1 : 0, me.id);
        bump(me.repo);
        return Number(db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(me.id).wait_gen);
      });
      const current = () => Number(db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(p.id).wait_gen) === gen;
      return new Promise((resolve, reject) => {
        let settled = false;
        let watcher;
        let poll;
        let timer;
        const finish = (d) => {
          if (settled) return;
          settled = true;
          watcher?.close();
          clearInterval(poll);
          clearTimeout(timer);
          try {
            transaction(() => {
              const r = db.prepare(`UPDATE participants SET ${column} = 0 WHERE id = ? AND wait_gen = ? AND ${column} = 1`).run(p.id, gen);
              if (Number(r.changes) > 0) bump(participantById(p.id).repo);
            });
          } catch {
          }
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = () => {
          if (settled) return;
          try {
            if (participantById(p.id).ended) return finish({ full: [], lines: [] });
            const d = transaction(() => current() ? deliverTo(p, true, mentionsOnly) : null);
            if (!d) return finish({ full: [], lines: [], superseded: true });
            if (d.full.length || d.lines.length) finish(d);
          } catch (e) {
            finish(e);
          }
        };
        watcher = fs2.watch(signal, check);
        poll = setInterval(check, WAIT_POLL_MS);
        if (timeoutMs !== void 0) timer = setTimeout(() => finish({ full: [], lines: [] }), timeoutMs);
        check();
      });
    },
    checkEdit(p, file, opts2 = {}) {
      return claims.checkEdit(gated(live(p), "claim"), file, opts2);
    },
    reconcileWrites(p, changed) {
      return claims.reconcileWrites(gated(live(p), "reconcile"), changed);
    },
    release(p, file) {
      claims.release(gated(live(p), "release"), file);
    },
    lockMerge(p, onto, reflogMark) {
      return claims.lockMerge(gated(live(p), "merge-lock"), onto, reflogMark);
    },
    merged(p, sha, files, conflicts) {
      return claims.merged(gated(live(p), "merged"), sha, files, conflicts);
    },
    heldMergeLock(p) {
      return claims.heldMergeLock(p);
    },
    stats(scope) {
      return statsOf(db, scope, STALE_MS);
    },
    repos() {
      const byRepo = /* @__PURE__ */ new Map();
      for (const r of listedRuns()) {
        const list = byRepo.get(String(r.repo)) ?? [];
        list.push(runSummary(r));
        byRepo.set(String(r.repo), list);
      }
      const latest = (runs) => Math.max(...runs.map((x) => x.run));
      return [...byRepo.entries()].map(([repo, runs]) => ({ repo, name: repoName(repo), runs })).sort((a, b) => Number(b.runs.some((x) => x.open)) - Number(a.runs.some((x) => x.open)) || latest(b.runs) - latest(a.runs));
    },
    snapshot(repo) {
      const runRows = listedRuns().filter((r) => r.repo === repo);
      if (!runRows.length) throw new Error(`no repository ${repo}`);
      const runIds = runRows.map((r) => Number(r.id));
      const marks = runIds.map(() => "?").join(", ");
      const lockRow = db.prepare("SELECT participant, at FROM merge_locks WHERE repo = ?").get(repo);
      const lockHolder = lockRow && isLive(Number(lockRow.participant)) ? Number(lockRow.participant) : null;
      const sliceRows = db.prepare(`SELECT * FROM slices WHERE run IN (${marks}) ORDER BY run, ord`).all(...runIds);
      const sliceOf = new Map(sliceRows.map((s) => [`${s.run}/${s.id}`, s]));
      const people = db.prepare(`${PARTICIPANT_SQL} WHERE p.run IN (${marks}) ORDER BY p.run, p.id`).all(...runIds);
      const runOpen = new Map(runRows.map((r) => [Number(r.id), r.state === "open"]));
      const cutoff = Date.now() - STALE_MS;
      const claimsOf2 = db.prepare("SELECT path, kind FROM claims WHERE participant = ? ORDER BY rowid");
      const live2 = db.prepare("SELECT c.path, c.kind, c.participant, p.slice, r.plan FROM claims c JOIN participants p ON p.id = c.participant JOIN runs r ON r.id = p.run WHERE c.repo = ? ORDER BY c.rowid").all(repo).filter((c) => isLive(Number(c.participant)));
      const files = /* @__PURE__ */ new Map();
      for (const c of live2) {
        const f = files.get(String(c.path)) ?? { path: String(c.path), holders: [], interface: false };
        f.holders.push(`${c.plan}/${c.slice}`);
        f.interface ||= c.kind === "interface";
        files.set(f.path, f);
      }
      const everClaimed = db.prepare("SELECT 1 FROM claim_log WHERE repo = ? AND path = ? AND participant = ?");
      for (const r of people) {
        if (String(r.slice) === ORCHESTRATOR2 || !isLive(Number(r.id))) continue;
        const name = `${r.plan}/${r.slice}`;
        for (const d of JSON.parse(String(r.files))) {
          const f = files.get(relPath(repo, d.path) ?? d.path);
          if (f && !f.holders.includes(name) && !everClaimed.get(repo, f.path, Number(r.id))) f.holders.push(name);
        }
      }
      const sharedBy = (path5, id) => live2.some((c) => String(c.path) === path5 && Number(c.participant) !== id);
      const roster = people.map((r) => {
        const id = Number(r.id);
        const slice = String(r.slice);
        const orchestrator = slice === ORCHESTRATOR2;
        const s = sliceOf.get(`${r.run}/${slice}`);
        const ended = r.ended_at != null;
        const state = orchestrator ? runOpen.get(Number(r.run)) ? "watching" : "done" : s?.state === "done" ? "done" : ended ? "ended" : lockHolder === id ? "merging" : Number(r.waiting) === 1 ? "waiting" : "working";
        return {
          runner: `${r.plan}/${slice}`,
          nick: nickOf(r),
          plan: String(r.plan),
          slice,
          title: orchestrator ? "" : String(s?.title ?? slice),
          doing: String(r.doing),
          state,
          stale: !ended && !orchestrator && Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
          files: claimsOf2.all(id).map((c) => ({ path: String(c.path), interface: c.kind === "interface", shared: sharedBy(String(c.path), id) })),
          joined: String(r.joined_at),
          ended: r.ended_at == null ? null : String(r.ended_at),
          calls: Number(r.calls ?? 0),
          listening: !ended && Number(r.listening) === 1,
          on: subsOf(r).map((x) => formatSubscriptions([x])),
          lastCall: String(r.last_call ?? r.joined_at),
          liveness: livenessOf(transcriptOf(Number(r.run), slice))
        };
      });
      const events = db.prepare("SELECT * FROM (SELECT * FROM messages WHERE repo = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(repo, EVENTS_SHOWN).map((r) => {
        const m = toMessage(r);
        return {
          seq: m.seq,
          at: m.at,
          kind: m.kind,
          from: m.from,
          body: m.body,
          about: m.about,
          run: m.run,
          channel: m.run,
          event: m.event,
          mentions: m.mentions,
          meta: m.meta ?? null
        };
      });
      const nameOf = new Map(people.map((r) => [`${r.run}/${r.slice}`, `${r.plan}/${r.slice}`]));
      const queues = {};
      for (const run2 of runRows) {
        queues[String(run2.plan)] = sliceRows.filter((s) => Number(s.run) === Number(run2.id)).map((s) => ({
          slice: String(s.id),
          title: String(s.title),
          link: s.link == null ? null : String(s.link),
          state: String(s.state),
          blockers: JSON.parse(String(s.blockers)),
          runner: nameOf.get(`${run2.id}/${s.id}`) ?? null
        }));
      }
      const flags = db.prepare("SELECT f.path, p.slice, r.plan FROM flags f JOIN participants p ON p.id = f.participant JOIN runs r ON r.id = p.run WHERE f.repo = ? ORDER BY f.rowid").all(repo).map((f) => ({ path: String(f.path), runner: `${f.plan}/${f.slice}` }));
      return {
        repo,
        name: repoName(repo),
        runs: runRows.map(runSummary),
        lock: lockHolder !== null ? { holder: participantById(lockHolder).name, since: String(lockRow.at) } : null,
        roster,
        events,
        queues,
        files: [...files.values()],
        flags
      };
    },
    onChange(listener) {
      listeners.add(listener);
      if (!watching) {
        versions = readVersions();
        const check = () => {
          let next;
          try {
            next = readVersions();
          } catch {
            return;
          }
          const moved = [...next].filter(([repo, v]) => versions.get(repo) !== v).map(([repo]) => repo);
          versions = next;
          for (const repo of moved) for (const l of [...listeners]) l(repo);
        };
        const watcher = fs2.watch(signal, check);
        const poll = setInterval(check, WAIT_POLL_MS);
        watcher.unref?.();
        poll.unref?.();
        watching = { close: () => (watcher.close(), clearInterval(poll)) };
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size && watching) {
          watching.close();
          watching = null;
        }
      };
    },
    close() {
      watching?.close();
      watching = null;
      listeners.clear();
      db.close();
    }
  };
  const countCall = (p, verb) => {
    const at = now();
    db.prepare("UPDATE participants SET calls = calls + 1, last_call = ? WHERE id = ?").run(at, p.id);
    db.prepare("INSERT INTO call_log (participant, at, verb) VALUES (?, ?, ?)").run(p.id, at, verb);
    db.prepare("UPDATE runs SET stale_flagged = 0 WHERE id = ? AND stale_flagged = 1").run(p.run);
    if (Number(db.prepare("UPDATE participants SET quiet_flagged = 0 WHERE id = ? AND quiet_flagged = 1").run(p.id).changes) > 0 && runRow(p.run).state === "open")
      insertMessage(participantById(p.id), "back", null, "event", [], { event: EVENTS.back.name });
    bump(participantById(p.id).repo);
  };
  const counted = (name, verb) => (p, ...rest) => transaction(() => {
    const out = verb(p, ...rest);
    countCall(p, name);
    return out;
  });
  board.setDoing = counted("setDoing", board.setDoing);
  board.subscribe = counted("subscribe", board.subscribe);
  board.unsubscribe = counted("unsubscribe", board.unsubscribe);
  board.end = counted("end", board.end);
  board.post = counted("post", board.post);
  board.phase = counted("phase", board.phase);
  board.done = counted("done", board.done);
  board.endorse = counted("endorse", board.endorse);
  board.deliver = counted("deliver", board.deliver);
  board.wait = counted("wait", board.wait);
  board.checkEdit = counted("checkEdit", board.checkEdit);
  board.release = counted("release", board.release);
  board.lockMerge = counted("lockMerge", board.lockMerge);
  board.merged = counted("merged", board.merged);
  const read = board.read;
  board.read = (seq, by) => {
    const m = read(seq);
    if (by) transaction(() => countCall(by, "read"));
    return m;
  };
  return board;
}

// src/cli/args.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--plan",
  "--title",
  "--slices",
  "--run",
  "--slice",
  "--state",
  "--doing",
  "--file",
  "--as",
  "--about",
  "--timeout",
  "--repo",
  "--port",
  "--onto",
  "--kind",
  "--group",
  "--seats",
  "--seat",
  "--on",
  "--blockers",
  "--role",
  "--link",
  "--since"
]);
var LIST_FLAGS = /* @__PURE__ */ new Set(["--files"]);
function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const listed = /* @__PURE__ */ new Set();
  let inList = false;
  rest.forEach((a, i) => {
    if (a.startsWith("--")) inList = LIST_FLAGS.has(a);
    else if (inList) listed.add(i);
  });
  return {
    verb,
    rest,
    positional: rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(rest[i - 1] ?? "") && !listed.has(i)),
    flag: (name) => {
      const i = rest.indexOf(name);
      return i >= 0 ? rest[i + 1] : void 0;
    },
    flags: (name) => rest.flatMap((a, i) => a === name && rest[i + 1] ? [rest[i + 1]] : []),
    list: (name) => {
      const out = [];
      let on = false;
      for (const a of rest) {
        if (a.startsWith("--")) on = a === name;
        else if (on) out.push(...a.split(",").map((x) => x.trim()).filter(Boolean));
      }
      return out;
    },
    has: (name) => rest.includes(name)
  };
}

// src/cli/format.ts
var seqLine = (m) => `#${m.seq}`;
var fullText = (m) => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}
${m.body}${m.answer ? `
${m.answer}` : ""}`;
};

// src/cli/aiview-document.ts
import { spawnSync } from "node:child_process";
import fs3 from "node:fs";
import path3 from "node:path";
function aiviewLauncher(toolRoot2) {
  const file = process.env.SWARM_AIVIEW ?? path3.join(toolRoot2, "..", "aiview", "aiview.mjs");
  return fs3.existsSync(file) ? file : null;
}
var callAiview = (launcher, cwd, argv) => {
  const r = spawnSync(process.execPath, [launcher, ...argv, "--json"], { cwd, encoding: "utf8" });
  if (r.status !== 0) return { ok: false, error: `aiview ${argv[0]} failed: ${(r.stderr || r.stdout).trim()}` };
  try {
    return { ok: true, out: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
  } catch {
    return { ok: false, error: `aiview ${argv[0]}: unreadable output ${r.stdout.trim()}` };
  }
};
var BOARD_DOCUMENT_FILE = "swarm.swarm.json";
var boardReposFor = (current, repo) => {
  const repos = reposInDocument(current);
  return repos.includes(repo) ? repos : [...repos, repo];
};
function reposInDocument(text) {
  if (text === null) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const named = Array.isArray(parsed.repos) ? parsed.repos.filter((r) => typeof r === "string") : typeof parsed.url === "string" ? reposInPreMergeUrl(parsed.url) : [];
  return [...new Set(named)];
}
var reposInPreMergeUrl = (url) => {
  try {
    return new URL(url).searchParams.getAll("repo");
  } catch {
    return [];
  }
};
var boardDocumentText = (repos) => JSON.stringify({ repos }, null, 2) + "\n";
function registerBoardDocument(input) {
  const launcher = aiviewLauncher(input.toolRoot);
  if (!launcher) return { registered: false, reason: "aiview not found" };
  const aiview = (argv) => callAiview(launcher, input.cwd, argv);
  const status = aiview(["status"]);
  if (!status.ok) return { registered: false, reason: status.error };
  const project = status.out.cwdProject;
  if (!project) return { registered: false, reason: `no aiview project for ${input.cwd}` };
  const where = aiview(["path", BOARD_DOCUMENT_FILE, "--project", project]);
  if (!where.ok) return { registered: false, reason: where.error };
  const file = where.out.path;
  const existing = readDocumentText(file);
  const text = boardDocumentText(boardReposFor(existing, input.repo));
  if (text !== existing) {
    fs3.mkdirSync(path3.dirname(file), { recursive: true });
    fs3.writeFileSync(file, text);
  }
  const opened = aiview(existing === null ? ["open", file, "--kind", "swarm"] : ["open", file]);
  if (!opened.ok) return { registered: false, reason: opened.error };
  const retired = retireOtherSwarmDocuments(aiview, project, file);
  if (!retired.ok) return { registered: false, reason: retired.error };
  return { registered: true, url: opened.out.url, file, retired: retired.files };
}
function readDocumentText(file) {
  try {
    return fs3.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
function retireOtherSwarmDocuments(aiview, project, board) {
  const listed = aiview(["list", "--kind", "swarm", "--project", project]);
  if (!listed.ok) return listed;
  const others = listed.out.filter((d) => path3.resolve(d.abs_path ?? d.file_path) !== path3.resolve(board));
  if (!others.length) return { ok: true, files: [] };
  const removed = aiview(["remove", ...others.map((d) => `#${d.id}`)]);
  if (!removed.ok) return removed;
  return { ok: true, files: others.map((d) => d.file_path) };
}

// src/cli/unclaimed.ts
var COLLAPSE_OVER = 20;
function unclaimedLines(paths) {
  const folderOf = (p) => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".";
  const byFolder = /* @__PURE__ */ new Map();
  for (const p of paths) byFolder.set(folderOf(p), [...byFolder.get(folderOf(p)) ?? [], p]);
  const lines = [];
  const told = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const folder = folderOf(p);
    const inFolder = byFolder.get(folder);
    if (inFolder.length <= COLLAPSE_OVER) lines.push(`reconciled ${p}`);
    else if (!told.has(folder)) {
      told.add(folder);
      lines.push(`${inFolder.length} files under ${folder}/ written unclaimed`);
    }
  }
  return lines;
}

// src/cli/git.ts
import { spawnSync as spawnSync2 } from "node:child_process";
var gitAnswer = (cwd, ...argv) => {
  const r = spawnSync2("git", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};
var git = (cwd, ...argv) => {
  const r = gitAnswer(cwd, ...argv);
  return r.status === 0 ? r.stdout.trim() : null;
};

// src/cli/conflicts.ts
var MERGE_TREE_SINCE = [2, 38];
var REBASE_START = /^(?:pull --)?rebase(?: -[a-z]+)? \(start\):/;
function gitHasMergeTree(worktree) {
  const m = (git(worktree, "version") ?? "").match(/(\d+)\.(\d+)/);
  if (!m) return false;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > MERGE_TREE_SINCE[0] || major === MERGE_TREE_SINCE[0] && minor >= MERGE_TREE_SINCE[1];
}
function headReflog(worktree) {
  const r = gitAnswer(worktree, "reflog", "show", "--format=%H%x09%gs", "HEAD");
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [commit, ...subject] = line.split("	");
    return { commit, subject: subject.join("	") };
  });
}
function headReflogLength(worktree) {
  try {
    return headReflog(worktree)?.length ?? null;
  } catch {
    return null;
  }
}
function conflictsOf(worktree, onto, reflogMark) {
  try {
    if (!gitHasMergeTree(worktree)) return { unknown: "old-git" };
    const reflog = headReflog(worktree);
    if (!reflog || reflog.length < reflogMark) return { unknown: "no-reflog" };
    const start = reflog.slice(0, reflog.length - reflogMark).findIndex((e) => REBASE_START.test(e.subject));
    if (start < 0) return { files: [] };
    const before = reflog[start + 1];
    const target = reflog[start].commit || onto;
    if (!before || !target) return { unknown: "no-reflog" };
    const r = gitAnswer(worktree, "merge-tree", "--write-tree", "--name-only", "--no-messages", "-z", before.commit, target);
    if (r.status === 0) return { files: [] };
    if (r.status !== 1) return { unknown: "no-reflog" };
    const [, ...paths] = r.stdout.split("\0").filter(Boolean);
    return { files: [...new Set(paths)] };
  } catch {
    return { unknown: "no-reflog" };
  }
}

// src/cli/index.ts
var args = parseArgs(process.argv.slice(2));
var asJson = args.has("--json");
var WAIT_UPKEEP_TICK_MS = 1e3;
var USAGE = [
  "usage: swarm <verb> [--json]        (swarm --help code: the claim and merge verbs)",
  "  open    --kind plan|brainstorm --group <slug> --title <t> --seats <file.json> [--link <url>] [--transcript <path>] [--stall-ms <ms>]   # opens a run, registers the project's board in aiview, starts its stall poller, prints the run id then the board's URL (orchestrator)",
  "          # --transcript: your own transcript, its token counter read for the stall check; --stall-ms: no counter moved this long posts stalled, default 5000",
  "          # --plan <slug> --slices <file.json>: the same as --kind plan --group <slug> --seats <file.json>",
  '          # the seats file: [{"id", "title", "role"?, "blockers": [...], "link"?: "<URL>", "on"?: ["agreement", \u2026], "transcript"?: "<path>"}]',
  "  slice   <id> --run <id> [--state ready|running|done|blocked] [--transcript <path>]   # --transcript: the dispatched member's transcript, after dispatch (orchestrator)",
  "  slice   add <id> --run <id> --title <t> [--blockers a,b] [--link <url>] [--role <r>] [--on <events>]   # adds a slice or seat mid-run (orchestrator)",
  "  phase   <name> <text> [--as <member>]                           # opens phase <name>; the current phase ends with it: a separator on the thread that wakes every member of the run (orchestrator)",
  "  done    <phase> [--as <member>]                                 # your part of the current phase is in: tells the orchestrator; when every member is done, the board tells it",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --seat <id> --doing <t> [--files "<path>:interface,<path>:inside,\u2026"]   # --slice <id> the same; prints the roster, then how you listen: a seat waits in the foreground, a slice runner listens in the background',
  "          # --on <events>: what wakes your wait --mentions besides mentions and urgent posts, e.g. agreement,any:merged; else the seat row's on, else the kind's defaults",
  "  subscribe   [--as <member>] <events>                            # prints your subscriptions after",
  "  unsubscribe [--as <member>] <events>",
  "  doing   [--as <member>] <text>",
  "  post    [--as <member>] <body> [--about <path|decision id>]   # prints the seq",
  "  agree   [--as <member>] <terms> [--about <path|decision id>]  # prints the seq",
  "  endorse [--as <member>] <seq>                                   # backs an agreement; prints the endorsement's seq",
  "  read    <seq>",
  "  deliver [--as <member>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <member>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # once your run is closed, wait, deliver, read, roster --as, post, agree, endorse, doing and done answer: run <id> closed: run end \u2026",
  "          # --mentions: only a mention of you, an urgent post or an event you subscribed to ends it; the rest stays for deliver",
  "  roster  [--repo <path>] [--as <member>]",
  "  end     [--as <member>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  status                                                          # data home, open runs, each run's phase and its n/m done",
  "  config  retention [<days>]                                      # prints, or sets then prints, how many days closed runs and main's talk are kept",
  `events: ${Object.keys(EVENTS).join(", ")}; any:<event> for one posted in any run`,
  "a member is <group>/<seat>, the orchestrator <group>/orchestrator; without --as, the runner joined from this worktree"
].join("\n");
var CODE_USAGE = [
  "usage: swarm <verb> [--json]        the code verbs; refused on a run whose kind has no claims",
  "  claim   [--as <runner>] <path> [--interface] [--new]            # before editing a file: exit 0 claimed, 3 held until you post about it (the post claims it); --new: a file you create",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock --onto <branch> [--as <runner>]                      # one merge at a time per repository; claims or flags what your branch wrote unclaimed",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase and who was refused the lock, names whom to tell of a resolved conflict"
].join("\n");
var STATS_USAGE = [
  "usage: swarm stats [--repo <path>] [--run <id>] [--since 30d|<ISO> | --all] [--closed] [--kind plan|brainstorm[,\u2026]] [--json]",
  "  the figures of a repository's runs, oldest first, with the scope's totals; a figure not recorded or not computed yet is null, never 0",
  "  --since: runs open, or closed since then, default 30d, none with --run; --all: every run kept; --closed: closed runs only",
  "  without --json: one line per run; --json carries every figure, with the run ids, members and seqs to follow with swarm read <seq>"
].join("\n");
var lengthText = (ms2) => {
  if (ms2 === null) return "\u2014";
  const minutes = Math.floor(ms2 / 6e4);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  return minutes >= 1 ? `${minutes}m` : `${Math.round(ms2 / 1e3)}s`;
};
var statsLine = (r) => {
  const c = r.plan?.conflicts;
  const conflicts = !c || r.recorded && r.firstMergeAtMs === null ? "\u2014" : c.known === null ? "unknown" : c.unknownMerges ? `${c.known} + ${c.unknownMerges} unknown` : String(c.known);
  return `${r.code} ${r.title} \xB7 ${r.kind} \xB7 ${lengthText(r.lengthMs)} \xB7 ${r.closedAt === null ? "open" : "closed"} \xB7 conflicts ${conflicts}`;
};
var CliError = class extends Error {
};
var fail = (msg) => {
  throw new CliError(msg);
};
var emit = (json, human) => {
  if (asJson) console.log(JSON.stringify(json));
  else if (typeof human === "string") {
    if (human) console.log(human);
  } else human();
};
function transcriptWarning(member, file) {
  let size;
  try {
    size = fs4.statSync(file).size;
  } catch {
    return `liveness: ${member}'s transcript ${file} does not exist: the stall check is blind for it; register the agent's own transcript`;
  }
  if (size === 0) return `liveness: ${member}'s transcript ${file} is empty: not a transcript, the stall check is blind for it; register the agent's own transcript, not its task output`;
  if (!readTranscript(file, null)) return `liveness: ${member}'s transcript ${file} is in no known format: the stall check is blind for it; register the agent's own transcript`;
  return null;
}
function repoOf(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path4.resolve(dir, common);
  try {
    return fs4.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function worktreeOf(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path4.resolve(top) : null;
}
function changedIn(worktree) {
  const r = spawnSync3("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git status failed in ${worktree}: ${r.stderr.trim()}`);
  const parts = r.stdout.split("\0");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    out.push(e.slice(3));
    if (/[RC]/.test(e.slice(0, 2)) && parts[i + 1]) out.push(parts[++i]);
  }
  return out;
}
function branchChangedIn(worktree, onto) {
  const base = git(worktree, "merge-base", onto, "HEAD") ?? fail(`no merge base between ${onto} and HEAD in ${worktree}: is --onto the branch you merge into?`);
  const r = spawnSync3("git", ["diff", "--name-only", "-z", "--no-renames", `${base}..HEAD`], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git diff failed in ${worktree}: ${r.stderr.trim()}`);
  const committed = r.stdout.split("\0").filter(Boolean);
  return [.../* @__PURE__ */ new Set([...committed, ...changedIn(worktree)])];
}
var printReconciled = (reconciled, flags) => {
  for (const line of unclaimedLines(reconciled)) console.log(line);
  for (const f of flags) console.log(`#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the thread.`);
};
var toolRoot = () => process.env.SWARM_ROOT ?? path4.dirname(path4.resolve(process.argv[1]));
var need = (flag) => args.flag(flag) ?? fail(`${flag} is required
${USAGE}`);
var runArg = () => {
  const raw = need("--run");
  const id = Number(raw);
  if (!Number.isInteger(id)) fail(`--run takes a run id, got ${raw}`);
  return id;
};
function caller(board) {
  const as = args.flag("--as");
  if (as) return board.participant(as) ?? fail(`unknown runner ${as}`);
  const wt = worktreeOf(process.cwd());
  const p = wt ? board.identify({ worktree: wt }) : null;
  return p ?? fail("who is calling? no single runner joined from this worktree; pass --as <plan>/<slice>");
}
var rosterLine = (r) => {
  const files = r.files.map((f) => f.interface ? `${f.path} (interface)` : f.path).join(", ");
  const who = r.slice === "orchestrator" ? r.name : `${r.nick} \xB7 ${r.name}`;
  const on = r.subscriptions.length ? `  on: ${formatSubscriptions(r.subscriptions)}` : "";
  return `${who}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}${on}`;
};
var phaseHeader = (board, run2) => {
  const ph = board.currentPhase(run2);
  return ph ? `phase ${ph.name}: ${ph.text}` : null;
};
var phaseSuffix = (phase, progress) => phase ? `  phase ${phase.name}: ${phase.text}${progress ? `  ${progress.done}/${progress.of} done` : ""}` : "";
var pollerPidFile = (run2) => path4.join(DATA_ROOT, `swarm-poll-${run2}.pid`);
function startPoller(run2) {
  if (process.env.SWARM_NO_POLLER === "1") return;
  const child = spawn(process.execPath, [process.argv[1], "poll", "--run", String(run2)], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
function stopPoller(run2) {
  const file = pollerPidFile(run2);
  try {
    const pid = Number(fs4.readFileSync(file, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) process.kill(pid);
  } catch {
  }
  try {
    fs4.rmSync(file, { force: true });
  } catch {
  }
}
var POLL_MS = 1e3;
var withNext = (me, d) => ({
  ...d,
  full: d.full.map((m) => {
    const e = eventOf(m);
    const line = e ? EVENTS[e].next?.(m, me, self().join(" ")) ?? null : null;
    return line ? { ...m, endorse: line } : m;
  })
});
var printDelivery = (d) => {
  for (const m of d.full) {
    console.log(fullText(m));
    if (m.endorse) console.log(m.endorse);
  }
  for (const l of d.lines) console.log(l);
};
var shellWord = (w) => /^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`;
var self = () => ["node", shellWord(process.argv[1].replace(/\\/g, "/"))];
var listensInForeground = (p) => p.slice !== "orchestrator" && profileOf(p.kind).member === "seat";
var waitCommand = (name) => [...self(), "wait", "--mentions", "--as", shellWord(name)].join(" ");
var listenNow = (p, afterPhase = false) => listensInForeground(p) ? `${afterPhase ? "only then wait" : "wait now"}, in the foreground (never a background listener: a seat that ends its turn is gone): ${waitCommand(p.name)}` : `start your listener now, in the background (your harness's background task): ${waitCommand(p.name)}`;
var owedLine = (board, p) => {
  const ph = board.owedPhase(p);
  return ph ? `phase ${ph.name} is open and asks: ${ph.text}. Do your part now, then: ${[...self(), "done", shellWord(ph.name), "--as", shellWord(p.name)].join(" ")}` : null;
};
var nextStep = (board, p) => {
  const owed = owedLine(board, p);
  return owed ? `${owed}
${listenNow(p, true)}` : listenNow(p);
};
var closedLine = (p) => `run ${p.run} closed: run end and return your summary: ${[...self(), "end", "--as", shellWord(p.name)].join(" ")}`;
var answeredClosed = (board, p) => {
  if (board.runs().some((r) => r.id === p.run)) return false;
  const line = closedLine(p);
  emit({ run: p.run, closed: true, next: line }, line);
  return true;
};
var unmatchedLines = (board, p, body) => {
  const roster = board.roster(p.repo);
  const runners = roster.filter((r) => r.slice !== "orchestrator");
  const plans = [...new Set(roster.map((r) => r.plan))];
  const names = new Map(runners.map((r) => [nameHandle(r.nick), r.name]));
  const nickOf = new Map(runners.map((r) => [r.name, r.nick.replace(/\s+/g, "")]));
  return unmatchedMentions(body, p.plan, plans, names).map(({ name, closest }) => {
    const guesses = closest.map((c) => nickOf.has(c) ? `@${c} or @${nickOf.get(c)}` : `@${c}`);
    return `@${name} matched nobody on the board${guesses.length ? `: did you mean ${guesses.join(", ")}?` : ""}`;
  });
};
var emitHeard = (board, p, json, human) => {
  const next = !p.ended && !p.listening ? nextStep(board, p) : null;
  emit(next ? { ...json, next } : json, () => {
    if (typeof human === "string") console.log(human);
    else human();
    if (next) console.log(next);
  });
};
function resolveClaimPath(file) {
  if (path4.isAbsolute(file)) return file;
  const here = path4.resolve(file);
  if (fs4.existsSync(here)) return here;
  const root = worktreeOf(process.cwd());
  const fromRoot = root ? path4.resolve(root, file) : null;
  if (fromRoot && fs4.existsSync(fromRoot)) return fromRoot;
  if (args.has("--new")) return here;
  return fail(`no such file: ${here}${fromRoot && fromRoot !== here ? ` nor ${fromRoot}` : ""}; pass --new if you are creating it`);
}
function repoRelative(abs) {
  const root = worktreeOf(process.cwd());
  const rel = root ? path4.relative(root, abs) : abs;
  return rel.split(path4.sep).join("/");
}
function aboutArg() {
  const about = args.flag("--about");
  if (about === void 0 || !/[\\/]/.test(about)) return about;
  return repoRelative(resolveClaimPath(about));
}
function parseFile(spec) {
  const m = spec.match(/^(.*):(interface|inside)$/);
  const d = m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
  return { ...d, path: repoRelative(resolveClaimPath(d.path)) };
}
function readSlices(file) {
  let raw;
  try {
    raw = JSON.parse(fs4.readFileSync(path4.resolve(file), "utf8"));
  } catch (e) {
    return fail(`cannot read slices from ${file}: ${e.message}`);
  }
  const list = Array.isArray(raw) ? raw : raw.slices;
  if (!Array.isArray(list)) return fail(`${file}: expected an array of {id, title, blockers}`);
  return list.map((s) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return {
      id: String(s.id),
      title: String(s.title ?? s.id),
      ...typeof s.role === "string" && s.role ? { role: s.role } : {},
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null,
      ...Array.isArray(s.on) ? { on: s.on.map(String) } : {},
      ...typeof s.transcript === "string" && s.transcript ? { transcript: path4.resolve(s.transcript) } : {}
    };
  });
}
function boardUpkeep(board) {
  try {
    board.upkeepIfDue();
  } catch (e) {
    console.error(`swarm: upkeep failed: ${e.message}`);
  }
}
function openKindAndGroup() {
  const raw = args.flag("--kind") ?? "plan";
  let kind;
  try {
    kind = profileOf(raw).kind;
  } catch (e) {
    return fail(`open: ${e.message}`);
  }
  const plan = args.flag("--plan");
  if (plan !== void 0 && kind !== "plan") fail(`open: --plan means --kind plan; a ${kind} run takes --group <slug>`);
  const group = args.flag("--group") ?? plan ?? fail(`open: --group <slug> is required (or --plan <slug> for a plan run)
${USAGE}`);
  return { kind, group };
}
function joinedSeat() {
  const seat = args.flag("--seat");
  const slice = args.flag("--slice");
  if (seat !== void 0 && slice !== void 0 && seat !== slice) fail(`join: --seat ${seat} and --slice ${slice} name different members; pass one`);
  return seat ?? slice ?? fail(`--seat (or --slice) is required
${USAGE}`);
}
var SEAT_POSTS_DRAW = "posts render markdown and mermaid: compare in a table, draw a flow as a mermaid block";
var seatCommands = (as) => {
  const cli = self().join(" ");
  const who = `--as ${shellWord(as)}`;
  return [
    `${cli} post "\u2026" --about <D id> ${who}`,
    `${cli} agree "\u2026" --about <D id> ${who}`,
    `${cli} endorse <seq> ${who}`,
    `${cli} wait --mentions ${who}    # in the foreground, when waiting`
  ];
};
var subscriptionsArg = (spec) => {
  try {
    return parseSubscriptions(spec);
  } catch (e) {
    return fail(e.message);
  }
};
var NO_MAIN = "there is no Main any more: the conversation is one; mention who you mean (@IW, @IW\xB7SL3, @swarm)";
async function main(board) {
  if ((args.verb === "post" || args.verb === "agree" || args.verb === "endorse") && args.has("--main")) {
    console.error(NO_MAIN);
    process.exitCode = 2;
    return;
  }
  switch (args.verb) {
    case "config": {
      const setting = args.positional[0];
      if (setting !== "retention") fail(`config: the one setting is retention
${USAGE}`);
      const raw = args.positional[1];
      const value = raw === void 0 ? void 0 : Number(raw);
      const days = board.setting("retention-days", value);
      emit({ retention: days }, String(days));
      break;
    }
    case "open": {
      const { kind, group } = openKindAndGroup();
      const plan = group;
      const seatsFile = args.flag("--seats") ?? args.flag("--slices") ?? fail(`open: --seats <file.json> is required (or --slices)
${USAGE}`);
      const rawStall = args.flag("--stall-ms");
      const stallMs = rawStall === void 0 ? void 0 : Number(rawStall);
      if (stallMs !== void 0 && !(Number.isInteger(stallMs) && stallMs > 0)) fail(`--stall-ms takes a positive whole number of ms, got ${rawStall}`);
      const transcript = args.flag("--transcript");
      const run2 = board.openRun({
        repo: repoOf(process.cwd()),
        kind,
        group,
        title: need("--title"),
        link: args.flag("--link") ?? null,
        seats: readSlices(seatsFile),
        ...transcript ? { transcript: path4.resolve(transcript) } : {},
        ...stallMs !== void 0 ? { stallMs } : {}
      });
      startPoller(run2.id);
      const warning = transcript ? transcriptWarning("orchestrator", path4.resolve(transcript)) : null;
      const doc = registerBoardDocument({ toolRoot: toolRoot(), cwd: process.cwd(), repo: run2.repo });
      if (!doc.registered) {
        console.error(`swarm: ${doc.reason}: the run is open; its board is read in aiview once aiview is installed and knows this project`);
        emit({ run: run2.id, repo: run2.repo, kind: run2.kind, group: run2.group, plan: run2.plan, url: null, ...warning ? { warning } : {} }, [String(run2.id), warning].filter(Boolean).join("\n"));
        break;
      }
      emit({ run: run2.id, repo: run2.repo, kind: run2.kind, group: run2.group, plan: run2.plan, url: doc.url, ...warning ? { warning } : {} }, [String(run2.id), doc.url, warning].filter(Boolean).join("\n"));
      break;
    }
    case "slice": {
      if (args.positional[0] === "add") {
        const id2 = args.positional[1] ?? fail(`slice add: which id?
${USAGE}`);
        const run3 = runArg();
        const on = args.flag("--on");
        if (on !== void 0) subscriptionsArg(on);
        const role = args.flag("--role");
        const added = board.addSlice(run3, {
          id: id2,
          title: need("--title"),
          ...role ? { role } : {},
          blockers: args.list("--blockers"),
          link: args.flag("--link") ?? null,
          ...on !== void 0 ? { on: on.split(",").map((x) => x.trim()).filter(Boolean) } : {}
        });
        emit({ run: run3, slice: added }, `${id2} added`);
        break;
      }
      const id = args.positional[0] ?? fail(`slice: which slice?
${USAGE}`);
      const run2 = runArg();
      const transcript = args.flag("--transcript");
      const state = transcript === void 0 ? need("--state") : args.flag("--state");
      if (state !== void 0) board.setSliceState(run2, id, state);
      const liveness = transcript !== void 0 ? board.registerTranscript(run2, id, path4.resolve(transcript)) : void 0;
      const warning = transcript !== void 0 ? transcriptWarning(id, path4.resolve(transcript)) : null;
      const said = [
        state !== void 0 ? `${id} ${state}` : null,
        liveness && !warning ? `${id} transcript ${liveness.state === "ok" ? `read, ${liveness.tokens} tokens` : "not readable yet: the board warned on the thread"}` : null,
        warning
      ];
      emit({ run: run2, slice: id, ...state !== void 0 ? { state } : {}, ...liveness ? { liveness } : {}, ...warning ? { warning } : {} }, said.filter(Boolean).join("\n"));
      break;
    }
    case "close": {
      const run2 = runArg();
      board.closeRun(run2);
      stopPoller(run2);
      emit({ run: run2, state: "closed" }, `run ${run2} closed`);
      break;
    }
    case "phase": {
      const p = caller(board);
      const [name, ...said] = args.positional;
      if (!name) fail(`phase: which phase?
${USAGE}`);
      const text = said.join(" ") || fail(`phase ${name}: what does it ask?`);
      const m = board.phase(p, name, text);
      const cli = self().join(" ");
      const next = `phase ${name} is open; listen for each member's done in the background: ${cli} wait --mentions --as ${shellWord(p.name)}. When the board says every member is done, open the next phase: ${cli} phase <name> "<text>" --as ${shellWord(p.name)}; after the last, ${cli} close --run ${m.run}`;
      emit({ seq: m.seq, run: m.run, phase: name, next }, () => {
        console.log(seqLine(m));
        console.log(next);
      });
      break;
    }
    case "done": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const name = args.positional[0] ?? fail(`done: which phase?
${USAGE}`);
      const r = board.done(p, name);
      const next = `wait for the next phase, in the foreground: ${self().join(" ")} wait --mentions --as ${shellWord(p.name)}`;
      emit({ runner: p.name, phase: name, done: r.progress.done, of: r.progress.of, all: r.all, already: r.already, next }, () => {
        console.log(`${r.already ? "already done" : "done"} ${name}: ${r.progress.done}/${r.progress.of} members done${r.all ? "; the orchestrator is told every member is done" : ""}`);
        console.log(next);
      });
      break;
    }
    case "poll": {
      const run2 = runArg();
      const pidFile = pollerPidFile(run2);
      fs4.mkdirSync(path4.dirname(pidFile), { recursive: true });
      fs4.writeFileSync(pidFile, String(process.pid));
      const mine = () => {
        try {
          return fs4.readFileSync(pidFile, "utf8").trim() === String(process.pid);
        } catch {
          return false;
        }
      };
      for (; ; ) {
        if (!mine() || !fs4.existsSync(SQLITE_PATH)) break;
        let open = true;
        try {
          open = board.livenessTick(run2);
        } catch (e) {
          console.error(`swarm poll: ${e.message}`);
        }
        if (!open) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      if (mine()) fs4.rmSync(pidFile, { force: true });
      break;
    }
    case "join": {
      const { runner, roster } = board.join({
        run: runArg(),
        slice: joinedSeat(),
        doing: need("--doing"),
        files: [...args.list("--files"), ...args.flags("--file")].map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? void 0,
        ...args.flag("--on") !== void 0 ? { on: subscriptionsArg(args.flag("--on")) } : {}
      });
      const next = nextStep(board, runner);
      const shared = !profileOf(runner.kind).worktree;
      const as = shared ? `pass --as ${runner.name} on every call: this checkout is shared, the board cannot tell you apart` : null;
      const commands = shared ? seatCommands(runner.name) : null;
      const drawing = profileOf(runner.kind).member === "seat" ? SEAT_POSTS_DRAW : null;
      const phase = phaseHeader(board, runner.run);
      emit({ runner: runner.name, nick: runner.nick, roster, phase, ...shared ? { as: runner.name, commands } : {}, ...drawing ? { drawing } : {}, next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
        if (phase) console.log(phase);
        if (as) console.log(as);
        for (const c of commands ?? []) console.log(c);
        if (drawing) console.log(drawing);
        console.log(next);
      });
      break;
    }
    case "subscribe":
    case "unsubscribe": {
      const p = caller(board);
      const subs = subscriptionsArg(args.positional.join(",") || fail(`${args.verb}: which events?`));
      const after = args.verb === "subscribe" ? board.subscribe(p, subs) : board.unsubscribe(p, subs);
      emitHeard(board, p, { runner: p.name, subscriptions: after }, `${p.name} wakes on: ${formatSubscriptions(after) || "mentions and urgent posts only"}`);
      break;
    }
    case "doing": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emitHeard(board, p, { runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, {
        about: aboutArg(),
        kind: args.verb === "agree" ? "agreement" : "msg"
      });
      const unmatched = unmatchedLines(board, p, body);
      emitHeard(board, p, { seq: m.seq, mentions: m.mentions, run: m.run, ...unmatched.length ? { unmatched } : {}, ...m.claimed ? { claimed: m.claimed } : {} }, () => {
        console.log(seqLine(m));
        if (m.claimed) console.log(`claimed ${m.claimed.path}, shared with ${m.claimed.sharedWith.join(", ")}`);
        for (const line of unmatched) console.log(line);
      });
      break;
    }
    case "endorse": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const raw = (args.positional[0] ?? fail("endorse: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`endorse takes a seq, got ${raw}`);
      const m = board.endorse(p, seq);
      emitHeard(board, p, { seq: m.seq, endorses: m.endorses, run: m.run }, seqLine(m));
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      let by;
      try {
        by = caller(board);
      } catch (e) {
        if (!(e instanceof CliError)) throw e;
      }
      if (by && answeredClosed(board, by)) break;
      const m = board.read(seq, by);
      const phase = phaseHeader(board, by?.run ?? m.run);
      const owes = by ? owedLine(board, by) : null;
      emit({ ...m, phase, ...owes ? { next: owes } : {} }, () => {
        if (phase) console.log(phase);
        console.log(fullText(m));
        if (owes) console.log(owes);
      });
      break;
    }
    case "deliver": {
      const me = caller(board);
      if (answeredClosed(board, me)) break;
      const d = withNext(me, board.deliver(me));
      const phase = d.full.length || d.lines.length ? phaseHeader(board, me.run) : null;
      const owes = owedLine(board, me);
      emit({ phase, ...d, ...owes ? { next: owes } : {} }, () => {
        if (phase) console.log(phase);
        printDelivery(d);
        if (owes) console.log(owes);
      });
      break;
    }
    case "wait": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const raw = args.flag("--timeout");
      const timeout = raw === void 0 ? void 0 : Number(raw);
      if (timeout !== void 0 && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      const upkeepTicks = setInterval(() => boardUpkeep(board), WAIT_UPKEEP_TICK_MS);
      const d = withNext(p, await board.wait(p, { timeoutMs: timeout, mentionsOnly }).finally(() => clearInterval(upkeepTicks)));
      if (answeredClosed(board, p)) break;
      if (d.superseded) {
        emit(d, "superseded by a newer wait");
        break;
      }
      if (!d.full.length && !d.lines.length) {
        emit(d, "");
        break;
      }
      const again = [...self(), "wait"];
      if (mentionsOnly) again.push("--mentions");
      if (args.flag("--as")) again.push("--as", shellWord(args.flag("--as")));
      if (raw !== void 0) again.push("--timeout", raw);
      if (asJson) again.push("--json");
      const owes = owedLine(board, p);
      const rearm = listensInForeground(p) ? owes ? `${owes}
only then wait again, in the foreground: ${again.join(" ")}` : `answer on the thread if needed, then wait again, in the foreground: ${again.join(" ")}` : p.slice === "orchestrator" ? `act on it, then start this listener again, in the background: ${again.join(" ")}` : `answer on the thread if needed, then start this listener again, in the background while you work, in the foreground when you are waiting: ${again.join(" ")}`;
      const next = owes && !listensInForeground(p) ? `${owes}
${rearm}` : rearm;
      const phase = phaseHeader(board, p.run);
      emit({ phase, next, ...d }, () => {
        if (phase) console.log(phase);
        console.log(next);
        printDelivery(d);
      });
      break;
    }
    case "roster": {
      if (args.flag("--as") && answeredClosed(board, caller(board))) break;
      const repo = repoOf(path4.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      const runs = new Map(board.runs().filter((r) => r.repo === repo).map((r) => [r.id, r]));
      const progress = new Map([...runs.keys()].map((id) => [id, board.phaseProgress(id)]));
      emit({ repo, roster, runs: [...runs.values()].map((r) => ({ run: r.id, title: r.title, phase: r.phase, progress: progress.get(r.id) ?? null })) }, () => {
        let shown = null;
        for (const r of roster) {
          const run2 = runs.get(r.run);
          if (run2 && r.run !== shown) console.log(`run ${run2.id}  ${run2.title}${phaseSuffix(run2.phase, progress.get(run2.id) ?? null)}`);
          shown = r.run;
          console.log(rosterLine(r));
        }
      });
      break;
    }
    case "claim": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("claim: which path?");
      const abs = resolveClaimPath(file);
      const rel = repoRelative(abs);
      const verdict = board.checkEdit(p, abs, { interface: args.has("--interface") });
      if (!verdict.allowed) process.exitCode = 3;
      emitHeard(board, p, verdict, () => {
        if (!verdict.allowed) return console.log(verdict.refusal);
        const also = verdict.notice ? verdict.sharedWith.map((o) => `${o.runner} \xB7 ${board.participant(o.runner)?.nick ?? "?"}: ${o.doing}`).join("; ") : "";
        console.log(also ? `claimed ${rel}, also held by ${also}` : `claimed ${rel}`);
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      const abs = resolveClaimPath(file);
      board.release(p, abs);
      emit({ runner: p.name, released: repoRelative(abs) }, `${p.name} released ${repoRelative(abs)}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      const onto = need("--onto");
      const reconciled = p.worktree ? branchChangedIn(p.worktree, onto) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      const reflogMark = p.worktree ? headReflogLength(p.worktree) ?? void 0 : void 0;
      const r = board.lockMerge(p, onto, reflogMark);
      emit({ runner: p.name, ...r, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(r.granted ? "granted: merge, then swarm merged <sha> --files <path>..." : `held by ${r.holder}: swarm wait --mentions for its merged event`);
      });
      break;
    }
    case "merged": {
      const p = caller(board);
      const sha = args.positional[0] ?? fail("merged: which sha?");
      const files = args.list("--files");
      const lock = board.heldMergeLock(p);
      const conflicts = p.worktree && lock && lock.reflogMark !== null ? conflictsOf(p.worktree, lock.onto ?? "", lock.reflogMark) : void 0;
      const sharers = board.merged(p, sha, files.map((f) => path4.resolve(f)), conflicts);
      const tell = sharers.map(
        (o) => `if you resolved a conflict in ${o.path}, tell them: swarm post "@${o.runner} I resolved ${o.path}: <how>" --about ${o.path}`
      );
      emit({ runner: p.name, sha, files, tell }, () => {
        console.log(`merged ${sha}: lock released`);
        for (const line of tell) console.log(line);
      });
      break;
    }
    case "end": {
      const p = caller(board);
      if (p.ended || board.runs().every((r) => r.id !== p.run)) break;
      const reconciled = p.worktree ? changedIn(p.worktree) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      board.end(p);
      emit({ runner: p.name, ended: true, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(`${p.name} ended`);
      });
      break;
    }
    case "stats": {
      const raw = args.flag("--run");
      const run2 = raw === void 0 ? void 0 : Number(raw);
      if (run2 !== void 0 && !Number.isInteger(run2)) fail(`--run takes a run id, got ${raw}`);
      const all = args.has("--all");
      const since = args.flag("--since");
      if (all && args.has("--since")) fail("stats: --since or --all, not both");
      const kinds = args.list("--kind").map((k) => {
        try {
          return profileOf(k).kind;
        } catch (e) {
          return fail(`stats: ${e.message}`);
        }
      });
      const stats = board.stats({
        repo: repoOf(path4.resolve(args.flag("--repo") ?? process.cwd())),
        ...run2 !== void 0 ? { run: run2 } : {},
        // a named run is read whatever its age: no default period (plan D40)
        ...all ? {} : since !== void 0 ? { since } : run2 !== void 0 ? {} : { since: "30d" },
        ...kinds.length ? { kinds } : {},
        ...args.has("--closed") ? { closedOnly: true } : {}
      });
      emit(stats, () => {
        if (!stats.runs.length) console.log("no run in this scope");
        for (const r of stats.runs) console.log(statsLine(r));
        console.log("swarm stats --json for every figure");
      });
      break;
    }
    case "status": {
      const runs = board.runs();
      const membersOf = (r) => board.roster(r.repo).filter((m) => m.run === r.id).map((m) => ({ name: m.name, nick: m.nick, worktree: m.worktree }));
      const open = runs.map((r) => ({ run: r.id, kind: r.kind, group: r.plan, title: r.title, phase: r.phase, progress: board.phaseProgress(r.id), members: membersOf(r) }));
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, runs: runs.length, open }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.kind}  ${r.plan}  ${r.title}${phaseSuffix(r.phase, board.phaseProgress(r.id))}  ${r.repo}`);
          for (const s of r.slices) console.log(`  ${s.id} ${s.state}  ${s.title}${s.blockers.length ? `  blocked by ${s.blockers.join(", ")}` : ""}`);
        }
      });
      break;
    }
    default:
      fail(USAGE);
  }
}
if (!args.verb) {
  console.error(USAGE);
  process.exit(1);
}
if (args.verb === "stats" && args.has("--help")) {
  console.log(STATS_USAGE);
  process.exit(0);
}
if (args.verb === "--help") {
  console.log(args.positional[0] === "code" ? CODE_USAGE : USAGE);
  process.exit(0);
}
if (args.verb === "serve") {
  console.error(`swarm: unknown verb serve: swarm has no page; the board is read in aiview
${USAGE}`);
  process.exit(2);
} else {
  const board = await openBoard();
  try {
    boardUpkeep(board);
    await main(board);
  } catch (e) {
    console.error(e instanceof CliError ? e.message : `swarm: ${e.message}`);
    process.exitCode = 1;
  } finally {
    board.close();
  }
}
