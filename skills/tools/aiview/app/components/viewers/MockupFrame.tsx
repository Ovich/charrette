import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";

const VIEWPORTS: Array<[string, number]> = [
  ["mobile", 390],
  ["tablet", 820],
  ["laptop", 1280],
  ["full", 0],
];

const stored = (): string => {
  try {
    return localStorage.getItem("aiview.viewport") ?? "full";
  } catch {
    return "full";
  }
};

export function MockupFrame({ html }: { html: string }) {
  const [viewport, setViewport] = useState(stored);
  const width = VIEWPORTS.find(([n]) => n === viewport)?.[1] ?? 0;
  const select = (v: string) => {
    if (!v) return;
    setViewport(v);
    try {
      localStorage.setItem("aiview.viewport", v);
    } catch {}
  };
  return (
    <div data-component="MockupFrame">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>viewport</span>
        <ToggleGroup type="single" value={viewport} onValueChange={select}>
          {VIEWPORTS.map(([n]) => (
            <ToggleGroupItem key={n} value={n}>
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="font-mono">{width ? `${width}px` : ""}</span>
      </div>
      <div className="flex justify-center">
        {/* sandboxed: the mockup's scripts run, but it cannot touch the viewer, storage, or navigate the top window */}
        <iframe
          title="mockup"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          srcDoc={html}
          className="h-[calc(100vh-10rem)] w-full max-w-full rounded-[10px] border border-border bg-white shadow-lg transition-[width]"
          style={width ? { width } : undefined}
        />
      </div>
    </div>
  );
}
