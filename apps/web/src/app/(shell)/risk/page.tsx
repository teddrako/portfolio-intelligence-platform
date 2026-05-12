import { trpc } from "@/trpc/server";
import type { RiskMetricsDTO } from "@pip/api";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata = { title: "Risk & Exposure — Portfolio Intelligence" };

// ─── Formatting ────────────────────────────────────────────────────────────────

function pct(n: number, decimals = 1): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  sentiment,
}: {
  label:     string;
  value:     string;
  sub?:      string;
  sentiment?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    sentiment === "positive" ? "text-emerald-400"
    : sentiment === "negative" ? "text-red-400"
    : "text-gray-100";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const W = 900;
const H = 100;

function toX(i: number, len: number): number {
  return len <= 1 ? 0 : (i / (len - 1)) * W;
}

function drawdownLinePath(series: RiskMetricsDTO["drawdownSeries"], minDD: number): string {
  if (series.length === 0) return "";
  const floor = Math.min(minDD, -0.001); // guard against flat line
  const toY   = (dd: number) => (dd / floor) * H;
  return series
    .map((d, i) => `${i === 0 ? "M" : "L"}${toX(i, series.length).toFixed(1)},${toY(d.drawdown).toFixed(2)}`)
    .join(" ");
}

function drawdownAreaPath(series: RiskMetricsDTO["drawdownSeries"], minDD: number): string {
  if (series.length === 0) return "";
  const line = drawdownLinePath(series, minDD);
  const last = series.length - 1;
  return `${line} L${W},0 L0,0 Z`;
}

function betaLinePath(series: RiskMetricsDTO["rollingBeta"]): string {
  if (series.length === 0) return "";
  const betas = series.map((d) => d.beta);
  const minB  = Math.min(...betas);
  const maxB  = Math.max(...betas);
  const range = maxB - minB || 0.01;
  const toY   = (b: number) => H - ((b - minB) / range) * H;
  return series
    .map((d, i) =>
      `${i === 0 ? "M" : "L"}${toX(i, series.length).toFixed(1)},${toY(d.beta).toFixed(2)}`,
    )
    .join(" ");
}

/** Y-coordinate of beta=1 in the rolling beta chart */
function betaOneY(series: RiskMetricsDTO["rollingBeta"]): number {
  if (series.length === 0) return H / 2;
  const betas = series.map((d) => d.beta);
  const minB  = Math.min(...betas);
  const maxB  = Math.max(...betas);
  const range = maxB - minB || 0.01;
  return H - ((1 - minB) / range) * H;
}

/** Date label from first/last element of a series */
function dateRange(series: Array<{ date: string }>): string {
  if (series.length === 0) return "";
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return `${fmt(series[0]!.date)} – ${fmt(series.at(-1)!.date)}`;
}

// ─── Correlation heatmap colour ───────────────────────────────────────────────

function corrBg(v: number): string {
  // Anchors: -1 → red, 0 → near-transparent, +1 → indigo
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    // 0 → rgba(99,102,241,0.05)  to  1 → rgba(99,102,241,0.90)
    const alpha = (t * 0.85 + 0.05).toFixed(2);
    return `rgba(99,102,241,${alpha})`;
  } else {
    // 0 → rgba(239,68,68,0.05)   to -1 → rgba(239,68,68,0.90)
    const alpha = (-t * 0.85 + 0.05).toFixed(2);
    return `rgba(239,68,68,${alpha})`;
  }
}

function corrTextColor(v: number): string {
  return Math.abs(v) > 0.5 ? "text-white" : "text-gray-300";
}

// ─── Sector bar ───────────────────────────────────────────────────────────────

function SectorBar({
  sector,
  weight,
  spyWeight,
  overUnder,
}: {
  sector:    string;
  weight:    number;
  spyWeight: number;
  overUnder: number;
}) {
  const maxBar   = 0.7; // scale so 70% = full bar width
  const portPct  = Math.min(weight / maxBar, 1) * 100;
  const spyPct   = Math.min(spyWeight / maxBar, 1) * 100;
  const isOver   = overUnder > 0.005;
  const isUnder  = overUnder < -0.005;

  return (
    <div className="grid grid-cols-[140px_1fr_72px] items-center gap-3 py-1.5">
      <span className="truncate text-xs text-gray-300">{sector}</span>

      <div className="relative h-4">
        {/* SPY baseline bar */}
        <div
          className="absolute inset-y-0 left-0 rounded bg-gray-700/50"
          style={{ width: `${spyPct.toFixed(1)}%` }}
        />
        {/* Portfolio bar */}
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{
            width:      `${portPct.toFixed(1)}%`,
            background: "linear-gradient(90deg, rgba(99,102,241,0.7), rgba(99,102,241,0.4))",
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs tabular-nums text-gray-300">
          {(weight * 100).toFixed(1)}%
        </span>
        {(isOver || isUnder) && (
          <span
            className={`rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums ${
              isOver ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {isOver ? "+" : ""}{(overUnder * 100).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-gray-800 bg-gray-900 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-2xl">
        📉
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RiskPage() {
  const caller = await trpc();
  const data   = await caller.risk.metrics({ lookbackDays: 252 });

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState message="No portfolio found. Set up your portfolio to view risk analytics." />
      </div>
    );
  }

  if (data.daysOfHistory < 10) {
    return (
      <div className="p-6">
        <AutoRefresh intervalMs={10_000} />
        <EmptyState message="Price history is seeding — this page will update automatically." />
      </div>
    );
  }

  const maxDD  = data.maxDrawdown;
  const tickers = data.correlationMatrix.tickers;
  const matrix  = data.correlationMatrix.matrix;

  return (
    <div className="space-y-5 p-5 sm:p-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Risk &amp; Exposure</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          252-day lookback &middot; {data.daysOfHistory} trading days &middot;{" "}
          {tickers.length} position{tickers.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Portfolio Beta (vs SPY)"
          value={data.beta !== null ? fmt2(data.beta) : "—"}
          sub={
            data.beta !== null
              ? data.beta > 1.1 ? "Aggressive tilt" : data.beta < 0.9 ? "Defensive tilt" : "Market-neutral"
              : "Insufficient data"
          }
          sentiment={
            data.beta === null ? "neutral"
            : Math.abs(data.beta - 1) < 0.1 ? "neutral"
            : data.beta > 1 ? "negative"
            : "positive"
          }
        />
        <KpiCard
          label="Max Drawdown"
          value={`${(maxDD * 100).toFixed(1)}%`}
          sub={`Peak-to-trough since ${dateRange(data.drawdownSeries)}`}
          sentiment={maxDD < -0.15 ? "negative" : maxDD < -0.07 ? "neutral" : "positive"}
        />
        <KpiCard
          label="Annualised Volatility"
          value={data.annualizedVol !== null ? `${(data.annualizedVol * 100).toFixed(1)}%` : "—"}
          sub="Annualised daily σ (252 days)"
          sentiment={
            data.annualizedVol === null ? "neutral"
            : data.annualizedVol > 0.25 ? "negative"
            : data.annualizedVol > 0.15 ? "neutral"
            : "positive"
          }
        />
        <KpiCard
          label="Concentration (HHI)"
          value={data.hhi.toFixed(3)}
          sub={data.hhi > 0.25 ? "Highly concentrated" : data.hhi > 0.15 ? "Moderate" : "Well diversified"}
          sentiment={data.hhi > 0.25 ? "negative" : data.hhi > 0.15 ? "neutral" : "positive"}
        />
      </div>

      {/* ── Sector exposure + correlation ────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Sector bars */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Sector Exposure vs SPY</h2>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">
              Portfolio / <span className="text-gray-700">SPY</span>
            </span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {data.sectorExposure.map((row) => (
              <SectorBar
                key={row.sector}
                sector={row.sector}
                weight={row.weight}
                spyWeight={row.spyWeight}
                overUnder={row.overUnder}
              />
            ))}
          </div>
        </div>

        {/* Correlation matrix */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-200">
            Pairwise Correlation (252 days)
          </h2>
          {tickers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-14" />
                    {tickers.map((t) => (
                      <th
                        key={t}
                        className="px-0.5 py-1 text-center text-[9px] font-medium text-gray-500"
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickers.map((rowT, i) => (
                    <tr key={rowT}>
                      <td className="pr-2 text-right text-[9px] font-medium text-gray-500">{rowT}</td>
                      {tickers.map((_, j) => {
                        const v = matrix[i]?.[j] ?? 0;
                        return (
                          <td
                            key={j}
                            className={`h-7 w-7 min-w-7 rounded-sm text-center text-[8px] tabular-nums ${corrTextColor(v)}`}
                            style={{ backgroundColor: corrBg(v) }}
                            title={`${rowT}/${tickers[j]}: ${v.toFixed(2)}`}
                          >
                            {v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-600">No holdings to correlate.</p>
          )}
        </div>
      </div>

      {/* ── Drawdown chart ────────────────────────────────────────────────── */}
      {data.drawdownSeries.length > 1 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Portfolio Drawdown</h2>
            <span className="text-xs tabular-nums text-gray-500">
              Max {(maxDD * 100).toFixed(1)}%
              &nbsp;·&nbsp;
              {dateRange(data.drawdownSeries)}
            </span>
          </div>

          {/* Grid lines */}
          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-24 w-full"
            >
              {/* Zero line */}
              <line x1="0" y1="0" x2={W} y2="0" stroke="rgba(107,114,128,0.3)" strokeWidth="1" />

              {/* Area fill */}
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="rgba(239,68,68,0.25)" />
                  <stop offset="100%" stopColor="rgba(239,68,68,0.05)" />
                </linearGradient>
              </defs>
              <path
                d={drawdownAreaPath(data.drawdownSeries, maxDD)}
                fill="url(#ddGrad)"
              />
              {/* Line */}
              <path
                d={drawdownLinePath(data.drawdownSeries, maxDD)}
                fill="none"
                stroke="rgba(239,68,68,0.7)"
                strokeWidth="1.5"
              />
            </svg>

            {/* Y-axis labels (absolute positioned over SVG) */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-0.5 text-right">
              <span className="text-[9px] text-gray-600 pr-1">0%</span>
              <span className="text-[9px] text-gray-600 pr-1">
                {(maxDD * 50).toFixed(1)}%
              </span>
              <span className="text-[9px] text-gray-600 pr-1">
                {(maxDD * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Rolling beta chart ────────────────────────────────────────────── */}
      {data.rollingBeta.length > 1 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Rolling 60-Day Beta vs SPY</h2>
            <span className="text-xs tabular-nums text-gray-500">
              Current {data.beta !== null ? fmt2(data.beta) : "—"}
              &nbsp;·&nbsp;
              {dateRange(data.rollingBeta)}
            </span>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-24 w-full"
          >
            {/* Beta = 1 reference line */}
            <line
              x1="0"
              y1={betaOneY(data.rollingBeta).toFixed(2)}
              x2={W}
              y2={betaOneY(data.rollingBeta).toFixed(2)}
              stroke="rgba(107,114,128,0.4)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />

            {/* Rolling beta line */}
            <path
              d={betaLinePath(data.rollingBeta)}
              fill="none"
              stroke="rgba(99,102,241,0.8)"
              strokeWidth="1.5"
            />
          </svg>

          <div className="mt-1 flex items-center gap-2">
            <div className="h-px w-4 border-t border-gray-600 border-dashed" />
            <span className="text-[10px] text-gray-600">β = 1.0</span>
          </div>
        </div>
      )}

    </div>
  );
}
