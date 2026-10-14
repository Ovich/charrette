// Every file held on the repository, across runs (the mockup's FileMap): who holds it, whether
// it changes an interface, whether it was written outside a claim.
import type { FileRow } from "../lib/view.ts";
import { RunnerTag } from "./chips.tsx";

export function FileMap({ files }: { files: FileRow[] }) {
  return (
    <section className="panel filemap" data-component="FileMap" aria-label="Files held">
      <p className="label">
        Files held <span className="n">{files.length}</span>
      </p>
      {files.length ? (
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
      )}
    </section>
  );
}
