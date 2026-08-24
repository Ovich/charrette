import * as React from "react";
import { cn } from "../../lib/utils.ts";

/** Tag chip base — the grey pill. Kind chips are the colored KindChip component. */
export function Badge({
  className,
  active = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-[11px]",
        active
          ? "border-accent/35 bg-accent-soft text-accent"
          : "border-border bg-surface-2 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
