import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { Button } from "../ui/button.tsx";
import type { BindingsSummary } from "../../lib/api.ts";
import { withOverlay } from "../../lib/overlay.ts";
import { mockupControls, withBridge } from "../../lib/bridge.ts";
import { pointMessage, withSpotlight } from "../../lib/spotlight.ts";
import { THEMES, type Theme, withTheme } from "../../lib/theme.ts";

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
  /** The components the agent is pointing at (`aiview show`), lit until it points elsewhere. */
  pointed?: readonly string[];
  /** The variant the pointed components live in, switched to first. */
  pointedVariant?: string;
  /** The person dismissed the pointer. */
  onClearPointer?: () => void;
}

const NONE: readonly string[] = [];

export function MockupFrame({ html, bindings, target, onOpenSource, pointed = NONE, pointedVariant, onClearPointer }: MockupFrameProps) {
  const [viewport, setViewport] = useState(() => stored("aiview.viewport", "full"));
  const [mode, setMode] = useState<MockupMode>(() =>
    stored("aiview.mockupMode", "rendered") === "composition" ? "composition" : "rendered",
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const s = stored("aiview.theme", "system");
    return THEMES.includes(s as Theme) ? (s as Theme) : "system";
  });
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  // Full screen: the browser's own on the stage, so the frame is not reloaded and the
  // mockup keeps its state; Escape leaves it. Where the API is missing or refused (an
  // embedded browser, a test), the stage covers the window instead and Escape leaves that.
  const [full, setFull] = useState<"native" | "cover" | null>(null);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === stage.current ? "native" : null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (full !== "cover") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  const toggleFull = () => {
    if (full === "native") return void document.exitFullscreen?.();
    if (full === "cover") return setFull(null);
    const el = stage.current;
    if (!el?.requestFullscreen) return setFull("cover");
    el.requestFullscreen().catch(() => setFull("cover"));
  };
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
  const selectTheme = (v: string) => {
    if (!v) return;
    setTheme(v as Theme);
    store("aiview.theme", v);
  };

  // The mockup's declared variants and actions, mirrored above the frame. The chosen
  // variant is the viewer's, so it survives a reload of the page (a save on disk, a
  // switch of mode) and can be switched in Composition, where the page takes no mouse.
  const controls = useMemo(() => mockupControls(html), [html]);
  const [variant, setVariant] = useState<string | null>(null);
  const chosen = variant && controls.variants.some((v) => v.name === variant) ? variant : controls.initial;
  const post = (msg: { type: string; name?: string; names?: string[] }) => frame.current?.contentWindow?.postMessage(msg, "*");
  const selectVariant = (v: string) => {
    if (!v) return;
    setVariant(v);
    post({ type: "aiview:variant", name: v });
  };
  const onLoad = () => {
    if (chosen && chosen !== controls.initial) post({ type: "aiview:variant", name: chosen });
    if (pointed.length) post(pointMessage(pointed));
  };

  // The agent pointed somewhere: its variant first, since the components may exist only
  // there, then the names. The spotlight waits for them to appear, so the order is safe.
  // Keyed on the joined names: the array is a new one on every render of the parent.
  const pointedKey = pointed.join(",");
  useEffect(() => {
    if (pointedVariant && controls.variants.some((v) => v.name === pointedVariant)) {
      setVariant(pointedVariant);
      post({ type: "aiview:variant", name: pointedVariant });
    }
    post(pointMessage(pointedKey ? pointedKey.split(",") : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointedKey, pointedVariant]);

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

  // The theme is forced last, so it also normalises whatever the overlay and the bridge
  // brought with them: one pass over the html that actually reaches the frame.
  const served = withTheme(withSpotlight(withBridge(mode === "composition" ? withOverlay(html, { bindings, target }) : html)), theme);
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
        <span className="ml-3">theme</span>
        <ToggleGroup type="single" value={theme} onValueChange={selectTheme} data-component="MockupThemeToggle">
          {THEMES.map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {t}
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
        {pointed.length > 0 && (
          <span
            className="ml-3 inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-2 py-0.5 font-medium text-white"
            data-component="PointerChip"
          >
            pointing at {pointed.join(", ")}
            {onClearPointer && (
              <button type="button" aria-label="Stop pointing" title="Stop pointing" className="ml-0.5 cursor-pointer opacity-80 hover:opacity-100" onClick={onClearPointer}>
                <X className="size-3" />
              </button>
            )}
          </span>
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
      <div
        ref={stage}
        data-component="MockupStage"
        data-full={full ?? undefined}
        className={
          full
            ? `flex justify-center bg-surface-2 ${full === "cover" ? "fixed inset-0 z-50" : "h-full w-full"}`
            : "flex justify-center"
        }
      >
        <div className="group relative w-full max-w-full" style={width ? { width } : undefined}>
          {/* sandboxed: the mockup's scripts run, but it cannot touch the viewer, storage, or navigate the top window */}
          <iframe
            ref={frame}
            title="mockup"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            srcDoc={served}
            onLoad={onLoad}
            className={
              full
                ? "block h-screen w-full max-w-full border-0 bg-white"
                : "block h-[calc(100vh-10rem)] w-full max-w-full rounded-[10px] border border-border bg-white shadow-lg transition-[width]"
            }
          />
          {/* Shown while the pointer is over the mockup or a control in it has focus; a pointer
              inside the frame still counts, because the frame is a child of this group. */}
          <div
            data-component="MockupHoverBar"
            className="pointer-events-none absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
          >
            <Button
              variant="outline"
              size="icon"
              aria-label={full ? "Exit full screen" : "Full screen"}
              title={full ? "Exit full screen (Esc)" : "Full screen"}
              onClick={toggleFull}
            >
              {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
