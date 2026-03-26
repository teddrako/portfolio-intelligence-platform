import { trpc } from "@/trpc/server";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { EmptyPortfolio } from "@/components/dashboard/EmptyPortfolio";
import { AddTransactionButton } from "@/components/transactions/AddTransactionButton";

export const metadata = { title: "Dashboard — Portfolio Intelligence" };

export default async function DashboardPage() {
  const caller = await trpc();
  const [summary, holdings, recentTxns, news] = await Promise.all([
    caller.portfolio.summary(),
    caller.portfolio.holdings(),
    caller.portfolio.transactions({ limit: 8 }),
    caller.news.list({ limit: 8 }),
  ]);

  if (!summary) return <EmptyPortfolio />;

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });

  return (
    <div className="space-y-5 p-5 sm:p-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">
            {summary.portfolioName}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">{dateStr}</p>
        </div>
        <AddTransactionButton portfolioId={summary.portfolioId} />
      </div>

      {/* ── Hero: portfolio value + metrics ── */}
      <PortfolioSummary summary={summary} />

      {/* ── Main bento row: holdings + news ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Holdings takes 3/5 */}
        <div className="xl:col-span-3">
          <HoldingsTable holdings={holdings} />
        </div>
        {/* Intelligence stream takes 2/5 */}
        <div className="xl:col-span-2">
          <NewsFeed news={news} />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <RecentTransactions transactions={recentTxns} />
    </div>
  );
}
