// The build a tab was drawn by, against the one the server serves now. A tab left open across a
// rebuild or an update keeps its old code: it refetches the new data and draws it with the old
// page, so whatever the new page adds stays invisible until a manual reload (a phase separator,
// 2026-10-16). aiview's hello names the served entry bundle; a tab of another build reloads.

/** The entry bundle this page was loaded from (`index-<hash>.js`); null in development, unhashed. */
export function pageBuild(doc: Document = document): string | null {
  for (const s of Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    const m = /assets\/(index-[\w-]+\.js)/.exec(s.getAttribute("src") ?? "");
    if (m) return m[1];
  }
  return null;
}

/** True when the server serves another build than the one this page runs. */
export const isStaleBuild = (served: string | null | undefined, page: string | null = pageBuild()): boolean => !!served && !!page && served !== page;

/** Reloads the tab when the server's build is not this page's. */
export function reloadOnNewBuild(served: string | null | undefined, reload: () => void = () => location.reload()): void {
  if (isStaleBuild(served)) reload();
}
