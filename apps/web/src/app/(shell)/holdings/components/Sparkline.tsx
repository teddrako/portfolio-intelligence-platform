"use client";

interface SparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

/**
 * Minimal SVG sparkline. No external dependency.
 * `data` is an array of close prices, oldest → newest.
 */
export function Sparkline({ data, positive, width = 80, height = 28 }: SparklineProps) {
  if (data.length < 2) return <div style={{ width, height }} />;

  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pad   = 1; // px inset so stroke isn't clipped

  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width  - pad * 2);
      const y = pad + ((1 - (v - min) / range)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
