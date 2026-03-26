import type { PriceBarDTO } from "@pip/api";

interface Props {
  history: PriceBarDTO[];
}

export function PortfolioChart({ history }: Props) {
  if (history.length < 2) return null;

  const base = history[0]!.close;

  // Compute % return from start for each point
  const points = history.map((h, i) => ({
    x: i,
    pct: base > 0 ? ((h.close - base) / base) * 100 : 0,
    date: h.date,
    value: h.close,
  }));

  const minPct = Math.min(...points.map((p) => p.pct));
  const maxPct = Math.max(...points.map((p) => p.pct));
  const range  = maxPct - minPct || 1;

  const W = 800;
  const H = 110;
  const PX = 2; // horizontal padding
  const PY = 6; // vertical padding

  function toSvg(p: (typeof points)[0]) {
    return {
      x: PX + (p.x / (points.length - 1)) * (W - 2 * PX),
      y: PY + ((maxPct - p.pct) / range) * (H - 2 * PY),
    };
  }

  const svgPts = points.map(toSvg);
  const polyline = svgPts.map((p) => `${p.x},${p.y}`).join(" ");

  const lastPt = svgPts[svgPts.length - 1]!;
  const firstPt = svgPts[0]!;

  const areaPath = [
    `M ${firstPt.x},${firstPt.y}`,
    ...svgPts.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${lastPt.x},${H}`,
    `L ${firstPt.x},${H}`,
    "Z",
  ].join(" ");

  const lastPct = points[points.length - 1]!.pct;
  const positive = lastPct >= 0;
  const stroke   = positive ? "#22c55e" : "#ef4444";

  // Zero-line position (only rendered when the range spans positive & negative)
  const showZero = minPct < 0 && maxPct > 0;
  const zeroY    = PY + (maxPct / range) * (H - 2 * PY);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          30-Day Performance
        </p>
        <p className={`text-sm font-semibold tabular-nums ${positive ? "text-green-400" : "text-red-400"}`}>
          {lastPct >= 0 ? "+" : ""}
          {lastPct.toFixed(2)}%
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pgChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#pgChartGrad)" />

        {showZero && (
          <line
            x1={PX} y1={zeroY}
            x2={W - PX} y2={zeroY}
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
