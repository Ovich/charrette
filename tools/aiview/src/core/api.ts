// Shared API payload types — the contract between src/server and app/.
// The contract-guard test asserts the server actually returns these shapes.
import type { DocFormat } from "./paths.ts";
import type { Document, DocumentWithState } from "./db.ts";

export interface DocumentsResponse {
  documents: DocumentWithState[];
  /** slug -> display title. Empty until groups land (Phase 6). */
  groups: Record<string, string>;
  start: number | null;
}

export interface DocumentResponse {
  document: Document;
  format?: DocFormat;
  /** null = file missing on disk (markdown/html) or binary (pdf). */
  content: string | null;
}

export interface ChangedEventPayload {
  type: "changed";
  id: number;
}
