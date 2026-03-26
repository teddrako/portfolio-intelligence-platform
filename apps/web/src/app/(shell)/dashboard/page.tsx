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
    caller.portfolio.transactions({ limit: 10 }),
    caller.news.list({ limit: 6 }),
  ]);

  if (!summary) {
    return <EmptyPortfolio />;
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">{summary.portfolioName}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{dateStr}</p>
        </div>
        <AddTransactionButton portfolioId={summary.portfolioId} />
      </div>

      {/* Summary stats */}
      <PortfolioSummary summary={summary} />

      {/* Holdings + news row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HoldingsTable holdings={holdings} />
        </div>
        <div>
          <NewsFeed news={news} />
        </div>
      </div>

      {/* Recent transactions */}
      <RecentTransactions transactions={recentTxns} />
    </div>
  );
}
