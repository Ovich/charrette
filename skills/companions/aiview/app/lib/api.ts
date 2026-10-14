// Typed client over the backend-for-frontend API. Types come from src/core (type-only,
// erased at build) so the contract-guard test can hold server and app to one shape.
import type { BindingsSummary, DocumentsResponse, DocumentResponse } from "../../src/core/api.ts";
import type { Document, DocumentWithState, Pending } from "../../src/core/db.ts";

export type { BindingsSummary, DocumentsResponse, DocumentResponse, Document, DocumentWithState, Pending };

export async function fetchDocuments(): Promise<DocumentsResponse> {
  const r = await fetch("/api/documents");
  if (!r.ok) throw new Error(`GET /api/documents: ${r.status}`);
  return (await r.json()) as DocumentsResponse;
}

export async function fetchDocument(id: number): Promise<DocumentResponse | null> {
  const r = await fetch(`/api/document/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET /api/document/${id}: ${r.status}`);
  return (await r.json()) as DocumentResponse;
}

/** The one write path for the active project — the CLI posts here too. */
export async function setActiveProject(project: string): Promise<string> {
  const r = await fetch("/api/active", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!r.ok) throw new Error(`POST /api/active: ${r.status}`);
  return ((await r.json()) as { project: string }).project;
}

export const rawUrl = (id: number): string => `/api/raw/${id}?t=${Date.now()}`;
export const assetUrl = (docId: number, rel: string): string => `/api/asset/${docId}/${rel}`;
