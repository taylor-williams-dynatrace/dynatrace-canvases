import { useEffect, useState } from "react";
import { documentsClient } from "@dynatrace-sdk/client-document";
import {
  VIEW_DOC_TYPE,
  VIEW_SCHEMA_VERSION,
  type MetricsGraphicView,
} from "../types/metricsView";

/**
 * The schema version this renderer understands. A canvas document stamped with a
 * higher `schemaVersion` was saved by a newer build and may use fields this
 * renderer doesn't know about — callers can warn and render best-effort.
 */
export const CANVAS_SCHEMA_VERSION = VIEW_SCHEMA_VERSION;

export interface UseCanvasDocumentResult {
  /** The parsed canvas content, or null until loaded / on error. */
  canvas: MetricsGraphicView | null;
  /** The document's display name (metadata), if available. */
  name: string | null;
  error: Error | null;
  isLoading: boolean;
  /** True when the document's schemaVersion exceeds what this renderer supports. */
  unsupportedVersion: boolean;
}

/**
 * Fetch, parse, and version-check a Canvas document by id, for read-only
 * rendering (e.g. embedding a canvas in another app). Requires the
 * `document:documents:read` scope. This is intentionally decoupled from the core
 * app's edit/save flow so it can move into a shared renderer package unchanged.
 */
export function useCanvasDocument(id: string | null): UseCanvasDocumentResult {
  const [canvas, setCanvas] = useState<MetricsGraphicView | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(id));

  useEffect(() => {
    if (!id) {
      setCanvas(null);
      setName(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setError(null);
    documentsClient
      .getDocument({ id })
      .then(async (response) => {
        const meta = response.metadata;
        if (meta && meta.type && meta.type !== VIEW_DOC_TYPE) {
          throw new Error(
            `Document ${id} is of type "${meta.type}", not a canvas (${VIEW_DOC_TYPE}).`,
          );
        }
        const content = (await response.content?.get(
          "json",
        )) as MetricsGraphicView | undefined;
        if (!content) throw new Error(`Canvas ${id} has no content.`);
        if (!active) return;
        setCanvas(content);
        setName(meta?.name ?? content.name ?? null);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setCanvas(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const unsupportedVersion =
    canvas != null &&
    typeof canvas.schemaVersion === "number" &&
    canvas.schemaVersion > CANVAS_SCHEMA_VERSION;

  return { canvas, name, error, isLoading, unsupportedVersion };
}
