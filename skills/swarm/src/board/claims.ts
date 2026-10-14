// Claims and the merge lock (D35): internal to the board, imported by board.ts only. The
// second module that sees SQL. The Board's verbs of the same names delegate here after the
// kind gate; behaviour and wording are the board's, moved, not rewritten.
import type { DatabaseSync } from "node:sqlite";
import type { Declared, EditAllowed, EditHeld, Flag, Message, MessageKind, Participant, Sharer } from "./board.ts";

export interface ClaimsDeps {
  db: DatabaseSync;
  transaction<T>(fn: () => T): T;
  bump(repo: string): void;
  now(): string;
  lastSeq(): number;
  participantById(id: number): Participant;
  isLive(id: number): boolean;
  insertMessage(p: Participant, body: string, about: string | null, kind: MessageKind, named?: string[]): Message;
  relPath(repo: string, file: string): string | null;
  fold(s: string): string;
  slashes(rel: string): string;
  doingOf(id: number): string;
}

export interface Claims {
  checkEdit(p: Participant, file: string, opts?: { interface?: boolean }): EditAllowed | EditHeld;
  reconcileWrites(p: Participant, changed: string[]): Flag[];
  release(p: Participant, file: string): void;
  lockMerge(p: Participant): { granted: true } | { granted: false; holder: string };
  merged(p: Participant, sha: string, files: string[]): Sharer[];
  /** join's declared files, claimed where free */
  claimDeclared(p: Participant, files: Declared[]): void;
  /** end, closeRun, slice done */
  releaseAll(participant: number): void;
  clearFlags(): void;
  /** At `p`'s end: when `p` holds the merge lock, the runners refused it, cleared (D65); else none. */
  lockWaitersFreedBy(p: Participant): string[];
  /** The path `m` asks `me` about, when `me` held it before `m` and its author did not (D62). */
  askedAbout(me: Participant, author: number, m: Message): string | null;
  /** `rel` is held, or was held during the run, by a member of a run other than `p`'s. */
  heldInOtherRun(p: Participant, rel: string): boolean;
}

type Row = Record<string, unknown>;
type ClaimRow = { participant: number; kind: string; since: number };

export function claimsOf(deps: ClaimsDeps): Claims {
  const { db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf } = deps;

  /** A flag lives while a claim on its path does; a notice while both its holders' claims do. */
  const clearFlags = (): void => {
    db.prepare("DELETE FROM flags WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = flags.repo AND c.path = flags.path)").run();
    db.prepare(
      `DELETE FROM notices WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.participant)
         OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.other)`,
    ).run();
  };

  /** Every live holder of `rel`, in claim order. */
  const holdersOf = (repo: string, rel: string): ClaimRow[] =>
    (db.prepare("SELECT participant, kind, since_seq FROM claims WHERE repo = ? AND path = ? ORDER BY rowid").all(repo, rel) as Row[])
      .map((r) => ({ participant: Number(r.participant), kind: String(r.kind), since: Number(r.since_seq) }))
      .filter((c) => isLive(c.participant));
  /** `p` holds `rel` (alongside whoever else does); `interface` widens an inside claim, never the reverse.
   *  True when the claim was made or widened here. */
  const hold = (p: Participant, rel: string, kind: "interface" | "inside"): boolean =>
    transaction(() => {
      const r = db
        .prepare(
          `INSERT INTO claims (repo, path, participant, kind, since_seq) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (repo, path, participant) DO UPDATE SET kind = excluded.kind WHERE claims.kind = 'inside' AND excluded.kind = 'interface'`,
        )
        .run(p.repo, rel, p.id, kind, lastSeq());
      db.prepare("INSERT OR IGNORE INTO claim_log (repo, path, participant) VALUES (?, ?, ?)").run(p.repo, rel, p.id);
      if (Number(r.changes) === 0) return false;
      bump(p.repo);
      return true;
    });
  /** Claims `rel` for `p` unless another live runner holds it: `held` is the other holders,
   *  `taken` says whether the claim was made or widened here. */
  const take = (p: Participant, rel: string, kind: "interface" | "inside"): { held: ClaimRow[]; taken: boolean } =>
    transaction(() => {
      const held = holdersOf(p.repo, rel).filter((c) => c.participant !== p.id);
      if (held.length) return { held, taken: false };
      return { held, taken: hold(p, rel, kind) };
    });
  /** Whether `p` has posted about `rel` mentioning one of `holders` since that holder claimed it (D41):
   *  the message's `about` is the path (or its tail), or its body names the path or its file name. */
  const hasPostedAbout = (p: Participant, rel: string, holders: ClaimRow[]): boolean => {
    const since = Math.min(...holders.map((h) => h.since));
    const rows = db.prepare("SELECT seq, body, about, mentions FROM messages WHERE repo = ? AND author = ? AND seq > ? AND kind != 'event' AND by_board = 0").all(p.repo, p.id, since) as Row[];
    const base = rel.split("/").pop()!;
    const names = (r: Row): boolean => {
      const about = r.about == null ? "" : fold(slashes(String(r.about)));
      const f = fold(rel);
      if (about && (about === f || f.endsWith(`/${about}`))) return true;
      const body = fold(String(r.body));
      return body.includes(f) || body.includes(fold(base));
    };
    return rows.some((r) => {
      if (!names(r)) return false;
      const mentions = JSON.parse(String(r.mentions)) as string[];
      return holders.some((h) => {
        const o = participantById(h.participant);
        return Number(r.seq) > h.since && (mentions.includes(o.name) || mentions.includes(`${o.plan}/*`));
      });
    });
  };
  const releaseAll = (id: number): void => {
    const owner = db.prepare("SELECT r.repo FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ?").get(id) as Row | undefined;
    const claims = Number(db.prepare("DELETE FROM claims WHERE participant = ?").run(id).changes);
    const locks = Number(db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id).changes);
    clearFlags();
    if (owner && claims + locks > 0) bump(String(owner.repo));
  };
  /** The live runners refused the lock since its holder took it, as mentions name them; the record is cleared (D65). */
  const takeLockWaiters = (repo: string): string[] => {
    const rows = db.prepare("SELECT participant FROM lock_waiters WHERE repo = ? ORDER BY rowid").all(repo) as Row[];
    db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(repo);
    return rows.map((r) => Number(r.participant)).filter(isLive).map((id) => participantById(id).name);
  };
  const declared = (id: number): Declared[] => JSON.parse(String((db.prepare("SELECT files FROM participants WHERE id = ?").get(id) as Row).files)) as Declared[];

  return {
    clearFlags,
    releaseAll,

    lockWaitersFreedBy(p) {
      const held = db.prepare("SELECT 1 FROM merge_locks WHERE repo = ? AND participant = ?").get(p.repo, p.id) !== undefined;
      return held ? takeLockWaiters(p.repo).filter((n) => n !== p.name) : [];
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
      const about = fold(relPath(me.repo, m.about!) ?? slashes(m.about!));
      const mine = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ? AND since_seq < ?").all(me.repo, me.id, m.seq) as Row[];
      const rel = mine.map((r) => String(r.path)).find((x) => fold(x) === about || fold(x).endsWith(`/${about}`));
      if (!rel) return null;
      const theirs = db.prepare("SELECT 1 FROM claims WHERE repo = ? AND path = ? AND participant = ? AND since_seq < ?").get(me.repo, rel, author, m.seq);
      return theirs ? null : rel;
    },

    heldInOtherRun(p, rel) {
      const f = fold(rel);
      const rows = db
        .prepare("SELECT l.path FROM claim_log l JOIN participants q ON q.id = l.participant WHERE l.repo = ? AND q.run != ?")
        .all(p.repo, p.run) as Row[];
      return rows.some((r) => {
        const x = fold(String(r.path));
        return x === f || x.endsWith(`/${f}`);
      });
    },

    checkEdit(me, file, opts = {}) {
      const kind = opts.interface ? "interface" : "inside";
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true, sharedWith: [], notice: null }; // outside the repository: no claim
      return transaction((): EditAllowed | EditHeld => {
        const all = holdersOf(me.repo, rel);
        const others = all.filter((c) => c.participant !== me.id);
        if (!others.length) {
          hold(me, rel, kind); // a free file: claimed, silently
          return { allowed: true, sharedWith: [], notice: null };
        }
        const people = others.map((c) => participantById(c.participant));
        if (!all.some((c) => c.participant === me.id)) {
          // the first edit of a file another runner holds: held until the runner has said what it changes (D41)
          if (!hasPostedAbout(me, rel, others)) {
            const who = people.map((o) => `${o.name} (${o.nick}: ${doingOf(o.id)})`).join(", ");
            const at = people.map((o) => `@${o.name}`).join(" ");
            return {
              allowed: false,
              refusal:
                `${rel} is also held by ${who}. You may share it, but first tell ${people.length > 1 ? "them" : "its holder"} what you change in it: ` +
                `\`swarm post "${at} …" --about ${rel}\`; ${people.length > 1 ? "they answer" : "its holder answers"} with an agreement on who changes what ` +
                `(\`swarm agree … --about ${rel}\`), and that agreement goes. Then claim again.`,
            };
          }
        }
        hold(me, rel, kind); // a new holder, or an `inside` claim widened to an interface
        const sharedWith = people.map((o) => ({ runner: o.name, doing: doingOf(o.id) }));
        // told once per runner and path
        const told = db.prepare("INSERT OR IGNORE INTO notices (repo, path, participant, other) VALUES (?, ?, ?, ?)");
        const fresh = people.filter((o) => Number(told.run(me.repo, rel, me.id, o.id).changes) > 0);
        const notice = fresh.length ? fresh.map((o) => `${rel} is also held by ${o.name}: ${doingOf(o.id)}`).join("; ") : null;
        return { allowed: true, sharedWith, notice };
      });
    },

    reconcileWrites(me, changed) {
      const flags: Flag[] = [];
      // one transaction: the page sees one change however many files
      return transaction(() => {
        const flag = db.prepare("INSERT OR IGNORE INTO flags (repo, path, participant) VALUES (?, ?, ?)");
        for (const file of changed) {
          const rel = relPath(me.repo, file);
          if (!rel) continue;
          // a file the writer shares with others is its own: nothing to flag (D40)
          if (holdersOf(me.repo, rel).some((c) => c.participant === me.id)) {
            take(me, rel, "inside");
            continue;
          }
          const { held: others, taken } = take(me, rel, "inside");
          // written outside the writer's claim: free and claimed now, or held by another (D39)
          if (taken || others.length) flag.run(me.repo, rel, me.id);
          if (!others.length) continue;
          const holder = participantById(others[0].participant);
          const m = insertMessage(
            me,
            `@${holder.name} @${me.name} flag: ${me.name} wrote ${rel} outside its claim; ${holder.name} holds it. Settle it here.`,
            rel,
            "msg",
            [holder.name, me.name],
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

    lockMerge(me) {
      return transaction(() => {
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          db.prepare("INSERT OR IGNORE INTO lock_waiters (repo, participant) VALUES (?, ?)").run(me.repo, me.id);
          return { granted: false as const, holder: participantById(Number(r.participant)).name };
        }
        if (r && Number(r.participant) === me.id) return { granted: true as const };
        // a new holder: the waiters on the one before are not this one's (D65)
        db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(me.repo);
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at) VALUES (?, ?, ?)").run(me.repo, me.id, now());
        bump(me.repo);
        return { granted: true as const };
      });
    },

    merged(me, sha, files) {
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x): x is string => x !== null))];
      const wanted = new Set(rels);
      const told = new Set<string>();
      const iface = new Set<string>();
      const sharers: Sharer[] = [];
      let waiters: string[] = [];
      // one transaction: the page sees the merge as one change
      transaction(() => {
        transaction(() => {
          const lock = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
          if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
            throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
          }
          db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
          db.prepare("UPDATE participants SET merged = 1 WHERE id = ?").run(me.id);
          waiters = takeLockWaiters(me.repo).filter((n) => n !== me.name);
        });
        // every holder of a merged path, a shared one included (D40)
        for (const rel of rels) {
          for (const c of holdersOf(me.repo, rel)) {
            if (c.kind === "interface") iface.add(rel);
            if (c.participant !== me.id) told.add(participantById(c.participant).name);
          }
        }
        // declarers, the merger's own declarations counting toward *interface*
        const everyone = db
          .prepare("SELECT p.id, p.slice, r.plan FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL")
          .all(me.repo) as Row[];
        for (const o of everyone) {
          for (const f of declared(Number(o.id))) {
            const rel = relPath(me.repo, f.path);
            if (!rel || !wanted.has(rel)) continue;
            if (f.interface) iface.add(rel);
            if (Number(o.id) !== me.id) told.add(`${o.plan}/${o.slice}`);
          }
        }
        // an interface change is announced to every runner on the repository (D26)
        const openPlans = (db.prepare("SELECT DISTINCT plan FROM runs WHERE repo = ? AND state = 'open'").all(me.repo) as Row[]).map((r) => String(r.plan));
        const all = iface.size ? openPlans.map((plan) => `${plan}/*`) : [];
        const lines = [`merged ${sha}: rebase onto ${sha}.`];
        if (told.size) lines.push(`${[...told].map((n) => `@${n}`).join(" ")}: you hold or declared a file it changed.`);
        if (iface.size) lines.push(`@all interface changed: ${[...iface].join(", ")}.`);
        if (waiters.length) lines.push(`the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`);
        lines.push(`files: ${rels.join(", ") || "-"}`);
        insertMessage(me, lines.join("\n"), null, "event", [...new Set([...told, ...waiters, ...all])]);
        // whom to tell of a resolved conflict (D63): a holder from any run, or one of this run that held it
        for (const rel of rels) {
          const ids = new Set(holdersOf(me.repo, rel).map((c) => c.participant));
          const held = db
            .prepare("SELECT l.participant FROM claim_log l JOIN participants p ON p.id = l.participant WHERE l.repo = ? AND l.path = ? AND p.run = ? ORDER BY l.rowid")
            .all(me.repo, rel, me.run) as Row[];
          for (const r of held) ids.add(Number(r.participant));
          ids.delete(me.id);
          for (const id of ids) sharers.push({ path: rel, runner: participantById(id).name });
        }
      });
      return sharers;
    },
  };
}
