import { useEffect, useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import type { BindingsSummary } from "../../lib/api.ts";
import { withOverlay } from "../../lib/overlay.ts";

const VIEWPORTS: Array<[string, number]> = [
  ["mobile", 390],
  ["tablet", 820],
  ["laptop", 1280],
  ["full", 0],
];

export type MockupMode = "rendered" | "composition";
const MODES: MockupMode[] = ["rendered", "composition"];

const stored = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export interface MockupFrameProps {
  html: string;
  /** What the server composed the html from; drawn by Composition mode. */
  bindings?: BindingsSummary;
  /** A component to scroll to and flash once loaded, when this document was opened from a label. */
  target?: string;
  /** A label in Composition mode was clicked: open `file` at `component`. */
  onOpenSource?: (file: string, component: string) => void;
}

export function MockupFrame({ html, bindings, target, onOpenSource }: MockupFrameProps) {
  const [viewport, setViewport] = useState(() => stored("aiview.viewport", "full"));
  const [mode, setMode] = useState<MockupMode>(() =>
    stored("aiview.mockupMode", "rendered") === "composition" ? "composition" : "rendered",
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const width = VIEWPORTS.find(([n]) => n === viewport)?.[1] ?? 0;
  const selectViewport = (v: string) => {
    if (!v) return;
    setViewport(v);
    store("aiview.viewport", v);
  };
  const selectMode = (v: string) => {
    if (!v) return;
    setMode(v as MockupMode);
    store("aiview.mockupMode", v);
  };

  // The sandboxed frame has an opaque origin, so postMessage is the only way up. Only
  // messages from this frame's own window are honoured.
  useEffect(() => {
    if (!onOpenSource) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: unknown; file?: unknown; component?: unknown } | null;
      if (d?.type === "aiview:open" && typeof d.file === "string" && typeof d.component === "string")
        onOpenSource(d.file, d.component);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onOpenSource]);

  const served = mode === "composition" ? withOverlay(html, { bindings, target }) : html;
  const bound = bindings?.sources.length ?? 0;

  return (
    <div data-component="MockupFrame">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>viewport</span>
        <ToggleGroup type="single" value={viewport} onValueChange={selectViewport}>
          {VIEWPORTS.map(([n]) => (
            <ToggleGroupItem key={n} value={n}>
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="font-mono">{width ? `${width}px` : ""}</span>
        <span className="ml-3">view</span>
        <ToggleGroup type="single" value={mode} onValueChange={selectMode} data-component="MockupModeToggle">
          {MODES.map((m) => (
            <ToggleGroupItem key={m} value={m}>
              {m}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {bound > 0 && (
          <span className="font-mono" data-component="BoundCount">
            {bound} source{bound > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex justify-center">
        {/* sandboxed: the mockup's scripts run, but it cannot touch the viewer, storage, or navigate the top window */}
        <iframe
          ref={frame}
          title="mockup"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          srcDoc={served}
          className="h-[calc(100vh-10rem)] w-full max-w-full rounded-[10px] border border-border bg-white shadow-lg transition-[width]"
          style={width ? { width } : undefined}
        />
      </div>
    </div>
  );
}
