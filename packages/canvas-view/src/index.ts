/**
 * @dynatrace-canvases/canvas-view
 *
 * Read-only renderer for Dynatrace Canvas documents (Document Service type
 * `metrics-graphic-view`). Use it to embed a canvas built in the Canvases app
 * inside another Dynatrace app.
 *
 * - `CanvasDocumentView` — fetch a canvas by id and render it (the drop-in).
 * - `CanvasView` — low-level renderer if you already have the canvas data.
 * - `useCanvasDocument` — fetch/parse/version-check a canvas document.
 *
 * The host app must declare `document:documents:read` plus the Grail read scopes
 * the tiles query, and render this inside its Strato `AppRoot`.
 */
export { CanvasDocumentView } from "./components/CanvasDocumentView";
export type { CanvasDocumentViewProps } from "./components/CanvasDocumentView";

export { CanvasView } from "./components/CanvasView";
export type { CanvasViewProps } from "./components/CanvasView";

export {
  useCanvasDocument,
  CANVAS_SCHEMA_VERSION,
} from "./hooks/useCanvasDocument";
export type { UseCanvasDocumentResult } from "./hooks/useCanvasDocument";

export { listCanvases } from "./services/listCanvases";
export type { CanvasSummary } from "./services/listCanvases";

export type { MetricsGraphicView, MetricTile } from "./types/metricsView";
