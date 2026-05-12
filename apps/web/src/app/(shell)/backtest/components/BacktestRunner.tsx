"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { BacktestResultDTO } from "@pip/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number, decimals = 2): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function metricColor(n: number, invert = false): string {
  const pos = invert ? n < 0 : n > 0;
  const neg = invert ? n > 0 : n < 0;
  if (pos) return "text-emerald-400";
  if (neg) return "text-red-400";
  return "text-gray-300";
}

// ─── Equity curve SVG ─────────────────────────────────────────────────────────

function EquityCurve({
  result,
  showBenchmark,
}: {
  result:        BacktestResultDTO;
  showBenchmark: boolean;
}) {
  const { equity } = result;
  if (equity.length < 2) return null;

  const W = 900;
  const H = 200;
  const PAD = { l: 56, r: 16, t: 16, b: 32 };

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const pvs = equity.map((e) => e.portfolioValue);
  const bvs = equity.map((e) => e.benchmarkValue);
  const allValues = showBenchmark ? [...pvs, ...bvs] : pvs;

  const minV = Math.min(...allValues) * 0.98;
  const maxV = Math.max(...allValues) * 1.02;
  const rangeV = maxV - minV || 1;

  const toX = (i: number) => PAD.l + (i / (equity.length - 1)) * innerW;
  const toY = (v: number) => PAD.t + ((maxV - v) / rangeV) * innerH;

  const pLine  = equity.map((e, i) => `${toX(i)},${toY(e.portfolioValue)}`).join(" ");
  const bLine  = equity.map((e, i) => `${toX(i)},${toY(e.benchmarkValue)}`).join(" ");

  // Area fill for portfolio
  const first = equity[0]!;
  const last  = equity[equity.length - 1]!;
  const n     = equity.length - 1;
  const pArea = `${PAD.l},${PAD.t + innerH} ${pLine} ${toX(n)},${PAD.t + innerH}`;

  // Y-axis ticks
  const yTicks = [minV, (minV + maxV) / 2, maxV];

  // X-axis date labels — sample ~6 evenly spaced dates
  const labelIndices = [0, Math.floor(n * 0.2), Math.floor(n * 0.4), Math.floor(n * 0.6), Math.floor(n * 0.8), n];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {/* Grid lines */}
      {yTicks.map((v) => (
        <line key={v} x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
          stroke="rgba(100,116,139,0.15)" strokeWidth="0.8" />
      ))}

      {/* Portfolio area */}
      <polygon points={pArea} fill="rgba(99,102,241,0.08)" />

      {/* Benchmark line */}
      {showBenchmark && (
        <polyline points={bLine} fill="none" stroke="rgba(100,116,139,0.5)"
          strokeWidth="1" strokeDasharray="4,3" strokeLinejoin="round" />
      )}

      {/* Portfolio line */}
      <polyline points={pLine} fill="none" stroke="rgba(129,140,248,0.9)"
        strokeWidth="1.8" strokeLinejoin="round" />

      {/* Y-axis labels */}
      {yTicks.map((v) => (
        <text key={v} x={PAD.l - 4} y={toY(v) + 3} textAnchor="end"
          fill="rgba(100,116,139,0.8)" fontSize="8">
          ${(v / 1000).toFixed(0)}K
        </text>
      ))}

      {/* X-axis labels */}
      {labelIndices.map((idx) => {
        const date = equity[idx]?.date ?? "";
        const x    = toX(idx);
        return (
          <text key={idx} x={x} y={H - 4} textAnchor="middle"
            fill="rgba(100,116,139,0.7)" fontSize="7">
            {date.slice(0, 7)}
          </text>
        );
      })}

      {/* Start / end value labels */}
      <text x={PAD.l + 4} y={toY(first.portfolioValue) - 3}
        fill="rgba(165,180,252,0.6)" fontSize="7">
        ${first.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </text>
      <text x={toX(n) - 4} y={toY(last.portfolioValue) - 3} textAnchor="end"
        fill="rgba(165,180,252,0.9)" fontSize="8" fontWeight="600">
        ${last.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </text>

      {/* Benchmark end label */}
      {showBenchmark && (
        <text x={toX(n) - 4} y={toY(last.benchmarkValue) + 10} textAnchor="end"
          fill="rgba(100,116,139,0.7)" fontSize="7">
          SPY ${last.benchmarkValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
      )}
    </svg>
  );
}

// ─── Metrics grid ─────────────────────────────────────────────────────────────

function MetricsGrid({ result }: { result: BacktestResultDTO }) {
  const m = result.metrics;

  const cells = [
    { label: "Total Return",    value: fmtPct(m.totalReturn),    color: metricColor(m.totalReturn) },
    { label: "CAGR",            value: fmtPct(m.cagr),           color: metricColor(m.cagr) },
    { label: "Benchmark Return",value: fmtPct(m.benchmarkReturn), color: metricColor(m.benchmarkReturn) },
    { label: "Alpha",           value: fmtPct(m.alpha),          color: metricColor(m.alpha) },
    { label: "Sharpe",          value: fmtNum(m.sharpe),         color: m.sharpe > 1 ? "text-emerald-400" : m.sharpe > 0 ? "text-gray-300" : "text-red-400" },
    { label: "Sortino",         value: fmtNum(m.sortino),        color: m.sortino > 1 ? "text-emerald-400" : m.sortino > 0 ? "text-gray-300" : "text-red-400" },
    { label: "Max Drawdown",    value: fmtPct(m.maxDrawdown),    color: metricColor(m.maxDrawdown, true) },
    { label: "Calmar",          value: fmtNum(m.calmar),         color: m.calmar > 0.5 ? "text-emerald-400" : "text-gray-300" },
    { label: "Volatility (ann)", value: fmtPct(m.volatility),   color: "text-gray-400" },
    { label: "Win Rate",        value: fmtPct(m.winRate),        color: metricColor(m.winRate - 0.5) },
    { label: "# Trades",        value: String(m.numTrades),      color: "text-gray-300" },
    { label: "Avg Trade P&L",   value: fmtPct(m.avgTradePnlPct),color: metricColor(m.avgTradePnlPct) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cells.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-[10px] text-gray-600">{label}</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Trade log ────────────────────────────────────────────────────────────────

function TradeLog({ trades }: { trades: BacktestResultDTO["trades"] }) {
  const [open, setOpen] = useState(false);
  if (trades.length === 0) return null;

  const recent = trades.slice(-50).reverse(); // last 50 trades, newest first

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold text-gray-400">Trade Log</span>
        <span className="text-[11px] text-gray-600">
          {trades.length} trades · showing last {Math.min(50, trades.length)} {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-gray-800">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-800 text-gray-600">
                {["Date", "Ticker", "Action", "Shares", "Price", "Value"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((t, i) => (
                <tr key={i} className="border-b border-gray-800/40">
                  <td className="px-3 py-1.5 text-gray-500">{t.date}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-400">{t.ticker}</td>
                  <td className={`px-3 py-1.5 font-medium ${t.action === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                    {t.action.toUpperCase()}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-400">{t.shares}</td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-400">${t.price.toFixed(2)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-300">${t.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Strategy config panels ───────────────────────────────────────────────────

type Strategy = "buy_hold" | "sma_cross" | "momentum" | "mean_reversion";

const STRATEGIES: { id: Strategy; label: string; description: string }[] = [
  { id: "buy_hold",       label: "Buy & Hold",       description: "Equal-weight allocation on day 1, never trade." },
  { id: "sma_cross",      label: "SMA Crossover",    description: "Buy on golden cross (fast > slow SMA), sell on death cross." },
  { id: "momentum",       label: "Momentum Rotation",description: "Monthly rebalance into top-N tickers by recent return." },
  { id: "mean_reversion", label: "Mean Reversion",   description: "Buy dips below N-day SMA, exit on recovery." },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function BacktestRunner({ availableTickers }: { availableTickers: string[] }) {
  const trpc = useTRPC();

  const [strategy,       setStrategy]       = useState<Strategy>("buy_hold");
  const [selectedTickers,setSelectedTickers]= useState<string[]>(availableTickers.slice(0, 5));
  const [lookbackDays,   setLookbackDays]   = useState(365);
  const [initialCapital, setInitialCapital] = useState(100_000);
  const [showBenchmark,  setShowBenchmark]  = useState(true);
  const [showTradeLog,   setShowTradeLog]   = useState(false);

  // Strategy-specific params
  const [fastSma,           setFastSma]           = useState(20);
  const [slowSma,           setSlowSma]           = useState(50);
  const [momentumLookback,  setMomentumLookback]  = useState(63);
  const [topN,              setTopN]              = useState(3);
  const [rebalanceFreq,     setRebalanceFreq]     = useState<"weekly" | "monthly">("monthly");
  const [smaPeriod,         setSmaPeriod]         = useState(20);
  const [entryThreshold,    setEntryThreshold]    = useState(0.05);
  const [exitThreshold,     setExitThreshold]     = useState(0.02);

  // Build input for tRPC
  const baseInput = { tickers: selectedTickers, lookbackDays, initialCapital };
  const stratInput = (() => {
    switch (strategy) {
      case "buy_hold":       return { strategy: "buy_hold" as const, ...baseInput };
      case "sma_cross":      return { strategy: "sma_cross" as const, ...baseInput, fastSma, slowSma };
      case "momentum":       return { strategy: "momentum" as const,  ...baseInput, momentumLookback, topN, rebalanceFreq };
      case "mean_reversion": return { strategy: "mean_reversion" as const, ...baseInput, smaPeriod, entryThreshold, exitThreshold };
    }
  })();

  const { data: result, isLoading, error } = useQuery(
    trpc.backtest.run.queryOptions(stratInput, { enabled: selectedTickers.length > 0 }),
  );

  const toggleTicker = (t: string) =>
    setSelectedTickers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const stratInfo = STRATEGIES.find((s) => s.id === strategy)!;

  return (
    <div className="space-y-5">
      {/* Config panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Left: strategy + tickers */}
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
          {/* Strategy tabs */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600">Strategy</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {STRATEGIES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStrategy(id)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-medium text-left transition-colors ${
                    strategy === id
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-gray-800 text-gray-500 border border-transparent hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-600">{stratInfo.description}</p>
          </div>

          {/* Ticker multi-select */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Tickers ({selectedTickers.length} selected)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTicker(t)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    selectedTickers.includes(t)
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-gray-800 text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: parameters */}
        <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Parameters</p>

          {/* Universal */}
          <label className="block space-y-1">
            <span className="text-[11px] text-gray-500">Lookback period</span>
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            >
              {[{ v: 90, l: "3 months" }, { v: 180, l: "6 months" }, { v: 252, l: "1 year" },
                { v: 365, l: "~1 year" }, { v: 504, l: "2 years" }, { v: 730, l: "~2 years" }].map(({ v, l }) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] text-gray-500">Initial capital</span>
            <select
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            >
              {[10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000].map((v) => (
                <option key={v} value={v}>${v.toLocaleString()}</option>
              ))}
            </select>
          </label>

          {/* Strategy-specific */}
          {strategy === "sma_cross" && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Fast SMA</span>
                <input type="number" min={5} max={50} value={fastSma}
                  onChange={(e) => setFastSma(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Slow SMA</span>
                <input type="number" min={20} max={200} value={slowSma}
                  onChange={(e) => setSlowSma(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </label>
            </>
          )}

          {strategy === "momentum" && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Momentum lookback (days)</span>
                <input type="number" min={10} max={252} value={momentumLookback}
                  onChange={(e) => setMomentumLookback(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Top N holdings</span>
                <input type="number" min={1} max={10} value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Rebalance frequency</span>
                <select value={rebalanceFreq} onChange={(e) => setRebalanceFreq(e.target.value as "weekly" | "monthly")}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            </>
          )}

          {strategy === "mean_reversion" && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">SMA period</span>
                <input type="number" min={5} max={100} value={smaPeriod}
                  onChange={(e) => setSmaPeriod(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Entry threshold ({(entryThreshold * 100).toFixed(0)}% below SMA)</span>
                <input type="range" min={0.01} max={0.3} step={0.01} value={entryThreshold}
                  onChange={(e) => setEntryThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-indigo-400" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-gray-500">Exit threshold ({(exitThreshold * 100).toFixed(0)}% above SMA)</span>
                <input type="range" min={0.005} max={0.2} step={0.005} value={exitThreshold}
                  onChange={(e) => setExitThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-indigo-400" />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-400" />
          Running backtest…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {String(error)}
        </div>
      )}

      {result && result.equity.length === 0 && !isLoading && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-[12px] text-yellow-300/80">
          Not enough price history to run this backtest. The selected tickers need at least{" "}
          {lookbackDays} days of data in the database.
          {result.dataGaps.length > 0 && (
            <> Missing data: {result.dataGaps.join(", ")}.</>
          )}
        </div>
      )}

      {result && result.equity.length > 1 && (
        <div className="space-y-4">
          {/* Chart */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-gray-400">Equity Curve</h3>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {result.startDate} → {result.endDate} · {result.metrics.daysSimulated} trading days
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBenchmark}
                  onChange={(e) => setShowBenchmark(e.target.checked)}
                  className="accent-indigo-400"
                />
                Show SPY benchmark
              </label>
            </div>
            {/* Legend */}
            <div className="mb-2 flex gap-4 text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 bg-indigo-400 rounded" />
                <span className="text-indigo-300">{stratInfo.label}</span>
              </span>
              {showBenchmark && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 border-t border-gray-500 border-dashed" />
                  <span className="text-gray-500">SPY Buy & Hold</span>
                </span>
              )}
            </div>
            <EquityCurve result={result} showBenchmark={showBenchmark} />
          </div>

          {/* Metrics */}
          <MetricsGrid result={result} />

          {/* Data gaps warning */}
          {result.dataGaps.length > 0 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-[11px] text-yellow-300/80">
              Thin data (excluded from simulation): {result.dataGaps.join(", ")}
            </div>
          )}

          {/* Trade log */}
          <TradeLog trades={result.trades} />
        </div>
      )}
    </div>
  );
}
