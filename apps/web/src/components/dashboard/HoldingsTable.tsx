"use client";

import Link from "next/link";
import type { PositionWithMetrics } from "@pip/api";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUSD(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number, showSign = true) {
  const sign = showSign ? (n >= 0 ? "+" : "") : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtShares(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}

// ─── Asset class chip ─────────────────────────────────────────────────────────

function AssetChip({ type }: { type: string }) {
  const map: Record<string, string> = {
    equity:    "chip-equity",
    etf:       "chip-etf",
    bond:      "chip-bond",
    crypto:    "chip-crypto",
    commodity: "chip-commodity",
    cash:      "chip-cash",
  };
  const cls = map[type.toLowerCase()] ?? "chip-cash";
  return (
    <span className={`${cls} rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide`}>
      {type.toUpperCase()}
    </span>
  );
}

// ─── Weight bar ───────────────────────────────────────────────────────────────

function WeightBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] w-12 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-indigo-500/50"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="num text-xs text-slate-500">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

const COLS = [
  { label: "Security",     align: "left"  },
  { label: "Shares",       align: "right" },
  { label: "Avg Cost",     align: "right" },
  { label: "Price",        align: "right" },
  { label: "Mkt Value",    align: "right" },
  { label: "Unrealized",   align: "right" },
  { label: "Day",          align: "right" },
  { label: "Weight",       align: "right" },
];

export function HoldingsTable({ holdings }: { holdings: PositionWithMetrics[] }) {
  if (holdings.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: "#0D0F1A",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <p className="text-sm text-slate-500">
          No open positions.{" "}
          <span className="text-slate-400">Add a transaction to get started.</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "#0D0F1A",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <h2 className="text-[13px] font-semibold text-slate-200">Holdings</h2>
        <span className="overline">{holdings.length} positions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {COLS.map(({ label, align }) => (
                <th
                  key={label}
                  className={`overline px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} whitespace-nowrap`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {holdings.map((h, i) => {
              const isLast = i === holdings.length - 1;
              const dayUp  = h.dailyChangePct  >= 0;
              const pnlUp  = h.unrealizedPnl   >= 0;

              return (
                <tr
                  key={h.positionId}
                  className="group transition-colors duration-100"
                  style={
                    isLast
                      ? undefined
                      : { borderBottom: "1px solid rgba(255,255,255,0.04)" }
                  }
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.025)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  {/* Security */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/positions/${h.ticker}`}
                      className="block group/link"
                    >
                      <div className="flex items-center gap-2">
                        <span className="num text-[13px] font-semibold text-slate-100 group-hover/link:text-indigo-300 transition-colors">
                          {h.ticker}
                        </span>
                        <AssetChip type={h.assetClass} />
                      </div>
                      <p className="mt-0.5 max-w-[160px] truncate text-[11px] text-slate-600">
                        {h.name}
                      </p>
                    </Link>
                  </td>

                  {/* Shares */}
                  <td className="px-4 py-3 text-right">
                    <span className="num text-sm text-slate-400">
                      {fmtShares(h.shares)}
                    </span>
                  </td>

                  {/* Avg Cost */}
                  <td className="px-4 py-3 text-right">
                    <span className="num text-sm text-slate-500">
                      {fmtUSD(h.avgCostBasis)}
                    </span>
                  </td>

                  {/* Current Price */}
                  <td className="px-4 py-3 text-right">
                    <span className="num text-sm font-medium text-slate-200">
                      {fmtUSD(h.currentPrice)}
                    </span>
                  </td>

                  {/* Market Value */}
                  <td className="px-4 py-3 text-right">
                    <span className="num text-sm font-medium text-slate-200">
                      {fmtUSD(h.marketValue, 0)}
                    </span>
                  </td>

                  {/* Unrealized P&L */}
                  <td className="px-4 py-3 text-right">
                    <span className={`num block text-sm font-semibold ${pnlUp ? "text-gain" : "text-loss"}`}>
                      {h.unrealizedPnl >= 0 ? "+" : "−"}
                      {fmtUSD(Math.abs(h.unrealizedPnl), 0)}
                    </span>
                    <span className={`num text-[10px] ${pnlUp ? "text-gain/60" : "text-loss/60"}`}>
                      {fmtPct(h.unrealizedPnlPct)}
                    </span>
                  </td>

                  {/* Day change */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className="num inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        background: dayUp
                          ? "rgba(52,211,153,0.08)"
                          : "rgba(251,113,133,0.08)",
                        color: dayUp ? "#34D399" : "#FB7185",
                      }}
                    >
                      {fmtPct(h.dailyChangePct)}
                    </span>
                  </td>

                  {/* Weight */}
                  <td className="px-4 py-3 text-right">
                    <WeightBar pct={h.portfolioWeight} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
