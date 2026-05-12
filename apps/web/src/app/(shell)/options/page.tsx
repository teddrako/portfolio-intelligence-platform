import { trpc } from "@/trpc/server";
import { OptionsChain } from "./components/OptionsChain";

export const metadata = { title: "Options — Portfolio Intelligence" };

export default async function OptionsPage() {
  const caller = await trpc();
  const tickers = await caller.options.holdingTickers();

  // Show a fallback set of tickers if user has no holdings
  const displayTickers =
    tickers.length > 0
      ? tickers
      : [
          { ticker: "SPY",  name: "SPDR S&P 500 ETF" },
          { ticker: "AAPL", name: "Apple Inc." },
          { ticker: "NVDA", name: "NVIDIA Corporation" },
        ];

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Options Chain</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Live options data · Black-Scholes Greeks
          </p>
        </div>
        <div className="text-[11px] text-gray-600">
          Greeks per share · ×100 per contract · 5-min cache
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <span className="mt-0.5 text-sm">✦</span>
        <p className="text-[12px] leading-relaxed text-indigo-300/80">
          Click any Bid/Ask cell to select a contract. Greeks are computed using Black-Scholes with
          implied volatility back-solved from the option midpoint. Theta is per calendar day, Vega
          per 1% IV move, Rho per 1% rate move. Green shading = in-the-money calls, red = ITM puts.
        </p>
      </div>

      <OptionsChain initialTickers={displayTickers} />
    </div>
  );
}
