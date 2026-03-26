import { Card } from "@pip/ui";
import type { PortfolioSummary as Summary } from "@pip/api";

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(n);
}

function fmtUSD(n: number) {
  return fmt(n, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function fmtDelta(n: number) {
  return `${n >= 0 ? "+" : ""}${fmtUSD(n)}`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
}

function StatCard({ label, value, sub, positive }: StatCardProps) {
  const subColor =
    positive === null || positive === undefined
      ? "text-gray-400"
      : positive
        ? "text-emerald-400"
        : "text-red-400";

  return (
    <Card>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-100">{value}</p>
      {sub && <p className={`mt-0.5 text-sm tabular-nums ${subColor}`}>{sub}</p>}
    </Card>
  );
}

export function PortfolioSummary({ summary }: { summary: Summary }) {
  const {
    totalValue,
    investedCapital,
    cashBalance,
    unrealizedPnl,
    unrealizedPnlPct,
    dailyPnl,
    dailyPnlPct,
    totalReturn,
    totalReturnPct,
    positionCount,
  } = summary;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total Value" value={fmtUSD(totalValue)} />
      <StatCard label="Invested" value={fmtUSD(investedCapital)} sub={`${positionCount} positions`} />
      <StatCard label="Cash" value={fmtUSD(cashBalance)} />
      <StatCard
        label="Unrealized P&L"
        value={fmtDelta(unrealizedPnl)}
        sub={fmtPct(unrealizedPnlPct)}
        positive={unrealizedPnl >= 0}
      />
      <StatCard
        label="Today's P&L"
        value={fmtDelta(dailyPnl)}
        sub={fmtPct(dailyPnlPct)}
        positive={dailyPnl >= 0}
      />
      <StatCard
        label="All-Time Return"
        value={fmtDelta(totalReturn)}
        sub={fmtPct(totalReturnPct)}
        positive={totalReturn >= 0}
      />
    </div>
  );
}
