import type { ReactNode } from "react";
import type { QueueSlice } from "../../src/board/board.ts";
import { waitingOn, type FileRow } from "../lib/view.ts";
import { PlanCode, RunnerName } from "./chips.tsx";

/** A document's link opens in a new tab when there is one (D44); plain text otherwise. */
export function DocLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  return href ? (
    <a className="doc" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

function PlanQueue({ plan, title, link, slices }: { plan: string; title: string; link: string | null; slices: QueueSlice[] }) {
  const done = slices.filter((s) => s.state === "done").length;
  return (
    <div className="queue" data-component="PlanQueue">
      <div className="queue-h">
        <PlanCode plan={plan} />
        <span className="t">
          <DocLink href={link}>{title}</DocLink>
        </span>
        <span className="pill">
          {done} of {slices.length}
        </span>
      </div>
      {slices.map((s) => {
        const after = waitingOn(s, slices);
        return (
          <div key={s.slice} className={`q ${after.length ? "blocked" : s.state}`}>
            <span className="id">{s.slice}</span>
            <span className="name" title={s.title}>
              <DocLink href={s.link}>{s.title}</DocLink>
            </span>
            <span className="st">
              {after.length ? `after ${after.join(", ")}` : s.state === "running" ? <RunnerName name={s.runner ?? `${plan}/${s.slice}`} plan={false} /> : s.state}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PlanQueues({
  queues,
  planTitle,
  planLink,
}: {
  queues: [string, QueueSlice[]][];
  planTitle: (plan: string) => string;
  planLink: (plan: string) => string | null;
}) {
  return (
    <section data-component="PlanQueues">
      <p className="label">The plans</p>
      {queues.map(([plan, slices]) => (
        <PlanQueue key={plan} plan={plan} title={planTitle(plan)} link={planLink(plan)} slices={slices} />
      ))}
    </section>
  );
}

export function FileMap({ files, focus }: { files: FileRow[]; focus: string | null }) {
  return (
    <section data-component="FileMap">
      <p className="label">
        Files held <span className="n">{files.length}</span>
      </p>
      <div className="filemap">
        {files.length ? (
          files.map((f) => (
            <div key={f.path} className={["f", f.flag && "flag", focus && f.holders.includes(focus) && "lit"].filter(Boolean).join(" ")}>
              <span className={f.iface ? "path iface" : "path"} title={f.path}>
                {f.path}
              </span>
              <span className="holders">
                {f.holders.map((h) => (
                  <RunnerName key={h} name={h} />
                ))}
              </span>
            </div>
          ))
        ) : (
          <div className="f">
            <span className="note">No file held.</span>
          </div>
        )}
      </div>
      <p className="foot">Underlined: the runner changes that file's interface; everyone is told when it merges.</p>
    </section>
  );
}

export function EmptyState() {
  return (
    <div className="empty" data-component="EmptyState">
      <span className="tile" aria-hidden="true">
        sw
      </span>
      <h2>No run open on this machine</h2>
      <p>
        A run opens when an orchestrator in swarm mode dispatches its plan: <code>swarm open --plan &lt;slug&gt; --slices &lt;file&gt;</code>. Closed runs stay in
        the sidebar.
      </p>
    </div>
  );
}
