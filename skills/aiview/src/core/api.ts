// Shared API payload types — the contract between src/server and app/.
// The contract-guard test asserts the server actually returns these shapes.
import type { DocFormat } from "./paths.ts";
import type { Document, DocumentWithState, Pending } from "./db.ts";
import type { BindingIssue } from "./bind.ts";

/** What the server resolved for an html document with `data-bind` placeholders. */
export interface BindingsSummary {
  /** Source file names, as written in the placeholders (bare names in the host's folder). */
  sources: string[];
  errors: BindingIssue[];
  warnings: BindingIssue[];
}

export interface DocumentsResponse {
  documents: DocumentWithState[];
  /** slug -> display title. Empty until groups land (Phase 6). */
  groups: Record<string, string>;
  /** slug -> display title. `paths` stays server-side: the UI has no use for it. */
  projects: Record<string, string>;
  /** The active project slug, or `*` for All projects. */
  activeProject: string;
  start: number | null;
  /** The collection's version, from the plugin manifest the tool was installed with.
   *  null when the tool runs outside one. */
  version: string | null;
}

export interface ActiveProjectResponse {
  project: string;
}

export interface DocumentResponse {
  document: Document;
  format?: DocFormat;
  /** null = file missing on disk (markdown/html) or binary (pdf). */
  content: string | null;
  /** Work still running behind this document. Empty when nothing is pending. */
  pending: Pending[];
  /** Present for html documents: the bindings the served content was composed from. */
  bindings?: BindingsSummary;
}

export interface ChangedEventPayload {
  type: "changed";
  id: number;
}

/** Broadcast when the active project changes, from either the UI or the CLI. */
export interface ProjectEventPayload {
  type: "project";
  slug: string;
}

/** Broadcast when a document's pending work changed — one started or finished. Reuses
 *  the `changed` event so an open tab reloads through the path it already has. */
export interface PendingEventPayload {
  type: "changed";
  id: number;
}

/** Broadcast when the set of documents changed — one was registered, moved, re-tagged
 *  or dropped. `changed` only covers edits to a file the server already watches, so
 *  without this a newly registered document stays invisible until a manual refresh. */
export interface IndexEventPayload {
  type: "index";
}

/** The heartbeat. It carries nothing: what matters is that it arrives, so a tab whose
 *  stream died in silence can tell (app/hooks/useDocuments.ts) and reconnect. */
export interface PingEventPayload {
  type: "ping";
}

/** Broadcast when the agent points at a mockup's components (`aiview show`): every open
 *  tab moves to the document and highlights them. The fields are a `Pointer`'s. */
export interface ShowEventPayload {
  type: "show";
  id: number;
  components: string[];
  variant?: string;
}

/** Broadcast when the pointing is over (`aiview show --done`): the question is answered,
 *  and every tab the pointer moved goes back to what the person was reading. */
export interface ShowDoneEventPayload {
  type: "show-done";
}

/** What `POST /api/show` answers: how many tabs heard it, so the agent knows whether
 *  the person is looking or has to be handed the link. */
export interface ShowResponse {
  tabs: number;
}
