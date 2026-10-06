import React, { useEffect, useMemo, useState } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { RunQueryButton, type QueryStateType } from "@dynatrace/strato-components-preview/buttons";
import { CodeEditor, DQLEditor } from "@dynatrace/strato-components-preview/editors";
import {
  BarChartGroupedIcon,
  BarChartIcon,
  ColoringIcon,
  CurveLinearIcon,
  CurveSmoothIcon,
  HorizontalBarChartIcon,
  LabelIcon,
  LineChartIcon,
  ListIcon,
  PlusIcon,
  StackedBarChartIcon,
  XAxisIcon,
  YAxisLeftIcon,
  type SvgIconProps,
} from "@dynatrace/strato-icons";
import { Switch } from "@dynatrace/strato-components/forms";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { DocumentMetaData } from "@dynatrace-sdk/client-document";
import {
  AGGREGATIONS,
  CATEGORICAL_AXIS_BOUND_OPTIONS,
  CATEGORICAL_AXIS_SCALE_OPTIONS,
  CATEGORICAL_COLOR_MODE_OPTIONS,
  CATEGORICAL_GROUP_MODE_OPTIONS,
  CATEGORICAL_LAYOUT_OPTIONS,
  CATEGORICAL_LEGEND_POSITION_OPTIONS,
  CATEGORICAL_TOOLTIP_OPTIONS,
  CATEGORICAL_TRUNCATION_OPTIONS,
  CATEGORICAL_VALUE_REPRESENTATION_OPTIONS,
  DEFAULT_CATEGORICAL_OPTIONS,
  DEFAULT_PIE_OPTIONS,
  DEFAULT_TIMESERIES_OPTIONS,
  PIE_LABEL_VALUE_TYPE_OPTIONS,
  PIE_LEGEND_POSITION_OPTIONS,
  PIE_TRUNCATION_OPTIONS,
  LINE_CURVE_OPTIONS,
  TIMESERIES_AXIS_BOUND_OPTIONS,
  TIMESERIES_AXIS_SCALE_OPTIONS,
  TIMESERIES_LEGEND_POSITION_OPTIONS,
  TIMESERIES_POINTS_OPTIONS,
  TIMESERIES_TOOLTIP_OPTIONS,
  TIMESERIES_TRUNCATION_OPTIONS,
  TIMESERIES_VALUE_REPRESENTATION_OPTIONS,
  DEFAULT_DQL_DISPLAY,
  DEFAULT_LOOKBACK,
  DEFAULT_TILE_SHAPE,
  DEFAULT_VALUE_POSITION,
  DEFAULT_SPARKLINE_VARIANT,
  DEFAULT_SPARKLINE_WINDOW,
  DQL_DISPLAY_OPTIONS,
  generateId,
  isLineTileShape,
  isOutlineTileShape,
  LINE_ARROW_OPTIONS,
  LOOKBACK_OPTIONS,
  SPARKLINE_VARIANT_OPTIONS,
  SPARKLINE_WINDOW_OPTIONS,
  STATIC_ONLY_SHAPES,
  THRESHOLD_COLOR_PRESETS,
  TILE_SHAPES,
  VALUE_POSITION_OPTIONS,
  type AggregationType,
  type CategoricalAxisBoundMode,
  type CategoricalAxisScale,
  type CategoricalChartOptions,
  type CategoricalColorMode,
  type CategoricalGroupMode,
  type CategoricalLayout,
  type CategoricalLegendPosition,
  type CategoricalTooltipVariant,
  type CategoricalTruncation,
  type CategoricalValueRepresentation,
  type DqlDisplay,
  type LineArrows,
  type LineCurve,
  type PieChartOptions,
  type PieLabelValueType,
  type PieLegendPosition,
  type PieTruncation,
  type TimeseriesAxisBoundMode,
  type TimeseriesAxisScale,
  type TimeseriesChartOptions,
  type TimeseriesLegendPosition,
  type TimeseriesPointsDisplay,
  type TimeseriesTooltipVariant,
  type TimeseriesTruncation,
  type TimeseriesValueRepresentation,
  type LookbackWindow,
  type SparklineVariant,
  type SparklineWindow,
  type Threshold,
  type TileFilter,
  type TileLink,
  type TileShape,
  type TileSource,
  type ValuePosition,
} from "../types/metricsView";
import { convertToTimeseries } from "@dynatrace/strato-components/charts";
import {
  dimensionKeysFromRecord,
  dimensionProbeQuery,
  readDqlCell,
  validateDqlCategorical,
  validateDqlResult,
  validateDqlTable,
} from "../services/metricsQuery";
import { listViews } from "../services/documentService";
import { ColumnPicker } from "./ColumnPicker";
import { ConfigSection } from "./ConfigSection";
import { FilterRow } from "./FilterRow";
import { ThresholdRow } from "./ThresholdRow";
import { NativeInput } from "./NativeField";
import { SelectField } from "./SelectField";
import { VizDisplayPicker } from "./VizDisplayPicker";
import { ShapeGlyph } from "./TileShapeLayer";

export interface TileConfig {
  source: TileSource;
  metricKey?: string;
  aggregation?: AggregationType;
  lookback?: LookbackWindow;
  sparkline?: boolean;
  sparklineWindow?: SparklineWindow;
  sparklineVariant?: SparklineVariant;
  sparklineColor?: string;
  dql?: string;
  dqlDisplay?: DqlDisplay;
  tableColumns?: string[];
  categoricalOptions?: CategoricalChartOptions;
  timeseriesOptions?: TimeseriesChartOptions;
  pieOptions?: PieChartOptions;
  markdown?: string;
  shape: TileShape;
  rotation?: number;
  lineWeight?: number;
  lineDashed?: boolean;
  lineArrows?: LineArrows;
  shapeOnly: boolean;
  transparent: boolean;
  backgroundColor?: string;
  valuePosition?: ValuePosition;
  filters: TileFilter[];
  thresholds: Threshold[];
  label?: string;
  unit?: string;
  link?: TileLink;
}

type LinkChoice = "none" | "view" | "url";
type TestState = { status: "idle" | "running" | "ok" | "error"; message: string };

interface TileConfigFormProps {
  /** Whether the tile is metric-based or uses a custom DQL query. */
  source: TileSource;
  /** Metric key (metric source only). */
  metricKey?: string;
  initial?: Partial<TileConfig>;
  submitLabel: string;
  /** Current view's id, excluded from the drill-down canvas list. */
  currentViewId?: string;
  onSubmit: (config: TileConfig) => void;
  onCancel?: () => void;
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: Colors.Text.Neutral.Default,
};

/** Subdued helper text under a config control. */
const configHintStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: Colors.Text.Neutral.Subdued,
};

/** Inline checkbox + label row used for boolean toggles in the config form. */
const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  color: Colors.Text.Neutral.Default,
  cursor: "pointer",
};

/** Clamp/normalize a user-entered rotation string into 0–359 degrees. */
function normalizeAngle(input: string): number {
  const n = Math.round(Number(input));
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

/** Color of the shape picker glyphs and captions (light / dark mode). */
const SHAPE_PICKER_COLOR_LIGHT = "#3b3fbe";
const SHAPE_PICKER_COLOR_DARK = "#b8bbff";

/** Compact captions for the shape picker buttons. */
const SHORT_SHAPE_LABELS: Record<TileShape, string> = {
  rectangle: "Rectangle",
  rounded: "Rounded",
  circle: "Circle",
  triangle: "Triangle",
  diamond: "Diamond",
  cloud: "Cloud",
  server: "Server",
  application: "App",
  database: "Database",
  user: "User",
  users: "Users",
  globe: "Globe",
  laptop: "Laptop",
  mobile: "Mobile",
  document: "Document",
  shield: "Shield",
  line: "Line",
  arrow: "Arrow",
};

type IconComponent = React.ComponentType<SvgIconProps>;

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  Icon?: IconComponent;
}

/**
 * A connected segmented control (icon + label per segment) matching the
 * Dashboards/Notebooks chart-option toggles. The selected segment sits on the
 * surface with a subtle shadow; the others recede into the container fill.
 */
function SegmentedControl<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        // Hug the buttons rather than stretch across the panel (the parent is a
        // flex column, which would otherwise stretch this to full width).
        alignSelf: "flex-start",
        padding: 2,
        gap: 2,
        borderRadius: 6,
        background: Colors.Background.Container.Neutral.Default,
        border: `1px solid ${Colors.Border.Neutral.Default}`,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: 4,
              border: "none",
              color: Colors.Text.Neutral.Default,
              background: selected
                ? Colors.Background.Surface.Default
                : "transparent",
              boxShadow: selected
                ? "0 1px 2px rgba(0,0,0,0.18)"
                : "none",
            }}
          >
            {o.Icon && (
              <span style={{ display: "inline-flex" }}>
                <o.Icon size={16} />
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const TileConfigForm: React.FC<TileConfigFormProps> = ({
  source,
  metricKey,
  initial,
  submitLabel,
  currentViewId,
  onSubmit,
  onCancel,
}) => {
  const isDql = source === "dql";
  const isMarkdown = source === "markdown";
  const isShape = source === "shape";
  const shapePickerColor =
    useCurrentTheme() === "dark"
      ? SHAPE_PICKER_COLOR_DARK
      : SHAPE_PICKER_COLOR_LIGHT;
  const [aggregation, setAggregation] = useState<AggregationType>(
    initial?.aggregation ?? "avg",
  );
  const [lookback, setLookback] = useState<LookbackWindow>(
    initial?.lookback ?? DEFAULT_LOOKBACK,
  );
  const [sparkline, setSparkline] = useState<boolean>(initial?.sparkline ?? false);
  const [sparklineWindow, setSparklineWindow] = useState<SparklineWindow>(
    initial?.sparklineWindow ?? DEFAULT_SPARKLINE_WINDOW,
  );
  const [sparklineVariant, setSparklineVariant] = useState<SparklineVariant>(
    initial?.sparklineVariant ?? DEFAULT_SPARKLINE_VARIANT,
  );
  // Empty string means "auto" — match the tile's text color.
  const [sparklineColor, setSparklineColor] = useState<string>(
    initial?.sparklineColor ?? "",
  );
  const [dql, setDql] = useState<string>(initial?.dql ?? "");
  const [dqlDisplay, setDqlDisplay] = useState<DqlDisplay>(
    initial?.dqlDisplay ?? DEFAULT_DQL_DISPLAY,
  );
  const [tableColumns, setTableColumns] = useState<string[]>(
    initial?.tableColumns ?? [],
  );
  // All categorical chart options in one object; defaults fill any unset field.
  const [catOpts, setCatOpts] = useState<Required<CategoricalChartOptions>>({
    ...DEFAULT_CATEGORICAL_OPTIONS,
    ...initial?.categoricalOptions,
  });
  function setCat<K extends keyof CategoricalChartOptions>(
    key: K,
    value: Required<CategoricalChartOptions>[K],
  ): void {
    setCatOpts((prev) => ({ ...prev, [key]: value }));
  }
  // All timeseries (line) chart options in one object; defaults fill unset.
  const [tsOpts, setTsOpts] = useState<Required<TimeseriesChartOptions>>({
    ...DEFAULT_TIMESERIES_OPTIONS,
    ...initial?.timeseriesOptions,
  });
  function setTs<K extends keyof TimeseriesChartOptions>(
    key: K,
    value: Required<TimeseriesChartOptions>[K],
  ): void {
    setTsOpts((prev) => ({ ...prev, [key]: value }));
  }
  // All pie/donut chart options in one object; defaults fill unset.
  const [pieOpts, setPieOpts] = useState<Required<PieChartOptions>>({
    ...DEFAULT_PIE_OPTIONS,
    ...initial?.pieOptions,
  });
  function setPie<K extends keyof PieChartOptions>(
    key: K,
    value: Required<PieChartOptions>[K],
  ): void {
    setPieOpts((prev) => ({ ...prev, [key]: value }));
  }
  // Fields discovered from the last successful table test — the pool the column
  // picker chooses from. Seeded with any saved columns so the picker isn't empty
  // before the auto-test finishes when editing an existing table tile.
  const [tableFields, setTableFields] = useState<string[]>(
    initial?.tableColumns ?? [],
  );
  const [markdown, setMarkdown] = useState<string>(initial?.markdown ?? "");
  const [test, setTest] = useState<TestState>({ status: "idle", message: "" });
  const [shape, setShape] = useState<TileShape>(
    // Legacy "arrow" shape is now "line" with an end arrowhead.
    initial?.shape === "arrow" ? "line" : initial?.shape ?? DEFAULT_TILE_SHAPE,
  );
  const [rotation, setRotation] = useState<number>(initial?.rotation ?? 0);
  const [lineWeight, setLineWeight] = useState<number>(
    initial?.lineWeight ?? 4,
  );
  const [lineDashed, setLineDashed] = useState<boolean>(
    initial?.lineDashed ?? false,
  );
  const [lineArrows, setLineArrows] = useState<LineArrows>(
    initial?.lineArrows ?? (initial?.shape === "arrow" ? "end" : "none"),
  );
  const [shapeOnly, setShapeOnly] = useState<boolean>(
    initial?.shapeOnly ?? false,
  );
  const [valuePosition, setValuePosition] = useState<ValuePosition>(
    initial?.valuePosition ?? DEFAULT_VALUE_POSITION,
  );
  const [bgMode, setBgMode] = useState<"default" | "transparent" | "custom">(
    initial?.transparent
      ? "transparent"
      : initial?.backgroundColor
        ? "custom"
        : "default",
  );
  const [bgColor, setBgColor] = useState<string>(
    initial?.backgroundColor ?? "#134fc9",
  );
  // Table tiles reuse the tile `transparent` flag as a "show only gridlines &
  // values" toggle (no solid table block behind the cells).
  const [tableTransparent, setTableTransparent] = useState<boolean>(
    initial?.transparent ?? false,
  );
  const [filters, setFilters] = useState<TileFilter[]>(initial?.filters ?? []);
  const [thresholds, setThresholds] = useState<Threshold[]>(
    initial?.thresholds ?? [],
  );
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [unit, setUnit] = useState<string>(initial?.unit ?? "");

  const [linkChoice, setLinkChoice] = useState<LinkChoice>(
    initial?.link?.type ?? "none",
  );
  const [linkView, setLinkView] = useState<string>(
    initial?.link?.type === "view" ? initial.link.target : "",
  );
  const [linkUrl, setLinkUrl] = useState<string>(
    initial?.link?.type === "url" ? initial.link.target : "",
  );
  const [views, setViews] = useState<DocumentMetaData[] | null>(null);

  // Load the list of canvases lazily when the user chooses a canvas link.
  useEffect(() => {
    if (linkChoice !== "view" || views !== null) return;
    let active = true;
    listViews()
      .then((docs) => active && setViews(docs))
      .catch(() => active && setViews([]));
    return () => {
      active = false;
    };
  }, [linkChoice, views]);

  // Probe one series to discover this metric's dimension keys (metric source).
  const { data } = useDql(
    { query: metricKey ? dimensionProbeQuery(metricKey) : "" },
    { enabled: !isDql && Boolean(metricKey) },
  );

  const dimensionOptions = useMemo(() => {
    const records =
      (data?.records as Array<Record<string, unknown>> | undefined) ?? [];
    return dimensionKeysFromRecord(records[0]);
  }, [data]);

  // Deferred query used to test/validate a custom DQL query on demand.
  const dqlTest = useDql({ query: dql }, { enabled: false });

  async function runDqlTest() {
    const q = dql.trim();
    if (!q) return;
    setTest({ status: "running", message: "Running query…" });
    try {
      const result = await dqlTest.refetch();
      const records = result.data?.records as
        | Array<Record<string, unknown>>
        | undefined;
      if (dqlDisplay === "table") {
        const validation = validateDqlTable(records);
        setTableFields(validation.fields);
        // Default to all fields on first successful test; otherwise keep the
        // user's selection, dropping any columns the query no longer returns.
        setTableColumns((prev) => {
          const kept = prev.filter((c) => validation.fields.includes(c));
          return kept.length > 0 ? kept : validation.fields;
        });
        setTest({
          status: validation.ok ? "ok" : "error",
          message: validation.message,
        });
      } else if (
        dqlDisplay === "categorical" ||
        dqlDisplay === "pie" ||
        dqlDisplay === "donut"
      ) {
        const validation = validateDqlCategorical(records);
        setTest({
          status: validation.ok ? "ok" : "error",
          message: validation.message,
        });
      } else if (
        dqlDisplay === "bar" ||
        dqlDisplay === "line" ||
        dqlDisplay === "area"
      ) {
        // Line/area/bar charts need a timeseries; convertToTimeseries throws on
        // a non-timeseries result, so treat that as an invalid query.
        try {
          const series = result.data
            ? convertToTimeseries(result.data.records, result.data.types)
            : [];
          setTest(
            series.length > 0
              ? {
                  status: "ok",
                  message: `Returns ${series.length} time series.`,
                }
              : {
                  status: "error",
                  message:
                    "Query returns no time series — use timeseries or makeTimeseries.",
                },
          );
        } catch {
          setTest({
            status: "error",
            message:
              "Query must return a time series (use timeseries or makeTimeseries).",
          });
        }
      } else {
        const cell = readDqlCell(records);
        const validation = validateDqlResult(cell);
        setTest({
          status: validation.ok ? "ok" : "error",
          message: validation.message,
        });
      }
    } catch (e) {
      setTest({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Auto-validate an existing DQL query when editing a DQL tile.
  useEffect(() => {
    if (isDql && (initial?.dql ?? "").trim()) {
      void runDqlTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(index: number, next: TileFilter) {
    setFilters((prev) => prev.map((f, i) => (i === index ? next : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function addFilter() {
    setFilters((prev) => [...prev, { dimension: "", value: "" }]);
  }

  function updateThreshold(index: number, next: Threshold) {
    setThresholds((prev) => prev.map((t, i) => (i === index ? next : t)));
  }

  function removeThreshold(index: number) {
    setThresholds((prev) => prev.filter((_, i) => i !== index));
  }

  function addThreshold() {
    setThresholds((prev) => [
      ...prev,
      {
        id: generateId("th"),
        comparator: "gte",
        value: 0,
        color:
          THRESHOLD_COLOR_PRESETS[prev.length % THRESHOLD_COLOR_PRESETS.length]
            .color,
      },
    ]);
  }

  function resolveLink(): TileLink | undefined {
    if (linkChoice === "view" && linkView) {
      return { type: "view", target: linkView };
    }
    if (linkChoice === "url" && linkUrl.trim()) {
      return { type: "url", target: linkUrl.trim() };
    }
    return undefined;
  }

  const isMetric = source === "metric";
  const isTable = isDql && dqlDisplay === "table";
  // Chart display modes (bar/categorical). Like tables, chart tiles are plain
  // panels — they ignore shape/threshold/value/link styling.
  // Line + area share the line-only "Lines" section (curve/points/connect).
  const isTimeseriesChart = dqlDisplay === "line" || dqlDisplay === "area";
  // Line + area + bar share the Legend / Y-axis / X-axis sections.
  const isTimeseriesLikeChart = isTimeseriesChart || dqlDisplay === "bar";
  // Pie + donut share the slice option sections (Legend/Labels).
  const isSliceChart = dqlDisplay === "pie" || dqlDisplay === "donut";
  const isChart =
    isDql &&
    (isTimeseriesChart ||
      isSliceChart ||
      dqlDisplay === "bar" ||
      dqlDisplay === "categorical");
  const isPanel = isTable || isChart;
  const canSubmit = isShape
    ? true
    : isMarkdown
      ? markdown.trim().length > 0
      : isDql
        ? test.status === "ok" && (!isTable || tableColumns.length > 0)
        : Boolean(metricKey);

  function handleSubmit() {
    onSubmit({
      source,
      metricKey: isMetric ? metricKey : undefined,
      aggregation: isMetric ? aggregation : undefined,
      lookback: isMetric ? lookback : undefined,
      sparkline: isMetric ? sparkline : undefined,
      sparklineWindow: isMetric && sparkline ? sparklineWindow : undefined,
      sparklineVariant: isMetric && sparkline ? sparklineVariant : undefined,
      // Empty color = auto (match text) → don't persist an explicit color.
      sparklineColor:
        isMetric && sparkline && sparklineColor ? sparklineColor : undefined,
      dql: isDql ? dql.trim() : undefined,
      dqlDisplay: isDql ? dqlDisplay : undefined,
      tableColumns: isTable ? tableColumns : undefined,
      categoricalOptions:
        dqlDisplay === "categorical" ? catOpts : undefined,
      timeseriesOptions: isTimeseriesLikeChart ? tsOpts : undefined,
      pieOptions: isSliceChart ? pieOpts : undefined,
      markdown: isMarkdown ? markdown : undefined,
      // Markdown tiles are a plain text box, not a shape. Table and chart tiles
      // are plain panels, so they ignore shape/threshold/value styling entirely.
      shape: isMarkdown || isPanel ? DEFAULT_TILE_SHAPE : shape,
      rotation: isPanel ? undefined : rotation || undefined,
      lineWeight:
        !isPanel && isLineTileShape(shape) ? lineWeight : undefined,
      lineDashed:
        !isPanel && isLineTileShape(shape) ? lineDashed : undefined,
      lineArrows:
        !isPanel && isLineTileShape(shape) ? lineArrows : undefined,
      shapeOnly: isMarkdown || isShape || isPanel ? false : shapeOnly,
      // Only tables expose a transparent toggle; charts always sit on a surface.
      transparent: isTable
        ? tableTransparent
        : isChart
          ? false
          : bgMode === "transparent",
      backgroundColor:
        !isPanel && bgMode === "custom" ? bgColor : undefined,
      valuePosition:
        isMarkdown || isShape || isPanel ? undefined : valuePosition,
      filters: isMetric
        ? filters.filter((f) => f.dimension && f.value !== "")
        : [],
      thresholds:
        isMarkdown || isShape || isPanel
          ? []
          : thresholds.filter((t) => Number.isFinite(t.value)),
      label: isMarkdown || isShape ? undefined : label.trim() || undefined,
      unit:
        isMarkdown || isShape || isPanel ? undefined : unit.trim() || undefined,
      link: isPanel ? undefined : resolveLink(),
    });
  }

  const dqlQueryState: QueryStateType =
    test.status === "running"
      ? "loading"
      : test.status === "ok"
        ? "success"
        : test.status === "error"
          ? "error"
          : "idle";

  return (
    <Flex flexDirection="column" gap={8} style={{ width: "100%" }}>
      {!isShape && (
      <ConfigSection title="Data source">
      {isMarkdown ? (
        <Flex flexDirection="column" gap={6}>
          <Text style={fieldLabelStyle}>Markdown content</Text>
          <CodeEditor
            language="md"
            value={markdown}
            lineWrap
            placeholder={"## Title\n\nSome **bold** text, a [link](https://…), or notes."}
            aria-label="Markdown content"
            onChange={(v) => setMarkdown(v)}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: Colors.Text.Neutral.Default,
            }}
          >
            Supports standard markdown (headings, bold, lists, links, etc.).
          </Text>
        </Flex>
      ) : isDql ? (
        <Flex flexDirection="column" gap={6}>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Display as</Text>
            <div style={{ maxWidth: 220 }}>
              <VizDisplayPicker
                value={dqlDisplay}
                ariaLabel="Display as"
                onChange={(v) => {
                  setDqlDisplay(v);
                  // Switching mode changes what "valid" means; re-test.
                  setTest({ status: "idle", message: "" });
                }}
                options={DQL_DISPLAY_OPTIONS}
              />
            </div>
          </Flex>
          <Text style={fieldLabelStyle}>Custom DQL query</Text>
          <DQLEditor
            value={dql}
            placeholder={
              isTable
                ? "fetch logs | fields timestamp, status, content | limit 100"
                : dqlDisplay === "bar" || isTimeseriesChart
                  ? "timeseries count(), by:{dt.entity.host}"
                  : dqlDisplay === "categorical" || isSliceChart
                    ? "fetch dt.davis.problems | summarize count(), by:{event.category}"
                    : "timeseries v = avg(dt.host.cpu.usage, scalar:true)"
            }
            onChange={(v) => {
              setDql(v);
              setTest({ status: "idle", message: "" });
            }}
          />
          <Flex justifyContent="space-between" alignItems="center" gap={8}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: 500,
                color:
                  test.status === "error"
                    ? Colors.Text.Critical.Default
                    : test.status === "ok"
                      ? Colors.Text.Success.Default
                      : Colors.Text.Neutral.Default,
              }}
            >
              {test.message ||
                (isTable
                  ? "Query should return one or more rows."
                  : dqlDisplay === "bar" || isTimeseriesChart
                    ? "Return a time series."
                    : dqlDisplay === "categorical" || isSliceChart
                      ? "Return a dimension + measure."
                      : "Query must return a single numeric or text value.")}
            </Text>
            <RunQueryButton
              onClick={() => void runDqlTest()}
              queryState={dqlQueryState}
            />
          </Flex>
          {isTable && (
            <ColumnPicker
              fields={tableFields}
              value={tableColumns}
              onChange={setTableColumns}
            />
          )}
          {isTable && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: Colors.Text.Neutral.Default,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={tableTransparent}
                onChange={(e) => setTableTransparent(e.target.checked)}
              />
              Transparent background (show only gridlines &amp; values)
            </label>
          )}
        </Flex>
      ) : (
        <>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Metric</Text>
            <Text
              style={{ fontSize: 13, fontWeight: 500, wordBreak: "break-all" }}
            >
              {metricKey}
            </Text>
          </Flex>

          <Flex gap={8}>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Text style={fieldLabelStyle}>Aggregation</Text>
              <SelectField
                value={aggregation}
                ariaLabel="Aggregation"
                onChange={(v) => setAggregation(v as AggregationType)}
                options={AGGREGATIONS}
              />
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Text style={fieldLabelStyle}>Aggregation window</Text>
              <SelectField
                value={lookback}
                ariaLabel="Aggregation window"
                onChange={(v) => setLookback(v as LookbackWindow)}
                options={LOOKBACK_OPTIONS}
              />
            </Flex>
          </Flex>

          <Flex flexDirection="column" gap={6}>
            <Flex justifyContent="space-between" alignItems="center">
              <Text style={fieldLabelStyle}>Filters</Text>
              <Button variant="default" onClick={addFilter}>
                <Button.Prefix>
                  <PlusIcon />
                </Button.Prefix>
                Add filter
              </Button>
            </Flex>
            {filters.length === 0 ? (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: Colors.Text.Neutral.Default,
                }}
              >
                No filters — the metric is aggregated across all series.
              </Text>
            ) : (
              filters.map((filter, i) => (
                <FilterRow
                  key={i}
                  metricKey={metricKey ?? ""}
                  filter={filter}
                  dimensionOptions={dimensionOptions}
                  onChange={(next) => updateFilter(i, next)}
                  onRemove={() => removeFilter(i)}
                />
              ))
            )}
          </Flex>
        </>
      )}
      </ConfigSection>
      )}

      {dqlDisplay === "categorical" && (
      <ConfigSection title="Bars" defaultOpen={false} icon={<BarChartIcon />}>
        <Flex flexDirection="column" gap={8}>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Layout</Text>
            <SegmentedControl<CategoricalLayout>
              ariaLabel="Bar layout"
              value={catOpts.layout}
              onChange={(v) => setCat("layout", v)}
              options={CATEGORICAL_LAYOUT_OPTIONS.map((o) => ({
                ...o,
                Icon:
                  o.value === "horizontal"
                    ? HorizontalBarChartIcon
                    : BarChartIcon,
              }))}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Group mode</Text>
            <SegmentedControl<CategoricalGroupMode>
              ariaLabel="Bar group mode"
              value={catOpts.groupMode}
              onChange={(v) => setCat("groupMode", v)}
              options={CATEGORICAL_GROUP_MODE_OPTIONS.map((o) => ({
                ...o,
                Icon:
                  o.value === "grouped"
                    ? BarChartGroupedIcon
                    : StackedBarChartIcon,
              }))}
            />
          </Flex>
          <Text style={configHintStyle}>
            Group mode applies when a category has multiple measures.
          </Text>
        </Flex>
      </ConfigSection>
      )}

      {dqlDisplay === "categorical" && (
      <ConfigSection
        title="Legend and tooltip"
        defaultOpen={false}
        icon={<ListIcon />}
      >
        <Flex flexDirection="column" gap={8}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={!catOpts.legendHidden}
              onChange={(e) => setCat("legendHidden", !e.target.checked)}
            />
            Show legend
          </label>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Position</Text>
            <SegmentedControl<CategoricalLegendPosition>
              ariaLabel="Legend position"
              value={catOpts.legendPosition}
              onChange={(v) => setCat("legendPosition", v)}
              options={CATEGORICAL_LEGEND_POSITION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Text truncation</Text>
            <SegmentedControl<CategoricalTruncation>
              ariaLabel="Text truncation"
              value={catOpts.truncationMode}
              onChange={(v) => setCat("truncationMode", v)}
              options={CATEGORICAL_TRUNCATION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Tooltip variant</Text>
            <SegmentedControl<CategoricalTooltipVariant>
              ariaLabel="Tooltip variant"
              value={catOpts.tooltipVariant}
              onChange={(v) => setCat("tooltipVariant", v)}
              options={CATEGORICAL_TOOLTIP_OPTIONS}
            />
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {dqlDisplay === "categorical" && (
      <ConfigSection
        title={catOpts.layout === "vertical" ? "Y-axis" : "X-axis"}
        defaultOpen={false}
        icon={
          catOpts.layout === "vertical" ? <YAxisLeftIcon /> : <XAxisIcon />
        }
      >
        <Flex flexDirection="column" gap={8}>
          <Flex flexDirection="column" gap={4}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={catOpts.valueAxisLabelEnabled}
                onChange={(e) =>
                  setCat("valueAxisLabelEnabled", e.target.checked)
                }
              />
              Value axis label
            </label>
            {catOpts.valueAxisLabelEnabled && (
              <NativeInput
                value={catOpts.valueAxisLabel}
                placeholder="Value axis label"
                onChange={(e) => setCat("valueAxisLabel", e.target.value)}
              />
            )}
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Scale values</Text>
            <SegmentedControl<CategoricalAxisScale>
              ariaLabel="Scale values"
              value={catOpts.valueAxisScale}
              onChange={(v) => setCat("valueAxisScale", v)}
              options={CATEGORICAL_AXIS_SCALE_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Value representation</Text>
            <SegmentedControl<CategoricalValueRepresentation>
              ariaLabel="Value representation"
              value={catOpts.valueRepresentation}
              onChange={(v) => setCat("valueRepresentation", v)}
              options={CATEGORICAL_VALUE_REPRESENTATION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Min value</Text>
            <SegmentedControl<CategoricalAxisBoundMode>
              ariaLabel="Min value mode"
              value={catOpts.valueAxisMinMode}
              onChange={(v) => setCat("valueAxisMinMode", v)}
              options={CATEGORICAL_AXIS_BOUND_OPTIONS}
            />
            {catOpts.valueAxisMinMode === "custom" && (
              <NativeInput
                type="number"
                value={String(catOpts.valueAxisMin)}
                onChange={(e) =>
                  setCat("valueAxisMin", Number(e.target.value) || 0)
                }
              />
            )}
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Max value</Text>
            <SegmentedControl<CategoricalAxisBoundMode>
              ariaLabel="Max value mode"
              value={catOpts.valueAxisMaxMode}
              onChange={(v) => setCat("valueAxisMaxMode", v)}
              options={CATEGORICAL_AXIS_BOUND_OPTIONS}
            />
            {catOpts.valueAxisMaxMode === "custom" && (
              <NativeInput
                type="number"
                value={String(catOpts.valueAxisMax)}
                onChange={(e) =>
                  setCat("valueAxisMax", Number(e.target.value) || 0)
                }
              />
            )}
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {dqlDisplay === "categorical" && (
      <ConfigSection
        title={catOpts.layout === "vertical" ? "X-axis" : "Y-axis"}
        defaultOpen={false}
        icon={
          catOpts.layout === "vertical" ? <XAxisIcon /> : <YAxisLeftIcon />
        }
      >
        <Flex flexDirection="column" gap={4}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={catOpts.categoryAxisLabelEnabled}
              onChange={(e) =>
                // eslint-disable-next-line noSecrets/no-secrets
                setCat("categoryAxisLabelEnabled", e.target.checked)
              }
            />
            Category axis label
          </label>
          {catOpts.categoryAxisLabelEnabled && (
            <NativeInput
              value={catOpts.categoryAxisLabel}
              placeholder="Category axis label"
              onChange={(e) => setCat("categoryAxisLabel", e.target.value)}
            />
          )}
        </Flex>
      </ConfigSection>
      )}

      {dqlDisplay === "categorical" && (
      <ConfigSection title="Colors" defaultOpen={false} icon={<ColoringIcon />}>
        <Flex flexDirection="column" gap={8}>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Palette</Text>
            <SegmentedControl<CategoricalColorMode>
              ariaLabel="Color palette mode"
              value={catOpts.colorMode}
              onChange={(v) => setCat("colorMode", v)}
              options={CATEGORICAL_COLOR_MODE_OPTIONS}
            />
          </Flex>
          <Text style={configHintStyle}>
            Single color uses one hue for all bars; multi-color assigns a
            palette across categories.
          </Text>
        </Flex>
      </ConfigSection>
      )}

      {isTimeseriesChart && (
      <ConfigSection title="Lines" defaultOpen={false} icon={<LineChartIcon />}>
        <Flex flexDirection="column" gap={12}>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Line type</Text>
            <SegmentedControl<LineCurve>
              ariaLabel="Line type"
              value={tsOpts.curve}
              onChange={(v) => setTs("curve", v)}
              options={LINE_CURVE_OPTIONS.map((o) => ({
                ...o,
                Icon: o.value === "smooth" ? CurveSmoothIcon : CurveLinearIcon,
              }))}
            />
          </Flex>
          <Flex justifyContent="space-between" alignItems="center" gap={8}>
            <Text style={fieldLabelStyle}>Connect data points</Text>
            <Switch
              value={tsOpts.connectDataPoints}
              aria-label="Connect data points"
              onChange={(v) => setTs("connectDataPoints", v)}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Flex justifyContent="space-between" alignItems="center" gap={8}>
              <Text style={fieldLabelStyle}>Show data points</Text>
              <Switch
                value={tsOpts.pointsDisplay !== "never"}
                aria-label="Show data points"
                onChange={(v) => setTs("pointsDisplay", v ? "auto" : "never")}
              />
            </Flex>
            {tsOpts.pointsDisplay !== "never" && (
              <SegmentedControl<TimeseriesPointsDisplay>
                ariaLabel="Data points mode"
                value={tsOpts.pointsDisplay}
                onChange={(v) => setTs("pointsDisplay", v)}
                options={TIMESERIES_POINTS_OPTIONS.filter(
                  (o) => o.value !== "never",
                )}
              />
            )}
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Value representation</Text>
            <SegmentedControl<TimeseriesValueRepresentation>
              ariaLabel="Value representation"
              value={tsOpts.valueRepresentation}
              onChange={(v) => setTs("valueRepresentation", v)}
              options={TIMESERIES_VALUE_REPRESENTATION_OPTIONS}
            />
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {dqlDisplay === "bar" && (
      <ConfigSection title="Bars" defaultOpen={false} icon={<BarChartIcon />}>
        <Flex flexDirection="column" gap={4}>
          <Text style={fieldLabelStyle}>Value representation</Text>
          <SegmentedControl<TimeseriesValueRepresentation>
            ariaLabel="Value representation"
            value={tsOpts.valueRepresentation}
            onChange={(v) => setTs("valueRepresentation", v)}
            options={TIMESERIES_VALUE_REPRESENTATION_OPTIONS}
          />
        </Flex>
      </ConfigSection>
      )}

      {isTimeseriesLikeChart && (
      <ConfigSection
        title="Legend and tooltip"
        defaultOpen={false}
        icon={<ListIcon />}
      >
        <Flex flexDirection="column" gap={8}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={!tsOpts.legendHidden}
              onChange={(e) => setTs("legendHidden", !e.target.checked)}
            />
            Show legend
          </label>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Position</Text>
            <SegmentedControl<TimeseriesLegendPosition>
              ariaLabel="Legend position"
              value={tsOpts.legendPosition}
              onChange={(v) => setTs("legendPosition", v)}
              options={TIMESERIES_LEGEND_POSITION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Text truncation</Text>
            <SegmentedControl<TimeseriesTruncation>
              ariaLabel="Text truncation"
              value={tsOpts.truncationMode}
              onChange={(v) => setTs("truncationMode", v)}
              options={TIMESERIES_TRUNCATION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Tooltip variant</Text>
            <SegmentedControl<TimeseriesTooltipVariant>
              ariaLabel="Tooltip variant"
              value={tsOpts.tooltipVariant}
              onChange={(v) => setTs("tooltipVariant", v)}
              options={TIMESERIES_TOOLTIP_OPTIONS}
            />
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {isTimeseriesLikeChart && (
      <ConfigSection title="Y-axis" defaultOpen={false} icon={<YAxisLeftIcon />}>
        <Flex flexDirection="column" gap={8}>
          <Flex flexDirection="column" gap={4}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={tsOpts.valueAxisLabelEnabled}
                onChange={(e) =>
                  setTs("valueAxisLabelEnabled", e.target.checked)
                }
              />
              Value axis label
            </label>
            {tsOpts.valueAxisLabelEnabled && (
              <NativeInput
                value={tsOpts.valueAxisLabel}
                placeholder="Value axis label"
                onChange={(e) => setTs("valueAxisLabel", e.target.value)}
              />
            )}
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Scale values</Text>
            <SegmentedControl<TimeseriesAxisScale>
              ariaLabel="Scale values"
              value={tsOpts.valueAxisScale}
              onChange={(v) => setTs("valueAxisScale", v)}
              options={TIMESERIES_AXIS_SCALE_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Min value</Text>
            <SegmentedControl<TimeseriesAxisBoundMode>
              ariaLabel="Min value mode"
              value={tsOpts.valueAxisMinMode}
              onChange={(v) => setTs("valueAxisMinMode", v)}
              options={TIMESERIES_AXIS_BOUND_OPTIONS}
            />
            {tsOpts.valueAxisMinMode === "custom" && (
              <NativeInput
                type="number"
                value={String(tsOpts.valueAxisMin)}
                onChange={(e) =>
                  setTs("valueAxisMin", Number(e.target.value) || 0)
                }
              />
            )}
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Max value</Text>
            <SegmentedControl<TimeseriesAxisBoundMode>
              ariaLabel="Max value mode"
              value={tsOpts.valueAxisMaxMode}
              onChange={(v) => setTs("valueAxisMaxMode", v)}
              options={TIMESERIES_AXIS_BOUND_OPTIONS}
            />
            {tsOpts.valueAxisMaxMode === "custom" && (
              <NativeInput
                type="number"
                value={String(tsOpts.valueAxisMax)}
                onChange={(e) =>
                  setTs("valueAxisMax", Number(e.target.value) || 0)
                }
              />
            )}
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {isTimeseriesLikeChart && (
      <ConfigSection title="X-axis" defaultOpen={false} icon={<XAxisIcon />}>
        <Flex flexDirection="column" gap={4}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={tsOpts.timeAxisLabelEnabled}
              onChange={(e) => setTs("timeAxisLabelEnabled", e.target.checked)}
            />
            Time axis label
          </label>
          {tsOpts.timeAxisLabelEnabled && (
            <NativeInput
              value={tsOpts.timeAxisLabel}
              placeholder="Time axis label"
              onChange={(e) => setTs("timeAxisLabel", e.target.value)}
            />
          )}
        </Flex>
      </ConfigSection>
      )}

      {isSliceChart && (
      <ConfigSection title="Legend" defaultOpen={false} icon={<ListIcon />}>
        <Flex flexDirection="column" gap={8}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={!pieOpts.legendHidden}
              onChange={(e) => setPie("legendHidden", !e.target.checked)}
            />
            Show legend
          </label>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Position</Text>
            <SegmentedControl<PieLegendPosition>
              ariaLabel="Legend position"
              value={pieOpts.legendPosition}
              onChange={(v) => setPie("legendPosition", v)}
              options={PIE_LEGEND_POSITION_OPTIONS}
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Text truncation</Text>
            <SegmentedControl<PieTruncation>
              ariaLabel="Text truncation"
              value={pieOpts.truncationMode}
              onChange={(v) => setPie("truncationMode", v)}
              options={PIE_TRUNCATION_OPTIONS}
            />
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {isSliceChart && (
      <ConfigSection title="Labels" defaultOpen={false} icon={<LabelIcon />}>
        <Flex flexDirection="column" gap={8}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={!pieOpts.labelsHidden}
              onChange={(e) => setPie("labelsHidden", !e.target.checked)}
            />
            Show labels
          </label>
          <Flex flexDirection="column" gap={4}>
            <Text style={fieldLabelStyle}>Value type</Text>
            <SegmentedControl<PieLabelValueType>
              ariaLabel="Label value type"
              value={pieOpts.labelValueType}
              onChange={(v) => setPie("labelValueType", v)}
              options={PIE_LABEL_VALUE_TYPE_OPTIONS}
            />
          </Flex>
        </Flex>
      </ConfigSection>
      )}

      {!isPanel && (
      <ConfigSection title="Appearance">
      {!isMarkdown && (
      <Flex flexDirection="column" gap={6}>
        <Text style={fieldLabelStyle}>Tile shape</Text>
        <Flex gap={6} style={{ flexWrap: "wrap" }}>
          {(isShape ? [...TILE_SHAPES, ...STATIC_ONLY_SHAPES] : TILE_SHAPES).map(
            (s) => {
            const selected = shape === s.value;
            return (
              <button
                key={s.value}
                type="button"
                title={s.label}
                aria-label={s.label}
                aria-pressed={selected}
                onClick={() => setShape(s.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  width: 60,
                  padding: "8px 4px",
                  cursor: "pointer",
                  borderRadius: 6,
                  border: `1px solid ${selected
                      ? Colors.Border.Primary.Default
                      : Colors.Border.Neutral.Default
                    }`,
                  background: selected
                    ? Colors.Background.Container.Neutral.Emphasized
                    : Colors.Background.Surface.Default,
                  color: shapePickerColor,
                }}
              >
                <ShapeGlyph shape={s.value} size={24} />
                <span style={{ fontSize: 10, fontWeight: 600 }}>
                  {SHORT_SHAPE_LABELS[s.value]}
                </span>
              </button>
            );
          })}
        </Flex>
        {!isShape && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: Colors.Text.Neutral.Default,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={shapeOnly}
              onChange={(e) => setShapeOnly(e.target.checked)}
            />
            Show shape only (hide value &amp; label)
          </label>
        )}
      </Flex>
      )}

      {!isMarkdown &&
        !isShape &&
        !shapeOnly &&
        isOutlineTileShape(shape) &&
        !isLineTileShape(shape) && (
          <Flex flexDirection="column" gap={4} style={{ maxWidth: 220 }}>
            <Text style={fieldLabelStyle}>Value position</Text>
            <SelectField
              value={valuePosition}
              ariaLabel="Value position"
              onChange={(v) => setValuePosition(v as ValuePosition)}
              options={VALUE_POSITION_OPTIONS}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: Colors.Text.Neutral.Default,
              }}
            >
              Move the value &amp; label off the icon so they stay readable.
            </Text>
          </Flex>
        )}

      {isLineTileShape(shape) && (
        <Flex flexDirection="column" gap={6}>
          <Text style={fieldLabelStyle}>Line format</Text>
          <Flex gap={8} style={{ flexWrap: "wrap" }}>
            <Flex flexDirection="column" gap={4} style={{ width: 96 }}>
              <Text style={fieldLabelStyle}>Weight</Text>
              <NativeInput
                type="number"
                min={1}
                max={40}
                value={String(lineWeight)}
                aria-label="Line weight"
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  setLineWeight(
                    Number.isFinite(n) ? Math.max(1, Math.min(40, n)) : 4,
                  );
                }}
              />
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ width: 120 }}>
              <Text style={fieldLabelStyle}>Style</Text>
              <SelectField
                value={lineDashed ? "dashed" : "solid"}
                ariaLabel="Line style"
                onChange={(v) => setLineDashed(v === "dashed")}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                ]}
              />
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ width: 140 }}>
              <Text style={fieldLabelStyle}>Arrowheads</Text>
              <SelectField
                value={lineArrows}
                ariaLabel="Arrowheads"
                onChange={(v) => setLineArrows(v as LineArrows)}
                options={LINE_ARROW_OPTIONS}
              />
            </Flex>
          </Flex>
        </Flex>
      )}

      <Flex flexDirection="column" gap={6}>
        <Text style={fieldLabelStyle}>Background</Text>
        <SelectField
          value={bgMode}
          ariaLabel="Background"
          onChange={(v) => setBgMode(v as "default" | "transparent" | "custom")}
          options={[
            { value: "default", label: "Default" },
            { value: "transparent", label: "Transparent (no shape)" },
            { value: "custom", label: "Custom color" },
          ]}
        />
        {bgMode === "custom" && (
          <Flex gap={6} alignItems="center" style={{ flexWrap: "wrap" }}>
            <input
              type="color"
              value={bgColor}
              aria-label="Background color"
              onChange={(e) => setBgColor(e.target.value)}
              style={{
                width: 36,
                height: 28,
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
            />
            {THRESHOLD_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.color}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() => setBgColor(preset.color)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: preset.color,
                  border:
                    bgColor.toLowerCase() === preset.color.toLowerCase()
                      ? "2px solid #161616"
                      : "1px solid rgba(0,0,0,0.2)",
                }}
              />
            ))}
          </Flex>
        )}
      </Flex>

      <Flex flexDirection="column" gap={4}>
        <Text style={fieldLabelStyle}>Rotation</Text>
        <Flex gap={6} alignItems="center" style={{ flexWrap: "wrap" }}>
          <div style={{ width: 96 }}>
            <NativeInput
              type="number"
              min={0}
              max={359}
              step={15}
              value={String(rotation)}
              aria-label="Rotation in degrees"
              onChange={(e) => setRotation(normalizeAngle(e.target.value))}
            />
          </div>
          {[0, 90, 180, 270].map((a) => (
            <Button
              key={a}
              variant={rotation === a ? "accent" : "default"}
              onClick={() => setRotation(a)}
              style={{ minWidth: "auto", padding: "4px 10px" }}
            >
              {a}°
            </Button>
          ))}
        </Flex>
      </Flex>
      </ConfigSection>
      )}

      {!isMarkdown && !isShape && !isPanel && (
        <ConfigSection title="Color thresholds" defaultOpen={false}>
          <Flex justifyContent="flex-end" alignItems="center">
            <Button variant="default" onClick={addThreshold}>
              <Button.Prefix>
                <PlusIcon />
              </Button.Prefix>
              Add threshold
            </Button>
          </Flex>
          {thresholds.length === 0 ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: Colors.Text.Neutral.Default,
              }}
            >
              No thresholds — the tile uses its default colors.
            </Text>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: Colors.Text.Neutral.Default,
                }}
              >
                Evaluated top to bottom; the first matching rule colors the
                tile.
              </Text>
              {thresholds.map((threshold, i) => (
                <ThresholdRow
                  key={threshold.id}
                  threshold={threshold}
                  onChange={(next) => updateThreshold(i, next)}
                  onRemove={() => removeThreshold(i)}
                />
              ))}
            </>
          )}
        </ConfigSection>
      )}

      {isMetric && (
        <ConfigSection title="Sparkline" defaultOpen={false}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: Colors.Text.Neutral.Default,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={sparkline}
              onChange={(e) => setSparkline(e.target.checked)}
            />
            Show a trend sparkline under the value
          </label>

          {sparkline && (
            <>
              <Flex gap={8} style={{ flexWrap: "wrap" }}>
                <Flex flexDirection="column" gap={4} style={{ width: 160 }}>
                  <Text style={fieldLabelStyle}>Trend window</Text>
                  <SelectField
                    value={sparklineWindow}
                    ariaLabel="Sparkline trend window"
                    onChange={(v) => setSparklineWindow(v as SparklineWindow)}
                    options={SPARKLINE_WINDOW_OPTIONS}
                  />
                </Flex>
                <Flex flexDirection="column" gap={4} style={{ width: 120 }}>
                  <Text style={fieldLabelStyle}>Style</Text>
                  <SelectField
                    value={sparklineVariant}
                    ariaLabel="Sparkline style"
                    onChange={(v) => setSparklineVariant(v as SparklineVariant)}
                    options={SPARKLINE_VARIANT_OPTIONS}
                  />
                </Flex>
              </Flex>

              <Flex flexDirection="column" gap={4}>
                <Text style={fieldLabelStyle}>Color</Text>
                <Flex gap={6} alignItems="center" style={{ flexWrap: "wrap" }}>
                  <Button
                    variant={sparklineColor === "" ? "accent" : "default"}
                    onClick={() => setSparklineColor("")}
                    style={{ minWidth: "auto", padding: "2px 10px" }}
                  >
                    Auto
                  </Button>
                  <input
                    type="color"
                    value={sparklineColor || "#ffffff"}
                    aria-label="Sparkline color"
                    onChange={(e) => setSparklineColor(e.target.value)}
                    style={{
                      width: 36,
                      height: 28,
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  />
                  {THRESHOLD_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      title={preset.label}
                      aria-label={preset.label}
                      onClick={() => setSparklineColor(preset.color)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        cursor: "pointer",
                        background: preset.color,
                        border:
                          sparklineColor.toLowerCase() === preset.color.toLowerCase()
                            ? "2px solid #161616"
                            : "1px solid rgba(0,0,0,0.2)",
                      }}
                    />
                  ))}
                </Flex>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: Colors.Text.Neutral.Default,
                  }}
                >
                  Auto matches the tile&apos;s text color. Pick a color to override.
                </Text>
              </Flex>
            </>
          )}
        </ConfigSection>
      )}

      {!isMarkdown && !isShape && (
        <ConfigSection title={isPanel ? "Label" : "Label & unit"}>
        <Flex gap={8}>
        <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
          <Text style={fieldLabelStyle}>
            {isPanel ? "Title (optional)" : "Label (optional)"}
          </Text>
          <NativeInput
            value={label}
            placeholder={
              isTable
                ? "Shown above the table"
                : isChart
                  ? "Shown above the chart"
                  : metricKey ?? "Custom DQL"
            }
            onChange={(e) => setLabel(e.target.value)}
          />
        </Flex>
        {!isPanel && (
        <Flex flexDirection="column" gap={4} style={{ width: 90 }}>
          <Text style={fieldLabelStyle}>Unit</Text>
          <NativeInput
            value={unit}
            placeholder="e.g. %"
            onChange={(e) => setUnit(e.target.value)}
          />
        </Flex>
        )}
      </Flex>
        </ConfigSection>
      )}

      {!isPanel && (
      <ConfigSection title="Hyperlink" defaultOpen={false}>
        <SelectField
          value={linkChoice}
          ariaLabel="Hyperlink type"
          onChange={(v) => setLinkChoice(v as LinkChoice)}
          options={[
            { value: "none", label: "No link" },
            { value: "view", label: "Open another canvas" },
            { value: "url", label: "Open a custom URL" },
          ]}
        />

        {linkChoice === "view" && (
          <SelectField
            value={linkView}
            ariaLabel="Target canvas"
            placeholder={
              views === null ? "Loading canvases…" : "Select a canvas…"
            }
            onChange={(v) => setLinkView(v)}
            options={(views ?? [])
              .filter((v) => v.id !== currentViewId)
              .map((v) => ({ value: v.id, label: v.name }))}
          />
        )}

        {linkChoice === "url" && (
          <NativeInput
            type="url"
            value={linkUrl}
            placeholder="https://example.com/dashboard"
            aria-label="Custom URL"
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        )}

        <Text
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: Colors.Text.Neutral.Default,
          }}
        >
          When set, the tile shows a link icon and opens this destination in a
          new tab when clicked in view mode.
        </Text>
      </ConfigSection>
      )}

      <Flex gap={8} justifyContent="flex-end">
        {onCancel && (
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="accent" onClick={handleSubmit} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </Flex>
    </Flex>
  );
};
