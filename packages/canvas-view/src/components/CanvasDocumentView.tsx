import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CanvasView } from "./CanvasView";
import { useCanvasDocument } from "../hooks/useCanvasDocument";

export interface CanvasDocumentViewProps {
  /** Document Service id of the canvas (type `metrics-graphic-view`). */
  documentId: string | null;
  /**
   * `fit` scales the canvas to the container (default); `actual` renders 1:1 and
   * scrolls. Fit recomputes on container resize.
   */
  sizing?: "fit" | "actual";
  /** Per-tile value refresh interval in ms (default 30s). */
  refreshIntervalMs?: number;
  /** Notified when the document fails to load. */
  onError?: (error: Error) => void;
}

/** Fallback canvas size when a document has no stored dimensions. */
const FALLBACK = { width: 1000, height: 600 };
const DEFAULT_REFRESH_MS = 30_000;
const CONTAINER_PADDING = 48; // matches CanvasView's 24px inset on each side

/**
 * Fetch a Canvas document by id and render it read-only — the drop-in for
 * embedding a canvas in another Dynatrace app. Tiles query Grail live, so the
 * host app must declare `document:documents:read` plus the relevant Grail read
 * scopes, and be mounted inside the host's Strato `AppRoot` for theming.
 */
export const CanvasDocumentView: React.FC<CanvasDocumentViewProps> = ({
  documentId,
  sizing = "fit",
  refreshIntervalMs = DEFAULT_REFRESH_MS,
  onError,
}) => {
  const { canvas, error, isLoading, unsupportedVersion } = useCanvasDocument(documentId);

  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  const bounds = useMemo(
    () => ({
      width: canvas?.backgroundWidth ?? FALLBACK.width,
      height: canvas?.backgroundHeight ?? FALLBACK.height,
    }),
    [canvas?.backgroundWidth, canvas?.backgroundHeight],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (sizing !== "fit") {
      setScale(1);
      return;
    }
    const el = containerRef.current;
    if (!el || !canvas) return;
    const compute = () => {
      const availW = el.clientWidth - CONTAINER_PADDING;
      const availH = el.clientHeight - CONTAINER_PADDING;
      if (availW <= 0 || availH <= 0) return;
      const next = Math.min(availW / bounds.width, availH / bounds.height);
      setScale(Math.max(0.1, Math.min(4, Math.round(next * 100) / 100)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizing, canvas, bounds.width, bounds.height]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {isLoading ? (
        <Flex alignItems="center" justifyContent="center" style={{ width: "100%", height: "100%" }}>
          <ProgressCircle aria-label="Loading canvas" />
        </Flex>
      ) : error ? (
        <Flex
          alignItems="center"
          justifyContent="center"
          style={{ width: "100%", height: "100%", padding: 24 }}
        >
          <Text style={{ color: Colors.Text.Critical.Default, textAlign: "center" }}>
            Could not load this canvas: {error.message}
          </Text>
        </Flex>
      ) : canvas ? (
        <>
          {unsupportedVersion && (
            <Text
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                right: 8,
                zIndex: 10,
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 12,
                textAlign: "center",
                color: Colors.Text.Warning.Default,
                background: Colors.Background.Container.Neutral.Default,
              }}
            >
              This canvas was saved by a newer version — update
              @dynatrace-canvases/canvas-view to render all of its features.
            </Text>
          )}
          <CanvasView
            tiles={canvas.tiles}
            backgroundUrl={canvas.backgroundImage ?? null}
            bounds={bounds}
            scale={scale}
            refreshIntervalMs={refreshIntervalMs}
            editable={false}
          />
        </>
      ) : null}
    </div>
  );
};
