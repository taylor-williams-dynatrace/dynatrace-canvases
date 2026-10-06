import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  BarChartIcon,
  ChevronDownSmallIcon,
  DonutChartIcon,
  HorizontalBarChartIcon,
  LineChartIcon,
  PieChartIcon,
  SingleValueChartIcon,
  StackedAreaChartIcon,
  TableIcon,
  type SvgIconProps,
} from "@dynatrace/strato-icons";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { DqlDisplay } from "../types/metricsView";

/**
 * A theme-aware, popover "Display as" picker for DQL tiles.
 *
 * Instead of a plain text dropdown, the trigger opens a floating panel that
 * lays out each visualization option as a Dynatrace viz icon + caption — the
 * same style the Dashboards/Notebooks apps use for their visualization
 * selector. It reuses the portal + fixed-positioning + dismiss mechanics of
 * SelectField so the panel is never clipped by scroll containers or modals.
 *
 * Adding a new visualization is a two-line change: add the DqlDisplay value to
 * DQL_DISPLAY_OPTIONS (types/metricsView) and map it to a Strato icon in
 * DISPLAY_ICONS below.
 */

// Matches the Strato design-system font, since the portal renders outside the
// app's styled subtree.
const FONT_FAMILY = "DynatraceFlow, Roboto, Helvetica, sans-serif";

type IconComponent = React.ComponentType<SvgIconProps>;

/**
 * Maps each DQL display mode to its Dynatrace visualization icon. Extend this
 * as new visualizations are implemented — a value with no entry falls back to a
 * caption-only tile rather than erroring.
 */
const DISPLAY_ICONS: Partial<Record<DqlDisplay, IconComponent>> = {
  value: SingleValueChartIcon,
  table: TableIcon,
  line: LineChartIcon,
  area: StackedAreaChartIcon,
  bar: BarChartIcon,
  categorical: HorizontalBarChartIcon,
  pie: PieChartIcon,
  donut: DonutChartIcon,
};

export interface VizDisplayOption {
  value: DqlDisplay;
  label: string;
}

interface VizDisplayPickerProps {
  value: DqlDisplay;
  onChange: (value: DqlDisplay) => void;
  options: VizDisplayOption[];
  ariaLabel?: string;
  disabled?: boolean;
}

export const VizDisplayPicker: React.FC<VizDisplayPickerProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const SelectedIcon = selected ? DISPLAY_ICONS[selected.value] : undefined;

  function reposition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The panel is wider than the trigger (icon grid), so anchor to the
    // trigger's left edge but give it a comfortable minimum width.
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Close on scroll/resize rather than chase a moving trigger.
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          textAlign: "left",
          borderRadius: 4,
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          background: Colors.Background.Surface.Default,
          color: Colors.Text.Neutral.Default,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflow: "hidden",
            color: selected
              ? Colors.Text.Neutral.Default
              : Colors.Text.Neutral.Subdued,
          }}
        >
          {SelectedIcon && (
            <span style={{ display: "inline-flex", color: Colors.Text.Primary.Default }}>
              <SelectedIcon size={16} />
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected ? selected.label : "Select…"}
          </span>
        </span>
        <ChevronDownSmallIcon />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel ?? "Visualization"}
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              minWidth: Math.max(rect.width, 280),
              zIndex: 4000,
              padding: 12,
              borderRadius: 8,
              fontFamily: FONT_FAMILY,
              background: Colors.Background.Surface.Default,
              border: `1px solid ${Colors.Border.Neutral.Default}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                fontSize: 12,
                fontWeight: 600,
                color: Colors.Text.Neutral.Subdued,
              }}
            >
              <span>Visualization</span>
              {selected && (
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: Colors.Text.Primary.Default,
                    background: Colors.Background.Container.Primary.Default,
                  }}
                >
                  {selected.label}
                </span>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, 84px)",
                gap: 6,
              }}
            >
              {options.map((o) => {
                const Icon = DISPLAY_ICONS[o.value];
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    title={o.label}
                    aria-label={o.label}
                    aria-pressed={isSel}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxSizing: "border-box",
                      width: 84,
                      height: 84,
                      padding: 6,
                      cursor: "pointer",
                      borderRadius: 8,
                      // Each tile is a subtly shaded card (echoing the native
                      // picker); only the selected tile gets a blue accent
                      // border. The transparent 2px border on unselected tiles
                      // keeps the tile size constant so nothing shifts.
                      border: `2px solid ${
                        isSel ? Colors.Border.Primary.Accent : "transparent"
                      }`,
                      background: isSel
                        ? Colors.Background.Container.Neutral.Emphasized
                        : Colors.Background.Container.Neutral.Default,
                      color: isSel
                        ? Colors.Text.Primary.Default
                        : Colors.Text.Neutral.Default,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background =
                          Colors.Background.Container.Neutral.Emphasized;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background =
                          Colors.Background.Container.Neutral.Default;
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 46,
                        height: 34,
                        borderRadius: 6,
                        // A recessed, shaded panel behind the glyph — a
                        // greyscale stand-in for the native filled chart preview.
                        background: Colors.Background.Surface.Default,
                        border: `1px solid ${Colors.Border.Neutral.Default}`,
                        color: isSel
                          ? Colors.Text.Primary.Default
                          : Colors.Text.Neutral.Default,
                      }}
                    >
                      {Icon ? <Icon size={22} /> : null}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textAlign: "center",
                        lineHeight: 1.15,
                      }}
                    >
                      {o.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
