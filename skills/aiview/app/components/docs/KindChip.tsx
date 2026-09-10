import { cn, kindColor } from "../../lib/utils.ts";

/** Colored kind chip — hue and chroma come from the hand-placed palette in `utils.ts`,
 *  so two kinds a reader sees side by side never look alike.
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
  const { h, s: sat } = kindColor(kind);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      data-component="KindChip"
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[5px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
        // Without a handler the chip is decoration sitting on top of a clickable row,
        // so it must not be an event target at all: the click belongs to the row.
        onClick ? "cursor-pointer" : "pointer-events-none",
        dim && "opacity-40",
      )}
      style={{
        background: `light-dark(hsl(${h} ${sat}% 94%), hsl(${h} ${Math.round(sat * 0.6)}% 17%))`,
        color: `light-dark(hsl(${h} ${Math.round(sat * 1.1)}% 31%), hsl(${h} ${Math.round(sat * 1.15)}% 78%))`,
        borderColor: `light-dark(hsl(${h} ${Math.round(sat * 0.8)}% 82%), hsl(${h} ${Math.round(sat * 0.55)}% 28%))`,
      }}
    >
      {kind}
    </Tag>
  );
}
