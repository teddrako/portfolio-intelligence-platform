import { Card, CardHeader, CardTitle } from "@pip/ui";
import type { RecentTransaction } from "@pip/api";
import Link from "next/link";

const TYPE_COLORS: Record<string, string> = {
  buy:        "bg-blue-500/15 text-blue-400",
  sell:       "bg-amber-500/15 text-amber-400",
  deposit:    "bg-emerald-500/15 text-emerald-400",
  withdrawal: "bg-red-500/15 text-red-400",
  dividend:   "bg-purple-500/15 text-purple-400",
  interest:   "bg-cyan-500/15 text-cyan-400",
  fee:        "bg-gray-500/15 text-gray-400",
  transfer:   "bg-gray-500/15 text-gray-400",
  split:      "bg-indigo-500/15 text-indigo-400",
};

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(n);
}

function fmtUSD(n: number) {
  return fmt(n, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TxnTypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? "bg-gray-500/15 text-gray-400";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  );
}

export function RecentTransactions({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <p className="py-6 text-center text-sm text-gray-500">No transactions yet.</p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle>Recent Transactions</CardTitle>
        <Link href="/transactions" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          View all
        </Link>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["Date", "Type", "Security", "Shares", "Price", "Amount", "Fees"].map((h) => (
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
              const amount = Number(t.amount);
              const fees = Number(t.fees);
              const isCash = t.type === "deposit" || t.type === "withdrawal";

              return (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-gray-400 whitespace-nowrap">
                    {fmtDate(t.date)}
                  </td>
                  <td className="px-4 py-3">
                    <TxnTypeBadge type={t.type} />
                  </td>
                  <td className="px-4 py-3">
                    {t.ticker ? (
                      <Link
                        href={`/positions/${t.ticker}`}
                        className="font-medium text-gray-200 hover:text-blue-400 transition-colors"
                      >
                        {t.ticker}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                    {t.securityName && (
                      <div className="text-xs text-gray-500 mt-0.5 max-w-[160px] truncate">
                        {t.securityName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-300">
                    {t.shares ? fmt(Number(t.shares), { maximumFractionDigits: 4 }) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-300">
                    {t.pricePerShare ? fmtUSD(Number(t.pricePerShare)) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-gray-100">
                    {isCash ? (
                      <span className={t.type === "deposit" ? "text-emerald-400" : "text-red-400"}>
                        {t.type === "deposit" ? "+" : "-"}{fmtUSD(amount)}
                      </span>
                    ) : (
                      fmtUSD(amount)
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-500">
                    {fees > 0 ? fmtUSD(fees) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
