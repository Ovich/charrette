// How the board's messages read in a terminal and in a runner's context: one place, so the
// CLI and the hook say it the same way.
import type { Delivery, Message } from "../board/board.ts";

export const fullText = (m: Message): string => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}\n${m.body}`;
};

/** Mentions in full, the rest one line each; empty when there is nothing. */
export const deliveryText = (d: Delivery): string => [...d.full.map(fullText), ...d.lines].join("\n");
