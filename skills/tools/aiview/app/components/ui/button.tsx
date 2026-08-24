import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.ts";

const buttonVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md text-xs font-medium border shadow-(--shadow-sm) cursor-pointer transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "bg-background text-foreground border-border hover:bg-surface-2",
        primary: "bg-foreground text-background border-foreground hover:opacity-90",
        ghost: "border-transparent shadow-none hover:bg-surface-2",
      },
      size: {
        sm: "px-2.5 py-1",
        md: "px-3 py-1.5",
        icon: "p-1.5",
      },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
