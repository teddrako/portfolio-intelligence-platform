import Link from "next/link";
import { trpc } from "@/trpc/server";
import type { HoldingDTO, PortfolioSummaryDTO } from "@pip/api";
import { Sparkline } from "./components/Sparkline";
import { PortfolioChart } from "./components/PortfolioChart";

export const metadata = { title: "Holdings — Portfolio Intelligence" };

// ─── Formatting helpers ────────────────────────────────────────────────────────

function usd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function delta(n: number) {
  return `${n >= 0 ? "+" : ""}${usd(n)}`;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity:    "bg-blue-500/15 text-blue-400",
  etf:       "bg-purple-500/15 text-purple-400",
  bond:      "bg-yellow-500/15 text-yellow-400",
  crypto:    "bg-orange-500/15 text-orange-400",
  commodity: "bg-emerald-500/15 text-emerald-400",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const valueColor =
    positive === undefined
      ? "text-gray-100"
      : positive
        ? "text-green-400"
        : "text-red-400";
  const subColor =
    positive === undefined
      ? ""
      : positive
        ? "text-green-400/70"
        : "text-red-400/70";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className={`text-xs tabular-nums ${subColor}`}>{sub}</p>}
    </div>
  );
}

function SummaryRow({ summary }: { summary: PortfolioSummaryDTO }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <SummaryCard label="Portfolio Value"   value={usd(summary.totalValue)} />
      <SummaryCard label="Invested Capital"  value={usd(summary.investedCapital)} />
      <SummaryCard label="Cash"              value={usd(summary.cashBalance)} />
      <SummaryCard
        label="Daily P&L"
        value={delta(summary.dailyPnl)}
        sub={pct(summary.dailyPnlPct)}
        positive={summary.dailyPnl >= 0}
      />
      <SummaryCard
        label="Total P&L"
        value={delta(summary.unrealizedPnl)}
        sub={pct(summary.unrealizedPnlPct)}
        positive={summary.unrealizedPnl >= 0}
      />
    </div>
  );
}

function HoldingRow({ h }: { h: HoldingDTO }) {
  const closes = h.priceHistory.map((b) => b.close);
  const sparkPositive =
    closes.length >= 2
      ? (closes.at(-1) ?? 0) >= (closes[0] ?? 0)
      : h.unrealizedPnl >= 0;

  return (
    <tr className="hover:bg-gray-800/40 transition-colors">
      {/* Security */}
      <td className="px-4 py-3">
        <Link href={`/positions/${h.ticker}`} className="group flex items-start gap-2">
          <div>
            <p className="font-medium text-gray-100 transition-colors group-hover:text-blue-400">
              {h.ticker}
            </p>
            <p className="line-clamp-1 max-w-[140px] text-xs text-gray-500">{h.name}</p>
            <span
              className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                ASSET_CLASS_COLORS[h.assetClass] ?? "bg-gray-700 text-gray-300"
              }`}
            >
              {h.assetClass}
            </span>
          </div>
        </Link>
      </td>

      {/* Shares */}
      <td className="px-4 py-3 tabular-nums text-gray-300">
        {h.shares % 1 === 0 ? h.shares.toLocaleString() : h.shares.toFixed(4)}
      </td>

      {/* Avg cost */}
      <td className="px-4 py-3 tabular-nums text-gray-300">{usd(h.avgCostBasis)}</td>

      {/* Current price + day change */}
      <td className="px-4 py-3 tabular-nums">
        <p className="text-gray-100">{usd(h.currentPrice)}</p>
        <p className={`text-xs ${h.dailyChangePct >= 0 ? "text-green-400" : "text-red-400"}`}>
          {pct(h.dailyChangePct)}
        </p>
      </td>

      {/* Market value */}
      <td className="px-4 py-3 font-medium tabular-nums text-gray-100">{usd(h.marketValue)}</td>

      {/* Invested capital */}
      <td className="px-4 py-3 tabular-nums text-gray-400">{usd(h.totalCost)}</td>

      {/* Unrealized P&L */}
      <td className="px-4 py-3 tabular-nums">
        <p className={h.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>
          {delta(h.unrealizedPnl)}
        </p>
        <p
          className={`text-xs ${
            h.unrealizedPnlPct >= 0 ? "text-green-400/70" : "text-red-400/70"
          }`}
        >
          {pct(h.unrealizedPnlPct)}
        </p>
      </td>

      {/* Day P&L */}
      <td className="px-4 py-3 tabular-nums">
        <p className={h.dailyPnl >= 0 ? "text-green-400" : "text-red-400"}>
          {delta(h.dailyPnl)}
        </p>
      </td>

      {/* Portfolio weight */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.min(100, h.portfolioWeight)}%` }}
            />
          </div>
          <span className="tabular-nums text-xs text-gray-400">
            {h.portfolioWeight.toFixed(1)}%
          </span>
        </div>
      </td>

      {/* 30-day sparkline */}
      <td className="px-4 py-3">
        <Sparkline data={closes} positive={sparkPositive} />
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HoldingsPage() {
  const caller = await trpc();
  const { holdings, portfolioHistory, summary } =
    await caller.portfolio.holdingsWithHistory();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Holdings</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {holdings.length} open position{holdings.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary stat cards */}
      {summary && <SummaryRow summary={summary} />}

      {/* Portfolio performance chart */}
      {portfolioHistory.length >= 2 && (
        <PortfolioChart history={portfolioHistory} />
      )}

      {/* Empty state */}
      {holdings.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20 text-center">
          <p className="text-gray-400">No open positions yet.</p>
          <p className="mt-1 text-sm text-gray-600">Add your first trade from the Dashboard.</p>
        </div>
      )}

      {/* Holdings table */}
      {holdings.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    "Security", "Shares", "Avg Cost",
                    "Price", "Mkt Value", "Invested",
                    "Unreal. P&L", "Day P&L", "Weight", "30d",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {holdings.map((h) => (
                  <HoldingRow key={h.positionId} h={h} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3 text-xs text-gray-500">
            <span>
              Invested: {usd(holdings.reduce((s, h) => s + h.totalCost, 0))}
            </span>
            {summary && (
              <span className={summary.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>
                Total return: {delta(summary.unrealizedPnl)} ({pct(summary.unrealizedPnlPct)})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
