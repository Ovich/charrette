import { useEffect, useMemo, useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { Button } from "../ui/button.tsx";
import type { BindingsSummary } from "../../lib/api.ts";
import { withOverlay } from "../../lib/overlay.ts";
import { mockupControls, withBridge } from "../../lib/bridge.ts";

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
  /** A pulled region in Composition mode was clicked: open `file` at `component`. */
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

  // The mockup's declared variants and actions, mirrored above the frame. The chosen
  // variant is the viewer's, so it survives a reload of the page (a save on disk, a
  // switch of mode) and can be switched in Composition, where the page takes no mouse.
  const controls = useMemo(() => mockupControls(html), [html]);
  const [variant, setVariant] = useState<string | null>(null);
  const chosen = variant && controls.variants.some((v) => v.name === variant) ? variant : controls.initial;
  const post = (msg: { type: string; name: string }) => frame.current?.contentWindow?.postMessage(msg, "*");
  const selectVariant = (v: string) => {
    if (!v) return;
    setVariant(v);
    post({ type: "aiview:variant", name: v });
  };
  const onLoad = () => {
    if (chosen && chosen !== controls.initial) post({ type: "aiview:variant", name: chosen });
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

  const served = withBridge(mode === "composition" ? withOverlay(html, { bindings, target }) : html);
  const bound = bindings?.sources.length ?? 0;

  return (
    <div data-component="MockupFrame">
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
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
        {controls.variants.length > 0 && (
          <>
            <span className="ml-3">variant</span>
            <ToggleGroup type="single" value={chosen ?? ""} onValueChange={selectVariant} data-component="VariantToggle">
              {controls.variants.map((v) => (
                <ToggleGroupItem key={v.name} value={v.name}>
                  {v.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        )}
        {controls.actions.length > 0 && (
          <span className="ml-3 inline-flex items-center gap-1" data-component="MockupActions">
            {controls.actions.map((a) => (
              <Button key={a.name} variant="outline" size="sm" className="h-auto px-2 py-0.5 text-[11px]" onClick={() => post({ type: "aiview:action", name: a.name })}>
                {a.label}
              </Button>
            ))}
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
          onLoad={onLoad}
          className="h-[calc(100vh-10rem)] w-full max-w-full rounded-[10px] border border-border bg-white shadow-lg transition-[width]"
          style={width ? { width } : undefined}
        />
      </div>
    </div>
  );
}
