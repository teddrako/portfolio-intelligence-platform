import { trpc } from "@/trpc/server";
import { ValuationCalculator } from "./components/ValuationCalculator";

export const metadata = { title: "Valuation — Portfolio Intelligence" };

export default async function ValuationPage() {
  const caller = await trpc();

  const [summary] = await Promise.all([
    caller.valuation.compareToPortfolio(),
  ]);

  const hasFmpKey = Boolean(process.env.FMP_API_KEY);

  if (summary.length === 0) {
    return (
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">DCF Valuation</h1>
          <p className="mt-0.5 text-sm text-gray-500">Intrinsic value analysis for your holdings</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20 text-center">
          <p className="text-gray-400">No holdings found.</p>
          <p className="mt-1 text-sm text-gray-600">Add positions to your portfolio to run valuations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">DCF Valuation</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Intrinsic value analysis · {summary.length} holding{summary.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`rounded px-1.5 py-0.5 font-semibold ${
              hasFmpKey
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {hasFmpKey ? "FMP connected" : "FMP key missing"}
          </span>
          <span className="text-gray-600">FCFF model · Gordon Growth terminal value</span>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <span className="mt-0.5 text-sm">✦</span>
        <p className="text-[12px] leading-relaxed text-indigo-300/80">
          Uses FCFF = EBIT × (1 − τ) + D&A − CapEx. Assumptions are pre-populated from historical
          data — adjust the sliders to explore different scenarios. Sensitivity grid shows intrinsic
          value across WACC and terminal growth combinations.
        </p>
      </div>

      <ValuationCalculator initialSummary={summary} hasFmpKey={hasFmpKey} />
    </div>
  );
}
