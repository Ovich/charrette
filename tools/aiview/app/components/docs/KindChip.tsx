import { cn, kindHue } from "../../lib/utils.ts";

/** Colored kind chip — hue is a deterministic hash of the kind, as in the legacy UI.
 *  NOT a Badge: its colors are data-driven. */
export function KindChip({
  kind,
  dim = false,
  onClick,
}: {
  kind: string;
  /** Rendered de-emphasised (filtered out). */
  dim?: boolean;
  onClick?: () => void;
}) {
  const h = kindHue(kind);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      data-component="KindChip"
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[5px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
        onClick && "cursor-pointer",
        dim && "opacity-40",
      )}
      style={{
        background: `light-dark(hsl(${h} 65% 95%), hsl(${h} 40% 16%))`,
        color: `light-dark(hsl(${h} 55% 35%), hsl(${h} 70% 75%))`,
        borderColor: `light-dark(hsl(${h} 45% 86%), hsl(${h} 35% 26%))`,
      }}
    >
      {kind}
    </Tag>
  );
}
