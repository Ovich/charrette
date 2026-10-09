import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { THEMES, type Theme } from "../../lib/theme.ts";

// A swarm document is one run, framed live from swarm's own server: aiview reads only the
// URL its file names, never swarm's store. Full height, no viewport and no Composition: an
// app, used at full size, as a workbench is.

/** The run's page URL a swarm document's file names, or null when the file holds none. */
export function swarmUrlOf(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { url?: unknown } | null;
    return typeof parsed?.url === "string" && parsed.url ? parsed.url : null;
  } catch {
    return null;
  }
}

/** The page URL with the viewer's theme asked of it; "system" leaves the URL as written. */
export function themedSwarmUrl(url: string, theme: Theme): string {
  if (theme === "system") return url;
  try {
    const u = new URL(url);
    u.searchParams.set("theme", theme);
    return u.toString();
  } catch {
    return url;
  }
}

const storedTheme = (): Theme => {
  try {
    const s = localStorage.getItem("aiview.theme") ?? "system";
    return THEMES.includes(s as Theme) ? (s as Theme) : "system";
  } catch {
    return "system";
  }
};

export interface SwarmFrameProps {
  url: string;
}

type Reach = "loading" | "framed" | "unreachable";

export function SwarmFrame({ url }: SwarmFrameProps) {
  const [reach, setReach] = useState<Reach>("loading");
  const [theme, setTheme] = useState<Theme>(storedTheme);

  // Swarm's server is another origin: an opaque probe says only whether it answers, which
  // is all the frame needs to know before it is shown.
  useEffect(() => {
    let live = true;
    setReach("loading");
    fetch(url, { mode: "no-cors", cache: "no-store" }).then(
      () => live && setReach("framed"),
      () => live && setReach("unreachable"),
    );
    return () => {
      live = false;
    };
  }, [url]);

  const selectTheme = (v: string) => {
    if (!v) return;
    setTheme(v as Theme);
    try {
      localStorage.setItem("aiview.theme", v);
    } catch {}
  };

  return (
    <div data-component="SwarmFrame" data-state={reach}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>theme</span>
        <ToggleGroup type="single" value={theme} onValueChange={selectTheme} data-component="SwarmThemeToggle">
          {THEMES.map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {reach === "loading" && <p className="text-muted-foreground">Reaching the run's page…</p>}
      {reach === "unreachable" && (
        <p className="text-muted-foreground" data-component="SwarmUnreachable">
          The board's server is not running: <code className="font-mono text-[12px]">swarm serve --detach</code>
        </p>
      )}
      {reach === "framed" && (
        <iframe
          title="swarm run"
          src={themedSwarmUrl(url, theme)}
          className="block h-[calc(100vh-10rem)] w-full max-w-full rounded-[10px] border border-border bg-background"
        />
      )}
    </div>
  );
}
