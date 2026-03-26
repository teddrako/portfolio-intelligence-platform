import { trpc } from "@/trpc/server";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { notFound } from "next/navigation";

export const metadata = { title: "Transactions — Portfolio Intelligence" };

export default async function TransactionsPage() {
  const caller = await trpc();
  const summary = await caller.portfolio.summary();
  if (!summary) notFound();

  const transactions = await caller.portfolio.transactions({ limit: 200 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Transactions</h1>
        <p className="mt-0.5 text-sm text-gray-500">{summary.portfolioName}</p>
      </div>
      <RecentTransactions transactions={transactions} />
    </div>
  );
}
