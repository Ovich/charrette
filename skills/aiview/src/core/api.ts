// Shared API payload types — the contract between src/server and app/.
// The contract-guard test asserts the server actually returns these shapes.
import type { DocFormat } from "./paths.ts";
import type { Document, DocumentWithState, Pending } from "./db.ts";

export interface DocumentsResponse {
  documents: DocumentWithState[];
  /** slug -> display title. Empty until groups land (Phase 6). */
  groups: Record<string, string>;
  /** slug -> display title. `paths` stays server-side: the UI has no use for it. */
  projects: Record<string, string>;
  /** The active project slug, or `*` for All projects. */
  activeProject: string;
  start: number | null;
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
