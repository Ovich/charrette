import type { CSSProperties, ReactNode } from "react";
import { planCode } from "../../src/board/mentions.ts";
import { runnerColor, runnerLabel } from "../lib/view.ts";

/** A runner's chip, "RT·S3": the KindChip recipe at its light tone, a hue per runner. */
export function RunnerTag({ name, plan = true }: { name: string; plan?: boolean }) {
  const { code, slice } = runnerLabel(name);
  const { h, s } = runnerColor(name);
  return (
    <span className="who" style={{ "--h": h, "--s": s } as CSSProperties} data-component="RunnerTag">
      {plan && <span className="pc">{code}·</span>}
      {slice}
    </span>
  );
}

/** A plan's two letters (D30). */
export function PlanCode({ plan }: { plan: string }) {
  return (
    <span className="code" data-component="PlanCode">
      {planCode(plan)}
    </span>
  );
}

const MENTION = /(?<![\w@])@[A-Za-z0-9][\w.\-]*(?:[\/·][A-Za-z0-9][\w.\-]*)?/g;

/** A body as written: `code` spans, @mentions in the accent; nothing else is interpreted. */
export function RichText({ text, mentions = true }: { text: string; mentions?: boolean }) {
  const out: ReactNode[] = [];
  text.split(/(`[^`\n]+`)/).forEach((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      out.push(<code key={i}>{part.slice(1, -1)}</code>);
      return;
    }
    if (!mentions) {
      out.push(part);
      return;
    }
    let last = 0;
    for (const m of part.matchAll(MENTION)) {
      const at = m.index ?? 0;
      if (at > last) out.push(part.slice(last, at));
      out.push(
        <span key={`${i}-${at}`} className="mention">
          {m[0].replace(/[.\-]+$/, "")}
        </span>,
      );
      const trail = m[0].match(/[.\-]+$/)?.[0];
      if (trail) out.push(trail);
      last = at + m[0].length;
    }
    if (last < part.length) out.push(part.slice(last));
  });
  return <>{out}</>;
}
