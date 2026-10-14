// Every file held on the repository, across runs (the mockup's FileMap): who holds it, whether
// it changes an interface, whether it was written outside a claim. Collapsed by default, so the
// thread has the room (D5); a viewer's expanding it is remembered in their browser.
import { useState } from "react";
import type { FileRow } from "../lib/view.ts";
import { RunnerTag } from "./chips.tsx";

export const FILEMAP_EXPANDED_KEY = "swarm.filemap.expanded";

function readExpanded(): boolean {
  try {
    return window.localStorage.getItem(FILEMAP_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberExpanded(expanded: boolean): void {
  try {
    window.localStorage.setItem(FILEMAP_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts this page only
  }
}

export function FileMap({ files }: { files: FileRow[] }) {
  const [expanded, setExpanded] = useState(readExpanded);
  const shared = files.filter((f) => f.holders.length >= 2).length;
  const toggle = (): void => {
    rememberExpanded(!expanded);
    setExpanded(!expanded);
  };
  return (
    <section className="panel filemap" data-component="FileMap" aria-label="Files held">
      <button className="label rail-toggle" aria-expanded={expanded} onClick={toggle}>
        Files held · <span className="n">{files.length}</span>
        {shared > 0 && <> · {shared} shared</>}
      </button>
      {expanded &&
        (files.length ? (
          <ul className="fm-rows">
            {files.map((f) => (
              <li key={f.path} className="fm-row">
                <span className={f.iface ? "file iface" : "file"} title={f.iface ? "changes its interface" : "inside only"}>
                  {f.path}
                </span>
                {f.iface && <span className="tag">interface</span>}
                {f.flag && (
                  <span className="tag strong" title="written outside a claim">
                    flag
                  </span>
                )}
                <span className="fm-holders">
                  {f.holders.map((h) => (
                    <RunnerTag key={h} name={h} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="none">No file held.</p>
        ))}
    </section>
  );
}
