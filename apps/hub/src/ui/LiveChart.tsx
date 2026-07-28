import { useId } from "react";

interface LiveChartProps {
  values: number[];
  max: number;
  color?: string;
  height?: number;
}

/**
 * A lightweight live line+area chart. Pure SVG with a non-uniform viewBox so it
 * stretches to any width; only `transform`/path data change, keeping it cheap.
 * Deliberately dependency-free (no uPlot yet) to keep the Phase 2 bundle small —
 * swap in a heavier lib later if we need multi-series overlays.
 */
export function LiveChart({ values, max, color = "var(--raspberry)", height = 44 }: LiveChartProps) {
  const gradId = useId();
  const W = 100;
  const H = 40;
  const safeMax = max > 0 ? max : 1;

  const points = values.map((v, i) => {
    const x = values.length < 2 ? 0 : (i / (values.length - 1)) * W;
    const y = H - Math.max(0, Math.min(1, v / safeMax)) * H;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const area = points.length >= 2 ? `${line} L${W} ${H} L0 ${H} Z` : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height, width: "100%", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradId})`} />}
      {points.length >= 2 && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
