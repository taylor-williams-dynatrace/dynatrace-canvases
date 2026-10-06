/**
 * Data model for the "Metrics Graphical View" feature.
 *
 * A view is persisted in the Dynatrace Document Service as a JSON document of
 * type {@link VIEW_DOC_TYPE}. The background image is stored as a *separate*
 * binary document of type {@link BG_DOC_TYPE} and referenced by its id, so the
 * (small) view JSON stays well below document size limits.
 */

/** Document Service `type` used to tag and list saved views. */
export const VIEW_DOC_TYPE = "metrics-graphic-view";

/** Document Service `type` used for uploaded background images. */
export const BG_DOC_TYPE = "metrics-graphic-background";

/** Current schema version of the persisted view JSON. */
export const VIEW_SCHEMA_VERSION = 1 as const;

/** Aggregation applied to a metric when computing the tile's single value. */
export type AggregationType = "avg" | "sum" | "min" | "max" | "count";

/**
 * How a DQL tile renders its result:
 *  - "value": a single scalar value (the default).
 *  - "table": a full table built from the returned rows and selected columns.
 *  - "bar": a timeseries bar chart (needs a timeseries-shaped query).
 *  - "categorical": a categorical bar chart of one measure grouped by one
 *    dimension (needs a `summarize … by:{…}`-shaped query).
 */
export type DqlDisplay =
  | "value"
  | "table"
  | "line"
  | "area"
  | "bar"
  | "categorical"
  | "pie"
  | "donut";

export const DQL_DISPLAY_OPTIONS: { value: DqlDisplay; label: string }[] = [
  { value: "value", label: "Single value" },
  { value: "table", label: "Table" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bar", label: "Bar" },
  { value: "categorical", label: "Categorical" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
];

export const DEFAULT_DQL_DISPLAY: DqlDisplay = "value";

/**
 * "Panel" display modes render inside a bordered tile with a caption strip
 * (table and charts), as opposed to the single-value/shape tiles. They share
 * sizing defaults and skip shape/threshold/value styling.
 */
export function isPanelDisplay(display: DqlDisplay | undefined): boolean {
  return (
    display === "table" ||
    display === "line" ||
    display === "area" ||
    display === "bar" ||
    display === "categorical" ||
    display === "pie" ||
    display === "donut"
  );
}

/** Bar orientation for the categorical chart (maps to Strato `layout`). */
export type CategoricalLayout = "vertical" | "horizontal";
/** Bar grouping for the categorical chart (maps to Strato `groupMode`). */
export type CategoricalGroupMode = "stacked" | "grouped";
/** Legend placement (maps to Strato legend `position`). */
export type CategoricalLegendPosition = "auto" | "bottom" | "right";
/** Label truncation (maps to Strato `truncationMode`). */
export type CategoricalTruncation = "end" | "middle" | "start";
/** Tooltip content (maps to Strato tooltip `variant`). */
export type CategoricalTooltipVariant = "single" | "grouped";
/** Value-axis scale (maps to Strato value axis `scale`). */
export type CategoricalAxisScale = "linear" | "log";
/** Value representation (maps to Strato `valueRepresentation`). */
export type CategoricalValueRepresentation = "absolute" | "relative";
/** Axis bound mode: automatic or a user-entered number. */
export type CategoricalAxisBoundMode = "auto" | "custom";
/** Bar coloring (maps to Strato `colorPaletteMode`). */
export type CategoricalColorMode = "single-color" | "multi-color";

export const CATEGORICAL_LAYOUT_OPTIONS: {
  value: CategoricalLayout;
  label: string;
}[] = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
];

export const CATEGORICAL_GROUP_MODE_OPTIONS: {
  value: CategoricalGroupMode;
  label: string;
}[] = [
  { value: "stacked", label: "Stacked" },
  { value: "grouped", label: "Grouped" },
];

export const CATEGORICAL_LEGEND_POSITION_OPTIONS: {
  value: CategoricalLegendPosition;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "bottom", label: "Bottom" },
  { value: "right", label: "Right" },
];

// Labels mirror the Dashboards/Notebooks truncation control (A… / A…B / …B).
export const CATEGORICAL_TRUNCATION_OPTIONS: {
  value: CategoricalTruncation;
  label: string;
}[] = [
  { value: "end", label: "A…" },
  { value: "middle", label: "A…B" },
  { value: "start", label: "…B" },
];

export const CATEGORICAL_TOOLTIP_OPTIONS: {
  value: CategoricalTooltipVariant;
  label: string;
}[] = [
  { value: "single", label: "Single" },
  { value: "grouped", label: "Grouped" },
];

export const CATEGORICAL_AXIS_SCALE_OPTIONS: {
  value: CategoricalAxisScale;
  label: string;
}[] = [
  { value: "linear", label: "Linear" },
  { value: "log", label: "Log" },
];

export const CATEGORICAL_VALUE_REPRESENTATION_OPTIONS: {
  value: CategoricalValueRepresentation;
  label: string;
}[] = [
  { value: "absolute", label: "Absolute" },
  { value: "relative", label: "Relative" },
];

export const CATEGORICAL_AXIS_BOUND_OPTIONS: {
  value: CategoricalAxisBoundMode;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
];

export const CATEGORICAL_COLOR_MODE_OPTIONS: {
  value: CategoricalColorMode;
  label: string;
}[] = [
  { value: "single-color", label: "Single color" },
  { value: "multi-color", label: "Multi-color" },
];

/**
 * All display options for a categorical bar-chart tile, mirroring the
 * Dashboards/Notebooks categorical viz config (Bars, Legend & tooltip, axes,
 * colors). Every field is optional; DEFAULT_CATEGORICAL_OPTIONS supplies the
 * resting values, which match Strato's own CategoricalBarChart defaults.
 */
export interface CategoricalChartOptions {
  layout?: CategoricalLayout;
  groupMode?: CategoricalGroupMode;
  legendHidden?: boolean;
  legendPosition?: CategoricalLegendPosition;
  truncationMode?: CategoricalTruncation;
  tooltipVariant?: CategoricalTooltipVariant;
  valueAxisLabelEnabled?: boolean;
  valueAxisLabel?: string;
  valueAxisScale?: CategoricalAxisScale;
  valueRepresentation?: CategoricalValueRepresentation;
  valueAxisMinMode?: CategoricalAxisBoundMode;
  valueAxisMin?: number;
  valueAxisMaxMode?: CategoricalAxisBoundMode;
  valueAxisMax?: number;
  categoryAxisLabelEnabled?: boolean;
  categoryAxisLabel?: string;
  colorMode?: CategoricalColorMode;
}

export const DEFAULT_CATEGORICAL_OPTIONS: Required<CategoricalChartOptions> = {
  layout: "vertical",
  groupMode: "stacked",
  legendHidden: false,
  legendPosition: "auto",
  truncationMode: "end",
  tooltipVariant: "single",
  valueAxisLabelEnabled: false,
  valueAxisLabel: "",
  valueAxisScale: "linear",
  valueRepresentation: "absolute",
  valueAxisMinMode: "auto",
  valueAxisMin: 0,
  valueAxisMaxMode: "auto",
  valueAxisMax: 100,
  categoryAxisLabelEnabled: false,
  categoryAxisLabel: "",
  colorMode: "single-color",
};

/* ---------- Timeseries chart (line / bar / area) options ----------
 * Shared across the TimeseriesChart family. Line uses all of these; Bar/Area
 * will reuse this module (Bar hides the line-only Curve/Points controls). */

/** Line interpolation (maps to Strato `curve`). */
export type LineCurve = "linear" | "smooth";
/** Data-point display (maps to Strato `pointsDisplay`). */
export type TimeseriesPointsDisplay = "auto" | "always" | "never";
/** Legend placement (maps to Strato legend `position`). */
export type TimeseriesLegendPosition = "auto" | "bottom" | "right";
/** Label truncation (maps to Strato `truncationMode`). */
export type TimeseriesTruncation = "end" | "middle" | "start";
/** Tooltip content (maps to Strato timeseries tooltip `variant`). */
export type TimeseriesTooltipVariant = "single" | "shared";
/** Value-axis scale (maps to Strato Y-axis `scale`). */
export type TimeseriesAxisScale = "linear" | "log";
/** Value representation (maps to Strato `valueRepresentation`). */
export type TimeseriesValueRepresentation = "absolute" | "relative";
/** Axis bound mode: automatic or a user-entered number. */
export type TimeseriesAxisBoundMode = "auto" | "custom";

export const LINE_CURVE_OPTIONS: { value: LineCurve; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "smooth", label: "Smooth" },
];

export const TIMESERIES_POINTS_OPTIONS: {
  value: TimeseriesPointsDisplay;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
];

export const TIMESERIES_LEGEND_POSITION_OPTIONS: {
  value: TimeseriesLegendPosition;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "bottom", label: "Bottom" },
  { value: "right", label: "Right" },
];

export const TIMESERIES_TRUNCATION_OPTIONS: {
  value: TimeseriesTruncation;
  label: string;
}[] = [
  { value: "end", label: "A…" },
  { value: "middle", label: "A…B" },
  { value: "start", label: "…B" },
];

export const TIMESERIES_TOOLTIP_OPTIONS: {
  value: TimeseriesTooltipVariant;
  label: string;
}[] = [
  { value: "single", label: "Single" },
  { value: "shared", label: "Shared" },
];

export const TIMESERIES_AXIS_SCALE_OPTIONS: {
  value: TimeseriesAxisScale;
  label: string;
}[] = [
  { value: "linear", label: "Linear" },
  { value: "log", label: "Log" },
];

export const TIMESERIES_VALUE_REPRESENTATION_OPTIONS: {
  value: TimeseriesValueRepresentation;
  label: string;
}[] = [
  { value: "absolute", label: "Absolute" },
  { value: "relative", label: "Relative" },
];

export const TIMESERIES_AXIS_BOUND_OPTIONS: {
  value: TimeseriesAxisBoundMode;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
];

/**
 * Display options for a timeseries chart tile (line/bar/area), mirroring the
 * Dashboards/Notebooks timeseries viz config. Line-only fields (curve, points)
 * are ignored by the Bar variant.
 */
export interface TimeseriesChartOptions {
  curve?: LineCurve;
  pointsDisplay?: TimeseriesPointsDisplay;
  /** Connect across missing data points (maps to Strato `gapPolicy`
   *  'connect' vs 'gap'). */
  connectDataPoints?: boolean;
  legendHidden?: boolean;
  legendPosition?: TimeseriesLegendPosition;
  truncationMode?: TimeseriesTruncation;
  tooltipVariant?: TimeseriesTooltipVariant;
  valueAxisLabelEnabled?: boolean;
  valueAxisLabel?: string;
  valueAxisScale?: TimeseriesAxisScale;
  valueRepresentation?: TimeseriesValueRepresentation;
  valueAxisMinMode?: TimeseriesAxisBoundMode;
  valueAxisMin?: number;
  valueAxisMaxMode?: TimeseriesAxisBoundMode;
  valueAxisMax?: number;
  timeAxisLabelEnabled?: boolean;
  timeAxisLabel?: string;
}

/* ---------- Pie / Donut chart options ----------
 * Shared across the pie/donut family (categorical-shaped data: dimension +
 * measure). Both charts render the same {category, value} slices. */

/** Legend placement (maps to Strato legend `position`). */
export type PieLegendPosition = "auto" | "bottom" | "right";
/** Label truncation (maps to Strato `truncationMode`). */
export type PieTruncation = "end" | "middle" | "start";
/** Slice label value display (maps to Strato Labels `valueType`). */
export type PieLabelValueType = "relative" | "absolute";

export const PIE_LEGEND_POSITION_OPTIONS: {
  value: PieLegendPosition;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "bottom", label: "Bottom" },
  { value: "right", label: "Right" },
];

export const PIE_TRUNCATION_OPTIONS: {
  value: PieTruncation;
  label: string;
}[] = [
  { value: "end", label: "A…" },
  { value: "middle", label: "A…B" },
  { value: "start", label: "…B" },
];

export const PIE_LABEL_VALUE_TYPE_OPTIONS: {
  value: PieLabelValueType;
  label: string;
}[] = [
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
];

/**
 * Display options for a pie/donut chart tile, mirroring the
 * Dashboards/Notebooks pie viz config (Legend, Labels).
 */
export interface PieChartOptions {
  legendHidden?: boolean;
  legendPosition?: PieLegendPosition;
  truncationMode?: PieTruncation;
  labelsHidden?: boolean;
  labelValueType?: PieLabelValueType;
}

export const DEFAULT_PIE_OPTIONS: Required<PieChartOptions> = {
  legendHidden: false,
  legendPosition: "auto",
  truncationMode: "end",
  labelsHidden: false,
  labelValueType: "relative",
};

export const DEFAULT_TIMESERIES_OPTIONS: Required<TimeseriesChartOptions> = {
  curve: "linear",
  pointsDisplay: "auto",
  connectDataPoints: false,
  legendHidden: false,
  legendPosition: "auto",
  truncationMode: "end",
  tooltipVariant: "single",
  valueAxisLabelEnabled: false,
  valueAxisLabel: "",
  valueAxisScale: "linear",
  valueRepresentation: "absolute",
  valueAxisMinMode: "auto",
  valueAxisMin: 0,
  valueAxisMaxMode: "auto",
  valueAxisMax: 100,
  timeAxisLabelEnabled: false,
  timeAxisLabel: "",
};

/** Visual shape of a metric tile. */
export type TileShape =
  | "rectangle"
  | "rounded"
  | "circle"
  | "triangle"
  | "diamond"
  | "cloud"
  | "server"
  | "application"
  | "database"
  | "user"
  | "users"
  | "globe"
  | "laptop"
  | "mobile"
  | "document"
  | "shield"
  | "line"
  | "arrow";

/** Extra shapes offered only for static shape tiles (not data-driven tiles). */
export const STATIC_ONLY_SHAPES: { value: TileShape; label: string }[] = [
  { value: "line", label: "Line" },
];

/**
 * Where a tile's value + label are placed within the tile. Mostly matters for
 * outline (icon) shapes, whose busy geometry makes a centered value hard to
 * read — moving it to an edge keeps it legible.
 */
export type ValuePosition = "center" | "left" | "right" | "bottom";

export const VALUE_POSITION_OPTIONS: { value: ValuePosition; label: string }[] =
  [
    { value: "center", label: "Center" },
    { value: "bottom", label: "Bottom" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ];

export const DEFAULT_VALUE_POSITION: ValuePosition = "center";

/** Which ends of a line/arrow have arrowheads. */
export type LineArrows = "none" | "start" | "end" | "both";

export const LINE_ARROW_OPTIONS: { value: LineArrows; label: string }[] = [
  { value: "none", label: "None" },
  { value: "end", label: "End" },
  { value: "start", label: "Start" },
  { value: "both", label: "Both ends" },
];

/** True for stroke-based shapes (line/arrow) that stretch to the tile box. */
export function isLineTileShape(shape: TileShape): boolean {
  return shape === "line" || shape === "arrow";
}

export const TILE_SHAPES: { value: TileShape; label: string }[] = [
  { value: "rectangle", label: "Rectangle" },
  { value: "rounded", label: "Rounded rectangle" },
  { value: "circle", label: "Circle / ellipse" },
  { value: "triangle", label: "Triangle" },
  { value: "diamond", label: "Diamond" },
  { value: "cloud", label: "Cloud" },
  { value: "server", label: "Server" },
  { value: "application", label: "Application" },
  { value: "database", label: "Database" },
  { value: "user", label: "User" },
  { value: "users", label: "Users" },
  { value: "globe", label: "Globe" },
  { value: "laptop", label: "Laptop" },
  { value: "mobile", label: "Mobile" },
  { value: "document", label: "Document" },
  { value: "shield", label: "Shield" },
];

export const DEFAULT_TILE_SHAPE: TileShape = "rectangle";

/** The original geometric shapes, rendered as solid fills on the canvas. */
const SOLID_TILE_SHAPES = new Set<TileShape>([
  "rectangle",
  "rounded",
  "circle",
  "triangle",
  "diamond",
  "cloud",
]);

/**
 * Whether a shape is drawn as a clean outline icon (threshold-colored lines +
 * subtle fill) rather than a solid fill. True for the icon shapes (server,
 * database, user, globe, …), false for the basic geometric shapes.
 */
export function isOutlineTileShape(shape: TileShape): boolean {
  return !SOLID_TILE_SHAPES.has(shape);
}

export const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: "avg", label: "Average" },
  { value: "sum", label: "Sum" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
  { value: "count", label: "Count" },
];

/** Lookback window over which a tile's value is aggregated (DQL `from:` value). */
export type LookbackWindow = "-5m" | "-15m" | "-1h";

export const LOOKBACK_OPTIONS: { value: LookbackWindow; label: string }[] = [
  { value: "-5m", label: "Last 5 minutes" },
  { value: "-15m", label: "Last 15 minutes" },
  { value: "-1h", label: "Last 1 hour" },
];

export const DEFAULT_LOOKBACK: LookbackWindow = "-15m";

/** Trend window a metric tile's sparkline covers (independent of the value's aggregation window). */
export type SparklineWindow = "-1h" | "-6h" | "-24h" | "-7d";

export const SPARKLINE_WINDOW_OPTIONS: {
  value: SparklineWindow;
  label: string;
}[] = [
  { value: "-1h", label: "Last 1 hour" },
  { value: "-6h", label: "Last 6 hours" },
  { value: "-24h", label: "Last 24 hours" },
  { value: "-7d", label: "Last 7 days" },
];

export const DEFAULT_SPARKLINE_WINDOW: SparklineWindow = "-6h";

/** Sparkline visual style. */
export type SparklineVariant = "area" | "line";

export const SPARKLINE_VARIANT_OPTIONS: {
  value: SparklineVariant;
  label: string;
}[] = [
  { value: "area", label: "Area" },
  { value: "line", label: "Line" },
];

export const DEFAULT_SPARKLINE_VARIANT: SparklineVariant = "area";

/** A single dimension filter applied to a metric, e.g. dt.entity.host == "HOST-1". */
export interface TileFilter {
  /** Dimension key, e.g. `dt.entity.host`. */
  dimension: string;
  /** Dimension value to match. */
  value: string;
}

/** Comparison used by a threshold rule. */
export type ThresholdComparator = "gte" | "gt" | "lte" | "lt" | "eq";

export const COMPARATORS: { value: ThresholdComparator; label: string }[] = [
  { value: "gte", label: "≥" },
  { value: "gt", label: ">" },
  { value: "lte", label: "≤" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
];

/**
 * A color threshold for a tile. When the tile's live value satisfies the
 * comparator against `value`, the tile is rendered in `color`. Rules are
 * evaluated in list order and the first match wins.
 */
export interface Threshold {
  id: string;
  comparator: ThresholdComparator;
  value: number;
  /** Any valid CSS color; typically a hex string. */
  color: string;
}

/**
 * Suggested palette for threshold colors, aligned with Dynatrace design tokens
 * (Charts `Status`/`Threshold`/`Apdex` semantic palettes). Stored as hex so the
 * color picker and text-contrast logic keep working.
 * @see https://developer.dynatrace.com/design/design-tokens/Colors/
 */
export const THRESHOLD_COLOR_PRESETS: { color: string; label: string }[] = [
  { color: "#2a7453", label: "Healthy" }, // Charts.Threshold.Good
  { color: "#eea53c", label: "Warning" }, // Charts.Status.Warning
  { color: "#d56b1a", label: "Degraded" }, // Charts.Apdex.Poor
  { color: "#c62239", label: "Critical" }, // Charts.Status.Critical
  { color: "#134fc9", label: "Info" }, // Charts.Categorical.Color01
  { color: "#5b5c81", label: "Neutral" }, // Charts.Status.Neutral
];

/**
 * Optional drill-down link attached to a tile. `view` links to another saved
 * canvas (by document id); `url` links to an arbitrary external URL.
 */
export interface TileLink {
  type: "view" | "url";
  /** For `view`: the target view document id. For `url`: the URL string. */
  target: string;
}

/**
 * What a tile displays: an existing platform metric (with aggregation / window
 * / filters), a user-supplied custom DQL query, static markdown text, or a
 * purely decorative static shape (no data).
 */
export type TileSource = "metric" | "dql" | "markdown" | "shape";

/** A metric value tile positioned on top of the background image. */
export interface MetricTile {
  /** Stable client-generated id. */
  id: string;
  /** Value source (defaults to "metric" for backward compatibility). */
  source?: TileSource;
  /** Metric key, e.g. `dt.host.cpu.usage`. Used when source is "metric". */
  metricKey?: string;
  /** Aggregation used to compute the displayed value (metric source). */
  aggregation?: AggregationType;
  /** Custom DQL query. Used when source is "dql". */
  dql?: string;
  /** How a DQL tile renders its result: single value (default) or table. */
  dqlDisplay?: DqlDisplay;
  /**
   * Ordered list of result field keys to show as columns (DQL table display).
   * Empty/undefined falls back to every field the query returns.
   */
  tableColumns?: string[];
  /** Display options for the categorical bar-chart tile (layout, legend, axes, colors). */
  categoricalOptions?: CategoricalChartOptions;
  /** Display options for a timeseries chart tile (line/bar): lines, legend, axes. */
  timeseriesOptions?: TimeseriesChartOptions;
  /** Display options for a pie/donut chart tile: legend, labels. */
  pieOptions?: PieChartOptions;
  /** Markdown text content. Used when source is "markdown". */
  markdown?: string;
  /** Visual shape of the tile (defaults to rectangle). */
  shape?: TileShape;
  /** Clockwise rotation of the tile in degrees (0–359, defaults to 0). */
  rotation?: number;
  /** Line/arrow thickness in px (line shapes only, defaults to 4). */
  lineWeight?: number;
  /** Whether a line/arrow is dashed (line shapes only). */
  lineDashed?: boolean;
  /** Which ends of a line have arrowheads (line shapes only). */
  lineArrows?: LineArrows;
  /** When true, hide the value/label and show only the shape + threshold color. */
  shapeOnly?: boolean;
  /** When true, render no shape/background — just the text/value over the canvas. */
  transparent?: boolean;
  /** Static background/fill color (hex). Used as the resting fill; a matching
   *  threshold color still overrides it at runtime. */
  backgroundColor?: string;
  /** Lookback window the value is aggregated over (metric source). */
  lookback?: LookbackWindow;
  /** Show a trend sparkline under the value (metric source only). */
  sparkline?: boolean;
  /** Time window the sparkline covers (metric source). */
  sparklineWindow?: SparklineWindow;
  /** Sparkline visual style (area/line). */
  sparklineVariant?: SparklineVariant;
  /** Optional sparkline color (hex); defaults to the threshold/status color. */
  sparklineColor?: string;
  /** Optional dimension filters narrowing the metric (metric source). */
  filters: TileFilter[];
  /** Optional color thresholds, evaluated in order (first match wins). */
  thresholds?: Threshold[];
  /** Where the value + label are placed within the tile (defaults to center). */
  valuePosition?: ValuePosition;
  /** Optional user-facing label (defaults to the metric key). */
  label?: string;
  /** Optional unit suffix shown next to the value. */
  unit?: string;
  /** Optional drill-down link opened when the tile is clicked in view mode. */
  link?: TileLink;
  /** X position in pixels, relative to the canvas top-left. */
  x: number;
  /** Y position in pixels, relative to the canvas top-left. */
  y: number;
  /** Tile width in pixels. */
  width: number;
  /** Tile height in pixels. */
  height: number;
}

/** The full persisted view payload (stored as the document content). */
export interface MetricsGraphicView {
  schemaVersion: typeof VIEW_SCHEMA_VERSION;
  /** Display name (mirrors the document metadata name). */
  name: string;
  /**
   * Background image embedded as a data URL (e.g. `data:image/png;base64,…`).
   * Embedding keeps the image inside the (shareable) view document so it loads
   * for every user who can read the view — unlike a separate binary document,
   * which does not round-trip reliably across users.
   */
  backgroundImage?: string | null;
  /**
   * Legacy: id of a separate background-image document. Kept for backward
   * compatibility with views created before images were embedded. New/updated
   * views use {@link backgroundImage} instead.
   */
  backgroundDocId?: string | null;
  /** Natural pixel width of the background image, if known. */
  backgroundWidth?: number;
  /** Natural pixel height of the background image, if known. */
  backgroundHeight?: number;
  /** Metric tiles placed on the canvas. */
  tiles: MetricTile[];
}

/**
 * Maximum accepted background image file size. Base64 inflates by ~33%, so this
 * keeps the embedded view document comfortably under the 50 MB document limit.
 */
export const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;

/** A view together with its document id and optimistic-locking version. */
export interface LoadedView {
  id: string;
  version: string;
  name: string;
  view: MetricsGraphicView;
  /** Whether the current user may edit this view (owner / write access). */
  canEdit: boolean;
  /**
   * Whether the view is private (readable only by the owner and explicit
   * share recipients). When false, the view is public to the whole environment.
   */
  isPrivate: boolean;
  /** Whether the current user may manage sharing (owner / delete access). */
  canShare: boolean;
}

/** Default tile dimensions when a metric is first added. */
export const DEFAULT_TILE_SIZE = 140;

/**
 * Starting size (px) for a **blank** canvas — one created without a background
 * image. Image canvases take their size from the image instead. This gives a
 * blank canvas plenty of room to place tiles from the start; it is persisted on
 * the view so the editor and any embedded renderer use it (and it can still be
 * changed later, e.g. by adding a background image).
 */
export const DEFAULT_BLANK_CANVAS = { width: 1920, height: 1080 };

/** Create an empty view payload (a blank canvas at {@link DEFAULT_BLANK_CANVAS}). */
export function createEmptyView(name: string): MetricsGraphicView {
  return {
    schemaVersion: VIEW_SCHEMA_VERSION,
    name,
    backgroundDocId: null,
    backgroundWidth: DEFAULT_BLANK_CANVAS.width,
    backgroundHeight: DEFAULT_BLANK_CANVAS.height,
    tiles: [],
  };
}

/** Generate a reasonably unique id for tiles. */
export function generateId(prefix = "tile"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
