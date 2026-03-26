import Link from "next/link";
import { Badge, Card, CardHeader, CardTitle } from "@pip/ui";
import type { PositionWithMetrics } from "@pip/api";

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(n);
}

function fmtUSD(n: number, decimals = 2) {
  return fmt(n, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function HoldingsTable({ holdings }: { holdings: PositionWithMetrics[] }) {
  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <p className="py-8 text-center text-sm text-gray-500">
          No open positions. Use the Add Transaction button to record your first buy.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4">
        <CardTitle>Holdings</CardTitle>
        <span className="text-xs text-gray-500">{holdings.length} positions</span>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["Security", "Shares", "Avg Cost", "Price", "Market Value", "P&L", "Day", "Weight"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {holdings.map((h) => (
              <tr key={h.positionId} className="group hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/positions/${h.ticker}`} className="block">
                    <div>
                      <span className="font-medium text-gray-100 group-hover:text-blue-400 transition-colors">
                        {h.ticker}
                      </span>
                      <Badge variant="default" className="ml-2 text-[10px]">
                        {h.assetClass.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{h.name}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-300">
                  {fmt(h.shares, { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-300">{fmtUSD(h.avgCostBasis)}</td>
                <td className="px-4 py-3 tabular-nums text-gray-100 font-medium">
                  {fmtUSD(h.currentPrice)}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-100">{fmtUSD(h.marketValue, 0)}</td>
                <td className="px-4 py-3 tabular-nums">
                  <div className={h.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {h.unrealizedPnl >= 0 ? "+" : ""}
                    {fmtUSD(h.unrealizedPnl, 0)}
                  </div>
                  <div
                    className={`text-xs ${h.unrealizedPnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {fmtPct(h.unrealizedPnlPct)}
                  </div>
                </td>
                <td
                  className={`px-4 py-3 tabular-nums text-sm ${h.dailyChangePct >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {fmtPct(h.dailyChangePct)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-gray-800 max-w-16">
                      <div
                        className="h-1 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(h.portfolioWeight, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-gray-400">
                      {fmt(h.portfolioWeight, { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
