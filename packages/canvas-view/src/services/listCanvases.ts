import { documentsClient } from "@dynatrace-sdk/client-document";
import { VIEW_DOC_TYPE } from "../types/metricsView";

/** Lightweight canvas descriptor for a picker (no content fetched). */
export interface CanvasSummary {
  id: string;
  name: string;
  /** ISO timestamp of the last modification, if available. */
  lastModified?: string;
}

/**
 * List the canvases the current user can access (Document Service documents of
 * type `metrics-graphic-view`), newest first — for a picker in a host app.
 * Requires the `document:documents:read` scope. Only metadata is fetched, not
 * the (potentially large) canvas content.
 */
export async function listCanvases(): Promise<CanvasSummary[]> {
  const result = await documentsClient.listDocuments({
    filter: `type == '${VIEW_DOC_TYPE}'`,
    sort: "-modificationInfo.lastModifiedTime",
    pageSize: 1000,
  });
  return (result.documents ?? []).map((d) => {
    const lm = d.modificationInfo?.lastModifiedTime;
    return {
      id: d.id,
      name: d.name,
      lastModified: lm instanceof Date ? lm.toISOString() : lm,
    };
  });
}
