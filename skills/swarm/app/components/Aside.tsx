import type { QueueSlice } from "../../src/board/board.ts";
import type { FileRow } from "../lib/view.ts";
import { PlanCode, RunnerTag } from "./chips.tsx";

function PlanQueue({ plan, title, slices }: { plan: string; title: string; slices: QueueSlice[] }) {
  const done = slices.filter((s) => s.state === "done").length;
  return (
    <div className="queue" data-component="PlanQueue">
      <div className="queue-h">
        <PlanCode plan={plan} />
        {title}
        <span className="pill">
          {done} of {slices.length}
        </span>
      </div>
      {slices.map((s) => (
        <div key={s.slice} className={`q ${s.state}`}>
          <span className="id">{s.slice}</span>
          <span className="name" title={s.title}>
            {s.title}
          </span>
          <span className="st">
            {s.state === "running" ? <RunnerTag name={s.runner ?? `${plan}/${s.slice}`} plan={false} /> : s.state === "blocked" ? `after ${s.blockers.join(", ")}` : s.state}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PlanQueues({ queues, planTitle }: { queues: [string, QueueSlice[]][]; planTitle: (plan: string) => string }) {
  return (
    <section data-component="PlanQueues">
      <p className="label">The plans</p>
      {queues.map(([plan, slices]) => (
        <PlanQueue key={plan} plan={plan} title={planTitle(plan)} slices={slices} />
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
            <div key={`${f.runner}:${f.path}`} className={["f", f.flag && "flag", focus === f.runner && "lit"].filter(Boolean).join(" ")}>
              <span className={f.iface ? "path iface" : "path"} title={f.path}>
                {f.path}
              </span>
              <RunnerTag name={f.runner} />
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
