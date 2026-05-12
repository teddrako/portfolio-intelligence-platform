import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { getPriceSeriesFromDB } from "../services/prices";
import {
  computeBeta,
  computeRollingBeta,
  computeSectorExposure,
  computeHerfindahl,
  computeCorrelationMatrix,
  computeDrawdown,
  computePortfolioReturns,
  computeAnnualizedVol,
} from "../services/riskAnalytics";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface RiskMetricsDTO {
  beta:             number | null;
  annualizedVol:    number | null;
  maxDrawdown:      number;
  hhi:              number;
  daysOfHistory:    number;
  sectorExposure:   Array<{
    sector:      string;
    weight:      number;
    marketValue: number;
    spyWeight:   number;
    overUnder:   number;
  }>;
  rollingBeta:      Array<{ date: string; beta: number }>;
  drawdownSeries:   Array<{ date: string; drawdown: number; value: number }>;
  correlationMatrix: {
    tickers: string[];
    matrix:  number[][];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive daily returns from a chronological price series. */
function dailyReturns(series: Array<{ date: string; close: number }>): Array<{ date: string; return: number }> {
  const result: Array<{ date: string; return: number }> = [];
  for (let i = 1; i < series.length; i++) {
    const cur  = series[i]!;
    const prev = series[i - 1]!;
    if (prev.close > 0) {
      result.push({ date: cur.date, return: (cur.close - prev.close) / prev.close });
    }
  }
  return result;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const riskRouter = router({
  metrics: protectedProcedure
    .input(
      z.object({ lookbackDays: z.number().min(30).max(730).default(252) }).optional(),
    )
    .query(async ({ ctx, input }): Promise<RiskMetricsDTO | null> => {
      const lookbackDays = input?.lookbackDays ?? 252;

      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return null;

      const holdings = await getHoldings(portfolio.id);
      if (holdings.length === 0) return null;

      // ── Fetch price data ────────────────────────────────────────────────────
      const holdingTickers = [...new Set(holdings.map((h) => h.ticker))];
      const allTickers     = [...new Set([...holdingTickers, "SPY"])];

      // Fetch extra days as buffer for weekends / holidays so we hit the target
      const priceSeriesMap = await getPriceSeriesFromDB(allTickers, lookbackDays + 20);

      // If any holding or SPY is missing history, kick off background seeding.
      // This handles securities added before the auto-backfill was wired up.
      const thinTickers = allTickers.filter(
        (t) => (priceSeriesMap.get(t) ?? []).length < 30,
      );
      if (thinTickers.length > 0) {
        import("../services/marketData")
          .then(({ backfillPriceHistory }) =>
            Promise.all(thinTickers.map((t) => backfillPriceHistory(t))),
          )
          .catch((err) => console.warn("[risk] backfill failed:", err));
      }

      // ── Portfolio & benchmark return series ────────────────────────────────
      const portfolioReturns = computePortfolioReturns(
        holdings.map((h) => ({ ticker: h.ticker, shares: h.shares })),
        priceSeriesMap,
      );

      const spySeries  = priceSeriesMap.get("SPY") ?? [];
      const spyReturns = dailyReturns(spySeries);

      // ── Align portfolio and SPY by date (inner join) ───────────────────────
      const spyByDate  = new Map(spyReturns.map((r) => [r.date, r.return]));
      const aligned: Array<{ date: string; portfolio: number; spy: number }> = [];
      for (const { date, return: pRet } of portfolioReturns) {
        const bRet = spyByDate.get(date);
        if (bRet !== undefined) aligned.push({ date, portfolio: pRet, spy: bRet });
      }

      const alignedPortfolioReturns = aligned.map((a) => ({ date: a.date, return: a.portfolio }));
      const alignedSpyReturns       = aligned.map((a) => ({ date: a.date, return: a.spy }));

      // ── Scalar metrics ─────────────────────────────────────────────────────
      const pNums  = alignedPortfolioReturns.map((r) => r.return);
      const bNums  = alignedSpyReturns.map((r) => r.return);

      const beta          = pNums.length >= 10 ? computeBeta(pNums, bNums) : null;
      const annualizedVol = computeAnnualizedVol(pNums);

      // ── Rolling beta ───────────────────────────────────────────────────────
      const rollingBeta = computeRollingBeta(alignedPortfolioReturns, alignedSpyReturns, 60);

      // ── Drawdown ───────────────────────────────────────────────────────────
      const drawdownSeries = computeDrawdown(portfolioReturns);
      const maxDrawdown    = drawdownSeries.reduce(
        (min, d) => Math.min(min, d.drawdown),
        0,
      );

      // ── Sector exposure ────────────────────────────────────────────────────
      const sectorExposure = computeSectorExposure(
        holdings.map((h) => ({ sector: h.sector, marketValue: h.marketValue })),
      );

      // ── HHI ────────────────────────────────────────────────────────────────
      const weights = holdings.map((h) => h.portfolioWeight / 100);
      const hhi     = computeHerfindahl(weights);

      // ── Correlation matrix across individual holdings ─────────────────────
      // Find dates common to ALL holding price series
      const holdingReturnsByDate = holdingTickers.map((ticker) =>
        new Map(dailyReturns(priceSeriesMap.get(ticker) ?? []).map((r) => [r.date, r.return])),
      );
      const commonDates = (() => {
        if (holdingReturnsByDate.length === 0) return [] as string[];
        const candidateDates = [...(holdingReturnsByDate[0]?.keys() ?? [])];
        return candidateDates.filter((d) => holdingReturnsByDate.every((m) => m.has(d))).sort();
      })();

      const returnSeries  = holdingReturnsByDate.map((byDate) =>
        commonDates.map((d) => byDate.get(d) ?? 0),
      );
      const corrMatrix    = computeCorrelationMatrix(returnSeries);

      return {
        beta,
        annualizedVol,
        maxDrawdown,
        hhi,
        daysOfHistory:    portfolioReturns.length,
        sectorExposure,
        rollingBeta,
        drawdownSeries:   drawdownSeries.map(({ date, drawdown, value }) => ({ date, drawdown, value })),
        correlationMatrix: { tickers: holdingTickers, matrix: corrMatrix },
      };
    }),
});
