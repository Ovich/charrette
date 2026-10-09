// Mention parsing: what an `@…` in a body names, resolved against the sender's plan.
// A target is a runner name `<plan>/<slice>` or `<plan>/*` for every runner of a plan.

/** The two-letter code a plan is shown under (D30): the initials of its first two words,
 *  dates dropped; a single word gives its first two letters. `review-tool` → `RT`. */
export function planCode(plan: string): string {
  const words = plan.split(/[-_\s.]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length === 0) return plan.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const MENTION = /(?<![\w@])@([A-Za-z0-9][\w.\-]*(?:[\/·][A-Za-z0-9][\w.\-]*)?)/g;

/** How a runner's funny name is written in a mention (D43): "Sleepy Otter" → `sleepyotter`,
 *  compared without case. */
export const nameHandle = (nick: string): string => nick.replace(/\s+/g, "").toLowerCase();

/**
 * The targets a body mentions. `@S3` and `@orchestrator` are the sender's plan; `@all` is
 * every runner of the sender's plan; `@<plan>/S3` and `@<code>·S3` cross plans. A code is
 * resolved against `plans`, the plans open on the repository; an unknown code is dropped.
 * `@SleepyOtter` is the runner of that funny name, whatever its plan: `names` maps each
 * active runner's `nameHandle` to its `<plan>/<slice>`.
 */
export function parseMentions(body: string, senderPlan: string, plans: string[], names?: ReadonlyMap<string, string>): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    const named = names?.get(token.toLowerCase());
    if (named) {
      out.add(named);
    } else if (token.includes("/")) {
      const [plan, slice] = token.split("/");
      out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token.includes("·")) {
      const [code, slice] = token.split("·");
      for (const plan of plans) if (planCode(plan) === code.toUpperCase()) out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token === "all") {
      out.add(`${senderPlan}/*`);
    } else {
      out.add(`${senderPlan}/${token}`);
    }
  }
  return [...out];
}
