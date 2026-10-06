# Plan: a reusable read-only Canvas renderer (`@dynatrace-canvases/canvas-view`)

Goal: let **another** Dynatrace app fetch and display a Canvas that the core
Canvases app created — e.g. a tab in a separate observability app that lets users
pick a saved canvas and render it live, in place. This is "Option 2": a shared,
read-only rendering package the host app imports, rather than navigating away
(deep link) or a platform widget.

> `@dynatrace-canvases` is a placeholder scope — rename to your real npm org
> before publishing. "Host app" = the other app doing the embedding.

## Implementation status

**Milestone 1 (done).** `MetricTile` edit callbacks are optional; the read-only
`CanvasView` was factored out of `GlassCanvas` (which now composes it); and
`useCanvasDocument` was added. No behavior change — the app dogfoods `CanvasView`
in View/Present mode.

**Milestone 2 (done — package stood up).** An npm workspace package now exists at
`packages/canvas-view`:

- Public API in `src/index.ts`: `CanvasDocumentView` (fetch-by-id drop-in),
  `CanvasView` (low-level), `useCanvasDocument`, `CANVAS_SCHEMA_VERSION`, and the
  `MetricsGraphicView` / `MetricTile` types.
- `CanvasDocumentView` fetches a canvas by id and renders it read-only with a
  `sizing` mode (`fit` recomputes scale on container resize via `ResizeObserver`;
  `actual` renders 1:1), plus loading / error / unsupported-version states.
- **Single source of truth:** the app in `ui/app` remains canonical. The closed
  set of renderer files (types, `metricsQuery`, `TileShapeLayer`, `MetricTile`,
  `CanvasView`, `useCanvasDocument`) is mirrored into the package by
  `scripts/sync-canvas-view.mjs` (`npm run sync:canvas-view`, and
  `npm run build:canvas-view` to sync + `tsc`). Package-only files (`index.ts`,
  `CanvasDocumentView.tsx`) are never touched by the sync.
- The package typechecks with its own `tsconfig` and lints clean; the workspace
  is registered in the root `package.json` and `package-lock.json`.

### Using it from a host app

```tsx
import { CanvasDocumentView } from "@dynatrace-canvases/canvas-view";

// inside a themed subtree (host app's <AppRoot>)
<CanvasDocumentView documentId={selectedId} sizing="fit" />
```

The host app must declare `document:documents:read` plus the Grail read scopes
the tiles query (metrics/logs/spans/events/bizevents/entities/system/buckets…),
and the user needs the matching Grail permissions.

### Remaining / caveats

- **dt-app build not verified here.** Whether the Dynatrace App Toolkit bundles a
  local workspace package (or its published `dist`) into a consuming app must be
  confirmed with a real `npm run start` / `npm run build` on macOS — it can't be
  run in this environment. Publishing the package (shipping `dist`) and having the
  host app depend on the built output is the most bundler-friendly path.
- **Core app still uses its own copies** (via the sync), not a package import —
  deliberately, to avoid risking the shipping app's build before the toolkit's
  workspace handling is confirmed. Once confirmed, the app can import from the
  package and drop the local copies (retire the sync script).
- **Legacy backgrounds:** `CanvasDocumentView` renders the embedded
  `backgroundImage` data URL; it does not resolve the legacy `backgroundDocId`
  (older canvases) — re-saving such a canvas in the core app migrates it.

The remaining milestones (sample host tab, publish) are below.

## Why this is clean to do

A canvas is a self-contained Document Service document (`type:
metrics-graphic-view`) whose content is a `MetricsGraphicView` JSON object, and
the Document Service is app-agnostic — any app can read a document the *user* is
allowed to see. The render path is already self-sufficient per tile: each
`MetricTile` runs its own `useDql` query and needs no app-wide state. So the
"view" half of the app can be lifted out with a thin, well-defined surface.

## What gets extracted vs. left behind

**Extract (the read-only render surface):**

| From | Why | Notes |
| --- | --- | --- |
| `ui/app/types/metricsView.ts` | The data model + `schemaVersion` + enums/helpers (`isOutlineTileShape`, …) | Pure TS, no deps. The contract. |
| `ui/app/services/metricsQuery.ts` | Query builders, threshold eval, value formatting, table field discovery/row normalization | Pure TS. |
| `ui/app/components/TileShapeLayer.tsx` | Shape/outline/line SVG + `ShapeGlyph` | Pure React, only design tokens. |
| `ui/app/components/MetricTile.tsx` | Per-tile live query + value/table/markdown/shape rendering | Needs edit props made optional (see refactor). |
| New: `CanvasView.tsx` | A slim read-only canvas (background + absolutely-positioned tiles) factored out of `GlassCanvas` | The package's main component. |
| New: `useCanvasDocument.ts` | Fetch + parse + version-check a canvas document by id | Wraps `@dynatrace-sdk/client-document`. |

**Leave behind (edit-only, stays in the core app):**

- `GlassCanvas.tsx`'s editing machinery: drag/resize, marquee + multi-select,
  group move, alignment/spacing guides, zoom controls, the selection toolbar.
- `TileConfigForm`, `ColumnPicker`, `MetricExplorer`, `CreateViewModal`,
  `ShareDialog`, `FilterRow`, `ThresholdRow`.
- `documentService.ts` **write/delete/share** paths and `shareService.ts`.

The core app keeps `GlassCanvas` for authoring; ideally it *also* consumes the
new `CanvasView` for its own View mode, so there's exactly one renderer (no drift
between how the core app and the host app display a canvas).

## Public API (small on purpose)

```ts
// @canvases/canvas-view

export const CANVAS_SCHEMA_VERSION: number;          // what this renderer supports
export type { MetricsGraphicView, MetricTile } from "./types";

// Fetch + parse + validate a canvas document by id.
export function useCanvasDocument(id: string): {
  canvas: MetricsGraphicView | null;
  error: Error | null;
  isLoading: boolean;
  /** true if the doc's schemaVersion is newer than this renderer supports */
  unsupportedVersion: boolean;
};

// Render a canvas. Either pass a documentId (it fetches) or a pre-fetched canvas.
export interface CanvasViewProps {
  documentId?: string;
  canvas?: MetricsGraphicView;
  /** value refresh interval in ms (default 30000). */
  refreshIntervalMs?: number;
  /** fit | actual — scale the canvas to the container or render 1:1. */
  sizing?: "fit" | "actual";
  onError?: (e: Error) => void;
}
export const CanvasView: React.FC<CanvasViewProps>;
```

Host-app usage becomes:

```tsx
import { CanvasView, useCanvasDocument } from "@canvases/canvas-view";

// picker: list documents of type metrics-graphic-view, let the user choose an id
<CanvasView documentId={selectedId} sizing="fit" />
```

## Refactors needed in the core app (small, low-risk)

1. **Make `MetricTile` edit props optional.** Today `onChange/onRemove/onEdit/
   onDuplicate` are required. Make them optional and guard the edit-only UI on
   `editable` (drag handlers, toolbar, resize handle, caption drag). Read-only
   render already exists — this just lets it run without edit wiring.
2. **Factor `CanvasView` out of `GlassCanvas`.** Pull the non-editing layers
   (outer scroll container, sizer, inner canvas box at `background{Width,Height}`,
   the `tiles.map(...)`) into `CanvasView`. `GlassCanvas` then renders
   `CanvasView` plus its editing overlays. This guarantees one code path.
3. **Add a document-fetch hook** (`useCanvasDocument`) that calls
   `documentClient.getDocument`, reads `content.get("json")`, and checks
   `schemaVersion`. (The core app's `getView` already does the fetch; share it.)
4. **Keep coordinates in image pixel space** (unchanged) so `sizing="fit"` is a
   pure CSS `scale` on the container, exactly like the app's zoom.

## Packaging & repo structure (pick one)

- **npm workspace (recommended):** turn the repo into a workspace with
  `packages/canvas-view` (the library) and `apps/canvases` (the current app,
  consuming the package). The host app installs the published package. Best for
  keeping the core app and library in lockstep.
- **Published internal package:** build `@canvases/canvas-view` and publish to
  your private registry; both apps depend on it by version. Cleanest boundary,
  needs a release step.
- **Git submodule / copied module:** fastest to prototype, worst for drift —
  acceptable only for a spike.

Peer dependencies (not bundled): `react`, `react-dom`, `@dynatrace-sdk/*`,
`@dynatrace/strato-*`. The host app already provides these.

## What the host app must declare

- **Scopes.** Tiles query Grail **in the host app's context**, so the host app's
  `app.config.json` needs `document:documents:read` (fetch/list canvases) plus the
  same Grail read set the tiles use: `storage:metrics:read`,
  `storage:entities:read`, `storage:logs:read`, `storage:events:read`,
  `storage:bizevents:read`, `storage:spans:read`, `storage:system:read`,
  `storage:buckets:read` (+ `user.sessions`/`user.events` if used). Without these,
  tiles render "not authorized". Users also need the matching Grail permissions
  (the intersection rule).
- **Strato theme context.** Render inside the host app's `AppRoot` so design
  tokens/theme resolve. `CanvasView` assumes it's mounted in a themed subtree.

## Schema versioning strategy

- Export `CANVAS_SCHEMA_VERSION` from the package and stamp it against the
  document's `schemaVersion`.
- **Renderer newer than doc** (old canvas, new renderer): render normally;
  unknown-to-old fields simply aren't present. Keep readers tolerant of missing
  optional fields (they already default).
- **Doc newer than renderer** (canvas saved by a newer core app): set
  `unsupportedVersion`, render best-effort, and surface a gentle "update the
  canvas-view package to see newer features" message rather than crashing.
- **Semver the package**: bump minor for additive tile features, major only for
  breaking schema changes. The core app and library should move together.

## Risks & gotchas

- **Scopes/permissions** are the most common failure — the host app *and* the
  user both need the Grail read grants.
- **Drift** if the renderer is copied instead of shared; a versioned package (and
  having the core app consume it too) prevents this.
- **Background size**: canvases embed the image as a data URL (≤ 8 MB); fine to
  fetch, but the picker should list metadata only, not full content.
- **DataTable interactivity** inside a host tab works, but if the host constrains
  height, pass a sizing mode and let the table scroll.
- **No iframes.** This package renders natively; do not attempt to iframe the core
  app (platform CSP blocks cross-app framing).

## Suggested milestones

1. Make `MetricTile` edit props optional; factor `CanvasView` out of
   `GlassCanvas`; have the core app's View mode use `CanvasView`. (No behavior
   change — pure refactor, verify with `tsc`/lint and a visual pass.)
2. Stand up `packages/canvas-view` (workspace) exporting `CanvasView`,
   `useCanvasDocument`, types, and `CANVAS_SCHEMA_VERSION`.
3. Build a tiny sample host app / tab: a document picker + `<CanvasView>`, with
   the required scopes, to validate end-to-end in one environment.
4. Add version-guard messaging and docs; publish the package for other teams.

## Effort snapshot

- Milestone 1 (refactor): small — mostly moving existing JSX and loosening a prop
  type.
- Milestone 2 (package): small–medium — build config + public API.
- Milestone 3 (host sample): small.
- Milestone 4 (hardening/publish): small.
