import { cn } from "../../lib/utils.ts";
import type { ConnectionState } from "../../hooks/useDocuments.ts";

export function LiveIndicator({ state }: { state: ConnectionState }) {
  const live = state === "live";
  return (
    <span
      data-component="LiveIndicator"
      className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title={live ? "live reload connected" : "reconnecting…"}
    >
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          live ? "bg-ok shadow-[0_0_0_3px] shadow-ok/20" : "bg-faint-foreground",
        )}
      />
      {live ? "live" : "reconnecting…"}
    </span>
  );
}
