import * as React from "react";
import { cn } from "../../lib/utils.ts";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground shadow-(--shadow-sm) outline-none placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
