import type { PortfolioSummary as SummaryDTO } from "@pip/api";
import { TrendingUp, TrendingDown } from "lucide-react";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUSD(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtDelta(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtUSD(Math.abs(n), 0)}`;
}

// ─── Sub-stat pill ────────────────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  value: string;
  sub?: string;
  signed?: boolean;
  positive?: boolean;
}

function StatPill({ label, value, sub, signed, positive }: StatPillProps) {
  const valueColor =
    signed === false || positive == null
      ? "text-slate-300"
      : positive
        ? "text-gain"
        : "text-loss";

  return (
    <div
      className="flex-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
      style={{
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p className="overline mb-1.5">{label}</p>
      <p className={`num text-sm font-semibold leading-none ${valueColor}`}>
        {value}
      </p>
      {sub && (
        <p className={`num mt-0.5 text-[10px] ${signed && positive != null ? (positive ? "text-gain/60" : "text-loss/60") : "text-slate-600"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function PortfolioSummary({ summary }: { summary: SummaryDTO }) {
  const {
    totalValue,
    dailyPnl,    dailyPnlPct,
    investedCapital, cashBalance, positionCount,
    unrealizedPnl,   unrealizedPnlPct,
    totalReturn,     totalReturnPct,
  } = summary;

  const up = dailyPnl >= 0;

  return (
    <div
      className="edge-glow halo relative rounded-2xl"
      style={{
        background: "linear-gradient(145deg, #0F1122 0%, #0C0E1A 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      <div className="relative z-10 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* ── Primary value block ── */}
          <div className="lg:col-span-3 space-y-4">
            <div>
              <p className="overline mb-2">Total Portfolio Value</p>

              {/* Big number + daily badge */}
              <div className="flex flex-wrap items-end gap-3">
                <span className="num text-4xl font-bold leading-none text-white sm:text-5xl">
                  {fmtUSD(totalValue, 0)}
                </span>

                <div
                  className="mb-1 flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{
                    background: up
                      ? "rgba(52,211,153,0.10)"
                      : "rgba(251,113,133,0.10)",
                    border: `1px solid ${up ? "rgba(52,211,153,0.2)" : "rgba(251,113,133,0.2)"}`,
                  }}
                >
                  {up
                    ? <TrendingUp  className="h-3.5 w-3.5 text-gain" />
                    : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                  <span className={`num text-sm font-semibold ${up ? "text-gain" : "text-loss"}`}>
                    {fmtDelta(dailyPnl)}
                  </span>
                  <span className={`text-xs ${up ? "text-gain/60" : "text-loss/60"}`}>
                    {fmtPct(dailyPnlPct)} today
                  </span>
                </div>
              </div>
            </div>

            {/* Stat pills row */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <StatPill
                label="Invested"
                value={fmtUSD(investedCapital, 0)}
                sub={`${positionCount} positions`}
                signed={false}
              />
              <StatPill
                label="Cash"
                value={fmtUSD(cashBalance, 0)}
                sub="available"
                signed={false}
              />
              <StatPill
                label="Unrealized P&L"
                value={fmtDelta(unrealizedPnl)}
                sub={fmtPct(unrealizedPnlPct)}
                signed
                positive={unrealizedPnl >= 0}
              />
              <StatPill
                label="Total Return"
                value={fmtDelta(totalReturn)}
                sub={fmtPct(totalReturnPct)}
                signed
                positive={totalReturn >= 0}
              />
            </div>
          </div>

          {/* ── Right: daily P&L context ── */}
          <div
            className="hidden lg:flex lg:col-span-2 flex-col justify-between rounded-xl p-4"
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <p className="overline">Daily Performance</p>

            <div className="space-y-3 mt-3">
              {[
                {
                  label: "Day P&L",
                  value: fmtDelta(dailyPnl),
                  sub: fmtPct(dailyPnlPct),
                  up,
                },
                {
                  label: "Unrealized",
                  value: fmtDelta(unrealizedPnl),
                  sub: fmtPct(unrealizedPnlPct),
                  up: unrealizedPnl >= 0,
                },
                {
                  label: "Total Return",
                  value: fmtDelta(totalReturn),
                  sub: fmtPct(totalReturnPct),
                  up: totalReturn >= 0,
                },
              ].map(({ label, value, sub, up: isUp }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <div className="text-right">
                    <span className={`num text-sm font-semibold ${isUp ? "text-gain" : "text-loss"}`}>
                      {value}
                    </span>
                    <span className={`num ml-2 text-xs ${isUp ? "text-gain/60" : "text-loss/60"}`}>
                      {sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar: invested vs cash */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Invested {((investedCapital / totalValue) * 100).toFixed(0)}%</span>
                <span>Cash {((cashBalance / totalValue) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-indigo-500/60"
                  style={{ width: `${(investedCapital / totalValue) * 100}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
