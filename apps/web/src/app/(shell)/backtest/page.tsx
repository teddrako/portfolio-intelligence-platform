import { trpc } from "@/trpc/server";
import { BacktestRunner } from "./components/BacktestRunner";

export const metadata = { title: "Backtesting — Portfolio Intelligence" };

export default async function BacktestPage() {
  const caller = await trpc();
  const tickers = await caller.backtest.availableTickers();

  // Fallback tickers when user has no holdings
  const displayTickers =
    tickers.length > 0
      ? tickers
      : ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"];

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Backtesting</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Simulate strategies on your holdings using historical price data
          </p>
        </div>
        <div className="text-[11px] text-gray-600">
          Long-only · Zero commission · Daily close prices
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <span className="mt-0.5 text-sm">✦</span>
        <p className="text-[12px] leading-relaxed text-indigo-300/80">
          4 strategies: Buy & Hold (baseline), SMA Crossover (trend-following), Momentum Rotation
          (top-N performers), Mean Reversion (dip-buying). All metrics are annualised.
          Sharpe uses 0% risk-free rate. SPY buy-and-hold is shown as the benchmark.
          Results depend on price history in the database — run the seed script if charts are empty.
        </p>
      </div>

      <BacktestRunner availableTickers={displayTickers} />
    </div>
  );
}
