import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/trpc/server";
import { Card, CardHeader, CardTitle, Badge } from "@pip/ui";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} Position — Portfolio Intelligence` };
}

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

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_COLORS: Record<string, string> = {
  buy:  "bg-blue-500/15 text-blue-400",
  sell: "bg-amber-500/15 text-amber-400",
};

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const caller = await trpc();

  let data;
  try {
    data = await caller.portfolio.positionDetail({ ticker: ticker.toUpperCase() });
  } catch {
    notFound();
  }

  const { position: p, transactions } = data;
  const pnlPositive = p.unrealizedPnl >= 0;
  const dailyPositive = p.dailyPnl >= 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Back nav */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Position header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-100">{p.ticker}</h1>
            <Badge variant="default">{p.assetClass.toUpperCase()}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-gray-400">{p.name}</p>
          {p.sector && <p className="text-xs text-gray-600 mt-0.5">{p.sector}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-gray-100">
            {fmtUSD(p.currentPrice)}
          </p>
          <p className={`text-sm tabular-nums ${dailyPositive ? "text-emerald-400" : "text-red-400"}`}>
            {fmtPct(p.dailyChangePct)} today
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Shares Held</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-100">
            {fmt(p.shares, { maximumFractionDigits: 4 })}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Avg Cost</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-100">
            {fmtUSD(p.avgCostBasis)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Market Value</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-100">
            {fmtUSD(p.marketValue, 0)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Cost basis: {fmtUSD(p.totalCost, 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Unrealized P&L</p>
          <p className={`mt-1.5 text-xl font-semibold tabular-nums ${pnlPositive ? "text-emerald-400" : "text-red-400"}`}>
            {p.unrealizedPnl >= 0 ? "+" : ""}{fmtUSD(p.unrealizedPnl, 0)}
          </p>
          <p className={`mt-0.5 text-sm tabular-nums ${pnlPositive ? "text-emerald-500" : "text-red-500"}`}>
            {fmtPct(p.unrealizedPnlPct)}
          </p>
        </Card>
      </div>

      {/* Transaction history */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4">
          <CardTitle>Transaction History</CardTitle>
          <span className="text-xs text-gray-500">{transactions.length} trades</span>
        </CardHeader>

        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No transactions recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Date", "Type", "Shares", "Price / Share", "Amount", "Fees", "Notes"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {transactions.map((t) => {
                  const cls = TYPE_COLORS[t.type] ?? "bg-gray-500/15 text-gray-400";
                  return (
                    <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-gray-400 whitespace-nowrap">
                        {fmtDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-300">
                        {t.shares ? fmt(Number(t.shares), { maximumFractionDigits: 4 }) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-300">
                        {t.pricePerShare ? fmtUSD(Number(t.pricePerShare)) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-100 font-medium">
                        {fmtUSD(Number(t.amount))}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-500">
                        {Number(t.fees) > 0 ? fmtUSD(Number(t.fees)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                        {t.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
