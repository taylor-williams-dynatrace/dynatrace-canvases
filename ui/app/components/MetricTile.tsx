import React, { useEffect, useMemo, useRef } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle, Markdown } from "@dynatrace/strato-components/content";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import type { DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import {
  CategoricalBarChart,
  DonutChart,
  PieChart,
  Sparkline,
  TimeseriesChart,
  convertToTimeseries,
} from "@dynatrace/strato-components/charts";
import {
  DeleteIcon,
  EditIcon,
  DragAllDirectionIcon,
  DuplicateIcon,
  LinkIcon,
} from "@dynatrace/strato-icons";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type {
  MetricTile as MetricTileModel,
  TileLink,
} from "../types/metricsView";
import {
  TileShapeLayer,
  TileOutlineLayer,
  TileLineLayer,
} from "./TileShapeLayer";
import {
  DEFAULT_CATEGORICAL_OPTIONS,
  DEFAULT_PIE_OPTIONS,
  DEFAULT_TIMESERIES_OPTIONS,
  DEFAULT_VALUE_POSITION,
  isLineTileShape,
  isOutlineTileShape,
  type ValuePosition,
} from "../types/metricsView";
import {
  buildCategoricalData,
  buildDqlRows,
  type CategoricalDatum,
  contrastTextColor,
  discoverDqlFields,
  type DqlTableRow,
  evaluateThresholdColor,
  extractScalar,
  formatValue,
  readDqlCell,
  sparklineQuery,
  tileValueQuery,
} from "../services/metricsQuery";

const MIN_TILE_SIZE = 60;
const MAX_TILE_SIZE = 1200;

interface MetricTileProps {
  tile: MetricTileModel;
  /** Editing enabled (drag / resize / remove / reconfigure). */
  editable: boolean;
  /** Whether this tile is part of the current selection. */
  selected?: boolean;
  /** Auto-refresh interval in ms for the value query. */
  refreshIntervalMs: number;
  /** Pixel bounds of the canvas, used to clamp dragging. */
  bounds: { width: number; height: number };
  /** Current canvas zoom factor, used to map pointer deltas to canvas space. */
  scale: number;
  /** Edit-only callbacks — omitted when the tile is rendered read-only. */
  onChange?: (tile: MetricTileModel) => void;
  onRemove?: (id: string) => void;
  onEdit?: (tile: MetricTileModel) => void;
  onDuplicate?: (tile: MetricTileModel) => void;
  /** Snap a proposed position against other tiles; also drives alignment guides. */
  onSnap?: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => { x: number; y: number };
  /** Called when a drag/resize gesture ends, to clear alignment guides. */
  onGestureEnd?: () => void;
  /**
   * Called on drag-handle pointer down for selection. Returns true if the
   * canvas took over the gesture (group move or a selection toggle), meaning
   * the tile should not start its own single-tile drag.
   */
  onHeaderPointerDown?: (
    id: string,
    additive: boolean,
    clientX: number,
    clientY: number,
  ) => boolean;
  /** Reports whether this tile's value query is currently running. */
  onLoadingChange?: (id: string, loading: boolean) => void;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  tile,
  editable,
  selected,
  refreshIntervalMs,
  bounds,
  scale,
  onChange,
  onRemove,
  onEdit,
  onDuplicate,
  onSnap,
  onGestureEnd,
  onHeaderPointerDown,
  onLoadingChange,
}) => {
  const source = tile.source ?? "metric";
  const isMetric = source === "metric";
  const isDql = source === "dql";
  const isMarkdown = source === "markdown";
  const isShape = source === "shape";
  // How a DQL tile renders its result. "value" is the single-scalar default;
  // the others render the result as a table or chart inside a bordered "panel"
  // tile (shared caption/border chrome, no shape/threshold styling).
  const dqlDisplay = tile.dqlDisplay ?? "value";
  const isTableTile = isDql && dqlDisplay === "table";
  const isLineTile = isDql && dqlDisplay === "line";
  const isAreaTile = isDql && dqlDisplay === "area";
  const isBarTile = isDql && dqlDisplay === "bar";
  const isCategoricalTile = isDql && dqlDisplay === "categorical";
  const isPieTile = isDql && dqlDisplay === "pie";
  const isDonutTile = isDql && dqlDisplay === "donut";
  // Pie + donut share the same category/value slice data.
  const isSliceTile = isPieTile || isDonutTile;
  // Line, area, and bar all convert the DQL result to Strato timeseries.
  const isTimeseriesTile = isLineTile || isAreaTile || isBarTile;
  const isChartTile = isTimeseriesTile || isCategoricalTile || isSliceTile;
  // Table and chart tiles share the same panel chrome and interaction model.
  const isPanelTile = isTableTile || isChartTile;
  // Non-data tiles (markdown text, static shapes) never run a query.
  const isStatic = isMarkdown || isShape;
  const transparent = tile.transparent ?? false;
  // Shape-only makes no sense with no shape, so transparent overrides it.
  const shapeOnly = (tile.shapeOnly ?? false) && !transparent;
  const query = isStatic ? "" : isDql ? tile.dql ?? "" : tileValueQuery(tile);
  const hasSource = isDql ? Boolean(tile.dql) : Boolean(tile.metricKey);

  // In shape-only mode with no thresholds, the value isn't needed at all, so
  // skip the query entirely; otherwise we still need it to drive the color.
  const needsValue = !shapeOnly || (tile.thresholds?.length ?? 0) > 0;

  const { data, error, isLoading, isFetching } = useDql(
    { query },
    {
      refetchInterval: refreshIntervalMs,
      enabled: !isStatic && hasSource && needsValue && query.length > 0,
    },
  );

  // Optional trend sparkline (metric tiles only): a second, bucketed timeseries
  // query over the tile's sparkline window, converted to chart data.
  const sparklineOn = isMetric && (tile.sparkline ?? false) && Boolean(tile.metricKey);
  const sparkQuery = sparklineOn ? sparklineQuery(tile) : "";
  const { data: sparkRaw } = useDql(
    { query: sparkQuery },
    { refetchInterval: refreshIntervalMs, enabled: sparklineOn && sparkQuery.length > 0 },
  );
  const sparkData = useMemo(() => {
    if (!sparklineOn) return null;
    const records = sparkRaw?.records;
    if (!records || records.length === 0) return null;
    try {
      const series = convertToTimeseries(records, sparkRaw?.types ?? []);
      return series.length > 0 ? series : null;
    } catch {
      return null;
    }
  }, [sparklineOn, sparkRaw]);

  // Report query activity to the canvas. Use `isFetching` (not `isLoading`) so
  // the indicator also reflects the periodic background refreshes — `isLoading`
  // is only true on the very first load before any data exists.
  useEffect(() => {
    onLoadingChange?.(tile.id, isFetching);
    return () => onLoadingChange?.(tile.id, false);
  }, [isFetching, tile.id, onLoadingChange]);

  // A transparent table shows only its gridlines and cell values over the
  // canvas. The DataTable paints cell/row/header backgrounds from design
  // tokens, so we clear them with a single scoped stylesheet (injected once).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "mce-transparent-table-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent =
      ".mce-transparent-table, .mce-transparent-table * " +
      "{ background-color: transparent !important; }";
    document.head.appendChild(style);
  }, []);

  // Metric tiles read the aliased `val`; DQL tiles read the single cell (which
  // may be numeric or text). Thresholds only apply to numeric values.
  let numericValue: number | null;
  let displayValue: string;
  if (isDql) {
    const cell = readDqlCell(data?.records);
    // A DQL value can come back as a numeric string (e.g. "0"); coerce it so
    // color thresholds still apply. Non-numeric text stays null (no thresholds).
    if (typeof cell.value === "number") {
      numericValue = cell.value;
    } else if (
      typeof cell.value === "string" &&
      cell.value.trim() !== "" &&
      Number.isFinite(Number(cell.value))
    ) {
      numericValue = Number(cell.value);
    } else {
      numericValue = null;
    }
    displayValue =
      cell.value == null
        ? "–"
        : typeof cell.value === "number"
          ? formatValue(cell.value, tile.unit)
          : tile.unit
            ? `${cell.value} ${tile.unit}`
            : String(cell.value);
  } else {
    numericValue = extractScalar(data?.records);
    displayValue = formatValue(numericValue, tile.unit);
  }

  const thresholdColor = evaluateThresholdColor(numericValue, tile.thresholds);
  // A matching threshold overrides the tile's resting fill (static color, or the
  // default surface). `effectiveFill` is the explicit hex fill, if any.
  const staticBg = tile.backgroundColor;
  const effectiveFill = thresholdColor ?? staticBg ?? null;
  const valueTextColor = effectiveFill
    ? contrastTextColor(effectiveFill)
    : undefined;

  const shape = tile.shape ?? "rectangle";
  const lineShape = isLineTileShape(shape);
  const outlineShape = !lineShape && isOutlineTileShape(shape);
  // Legacy "arrow" shapes default to an end arrowhead when no explicit setting.
  const lineArrows =
    tile.lineArrows ?? (shape === "arrow" ? "end" : "none");
  // Outline icons and transparent tiles have no solid backdrop behind the text.
  const noFill = transparent || outlineShape;

  // With no solid fill, text uses a readable color + surface-colored halo
  // (works in light/dark and over busy backgrounds). Transparent tiles color
  // the text by the threshold so status still reads; solid tiles fill instead.
  const contentTextColor = transparent
    ? thresholdColor ?? Colors.Text.Neutral.Default
    : outlineShape
      ? Colors.Text.Neutral.Default
      : valueTextColor;
  const contentTextShadow = noFill
    ? `0 0 3px ${Colors.Background.Surface.Default}, 0 0 2px ${Colors.Background.Surface.Default}`
    : undefined;

  // Where the value + label sit within the tile. Defaults to center; edge
  // placements keep the value legible over busy outline-icon geometry.
  const valuePosition = tile.valuePosition ?? DEFAULT_VALUE_POSITION;
  // For outline icons, an off-center value gets its own reserved band: the icon
  // shrinks into the opposite region so the value/label never overlap it.
  const reserveSpace = outlineShape && valuePosition !== "center";
  const iconInset = reserveSpace
    ? valuePosition === "bottom"
      ? { bottom: "38%" }
      : valuePosition === "left"
        ? { left: "50%" }
        : { right: "50%" } // "right"
    : undefined;

  const link = tile.link;
  // In view mode a linked tile is clickable; in edit mode we only show the badge.
  const clickable = !editable && Boolean(link);

  // Table-tile data: resolve the columns (explicit selection, else all returned
  // fields) and normalize rows for the DataTable. Memoized so sorting state and
  // renders stay stable between refreshes that return equivalent data.
  const tableColumnKeys = useMemo(
    () =>
      tile.tableColumns && tile.tableColumns.length > 0
        ? tile.tableColumns
        : discoverDqlFields(
            data?.records as Array<Record<string, unknown>> | undefined,
          ),
    [tile.tableColumns, data],
  );
  const tableRows = useMemo(
    () =>
      isTableTile
        ? buildDqlRows(
            data?.records as Array<Record<string, unknown>> | undefined,
            tableColumnKeys,
          )
        : [],
    [isTableTile, data, tableColumnKeys],
  );
  const tableColumns = useMemo<DataTableColumnDef<DqlTableRow>[]>(
    () =>
      tableColumnKeys.map((key) => ({
        id: key,
        header: key,
        // Function accessor avoids dotted keys (e.g. "dt.entity.host") being
        // treated as nested paths.
        accessor: (row: DqlTableRow) => row[key],
      })),
    [tableColumnKeys],
  );

  // Bar-chart data: convert the DQL result to Strato timeseries. Conversion
  // throws on non-timeseries results, so we swallow that and fall back to the
  // chart's empty state (the config form already steers users to a valid query).
  const chartSeries = useMemo(() => {
    if (!isTimeseriesTile) return [];
    const records = data?.records;
    if (!records || records.length === 0) return [];
    try {
      return convertToTimeseries(records, data?.types ?? []);
    } catch {
      return [];
    }
  }, [isTimeseriesTile, data]);

  // Timeseries (line) display options, with defaults filled for any unset field.
  const tsOpts = useMemo(
    () => ({ ...DEFAULT_TIMESERIES_OPTIONS, ...tile.timeseriesOptions }),
    [tile.timeseriesOptions],
  );

  // Categorical display options, with defaults filled in for any unset field.
  const catOpts = useMemo(
    () => ({ ...DEFAULT_CATEGORICAL_OPTIONS, ...tile.categoricalOptions }),
    [tile.categoricalOptions],
  );

  // Category/value data (one row per category) — shared by the categorical bar
  // chart and the pie/donut slice charts.
  const categoricalData = useMemo<CategoricalDatum[]>(
    () =>
      isCategoricalTile || isSliceTile
        ? buildCategoricalData(data?.records)
        : [],
    [isCategoricalTile, isSliceTile, data],
  );

  // Pie/donut display options, with defaults filled for any unset field.
  const pieOpts = useMemo(
    () => ({ ...DEFAULT_PIE_OPTIONS, ...tile.pieOptions }),
    [tile.pieOptions],
  );

  // Keep the last successfully-built table so a refresh that transiently errors
  // or returns no rows (a common blip for time-windowed queries) doesn't blank
  // the tile — we keep showing the previous data until the next good result.
  const lastGoodTableRef = useRef<{
    rows: DqlTableRow[];
    columns: DataTableColumnDef<DqlTableRow>[];
  } | null>(null);
  const hasFreshTable = tableRows.length > 0 && tableColumns.length > 0;
  if (isTableTile && hasFreshTable) {
    lastGoodTableRef.current = { rows: tableRows, columns: tableColumns };
  }
  // A settled, successful result that genuinely has no rows should clear the
  // table; only in-flight or errored refreshes fall back to the last good data.
  const settledEmpty =
    !isFetching && !error && Array.isArray(data?.records) && !hasFreshTable;
  const displayTable = hasFreshTable
    ? { rows: tableRows, columns: tableColumns }
    : settledEmpty
      ? null
      : lastGoodTableRef.current;

  // The Strato DataTable's column/row layout math breaks when it renders inside
  // a CSS `transform: scale()` (the canvas box is scaled for zoom / Present
  // mode). We fix that by counter-scaling the table's own container so its
  // subtree renders at net scale 1 (see `tableScaleStyle`). `scaleActive` marks
  // when the canvas is zoomed; `scalePct` keys a clean remount when zoom
  // changes so the table re-measures at the new counter-scaled size.
  const scalePct = Math.round(scale * 100);
  const scaleActive = Math.abs(scale - 1) > 0.001;
  const tableRemountKey = `s${scalePct}`;

  // The tile root; drags capture the pointer here so a drag started from the
  // body (normal tiles) or the caption strip (table tiles) both route move/up
  // events to the same element.
  const rootRef = useRef<HTMLDivElement>(null);

  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resizeState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  function onDragPointerDown(e: React.PointerEvent) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    // Let the canvas update selection and possibly take over (group move).
    const takeover =
      onHeaderPointerDown?.(tile.id, additive, e.clientX, e.clientY) ?? false;
    if (takeover) return;
    rootRef.current?.setPointerCapture(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: tile.x,
      originY: tile.y,
    };
  }

  // Keep the tile's rotated bounding box within the canvas. Reduces to the
  // plain box when rotation is 0, but lets rotated tiles reach the edges.
  function clampPosition(px: number, py: number): { x: number; y: number } {
    const rot = ((tile.rotation ?? 0) * Math.PI) / 180;
    const w = tile.width;
    const h = tile.height;
    const halfW =
      (Math.abs(Math.cos(rot)) * w) / 2 + (Math.abs(Math.sin(rot)) * h) / 2;
    const halfH =
      (Math.abs(Math.sin(rot)) * w) / 2 + (Math.abs(Math.cos(rot)) * h) / 2;
    let cx = px + w / 2;
    let cy = py + h / 2;
    cx = Math.min(Math.max(cx, halfW), Math.max(halfW, bounds.width - halfW));
    cy = Math.min(Math.max(cy, halfH), Math.max(halfH, bounds.height - halfH));
    return { x: cx - w / 2, y: cy - h / 2 };
  }

  function onDragPointerMove(e: React.PointerEvent) {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = (e.clientX - s.startX) / scale;
    const dy = (e.clientY - s.startY) / scale;
    let { x: nx, y: ny } = clampPosition(s.originX + dx, s.originY + dy);
    if (onSnap) {
      const snapped = onSnap(tile.id, nx, ny, tile.width, tile.height);
      ({ x: nx, y: ny } = clampPosition(snapped.x, snapped.y));
    }
    onChange?.({ ...tile, x: nx, y: ny });
  }

  function endDrag(e: React.PointerEvent) {
    if (dragState.current?.pointerId === e.pointerId) {
      dragState.current = null;
      onGestureEnd?.();
    }
  }

  function onResizePointerDown(e: React.PointerEvent) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originWidth: tile.width,
      originHeight: tile.height,
    };
  }

  function onResizePointerMove(e: React.PointerEvent) {
    const s = resizeState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    let dx = (e.clientX - s.startX) / scale;
    let dy = (e.clientY - s.startY) / scale;
    // The tile may be rotated, so map the screen-space drag back into the
    // tile's local axes before applying it to width/height.
    const rot = ((tile.rotation ?? 0) * Math.PI) / 180;
    if (rot) {
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      dx = localX;
      dy = localY;
    }
    // Allow shapes to span up to the full canvas (never below the fixed floor).
    const maxDim = Math.max(bounds.width, bounds.height, MAX_TILE_SIZE);
    const width = clamp(s.originWidth + dx, MIN_TILE_SIZE, maxDim);
    const height = clamp(s.originHeight + dy, MIN_TILE_SIZE, maxDim);
    onChange?.({ ...tile, width, height });
  }

  function endResize(e: React.PointerEvent) {
    if (resizeState.current?.pointerId === e.pointerId)
      resizeState.current = null;
  }

  // Only show a label the user explicitly entered — never the metric key or a
  // placeholder fallback.
  const label = tile.label?.trim() ?? "";

  // Default caption shown for a panel tile when the user hasn't set a label.
  const panelTypeLabel = isTableTile
    ? "Table"
    : isLineTile
      ? "Line chart"
      : isAreaTile
        ? "Area chart"
        : isBarTile
          ? "Bar chart"
          : isPieTile
            ? "Pie chart"
            : isDonutTile
              ? "Donut chart"
              : "Categorical";

  // Shared loading / error / empty state for a panel tile's content area.
  const panelPlaceholder =
    isLoading || isFetching ? (
      <Flex justifyContent="center" style={{ padding: 12 }}>
        <ProgressCircle size="small" aria-label="Loading" />
      </Flex>
    ) : error ? (
      <Text
        style={{ color: Colors.Text.Critical.Default, fontSize: 12, padding: 8 }}
      >
        Query error
      </Text>
    ) : (
      <Text
        style={{ color: Colors.Text.Neutral.Subdued, fontSize: 12, padding: 8 }}
      >
        No data
      </Text>
    );

  return (
    <div
      ref={rootRef}
      onClick={clickable && link ? () => openTileLink(link) : undefined}
      title={clickable ? "Open link in a new tab" : undefined}
      // Table tiles keep their body interactive (sort/scroll); they drag from
      // the caption strip instead, so no body pointer-down handler here.
      onPointerDown={
        editable && !isPanelTile ? onDragPointerDown : undefined
      }
      onPointerMove={editable ? onDragPointerMove : undefined}
      onPointerUp={editable ? endDrag : undefined}
      onPointerCancel={editable ? endDrag : undefined}
      style={{
        position: "absolute",
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
        transform: tile.rotation ? `rotate(${tile.rotation}deg)` : undefined,
        transformOrigin: "center center",
        // Selection outline is an edit affordance only — never show it in view /
        // present / embedded modes even if a stale selection lingers.
        outline:
          editable && selected
            ? `2px solid ${Colors.Border.Primary.Default}`
            : undefined,
        outlineOffset: 2,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        touchAction: "none",
        cursor: clickable
          ? "pointer"
          : editable && !isPanelTile
            ? "grab"
            : undefined,
      }}
    >
      {transparent || isPanelTile ? null : lineShape ? (
        <TileLineLayer
          width={tile.width}
          height={tile.height}
          color={effectiveFill ?? Colors.Text.Neutral.Default}
          weight={tile.lineWeight ?? 4}
          dashed={tile.lineDashed ?? false}
          arrowStart={lineArrows === "start" || lineArrows === "both"}
          arrowEnd={lineArrows === "end" || lineArrows === "both"}
        />
      ) : outlineShape ? (
        <TileOutlineLayer
          shape={shape}
          color={effectiveFill ?? Colors.Text.Neutral.Default}
          tint={effectiveFill ? `${effectiveFill}2b` : "transparent"}
          inset={iconInset}
        />
      ) : (
        <TileShapeLayer
          shape={shape}
          fill={effectiveFill ?? Colors.Background.Surface.Default}
          stroke={
            editable
              ? Colors.Border.Primary.Default
              : Colors.Border.Neutral.Default
          }
        />
      )}
      {link && !editable && (
        <div
          aria-label="Has drill-down link"
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: valueTextColor ?? Colors.Text.Primary.Default,
            pointerEvents: "none",
            opacity: 0.85,
          }}
        >
          <LinkIcon />
        </div>
      )}
      {!isPanelTile && editable && selected && (
        <Flex
          justifyContent="space-between"
          alignItems="center"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            cursor: "default",
            padding: "2px 4px",
            borderRadius: 4,
            background: Colors.Background.Container.Neutral.Default,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Flex gap={2} alignItems="center">
            <DragAllDirectionIcon />
            {link && <LinkIcon />}
          </Flex>
          <Flex gap={0}>
            <Button
              variant="default"
              onClick={() => onEdit?.(tile)}
              aria-label="Edit tile"
              style={{ minWidth: "auto", padding: 2 }}
            >
              <Button.Prefix>
                <EditIcon />
              </Button.Prefix>
            </Button>
            <Button
              variant="default"
              onClick={() => onDuplicate?.(tile)}
              aria-label="Duplicate tile"
              style={{ minWidth: "auto", padding: 2 }}
            >
              <Button.Prefix>
                <DuplicateIcon />
              </Button.Prefix>
            </Button>
            <Button
              variant="default"
              onClick={() => onRemove?.(tile.id)}
              aria-label="Remove tile"
              style={{ minWidth: "auto", padding: 2 }}
            >
              <Button.Prefix>
                <DeleteIcon />
              </Button.Prefix>
            </Button>
          </Flex>
        </Flex>
      )}

      {isPanelTile ? (
        <div
          style={{
            // When the canvas is zoomed, this layer is sized up by `scale` and
            // scaled back down by `1/scale`, so the table/chart subtree renders
            // at net scale 1 (no transform distortion) while still filling the
            // tile. At 100% it's a normal flex child.
            ...(scaleActive
              ? {
                  top: 0,
                  left: 0,
                  width: `${tile.width * scale}px`,
                  height: `${tile.height * scale}px`,
                  transform: `scale(${1 / scale})`,
                  transformOrigin: "top left" as const,
                }
              : {
                  flexGrow: 1,
                  width: "100%",
                }),
            position: scaleActive ? "absolute" : "relative",
            zIndex: 1,
            minHeight: 0,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 4,
            // Transparent tables drop the surface block/border so only the
            // gridlines and values sit over the canvas; edit mode keeps a faint
            // outline so the tile is still discoverable.
            border: transparent
              ? editable
                ? `1px dashed ${Colors.Border.Neutral.Default}`
                : "none"
              : `1px solid ${
                  editable
                    ? Colors.Border.Primary.Default
                    : Colors.Border.Neutral.Default
                }`,
            background: transparent
              ? "transparent"
              : Colors.Background.Surface.Default,
          }}
        >
          {(editable || label) && (
            <Flex
              alignItems="center"
              justifyContent="space-between"
              gap={4}
              onPointerDown={editable ? onDragPointerDown : undefined}
              style={{
                flex: "0 0 auto",
                padding: "3px 6px",
                cursor: editable ? "grab" : "default",
                borderBottom:
                  transparent && !editable
                    ? "none"
                    : `1px solid ${Colors.Border.Neutral.Default}`,
                background:
                  transparent
                    ? editable
                      ? "rgba(127,127,127,0.18)"
                      : "transparent"
                    : Colors.Background.Container.Neutral.Default,
              }}
            >
              <Flex alignItems="center" gap={4} style={{ minWidth: 0 }}>
                {editable && <DragAllDirectionIcon />}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: Colors.Text.Neutral.Default,
                  }}
                >
                  {label || (editable ? panelTypeLabel : "")}
                </Text>
              </Flex>
              {editable && selected && (
                <Flex gap={0} onPointerDown={(e) => e.stopPropagation()}>
                  <Button
                    variant="default"
                    onClick={() => onEdit?.(tile)}
                    aria-label="Edit tile"
                    style={{ minWidth: "auto", padding: 2 }}
                  >
                    <Button.Prefix>
                      <EditIcon />
                    </Button.Prefix>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => onDuplicate?.(tile)}
                    aria-label="Duplicate tile"
                    style={{ minWidth: "auto", padding: 2 }}
                  >
                    <Button.Prefix>
                      <DuplicateIcon />
                    </Button.Prefix>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => onRemove?.(tile.id)}
                    aria-label="Remove tile"
                    style={{ minWidth: "auto", padding: 2 }}
                  >
                    <Button.Prefix>
                      <DeleteIcon />
                    </Button.Prefix>
                  </Button>
                </Flex>
              )}
            </Flex>
          )}
          <div
            className={transparent ? "mce-transparent-table" : undefined}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              // Tables scroll their overflow; charts fill and clip.
              overflow: isTableTile ? "auto" : "hidden",
              padding: 4,
              position: "relative",
            }}
          >
            {isTableTile ? (
              displayTable ? (
                // Once we have data, keep showing it across refreshes even if a
                // given refresh is still in-flight, errored, or returned nothing.
                <DataTable
                  key={tableRemountKey}
                  data={displayTable.rows}
                  columns={displayTable.columns}
                  sortable
                  resizable
                  fullWidth
                  // Transparent tables show a full gridline grid (no surface
                  // block) so the cells read clearly over the canvas.
                  variant={
                    transparent
                      ? { verticalDividers: true, contained: false }
                      : undefined
                  }
                />
              ) : (
                panelPlaceholder
              )
            ) : isTimeseriesTile ? (
              chartSeries.length > 0 ? (
                <TimeseriesChart
                  key={tableRemountKey}
                  data={chartSeries}
                  variant={isBarTile ? "bar" : isAreaTile ? "area" : "line"}
                  height="100%"
                  // curve / points / gap-connect are line & area only.
                  curve={isBarTile ? undefined : tsOpts.curve}
                  pointsDisplay={isBarTile ? undefined : tsOpts.pointsDisplay}
                  gapPolicy={
                    isBarTile
                      ? undefined
                      : tsOpts.connectDataPoints
                        ? "connect"
                        : "gap"
                  }
                  valueRepresentation={tsOpts.valueRepresentation}
                  truncationMode={tsOpts.truncationMode}
                >
                  <TimeseriesChart.Legend
                    hidden={tsOpts.legendHidden}
                    position={tsOpts.legendPosition}
                  />
                  <TimeseriesChart.Tooltip variant={tsOpts.tooltipVariant} />
                  <TimeseriesChart.YAxis
                    label={
                      tsOpts.valueAxisLabelEnabled
                        ? tsOpts.valueAxisLabel || undefined
                        : undefined
                    }
                    scale={tsOpts.valueAxisScale}
                    min={
                      tsOpts.valueAxisMinMode === "custom"
                        ? tsOpts.valueAxisMin
                        : undefined
                    }
                    max={
                      tsOpts.valueAxisMaxMode === "custom"
                        ? tsOpts.valueAxisMax
                        : undefined
                    }
                  />
                  <TimeseriesChart.XAxis
                    label={
                      tsOpts.timeAxisLabelEnabled
                        ? tsOpts.timeAxisLabel || undefined
                        : undefined
                    }
                  />
                </TimeseriesChart>
              ) : (
                panelPlaceholder
              )
            ) : isPieTile ? (
              categoricalData.length > 0 ? (
                <PieChart
                  key={tableRemountKey}
                  data={{ slices: categoricalData }}
                  height="100%"
                  truncationMode={pieOpts.truncationMode}
                >
                  <PieChart.Legend
                    hidden={pieOpts.legendHidden}
                    position={pieOpts.legendPosition}
                  />
                  <PieChart.Labels
                    hidden={pieOpts.labelsHidden}
                    valueType={pieOpts.labelValueType}
                  />
                </PieChart>
              ) : (
                panelPlaceholder
              )
            ) : isDonutTile ? (
              categoricalData.length > 0 ? (
                <DonutChart
                  key={tableRemountKey}
                  data={{ slices: categoricalData }}
                  height="100%"
                  truncationMode={pieOpts.truncationMode}
                >
                  <DonutChart.Legend
                    hidden={pieOpts.legendHidden}
                    position={pieOpts.legendPosition}
                  />
                  <DonutChart.Labels
                    hidden={pieOpts.labelsHidden}
                    valueType={pieOpts.labelValueType}
                  />
                </DonutChart>
              ) : (
                panelPlaceholder
              )
            ) : categoricalData.length > 0 ? (
              <CategoricalBarChart
                key={tableRemountKey}
                data={categoricalData}
                height="100%"
                layout={catOpts.layout}
                groupMode={catOpts.groupMode}
                valueRepresentation={catOpts.valueRepresentation}
                colorPaletteMode={catOpts.colorMode}
                truncationMode={catOpts.truncationMode}
              >
                <CategoricalBarChart.Legend
                  hidden={catOpts.legendHidden}
                  position={catOpts.legendPosition}
                />
                <CategoricalBarChart.Tooltip variant={catOpts.tooltipVariant} />
                <CategoricalBarChart.ValueAxis
                  label={
                    catOpts.valueAxisLabelEnabled
                      ? catOpts.valueAxisLabel || undefined
                      : undefined
                  }
                  scale={catOpts.valueAxisScale}
                  min={
                    catOpts.valueAxisMinMode === "custom"
                      ? catOpts.valueAxisMin
                      : undefined
                  }
                  max={
                    catOpts.valueAxisMaxMode === "custom"
                      ? catOpts.valueAxisMax
                      : undefined
                  }
                />
                <CategoricalBarChart.CategoryAxis
                  label={
                    catOpts.categoryAxisLabelEnabled
                      ? catOpts.categoryAxisLabel || undefined
                      : undefined
                  }
                />
              </CategoricalBarChart>
            ) : (
              panelPlaceholder
            )}
          </div>
        </div>
      ) : isMarkdown ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            flexGrow: 1,
            minHeight: 0,
            width: "100%",
            boxSizing: "border-box",
            padding: 8,
            // Clear the floating edit toolbar so text isn't hidden beneath it.
            paddingTop: editable && selected ? 34 : 8,
            overflow: "auto",
          }}
        >
          <Markdown>{tile.markdown ?? ""}</Markdown>
        </div>
      ) : !shapeOnly && !isShape ? (
      <div style={valueBlockStyle(valuePosition, reserveSpace)}>
        {isLoading && numericValue == null ? (
          <ProgressCircle size="small" aria-label="Loading value" />
        ) : error ? (
          <Text
            style={{
              color: Colors.Text.Critical.Default,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Query error
          </Text>
        ) : (
          <Text
            style={{
              fontSize: tileFontSize(tile.width, tile.height),
              fontWeight: 600,
              textAlign: reserveSpace ? "center" : valueTextAlign(valuePosition),
              color: contentTextColor,
              textShadow: contentTextShadow,
            }}
          >
            {displayValue}
          </Text>
        )}
        {label && (
          <Text
            style={{
              textAlign: reserveSpace ? "center" : valueTextAlign(valuePosition),
              fontSize: 11,
              color: contentTextColor ?? Colors.Text.Neutral.Default,
              textShadow: contentTextShadow,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
          >
            {label}
          </Text>
        )}
        {sparklineOn && sparkData && (
          <div
            style={{
              width: "100%",
              marginTop: 4,
              // Inset the trend so it sits inside the shape rather than running
              // edge to edge.
              paddingLeft: Math.max(8, Math.min(24, Math.round(tile.width * 0.08))),
              paddingRight: Math.max(8, Math.min(24, Math.round(tile.width * 0.08))),
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            <Sparkline
              data={sparkData}
              variant={tile.sparklineVariant ?? "area"}
              // Default to the tile's text color (which already adapts to the
              // fill/threshold for contrast); an explicit color overrides it.
              color={
                tile.sparklineColor ??
                contentTextColor ??
                Colors.Text.Neutral.Default
              }
              width="100%"
              height={Math.max(18, Math.min(46, Math.round(tile.height * 0.3)))}
            />
          </div>
        )}
      </div>
      ) : null}

      {editable && selected && (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-label="Resize tile"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            zIndex: 2,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            background: `linear-gradient(135deg, transparent 50%, ${Colors.Border.Primary.Default} 50%)`,
          }}
        />
      )}
    </div>
  );
};

function tileFontSize(width: number, height: number): number {
  return Math.max(14, Math.min(34, Math.round(Math.min(width, height) / 5)));
}

/** Horizontal text alignment matching a value-block placement. */
function valueTextAlign(position: ValuePosition): "left" | "right" | "center" {
  if (position === "left") return "left";
  if (position === "right") return "right";
  return "center";
}

/**
 * Absolute-positioned box for the value + label, anchored per {@link
 * ValuePosition}. Center overlays the whole tile (original behavior). When
 * `reserve` is true (outline icons with an off-center value), the block takes
 * its own band — the complement of the shrunk icon's region — so the value and
 * label sit in dedicated blank space, fully separated from the graphic. Without
 * `reserve` the block is edge-anchored and overlays the shape.
 */
function valueBlockStyle(
  position: ValuePosition,
  reserve: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: 4,
    boxSizing: "border-box",
    justifyContent: "center",
    pointerEvents: "none",
  };
  if (reserve) {
    // Occupy the band opposite the shrunk icon (see iconInset in MetricTile).
    switch (position) {
      case "bottom":
        return { ...base, left: 0, right: 0, bottom: 0, height: "38%", alignItems: "center" };
      case "left":
        return { ...base, left: 0, top: 0, bottom: 0, width: "50%", alignItems: "center" };
      case "right":
        return { ...base, right: 0, top: 0, bottom: 0, width: "50%", alignItems: "center" };
    }
  }
  switch (position) {
    case "bottom":
      return { ...base, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", alignItems: "center" };
    case "left":
      return { ...base, left: 0, top: 0, bottom: 0, maxWidth: "55%", alignItems: "flex-start" };
    case "right":
      return { ...base, right: 0, top: 0, bottom: 0, maxWidth: "55%", alignItems: "flex-end" };
    case "center":
    default:
      return { ...base, inset: 0, alignItems: "center" };
  }
}

/** Open a tile's drill-down link in a new browser tab. */
function openTileLink(link: TileLink): void {
  const href =
    link.type === "url" ? normalizeUrl(link.target) : buildViewHref(link.target);
  window.open(href, "_blank", "noopener,noreferrer");
}

/** Ensure a user-entered URL has a scheme so it isn't treated as relative. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Build an absolute URL to another canvas within this app, so it can open in a
 * new tab. Derives the app base from the current location's `/ui` segment and
 * preserves any platform query parameters.
 */
function buildViewHref(viewId: string): string {
  const url = new URL(window.location.href);
  const route = `/view/${encodeURIComponent(viewId)}`;
  if (/\/ui(\/|$)/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/(\/ui)(\/.*)?$/, `$1${route}`);
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, "")}${route}`;
  }
  return url.toString();
}
